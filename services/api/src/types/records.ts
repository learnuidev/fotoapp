/**
 * The rows, as they are stored.
 *
 * These are not the shapes a client sees: `@foto/types` is that, and
 * `lib/serialize` is the one place allowed to move between the two. The rows
 * carry what the database needs — indexes, denormalised names, storage keys —
 * and none of it leaks out.
 */

/** Everything a viewer needs to know about a name after it has been written. */
export interface NameFields {
  guestId: string;
  guestName: string;
  guestEmoji: string;
}

export interface EventRow {
  eventId: string;
  code: string;
  name: string;
  kind: string;
  date: number | null;
  location: string;
  welcome: string;
  hostId: string;
  hostName: string;
  coverKey: string | null;
  coverPhotoId: string | null;
  settings: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
  closedAt: number | null;
}

export interface GuestRow {
  guestId: string;
  eventId: string;
  /** The name and avatar the gallery credits this person with. */
  name: string;
  emoji: string;
  /**
   * `eventId#deviceId` — the denormalised index key that lets a join recognise a
   * phone it has already given a guest to. DynamoDB cannot query a composite of
   * two attributes, so the composite is stored.
   */
  deviceKey: string;
  role: 'host' | 'guest';
  joinedAt: number;
  lastSeenAt: number;
  /** The roll they are shooting, when the event shoots on film. */
  openRollId: string | null;
}

export interface PhotoRow extends NameFields {
  photoId: string;
  eventId: string;
  key: string;
  width: number;
  height: number;
  size: number;
  contentType: string;
  caption: string;
  takenAt: number;
  createdAt: number;
  status: 'visible' | 'pending' | 'hidden' | 'developing';
  challengeId: string | null;
  rollId: string | null;
  favorite: boolean;
}

export interface ReactionRow {
  /** `photoId#guestId#emoji`: one reaction per person per emoji per photo. */
  reactionId: string;
  eventId: string;
  photoId: string;
  guestId: string;
  emoji: string;
  createdAt: number;
}

export interface CommentRow {
  commentId: string;
  eventId: string;
  photoId: string;
  guestId: string;
  guestName: string;
  guestEmoji: string;
  body: string;
  createdAt: number;
}

export interface ChallengeRow {
  challengeId: string;
  eventId: string;
  title: string;
  emoji: string;
  active: boolean;
  createdAt: number;
}

export interface RollRow extends NameFields {
  rollId: string;
  eventId: string;
  shotLimit: number;
  shotCount: number;
  status: 'shooting' | 'developed';
  startedAt: number;
  developAt: number | null;
  developedAt: number | null;
}

/** The rows of one run of the local store, keyed by collection. */
export type Rows =
  | EventRow
  | GuestRow
  | PhotoRow
  | ReactionRow
  | CommentRow
  | ChallengeRow
  | RollRow;

/** Any row: everything stored has a string id under the collection's own name. */
export type Row = { [key: string]: unknown };
