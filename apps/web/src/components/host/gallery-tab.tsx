'use client';

import { useState } from 'react';
import { Heart, Images, Inbox, Loader2 } from 'lucide-react';
import type { Event } from '@foto/types';
import { Card, CardContent, Skeleton, cn, plural } from '@foto/ui';
import { useHostPhotos } from '@foto/api';
import { AddPhotos } from '@/components/host/add-photos';
import { Gallery } from '@/components/gallery';
import { DownloadAlbum } from '@/components/download-album';

type Filter = 'all' | 'pending' | 'favorite';

/**
 * The gallery, from the host's side.
 *
 * Three filters, because a host has exactly three questions about a gallery while an
 * event is running: what has arrived, what is waiting for me, and what did I star.
 * Everything else — hiding, publishing, deleting, captioning — happens on the photo
 * itself, in the viewer, which is where the decision is actually made.
 */
export function GalleryTab({ event }: { event: Event }) {
  const [filter, setFilter] = useState<Filter>('all');
  const photos = useHostPhotos(event.eventId, {
    limit: 200,
    status: filter === 'pending' ? 'pending' : undefined,
    favorite: filter === 'favorite' ? true : undefined,
  });

  const list = photos.data?.photos ?? [];
  const pending = photos.data?.pending ?? event.counts.pending;
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
        </div>

        <div className="flex items-center gap-2">
          {photos.isFetching && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
          {event.closedAt === null && <AddPhotos eventId={event.eventId} />}
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
          filmLook={event.settings.filmLook}
          showStatus
          onChanged={() => void photos.refetch()}
          emptyTitle={
            filter === 'pending'
              ? 'Nothing is waiting'
              : filter === 'favorite'
                ? 'Nothing starred yet'
                : 'No photos yet'
          }
          emptyBody={
            filter === 'pending'
              ? 'Every photo has been dealt with. Approve-only mode means new ones show up here.'
              : filter === 'favorite'
                ? 'Tap a photo and press the star; those are the ones the wall plays first and the download keeps.'
                : 'The album fills up as guests shoot — or add the first one yourself with “Add photos”. Share the code and watch the rest arrive.'
          }
        />
      )}

      {pending > 0 && filter !== 'pending' && (
        <Card>
          <CardContent className="flex items-center justify-between gap-3 p-4 text-sm">
            <span className="text-muted-foreground">
              {plural(pending, 'photo')} waiting for your yes.
            </span>
            <button
              type="button"
              className="text-primary underline-offset-4 hover:underline"
              onClick={() => setFilter('pending')}
            >
              Show them
            </button>
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
