'use client';

import { useState } from 'react';
import {
  Download,
  Eye,
  EyeOff,
  Heart,
  Image as ImageIcon,
  Loader2,
  Send,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { REACTIONS, type Challenge, type Photo, type ReactionEmoji } from '@foto/types';
import {
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  EmojiAvatar,
  Input,
  Separator,
  cn,
  formatClock,
  formatMoment,
} from '@foto/ui';
import { PhotoDetails } from './photo-details';
import { PromptPicker } from './prompt-picker';
import {
  useComments,
  useCreateComment,
  useDeleteComment,
  useDeletePhoto,
  useDeleteOwnPhoto,
  useReact,
  useSetCover,
  useUnreact,
  useUpdatePhoto,
} from '@foto/api';

export interface PhotoViewerProps {
  photo: Photo | null;
  eventId: string;
  scope: 'host' | 'guest';
  viewerGuestId?: string;
  allowComments: boolean;
  allowReactions: boolean;
  /** The event's prompts, so a host can file a photo under one after the fact. */
  challenges?: Challenge[];
  onClose: () => void;
  onChanged?: () => void;
}

/**
 * One photo, full screen, with everything anybody may do to it.
 *
 * A dialog rather than a route: the grid is the page, and tapping a photo should
 * feel like picking it up rather than leaving. What it offers depends on who is
 * looking — the host gets moderation, a guest gets a heart and a comment box, and
 * the guest who shot it gets to delete it.
 */
export function PhotoViewer({
  photo,
  eventId,
  scope,
  viewerGuestId,
  allowComments,
  allowReactions,
  challenges,
  onClose,
  onChanged,
}: PhotoViewerProps) {
  if (!photo) return null;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-h-[92dvh] max-w-3xl overflow-y-auto p-0 sm:max-w-3xl"
        hideClose
      >
        <DialogTitle className="sr-only">{photo.caption || 'A photo'}</DialogTitle>
        <ViewerBody
          photo={photo}
          eventId={eventId}
          scope={scope}
          viewerGuestId={viewerGuestId}
          allowComments={allowComments}
          allowReactions={allowReactions}
          challenges={challenges}
          onClose={onClose}
          onChanged={onChanged}
        />
      </DialogContent>
    </Dialog>
  );
}

