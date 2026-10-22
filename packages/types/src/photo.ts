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

/**
 * What the camera recorded, read out of the file on the way up.
 *
 * This exists for the photographer: the one person at an event who uploaded a frame
 * from a camera rather than a phone wants to know which body, which lens and which
 * settings produced it — and the album is a better record if it can say so. It is
 * parsed in the browser, from the file the browser already holds, and stored as a
 * plain object beside the photo.
 *
 * Two rules shape it:
 *
 * - **Everything is optional.** A phone's HEIC has some of these, a screenshot has
 *   none, and a photo with no metadata is a normal photo rather than an error.
 * - **GPS comes from the file, and only from the file.** There is no second place a
 *   location is asked for: if the camera wrote coordinates into the photo, the album
 *   has them; if it did not, no screen asks anybody to supply them. The event's own
 *   `location` is the venue's name, which is a different thing from a coordinate.
 */
export interface PhotoMetadata {
  /** The body: `Canon`, `EOS R5`. */
  cameraMake?: string;
  cameraModel?: string;
  lens?: string;
  /** `1/250`, `2.5s` — as the camera writes it. */
  shutterSpeed?: string;
  /** Decimal seconds, for anything that wants to sort or plot it. */
  exposureSeconds?: number;
  /** f-number: `1.8`. */
  aperture?: number;
  iso?: number;
  /** Millimetres. */
  focalLength?: number;
  /** The 35mm-equivalent, which is how two cameras are compared. */
  focalLength35mm?: number;
  /** EV. */
  exposureBias?: number;
  flash?: boolean;
  whiteBalance?: string;
  meteringMode?: string;
  exposureProgram?: string;
  /** `Adobe RGB`, `sRGB`. */
  colorSpace?: string;
  /** The app that last touched the file — `Lightroom`, `Instagram`. */
  software?: string;
  /** EXIF's own `DateTimeOriginal`, which is when the shutter was pressed. */
  takenAt?: number;
  /** Where it was shot, when the file carried it. */
  gps?: { lat: number; lon: number };
  /** Derived by the API from the pixels, not trusted from the client. */
  megapixels?: number;
}

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
  /** What the camera recorded, when the file carried it. */
  metadata: PhotoMetadata | null;
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
