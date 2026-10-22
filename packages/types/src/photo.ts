/**
 * A photo, and the small things people do to one.
 *
 * A photo's own record carries the counts rather than the rows: a gallery tile
 * shows "♥ 12" and rarely needs the twelve names, so the twelve names are a
 * second request that only the photo viewer makes.
 */

/**
 * Where a photo is in its life.
 *
 * - `visible` — in the gallery.
 * - `pending` — uploaded while the host approves photos. Readable by the host
 *   and by whoever shot it, invisible to everybody else.
 * - `hidden` — the host took it out of the gallery without deleting it. Still
 *   readable by the host and by its author, which is the difference between
 *   hiding and removing.
 * - `developing` — shot on a roll that has not come back yet. Readable by the
 *   host alone, and only in the rolls tab: the whole point of a disposable
 *   camera is that nobody — including the person holding it — sees the frame
 *   before the roll is developed.
 */
export type PhotoStatus = 'visible' | 'pending' | 'hidden' | 'developing';

/** Who can tell one reaction from another. Emoji, because that is what people press. */
export type ReactionEmoji = '❤️' | '🔥' | '😂' | '😮' | '🥹' | '🎉';

/** The reactions on one photo, counted, plus the ones the reader left. */
export interface ReactionSummary {
  total: number;
  /** Emoji → count, biggest first. */
  byEmoji: { emoji: ReactionEmoji; count: number }[];
  /** The emoji the reader has left on this photo. */
  mine: ReactionEmoji[];
}

export interface Photo {
  photoId: string;
  eventId: string;
  guestId: string;
  guestName: string;
  guestEmoji: string;
  /** Storage key. Never used to build a URL by a client — `url` is the answer. */
  key: string;
  /** Ready to render: a signed CloudFront URL in AWS, an API path locally. */
  url: string;
  width: number;
  height: number;
  size: number;
  contentType: string;
  caption: string;
  /** When the shutter was pressed, which for a developed roll is not when it arrived. */
  takenAt: number;
  createdAt: number;
  status: PhotoStatus;
  /** The prompt this was shot for, if any. */
  challengeId: string | null;
  challengeTitle: string | null;
  challengeEmoji: string | null;
  /** The roll it came from, when the event shoots on film. */
  rollId: string | null;
  reactions: ReactionSummary;
  commentCount: number;
  /** The host's star: what the slideshow plays first, and what downloading keeps. */
  favorite: boolean;
}

export interface PhotoComment {
  commentId: string;
  photoId: string;
  eventId: string;
  guestId: string;
  guestName: string;
  guestEmoji: string;
  body: string;
  createdAt: number;
}
