'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Download, Film, Heart, Images, MonitorPlay, Users } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  EmojiAvatar,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  ThemeToggle,
  plural,
  formatMoment,
} from '@foto/ui';
import { useGuestMe, useGuestPhotos, useGuestRolls, useJoinEvent } from '@foto/api';
import { useGuestSession } from '@foto/auth';
import { CameraPanel } from '@/components/camera-panel';
import { Gallery } from '@/components/gallery';
import { JoinForm } from '@/components/join-form';
import { DownloadAlbum } from '@/components/download-album';

/**
 * The album, as a guest sees it.
 *
 * One page with three tabs — the photos, the camera, and the rolls — because this
 * is a phone held in one hand: tabs are one thumb-reach apart, and a guest should
 * never lose the album by going to take a photo.
 *
 * The page reads the event through the *public* join route, so it renders whether
 * or not this browser has joined; the camera and the hearts need the guest session
 * and are the only things behind it.
 */
export default function GuestEventPage({ params }: { params: { code: string } }) {
  const code = params.code.toUpperCase();
  const router = useRouter();
  const { session, guest, ready } = useGuestSession(code);
  const join = useJoinEvent(code);
  const event = join.data?.event;

  const photos = useGuestPhotos(event?.eventId, { limit: 200 });
  const me = useGuestMe(session ? event?.eventId : undefined);
  const rolls = useGuestRolls(session ? event?.eventId : undefined);

  const [tab, setTab] = useState('album');

  // A guest who has not joined gets the form in place — not a redirect, so the
  // code in the address bar survives the two taps.
  if (join.isLoading || !ready || !event) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-8">
        <Skeleton className="h-8 w-52" />
        <Skeleton className="mt-3 h-4 w-32" />
        <Skeleton className="mt-6 h-64 w-full" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-12">
        <JoinForm event={event} onJoined={() => router.refresh()} />
      </div>
    );
  }

  const ownRoll = me.data?.roll ?? null;
  const shotsLeft = me.data?.shotsLeft ?? null;
  const photosList = photos.data?.photos ?? [];

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-24">
      {/* --- the header: whose evening this is ---------------------------- */}
      <header className="flex flex-col gap-4 py-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              {event.hostName}’s album
            </p>
            <h1 className="mt-0.5 truncate font-display text-3xl tracking-tight">{event.name}</h1>
            {event.date && (
              <p className="mt-1 text-xs text-muted-foreground">{formatMoment(event.date)}</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <EmojiAvatar emoji={guest?.emoji ?? '🐣'} size="md" ring />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="secondary">
            <Images className="size-3" /> {plural(event.counts.photos, 'photo')}
          </Badge>
          <Badge variant="secondary">
            <Users className="size-3" /> {event.counts.guests}
          </Badge>
          <Badge variant="secondary">
            <Heart className="size-3" /> {event.counts.reactions}
          </Badge>
          {event.settings.cameraMode === 'roll' ? (
            <Badge variant="film">
              <Film className="size-3" /> film · {event.settings.shotsPerRoll} shots a roll
            </Badge>
          ) : (
            <Badge variant="live">open camera</Badge>
          )}
          {event.closed && <Badge variant="outline">closed</Badge>}
        </div>

        {event.settings.slideshowEnabled && (
          <Button asChild variant="outline" size="sm" className="w-fit">
            <Link href={`/e/${code}/wall`}>
              <MonitorPlay /> Open the wall
            </Link>
          </Button>
        )}
      </header>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="album">
            <Images className="size-4" /> Album
          </TabsTrigger>
          <TabsTrigger value="camera">
            {event.settings.cameraMode === 'roll' ? (
              <Film className="size-4" />
            ) : (
              <span aria-hidden>📷</span>
            )}
            Camera
          </TabsTrigger>
          <TabsTrigger value="rolls">
            <Film className="size-4" /> Rolls
          </TabsTrigger>
        </TabsList>

        {/* --- the album --------------------------------------------------- */}
        <TabsContent value="album" className="flex flex-col gap-4">
          {!event.galleryOpen ? (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">
                The host is keeping this album closed for now. Your own photos are here, and the
                rest appears when they open it.
              </CardContent>
            </Card>
          ) : null}

          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {photos.data?.photos.length
                ? `Newest first · updated as the evening goes on`
                : 'Nothing here yet'}
            </p>
            {event.settings.allowDownloads && photosList.length > 0 && (
              <DownloadAlbum
                photos={photosList}
                eventName={event.name}
                variant="ghost"
                label="Download"
              />
            )}
          </div>

          <Gallery
            photos={photosList}
            eventId={event.eventId}
            scope="guest"
            viewerGuestId={guest?.guestId}
            allowComments={event.settings.allowComments}
            allowReactions={event.settings.allowReactions}
            filmLook={event.settings.filmLook}
            onChanged={() => void photos.refetch()}
            emptyTitle={
              event.settings.cameraMode === 'roll' ? 'The rolls are still in the camera' : 'No photos yet'
            }
            emptyBody={
              event.settings.cameraMode === 'roll'
                ? 'Nothing is visible until a roll is developed. Yours appears the moment the host brings them back.'
                : 'Be the first. Whatever you shoot lands here with your name under it.'
            }
          />
        </TabsContent>

        {/* --- the camera -------------------------------------------------- */}
        <TabsContent value="camera">
          <Card>
            <CardContent className="p-5">
              <CameraPanel
                eventId={event.eventId}
                settings={event.settings}
                challenges={join.data?.challenges ?? []}
                roll={ownRoll}
                shotsLeft={shotsLeft}
                closed={event.closed}
                onShot={() => {
                  void photos.refetch();
                  void me.refetch();
                  void rolls.refetch();
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- the rolls --------------------------------------------------- */}
        <TabsContent value="rolls" className="flex flex-col gap-4">
          {(rolls.data?.rolls ?? []).length === 0 ? (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">
                {event.settings.cameraMode === 'roll'
                  ? 'You have not loaded a roll yet. The camera tab hands you one.'
                  : 'This event shoots on the open camera — every photo appears in the album straight away.'}
              </CardContent>
            </Card>
          ) : (
            (rolls.data?.rolls ?? []).map((roll) => (
              <Card key={roll.rollId}>
                <CardContent className="flex flex-col gap-3 p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Film className="size-4 text-violet-600 dark:text-violet-300" />
                      <span className="text-sm font-medium">
                        {roll.status === 'developed' ? 'Developed' : 'Still in the camera'}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {roll.shotCount} / {roll.shotLimit} shots
                    </span>
                  </div>

                  {roll.status === 'developed' ? (
                    <Gallery
                      photos={roll.photos}
                      eventId={event.eventId}
                      scope="guest"
                      viewerGuestId={guest?.guestId}
                      allowComments={event.settings.allowComments}
                      allowReactions={event.settings.allowReactions}
                      filmLook={event.settings.filmLook}
                      emptyTitle="An empty roll"
                      emptyBody="Developed with nothing on it — it happens."
                    />
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {roll.developAt
                        ? `Develops automatically. Nothing on this roll is visible until then.`
                        : 'Nothing on this roll is visible until it develops.'}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      <footer className="mt-10 flex items-center justify-between border-t border-border/50 pt-5 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <ThemeToggle className="-ml-2" />
          <span>
            Code <span className="font-mono tracking-widest text-foreground">{code}</span>
          </span>
        </span>
        <Link href="/" className="underline-offset-4 hover:underline">
          made with foto
        </Link>
      </footer>
    </div>
  );
}
