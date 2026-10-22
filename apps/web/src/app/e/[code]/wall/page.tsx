'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Heart, Pause, Play, ScanLine } from 'lucide-react';
import { Badge, Button, Mark, cn, plural } from '@foto/ui';
import { useWall } from '@foto/api';
import { QrCode } from '@/components/qr-code';

/**
 * The wall.
 *
 * A projector, a TV, or a laptop under one: the screen with nobody at it. It polls
 * every five seconds and does one job — put the newest photos of the evening in
 * front of the room, slowly enough to look at.
 *
 * Three decisions worth knowing about:
 *
 * - **It cycles rather than stacking.** New photos join the queue at the front; the
 *   screen never restarts mid-photo, because a wall that jumps back to the first
 *   frame every time somebody shoots is a wall nobody looks at.
 * - **It holds a paused frame.** Somebody reading a caption out loud is a thing
 *   that happens; space pauses and resumes.
 * - **It has the code on it.** The wall is the best possible advert for the code —
 *   the people looking at it are the people who have not joined yet.
 */
export default function WallPage({ params }: { params: { code: string } }) {
  const code = params.code.toUpperCase();
  const wall = useWall(code);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const photos = useMemo(() => wall.data?.photos ?? [], [wall.data]);

  useEffect(() => {
    if (paused || photos.length <= 1) return;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % photos.length);
    }, 6000);
    return () => window.clearInterval(timer);
  }, [paused, photos.length]);

  useEffect(() => {
    if (index >= photos.length) setIndex(0);
  }, [index, photos.length]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === ' ') {
        event.preventDefault();
        setPaused((current) => !current);
      }
      if (event.key === 'ArrowRight') setIndex((current) => (current + 1) % Math.max(1, photos.length));
      if (event.key === 'ArrowLeft')
        setIndex((current) => (current - 1 + photos.length) % Math.max(1, photos.length));
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [photos.length]);

  if (wall.isLoading) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <Mark />
      </div>
    );
  }

  if (wall.error || !wall.data) {
    return (
      <div className="grid min-h-dvh place-items-center px-6 text-center">
        <div className="max-w-sm">
          <h1 className="font-display text-3xl">There is no wall here</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            The host has either kept this album private or switched the wall off. Ask them for the
            album link instead.
          </p>
          <Button asChild variant="outline" className="mt-5">
            <Link href={`/e/${code}`}>Go to the album</Link>
          </Button>
        </div>
      </div>
    );
  }

  const event = wall.data.event;
  const photo = photos[index];
  const joinUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/j/${code}`;

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-black">
      {/* --- the photo being held up --------------------------------------- */}
      {photo ? (
        <div className="relative flex-1">
          {photos.map((candidate, candidateIndex) => (
            <img
              key={candidate.photoId}
              src={candidate.url}
              alt=""
              aria-hidden={candidateIndex !== index}
              className={cn(
                'absolute inset-0 size-full object-contain transition-opacity duration-[1400ms] ease-out',
                event.settings.filmLook && 'film',
                candidateIndex === index ? 'opacity-100' : 'opacity-0',
              )}
            />
          ))}

          {/* --- what is under it ------------------------------------------ */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-8 pb-8 pt-24">
            <div className="mx-auto flex w-full max-w-5xl items-end justify-between gap-6">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-white/80">
                  <span className="text-lg leading-none">{photo.guestEmoji}</span>
                  <span className="text-sm font-medium">{photo.guestName}</span>
                  {photo.challengeTitle && (
                    <span className="text-xs text-white/50">
                      · {photo.challengeEmoji} {photo.challengeTitle}
                    </span>
                  )}
                </div>
                {photo.caption && (
                  <p className="mt-1.5 max-w-2xl font-display text-2xl leading-snug text-white sm:text-3xl">
                    {photo.caption}
                  </p>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-3 text-white/70">
                {photo.reactions.total > 0 && (
                  <span className="flex items-center gap-1 text-sm">
                    <Heart className="size-4 fill-current text-rose-400" />
                    {photo.reactions.total}
                  </span>
                )}
                <span className="font-mono text-xs tracking-[0.3em]">{code}</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid flex-1 place-items-center px-6 text-center">
          <div>
            <p className="font-display text-4xl text-white/90">The wall is waiting</p>
            <p className="mt-3 text-sm text-white/60">
              {event.settings.cameraMode === 'roll'
                ? 'This evening was shot on film. Nothing shows until the host develops the rolls.'
                : 'The first photo anybody takes appears here within a few seconds.'}
            </p>
          </div>
        </div>
      )}

      {/* --- the bar: whose wall, how full, and the code ------------------- */}
      <header className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-6">
        <div className="flex items-center gap-3">
          <Mark withWord={false} />
          <div>
            <p className="font-display text-lg leading-tight text-white">{event.name}</p>
            <p className="text-xs text-white/50">
              {plural(event.counts.photos, 'photo')} · {event.counts.guests} guests ·{' '}
              {event.counts.reactions} reactions
            </p>
          </div>
        </div>

        <div className="pointer-events-auto flex items-center gap-4">
          <div className="hidden items-center gap-2 rounded-2xl border border-white/15 bg-black/40 px-3 py-2 backdrop-blur-md sm:flex">
            <QrCode value={joinUrl} size={54} className="rounded-lg" />
            <div className="text-xs text-white/70">
              <p className="font-medium text-white">Add yours</p>
              <p className="font-mono tracking-widest">{code}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={paused ? 'Play' : 'Pause'}
            className="text-white/70 hover:bg-white/10 hover:text-white"
            onClick={() => setPaused((current) => !current)}
          >
            {paused ? <Play /> : <Pause />}
          </Button>
        </div>
      </header>

      {paused && (
        <div className="absolute inset-0 grid place-items-center bg-black/20">
          <Badge variant="outline" className="border-white/30 text-white/80">
            paused · space to play
          </Badge>
        </div>
      )}

      {/* --- the invitation, for a room that has not joined yet ------------ */}
      {!photo && (
        <footer className="absolute inset-x-0 bottom-8 flex justify-center">
          <div className="flex items-center gap-2 rounded-full border border-white/15 bg-black/50 px-4 py-2 text-sm text-white/70 backdrop-blur-md">
            <ScanLine className="size-4" />
            Scan the code, or open foto.app and type {code}
          </div>
        </footer>
      )}
    </div>
  );
}
