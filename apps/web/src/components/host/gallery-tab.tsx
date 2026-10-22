'use client';

import { useState } from 'react';
import { EyeOff, Heart, Images, Inbox, Loader2 } from 'lucide-react';
import type { Event } from '@foto/types';
import { Card, CardContent, Skeleton, cn, plural } from '@foto/ui';
import { useEventChallenges, useHostPhotos } from '@foto/api';
import { AddPhotos } from '@/components/host/add-photos';
import { Gallery } from '@/components/gallery';
import { DownloadAlbum } from '@/components/download-album';

type Filter = 'all' | 'pending' | 'favorite' | 'hidden';

/**
 * The gallery, from the host's side.
 *
 * Four filters, because a host has exactly four questions about a gallery: what has
 * arrived, what is waiting for me, what did I star, and **what did I take out**. That
 * last one is the reason hiding is not deleting: a hidden photo is out of the album and
 * still in the evening, and a host who hid something at 11pm wants to find it again at
 * breakfast rather than be told it is gone.
 *
 * Everything else — hiding, publishing, deleting, captioning, filing under a prompt —
 * happens on the photo itself, in the viewer, which is where the decision is made.
 */
export function GalleryTab({ event }: { event: Event }) {
  const [filter, setFilter] = useState<Filter>('all');
  const challenges = useEventChallenges(event.eventId);
  const photos = useHostPhotos(event.eventId, {
    limit: 200,
    status: filter === 'pending' ? 'pending' : filter === 'hidden' ? 'hidden' : undefined,
    favorite: filter === 'favorite' ? true : undefined,
  });

  const list = photos.data?.photos ?? [];
  const pending = photos.data?.pending ?? event.counts.pending;
  const hidden = photos.data?.hidden ?? event.counts.hidden;
  const favorites = list.filter((photo) => photo.favorite).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-full border border-border/60 bg-card/60 p-1 text-xs">
          <FilterButton active={filter === 'all'} onClick={() => setFilter('all')}>
            <Images className="size-3.5" /> All {event.counts.photos}
          </FilterButton>
          <FilterButton active={filter === 'pending'} onClick={() => setFilter('pending')}>
            <Inbox className="size-3.5" /> Waiting {pending}
          </FilterButton>
          <FilterButton active={filter === 'favorite'} onClick={() => setFilter('favorite')}>
            <Heart className="size-3.5" /> Stars {filter === 'favorite' ? list.length : favorites}
          </FilterButton>
          <FilterButton active={filter === 'hidden'} onClick={() => setFilter('hidden')}>
            <EyeOff className="size-3.5" /> Hidden {hidden}
          </FilterButton>
        </div>

        <div className="flex items-center gap-2">
          {photos.isFetching && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
          {event.closedAt === null && (
            <AddPhotos eventId={event.eventId} challenges={challenges.data} />
          )}
          <DownloadAlbum photos={list} eventName={event.name} label="Download these" />
        </div>
      </div>

      {photos.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <Gallery
          photos={list}
          eventId={event.eventId}
          scope="host"
          allowComments={event.settings.allowComments}
          allowReactions={event.settings.allowReactions}
          challenges={challenges.data}
          showStatus
          onChanged={() => void photos.refetch()}
          emptyTitle={
            filter === 'pending'
              ? 'Nothing is waiting'
              : filter === 'favorite'
                ? 'Nothing starred yet'
                : filter === 'hidden'
                  ? 'Nothing is hidden'
                  : 'No photos yet'
          }
          emptyBody={
            filter === 'pending'
              ? 'Every photo has been dealt with. Approve-only mode means new ones show up here.'
              : filter === 'favorite'
                ? 'Tap a photo and press the star; those are the ones the wall plays first and the download keeps.'
                : filter === 'hidden'
                  ? 'Nothing has been taken out of the gallery. A photo you hide leaves the album — and the wall — but stays here, with its reactions and comments, until you put it back.'
                  : 'The album fills up as guests shoot — or add the first one yourself with “Add photos”. Share the code and watch the rest arrive.'
          }
        />
      )}

      {(pending > 0 || hidden > 0) && (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground">
              {pending > 0 && <span>{plural(pending, 'photo')} waiting for your yes.</span>}
              {hidden > 0 && <span>{plural(hidden, 'photo')} hidden from the gallery.</span>}
            </span>
            <span className="flex items-center gap-4">
              {pending > 0 && filter !== 'pending' && (
                <button
                  type="button"
                  className="text-primary underline-offset-4 hover:underline"
                  onClick={() => setFilter('pending')}
                >
                  Show what is waiting
                </button>
              )}
              {hidden > 0 && filter !== 'hidden' && (
                <button
                  type="button"
                  className="text-primary underline-offset-4 hover:underline"
                  onClick={() => setFilter('hidden')}
                >
                  Show hidden
                </button>
              )}
            </span>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors',
        active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent',
      )}
    >
      {children}
    </button>
  );
}
