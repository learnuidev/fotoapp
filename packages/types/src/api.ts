/**
 * The bodies of the API's requests and the shapes of its answers.
 *
 * Separate from the domain shapes beside them because the two answer different
 * questions: `Photo` is what a photo *is*, and `CreatePhotoPayload` is what a
 * client is allowed to say about one. A field that appears in the second and not
 * the first is a field the server computes.
 */
import type { Challenge } from './challenge';
import type {
  Event,
  EventCounts,
  EventKind,
  EventSettings,
  EventStats,
  PublicEvent,
  RollReveal,
} from './event';
import type { Guest, GuestSession } from './guest';
import type { Photo, PhotoComment, PhotoStatus, ReactionEmoji } from './photo';
import type { Roll, RollWithPhotos } from './roll';

/** A presigned upload: where to PUT the bytes, and with which headers. */
export interface PresignedUpload {
  url: string;
  method: string;
  headers: Record<string, string>;
}

/** What a client asks for before it uploads anything. */
export interface ReserveUploadPayload {
  fileName: string;
  contentType: string;
  size: number;
  /** Where the object will end up. Decides the key prefix. */
  kind: 'photo' | 'cover';
  /** The guest token's event, for a photo key. */
  eventId?: string;
}

export interface ReserveUploadResponse {
  key: string;
  upload: PresignedUpload;
  /** The URL the object will be readable at once it is uploaded. */
  publicUrl: string;
}

// --- events -----------------------------------------------------------------

export interface CreateEventPayload {
  name: string;
  kind?: EventKind;
  date?: number | null;
  location?: string;
  welcome?: string;
  settings?: Partial<EventSettings>;
}

export interface UpdateEventPayload extends Partial<CreateEventPayload> {
  /** Closes or reopens the album: closed means read-only for everybody. */
  closed?: boolean;
  /** The photo the album is represented by, or null to take the cover away. */
  coverPhotoId?: string | null;
}

export interface ListEventsResponse {
  events: Event[];
}

export interface EventResponse {
  event: Event;
}

export interface EventStatsResponse {
  stats: EventStats;
}

// --- joining ----------------------------------------------------------------

export interface JoinPayload {
  name: string;
  emoji: string;
  /**
   * A random id this browser keeps. It is how a join recognises a device it has
   * already given a guest to, so re-opening the link is not a second guest.
   */
  deviceId: string;
}

/** What `/join/:code` answers: the event as a guest may see it. */
export interface JoinEventResponse {
  event: PublicEvent;
  challenges: Challenge[];
  /** The caller's guest, when their token is valid for this event. */
  guest: Guest | null;
  rollsOpen: boolean;
}

export interface JoinSessionResponse extends GuestSession {
  event: PublicEvent;
}

export interface GuestResponse {
  guest: Guest;
}

// --- photos -----------------------------------------------------------------

export interface CreatePhotoPayload {
  key: string;
  width: number;
  height: number;
  size: number;
  contentType: string;
  caption?: string;
  challengeId?: string | null;
  takenAt?: number;
}

export interface CreatePhotoResponse {
  photo: Photo;
  /** What the shot did to the caller's roll, when the event shoots on film. */
  roll: Roll | null;
  /** How many shots are left, when there is a roll. */
  shotsLeft: number | null;
}

export interface ListPhotosResponse {
  photos: Photo[];
  /** The cursor for the next page: pass it back as `before`. */
  nextBefore: number | null;
  /** The event's counts, so a gallery header does not need a second request. */
  counts: EventCounts;
  /** How many photos are waiting for the host. Always zero for a guest. */
  pending: number;
}

export interface PhotoResponse {
  photo: Photo;
}

export interface UpdatePhotoPayload {
  status?: PhotoStatus;
  caption?: string;
  favorite?: boolean;
}

/**
 * The wall's read: everything new since a moment, plus the counts a caption bar
 * shows. `since: 0` is "the whole gallery", which is how the wall starts.
 */
export interface PhotoFeedResponse {
  photos: Photo[];
  counts: { photos: number; guests: number; reactions: number };
  serverTime: number;
}

export interface ReactPayload {
  emoji: ReactionEmoji;
}

export interface ReactionResponse {
  reactions: Photo['reactions'];
}

export interface ListCommentsResponse {
  comments: PhotoComment[];
}

// --- challenges -------------------------------------------------------------

export interface CreateChallengePayload {
  title: string;
  emoji?: string;
}

export interface UpdateChallengePayload {
  title?: string;
  emoji?: string;
  active?: boolean;
}

export interface ListChallengesResponse {
  challenges: Challenge[];
}

export interface ChallengeResponse {
  challenge: Challenge;
}

// --- rolls ------------------------------------------------------------------

export interface StartRollPayload {
  /** Overrides the event's `shotsPerRoll` for this one roll. */
  shotLimit?: number;
}

export interface RollResponse {
  roll: Roll;
}

export interface ListRollsResponse {
  rolls: RollWithPhotos[];
}

// --- the wall ---------------------------------------------------------------

/**
 * A wall's settings, read without a token.
 *
 * The wall is a projector in a room: it cannot sign in, and it is the one screen
 * this product offers that must work from a bare URL. Everything it may know is
 * in here, which is why it is its own shape rather than `PublicEvent`.
 */
export interface WallResponse {
  event: PublicEvent;
  photos: Photo[];
  challenges: Challenge[];
  serverTime: number;
}