function ViewerBody({
  photo,
  eventId,
  scope,
  viewerGuestId,
  allowComments,
  allowReactions,
  challenges,
  onClose,
  onChanged,
}: PhotoViewerProps & { photo: Photo }) {
  const isHost = scope === 'host';
  const isOwnGuest = Boolean(viewerGuestId && viewerGuestId === photo.guestId);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [comment, setComment] = useState('');

  const react = useReact(eventId);
  const unreact = useUnreact(eventId);
  const updatePhoto = useUpdatePhoto(eventId);
  const setCover = useSetCover(eventId);
  const deletePhoto = useDeletePhoto(eventId);
  const deleteOwn = useDeleteOwnPhoto(eventId);
  const comments = useComments(photo.photoId);
  const createComment = useCreateComment(eventId);
  const deleteComment = useDeleteComment(eventId);

  const busy =
    react.isPending ||
    unreact.isPending ||
    updatePhoto.isPending ||
    deletePhoto.isPending ||
    deleteOwn.isPending;

  const mine = photo.reactions.mine;

  function toggleReaction(emoji: ReactionEmoji) {
    if (!allowReactions) return;
    if (mine.includes(emoji)) unreact.mutate({ photoId: photo.photoId, emoji });
    else react.mutate({ photoId: photo.photoId, emoji });
    setEmojiOpen(false);
  }

  async function downloadThis() {
    // Fetching through the API's own URL keeps this working for a private album,
    // where a bare anchor would be a 403 the browser shows as a broken tab.
    const blob = await fetch(photo.url).then((response) => response.blob());
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filenameFor(photo);
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return (
    <div className="flex flex-col">
      {/* --- the photo itself ---------------------------------------------- */}
      {/* The frame around a contained photo is dark in both themes: it is a lightbox,
          and grey behind a photograph reads as a mistake rather than a mat. */}
      <div className="relative bg-black/80">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.url}
          alt={photo.caption || `A photo by ${photo.guestName}`}
          className="max-h-[58dvh] w-full object-contain"
        />
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 rounded-full bg-black/50 p-2 text-white backdrop-blur-sm transition-colors hover:bg-black/70"
        >
          <X className="size-4" />
        </button>
        {photo.rollId && (
          <div className="absolute left-3 top-3 rounded-full bg-black/60 px-2.5 py-0.5 text-[11px] font-medium text-white/90 backdrop-blur-sm">
            film roll
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4 p-5">
        {/* --- who, when, what was asked ------------------------------------ */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <EmojiAvatar emoji={photo.guestEmoji} size="sm" />
            <div className="flex flex-col">
              <span className="text-sm font-medium">
                {photo.guestName}
                {isOwnGuest && <span className="text-muted-foreground"> · you</span>}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatMoment(photo.createdAt)} · {formatClock(photo.createdAt)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon-sm" aria-label="Download" onClick={() => void downloadThis()}>
              <Download />
            </Button>
            {isHost && (
              <>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={photo.favorite ? 'Unstar' : 'Star'}
                  disabled={busy}
                  onClick={() =>
                    updatePhoto.mutate(
                      { photoId: photo.photoId, payload: { favorite: !photo.favorite } },
                      { onSuccess: onChanged },
                    )
                  }
                >
                  <Star className={cn(photo.favorite && 'fill-amber-300 text-amber-300')} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Use as the album cover"
                  title="Use as the album cover"
                  disabled={busy || photo.status !== 'visible'}
                  onClick={() =>
                    setCover.mutate(photo.photoId, {
                      onSuccess: () => toast.success('Album cover updated'),
                    })
                  }
                >
                  <ImageIcon />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={photo.status === 'hidden' ? 'Put back in the gallery' : 'Hide'}
                  disabled={busy}
                  onClick={() =>
                    updatePhoto.mutate(
                      {
                        photoId: photo.photoId,
                        payload: { status: photo.status === 'hidden' ? 'visible' : 'hidden' },
                      },
                      { onSuccess: onChanged },
                    )
                  }
                >
                  {photo.status === 'hidden' ? <Eye /> : <EyeOff />}
                </Button>
              </>
            )}
          </div>
        </div>

        {photo.caption && <p className="text-[15px] leading-relaxed">{photo.caption}</p>}

        {photo.challengeTitle && (
          <p className="text-xs text-muted-foreground">
            {photo.challengeEmoji} filed under “{photo.challengeTitle}”
          </p>
        )}

        {isHost && challenges && challenges.length > 0 && (
          <PromptPicker
            photo={photo}
            challenges={challenges}
            eventId={eventId}
            onChanged={onChanged}
          />
        )}

        <PhotoDetails photo={photo} />

        {isHost && photo.status === 'pending' && (
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3">
            <p className="text-sm text-amber-800 dark:text-amber-200">Awaiting your approval. Not visible to guests.</p>
            <Button
              size="sm"
              disabled={busy}
              onClick={() =>
                updatePhoto.mutate(
                  { photoId: photo.photoId, payload: { status: 'visible' } },
                  { onSuccess: onChanged },
                )
              }
            >
              {updatePhoto.isPending ? <Loader2 className="animate-spin" /> : 'Publish'}
            </Button>
          </div>
        )}

        {/* --- reactions ---------------------------------------------------- */}
        <div className="flex flex-wrap items-center gap-1.5">
          {photo.reactions.byEmoji.map((entry) => (
            <button
              key={entry.emoji}
              type="button"
              disabled={!allowReactions}
              onClick={() => toggleReaction(entry.emoji)}
              className={cn(
                'flex items-center gap-1 rounded-full border px-2.5 py-1 text-sm transition-colors',
                mine.includes(entry.emoji)
                  ? 'border-primary/60 bg-primary/15 text-primary'
                  : 'border-border/70 text-muted-foreground hover:bg-accent',
              )}
            >
              <span>{entry.emoji}</span>
              <span className="text-xs tabular-nums">{entry.count}</span>
            </button>
          ))}

          {allowReactions &&
            (emojiOpen ? (
              <div className="flex items-center gap-1 rounded-full border border-border/70 bg-card px-1.5 py-1">
                {REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className="rounded-full px-1 text-lg transition-transform hover:scale-125"
                    onClick={() => toggleReaction(emoji)}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setEmojiOpen(true)}>
                <Heart /> React
              </Button>
            ))}
        </div>

        {/* --- comments ----------------------------------------------------- */}
        {allowComments && (
          <>
            <Separator />
            <div className="flex flex-col gap-3">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">
                {photo.commentCount === 0
                  ? 'No comments'
                  : `${photo.commentCount} comment${photo.commentCount === 1 ? '' : 's'}`}
              </span>

              {comments.data?.map((entry) => (
                <div key={entry.commentId} className="flex items-start gap-2.5">
                  <EmojiAvatar emoji={entry.guestEmoji} size="xs" />
                  <div className="flex-1">
                    <p className="text-sm">
                      <span className="font-medium">{entry.guestName}</span>{' '}
                      <span className="text-muted-foreground">{entry.body}</span>
                    </p>
                  </div>
                  {(isHost || entry.guestId === viewerGuestId) && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Delete comment"
                      onClick={() =>
                        deleteComment.mutate({
                          photoId: photo.photoId,
                          commentId: entry.commentId,
                        })
                      }
                    >
                      <X className="size-3" />
                    </Button>
                  )}
                </div>
              ))}

              <form
                className="flex items-center gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!comment.trim()) return;
                  createComment.mutate(
                    { photoId: photo.photoId, body: comment },
                    { onSuccess: () => setComment('') },
                  );
                }}
              >
                <Input
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  placeholder={viewerGuestId ? 'Say something' : 'Join the event to comment'}
                  disabled={!viewerGuestId || createComment.isPending}
                  className="h-10"
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={!viewerGuestId || !comment.trim() || createComment.isPending}
                  aria-label="Send"
                >
                  <Send />
                </Button>
              </form>
            </div>
          </>
        )}

        {/* --- the way out, for whoever owns it ----------------------------- */}
        {(isHost || isOwnGuest) && (
          <>
            <Separator />
            <Button
              variant="ghost"
              className="justify-start text-destructive hover:bg-destructive/10"
              disabled={busy}
              onClick={() => {
                const mutation = isHost ? deletePhoto : deleteOwn;
                mutation.mutate(photo.photoId, {
                  onSuccess: () => {
                    onChanged?.();
                    onClose();
                  },
                });
              }}
            >
              <Trash2 /> Delete photo
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

/** A filename a host will recognise in their downloads folder eighteen months later. */
export function filenameFor(photo: Photo, eventName?: string): string {
  const stamp = new Date(photo.createdAt).toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const who = photo.guestName.replace(/[^a-zA-Z0-9-_ ]/g, '').trim() || 'guest';
  const caption = photo.caption
    .slice(0, 40)
    .replace(/[^a-zA-Z0-9-_ ]/g, '')
    .trim()
    .replace(/\s+/g, '-');
  const ext = photo.contentType.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg';
  const prefix = eventName ? `${eventName.replace(/[^a-zA-Z0-9-_ ]/g, '').trim().replace(/\s+/g, '-')}-` : '';
  return `${prefix}${stamp}-${who}${caption ? `-${caption}` : ''}.${ext}`;
}
