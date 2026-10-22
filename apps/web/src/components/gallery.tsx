'use client';

import { useEffect, useState } from 'react';
import { Images } from 'lucide-react';
import type { Challenge, Photo } from '@foto/types';
import { cn } from '@foto/ui';
import { PhotoTile } from './photo-tile';
import { PhotoViewer } from './photo-viewer';

/**
 * The grid, and the act of looking at one of its photos.
 *
 * The same component draws the guest gallery and the host's moderation queue; what
 * differs is passed in rather than branched on here, which is why a photo behaves
 * the same way wherever it is tapped.
 *
 * The columns are CSS multi-column rather than a grid: these photos come from every
 * phone in a room at every angle, and a masonry of mixed portrait and landscape
 * reads as an album where a grid of equal squares reads as a contact sheet.
 */
export function Gallery({
  photos,
  eventId,
  scope,
  viewerGuestId,
  allowComments,
  allowReactions,
  challenges,
  showStatus = false,
  onChanged,
  emptyTitle = 'No photos yet',
  emptyBody = 'The first one is the hardest — and it lights the whole album up.',
  emptyAction,
  columns = 'default',
}: {
  photos: Photo[];
  eventId: string;
  scope: 'host' | 'guest';
  viewerGuestId?: string;
  allowComments: boolean;
  allowReactions: boolean;
  /** The event's prompts, for a host filing photos after the fact. */
  challenges?: Challenge[];
  showStatus?: boolean;
  onChanged?: () => void;
  emptyTitle?: string;
  emptyBody?: string;
  emptyAction?: React.ReactNode;
  columns?: 'default' | 'wide';
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  // The open photo is looked up rather than held: a reaction, a moderation change
  // or the wall's poll replaces the object, and the viewer should follow it.
  const openPhoto = openId ? (photos.find((photo) => photo.photoId === openId) ?? null) : null;

  useEffect(() => {
    if (openId && !openPhoto) setOpenId(null);
  }, [openId, openPhoto]);

  if (photos.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-border/70 px-6 py-16 text-center">
        <span className="grid size-12 place-items-center rounded-full bg-secondary/70 text-muted-foreground">
          <Images className="size-5" />
        </span>
        <h3 className="font-display text-xl">{emptyTitle}</h3>
        <p className="max-w-sm text-sm text-muted-foreground">{emptyBody}</p>
        {emptyAction}
      </div>
    );
  }

  return (
    <>
      <div
        className={cn(
          columns === 'wide'
            ? 'columns-2 gap-2 sm:columns-3 lg:columns-4'
            : 'columns-2 gap-2 sm:columns-3',
        )}
      >
        {photos.map((photo) => (
          <PhotoTile
            key={photo.photoId}
            photo={photo}
            onOpen={() => setOpenId(photo.photoId)}
            showStatus={showStatus}
            isOwn={Boolean(viewerGuestId && photo.guestId === viewerGuestId)}
          />
        ))}
      </div>

      <PhotoViewer
        photo={openPhoto}
        eventId={eventId}
        scope={scope}
        viewerGuestId={viewerGuestId}
        allowComments={allowComments}
        allowReactions={allowReactions}
        challenges={challenges}
        onClose={() => setOpenId(null)}
        onChanged={onChanged}
      />
    </>
  );
}
