'use client';

import { Heart, MessageCircle } from 'lucide-react';
import type { Photo } from '@foto/types';
import { Badge, cn, formatClock } from '@foto/ui';

/**
 * One photo in a grid.
 *
 * The tile knows three things a photo has that a picture does not: who shot it, how
 * the room reacted, and — for the host — whether it is actually public yet. The
 * aspect ratio comes from the row rather than from the loaded image, which is what
 * keeps a grid from reflowing as photos arrive during a party.
 */
export function PhotoTile({
  photo,
  onOpen,
  showStatus = false,
  filmLook = false,
  isOwn = false,
}: {
  photo: Photo;
  onOpen: () => void;
  showStatus?: boolean;
  filmLook?: boolean;
  isOwn?: boolean;
}) {
  const ratio = photo.width && photo.height ? photo.width / photo.height : 4 / 5;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative mb-2 block w-full break-inside-avoid overflow-hidden rounded-2xl bg-muted/40 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      style={{ aspectRatio: String(ratio) }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.url}
        alt={photo.caption || `A photo by ${photo.guestName}`}
        loading="lazy"
        className={cn(
          'size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]',
          filmLook && 'film',
        )}
      />

      {/* The gradient is what makes a name legible over a bright frame. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

      {showStatus && photo.status !== 'visible' && (
        <div className="absolute left-2 top-2">
          <Badge variant={photo.status === 'pending' ? 'waiting' : 'outline'}>
            {photo.status === 'pending' ? 'waiting' : photo.status === 'hidden' ? 'hidden' : 'film'}
          </Badge>
        </div>
      )}

      {photo.favorite && (
        <div className="absolute right-2 top-2 rounded-full bg-black/50 p-1.5 text-amber-300 backdrop-blur-sm">
          <Heart className="size-3.5 fill-current" />
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-2.5 text-white">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="text-sm leading-none">{photo.guestEmoji}</span>
          <span className="truncate text-xs font-medium drop-shadow">
            {photo.guestName}
            {isOwn && <span className="text-white/60"> · you</span>}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-2 text-[11px] text-white/85">
          {photo.reactions.total > 0 && (
            <span className="flex items-center gap-0.5">
              <Heart className="size-3 fill-current" />
              {photo.reactions.total}
            </span>
          )}
          {photo.commentCount > 0 && (
            <span className="flex items-center gap-0.5">
              <MessageCircle className="size-3" />
              {photo.commentCount}
            </span>
          )}
        </div>
      </div>

      <span className="sr-only">{formatClock(photo.createdAt)}</span>
    </button>
  );
}
