'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Heart, Pause, Play, ScanLine } from 'lucide-react';
import { Badge, Button, Mark, cn, plural } from '@foto/ui';
import { useWall } from '@foto/api';

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
 * - **It carries no join code.** The wall is a photograph with a room in front of it;
 *   the code lives on the card, in the album, and in the link a host shares, and a
 *   screen full of guest photos is not improved by furniture in its corner.
 */
/**
 * The slideshow, tracked by *which photo is on screen* rather than by an index.
 *
 * That distinction is the whole point of it. The wall polls, and every poll can bring
 * new photos at the front of a newest-first list — which shifts every index by one. An
 * index-based wall therefore shows a *different* photo the moment somebody in the room
 * takes one, silently, mid-caption. Following the photo's id instead means the frame
 * being looked at stays put, and the arrivals are queued to come up next.
 */
function useWallSlideshow<T extends { photoId: string }>(photos: T[], intervalMs = 6000) {
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  /** Ids that arrived since the last frame, newest first, waiting their turn. */
  const arrivals = useRef<string[]>([]);
  const seen = useRef(new Set<string>());

  useEffect(() => {
    const fresh = photos.map((photo) => photo.photoId).filter((id) => !seen.current.has(id));
    for (const id of fresh) seen.current.add(id);
    if (fresh.length > 0) arrivals.current.unshift(...fresh);

    // First frame: the newest photo, or the newest arrival if the first poll was empty.
    if (currentId === null && photos.length > 0) {
      setCurrentId(arrivals.current[0] ?? photos[0]!.photoId);
    }
    // The photo on screen can vanish under us — hidden by the host, or deleted.
    if (currentId !== null && !photos.some((photo) => photo.photoId === currentId)) {
      setCurrentId(photos[0]?.photoId ?? null);
    }
  }, [photos, currentId]);

  const step = useCallback(
    (direction: 1 | -1) => {
      if (photos.length === 0) return;
      if (direction === 1 && arrivals.current.length > 0) {
        // Something new came in while we were showing something older: show it now.
        setCurrentId(arrivals.current.shift()!);
        return;
      }
      const at = photos.findIndex((photo) => photo.photoId === currentId);
      const next = at === -1 ? 0 : (at + direction + photos.length) % photos.length;
      setCurrentId(photos[next]!.photoId);
    },
    [photos, currentId],
  );

  useEffect(() => {
    if (paused || photos.length <= 1) return;
    const timer = window.setInterval(() => step(1), intervalMs);
    return () => window.clearInterval(timer);
  }, [paused, step, photos.length, intervalMs]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === ' ') {
        event.preventDefault();
        setPaused((current) => !current);
      }
      if (event.key === 'ArrowRight') step(1);
      if (event.key === 'ArrowLeft') step(-1);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step]);

  const index = photos.findIndex((photo) => photo.photoId === currentId);
  return {
    photo: (index === -1 ? photos[0] : photos[index]) as T | undefined,
    index: index === -1 ? 0 : index,
    paused,
    setPaused,
  };
}

export default function WallPage({ params }: { params: { code: string } }) {
  const code = params.code.toUpperCase();
  const wall = useWall(code);

  const photos = useMemo(() => wall.data?.photos ?? [], [wall.data]);
  // The event decides how long a frame is held; six seconds is only the fallback for a
  // payload that predates the setting.
  const seconds = wall.data?.event.settings.wallSeconds ?? 6;
  const { photo, index, paused, setPaused } = useWallSlideshow(photos, seconds * 1000);

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
          <h1 className="font-display text-3xl">This wall is not available</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            The host has kept this album private or turned the wall off.
          </p>
          <Button asChild variant="outline" className="mt-5">
            <Link href={`/e/${code}`}>Go to the album</Link>
          </Button>
        </div>
      </div>
    );
  }

  const event = wall.data.event;

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
                'absolute inset-0 size-full transition-opacity duration-[1400ms] ease-out',
                // `cover` fills the screen and crops; `contain` keeps every pixel of the
                // frame with bars around it. A wall behind a bar wants the first; a
                // photograph somebody composed wants the second.
                wall.data!.event.settings.wallFit === 'cover' ? 'object-cover' : 'object-contain',
                candidateIndex === index ? 'opacity-100' : 'opacity-0',
              )}
            />
          ))}

          {/* --- what is under it ------------------------------------------ */}
          {wall.data.event.settings.wallCaptions && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-8 pb-8 pt-24">
            <div className="mx-auto flex w-full max-w-5xl items-end gap-6 pr-20">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-white/80">
                  <span className="text-lg leading-none">{photo.guestEmoji}</span>
                  <span className="text-sm font-medium">{photo.guestName}</span>
                  {photo.challengeTitle && (
                    <span className="text-xs text-white/50">
                      · {photo.challengeEmoji} {photo.challengeTitle}
                    </span>
                  )}
                  {photo.reactions.total > 0 && (
                    <span className="flex items-center gap-1 text-xs text-white/60">
                      <Heart className="size-3.5 fill-current text-rose-400" />
                      {photo.reactions.total}
                    </span>
                  )}
                </div>
                {photo.caption && (
                  <p className="mt-1.5 max-w-2xl font-display text-2xl leading-snug text-white sm:text-3xl">
                    {photo.caption}
                  </p>
                )}
              </div>


            </div>
          </div>
          )}
        </div>
      ) : (
        <div className="grid flex-1 place-items-center px-6 text-center">
          <div>
            <p className="font-display text-4xl text-white/90">No photos yet</p>
            <p className="mt-3 text-sm text-white/60">
              {event.settings.cameraMode === 'roll'
                ? 'This event uses film rolls. Photos appear once a roll is developed.'
                : 'Photos appear here a few seconds after they are uploaded.'}
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
            Scan the code or enter {code}
          </div>
        </footer>
      )}
    </div>
  );
}
