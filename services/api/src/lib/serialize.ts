/**
 * Rows in, product shapes out.
 *
 * Every handler answers with types from `@foto/types`, and this is the only file
 * that builds them. The two jobs it does that are worth knowing about:
 *
 * - it resolves each photo's `url` from its storage key, so a client never learns
 *   a key it could build a URL from;
 * - it decides what a reader may see, which is why it is given a viewer rather
 *   than a flag. A photo that is still on a roll, or waiting for the host, is
 *   filtered here, once, instead of in each of the four screens that read photos.
 */
import {
  DEFAULT_EVENT_SETTINGS,
  type Challenge,
  type Event,
  type EventCounts,
  type EventKind,
  type EventSettings,
  type Guest,
  type Photo,
  type PhotoComment,
  type PublicEvent,
  type PublicEventSettings,
  type ReactionEmoji,
  type ReactionSummary,
  type Roll,
} from '@foto/types';
import {
  challenges as challengesCollection,
  comments as commentsCollection,
  photos,
  reactions,
} from '../types/collections';
import type {
  ChallengeRow,
  CommentRow,
  EventRow,
  GuestRow,
  PhotoRow,
  ReactionRow,
  RollRow,
} from '../types/records';
import { publicUrl } from './storage';
import { getStore } from './store';

/** Who is reading. Both may be true: a host who joined their own event. */
export interface Viewer {
  hostId?: string;
  guestId?: string;
}

export function settingsOf(row: EventRow): EventSettings {
  return { ...DEFAULT_EVENT_SETTINGS, ...(row.settings as Partial<EventSettings>) };
}

/** The settings a guest is told, which is the subset a guest screen acts on. */
function publicSettings(settings: EventSettings): PublicEventSettings {
  return {
    cameraMode: settings.cameraMode,
    shotsPerRoll: settings.shotsPerRoll,
    rollReveal: settings.rollReveal,
    rollRevealMinutes: settings.rollRevealMinutes,
    allowComments: settings.allowComments,
    allowReactions: settings.allowReactions,
    allowDownloads: settings.allowDownloads,
    challengesEnabled: settings.challengesEnabled,
    slideshowEnabled: settings.slideshowEnabled,
    filmLook: settings.filmLook,
    photoApproval: settings.photoApproval,
  };
}

export function toEvent(row: EventRow, counts: EventCounts): Event {
  return {
    eventId: row.eventId,
    code: row.code,
    name: row.name,
    kind: row.kind as EventKind,
    date: row.date,
    location: row.location,
    welcome: row.welcome,
    hostId: row.hostId,
    hostName: row.hostName,
    coverPhotoId: row.coverPhotoId,
    coverUrl: row.coverKey ? publicUrl(row.coverKey) : null,
    settings: settingsOf(row),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    closedAt: row.closedAt,
    counts,
  };
}

/**
 * The event as a guest may see it.
 *
 * `galleryOpen` is answered rather than passed through: with the gallery set to
 * `host`, no guest may read it, and with it set to `guests`, only somebody who
 * has joined may. A screen that received the raw visibility would have to
 * re-derive that rule, and one screen would get it wrong.
 */
export function toPublicEvent(row: EventRow, counts: EventCounts, viewer: Viewer): PublicEvent {
  const settings = settingsOf(row);
  const isHost = viewer.hostId !== undefined && viewer.hostId === row.hostId;
  const isGuest = viewer.guestId !== undefined;
  const galleryOpen =
    isHost ||
    settings.galleryVisibility === 'everyone' ||
    (settings.galleryVisibility === 'guests' && isGuest);

  return {
    eventId: row.eventId,
    code: row.code,
    name: row.name,
    kind: row.kind as EventKind,
    date: row.date,
    location: row.location,
    welcome: row.welcome,
    hostName: row.hostName,
    coverUrl: row.coverKey ? publicUrl(row.coverKey) : null,
    closed: row.closedAt !== null,
    galleryOpen,
    settings: publicSettings(settings),
    counts,
  };
}

/** One photo's reactions, counted, with the reader's own named. */
export function summariseReactions(rows: ReactionRow[], viewerGuestId?: string): ReactionSummary {
  const counts = new Map<string, number>();
  const mine = new Set<ReactionEmoji>();

  for (const row of rows) {
    counts.set(row.emoji, (counts.get(row.emoji) ?? 0) + 1);
    if (viewerGuestId && row.guestId === viewerGuestId) mine.add(row.emoji as ReactionEmoji);
  }

  return {
    total: rows.length,
    byEmoji: [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([emoji, count]) => ({ emoji: emoji as ReactionEmoji, count })),
    mine: [...mine],
  };
}

/** Every reaction on an event, grouped by photo. One read for a whole gallery. */
export async function reactionsByPhoto(
  eventId: string,
  viewerGuestId?: string,
): Promise<Map<string, ReactionSummary>> {
  const rows = await getStore().query(reactions, 'eventId', eventId);
  const grouped = new Map<string, ReactionRow[]>();
  for (const row of rows) {
    const list = grouped.get(row.photoId);
    if (list) list.push(row);
    else grouped.set(row.photoId, [row]);
  }

  const out = new Map<string, ReactionSummary>();
  for (const [photoId, list] of grouped) {
    out.set(photoId, summariseReactions(list, viewerGuestId));
  }
  return out;
}

/** How many comments each photo of an event has. */
export async function commentCountsByPhoto(eventId: string): Promise<Map<string, number>> {
  const rows = await getStore().query(commentsCollection, 'eventId', eventId);
  const out = new Map<string, number>();
  for (const row of rows) out.set(row.photoId, (out.get(row.photoId) ?? 0) + 1);
  return out;
}

export interface PhotoContext {
  reactions: Map<string, ReactionSummary>;
  commentCounts: Map<string, number>;
  challenges: Map<string, ChallengeRow>;
  viewer: Viewer;
}

/** Everything a gallery page reads, loaded once. */
export async function photoContext(eventId: string, viewer: Viewer): Promise<PhotoContext> {
  const [reactionMap, commentMap, challengeRows] = await Promise.all([
    reactionsByPhoto(eventId, viewer.guestId),
    commentCountsByPhoto(eventId),
    getStore().query(challengesCollection, 'eventId', eventId),
  ]);

  return {
    reactions: reactionMap,
    commentCounts: commentMap,
    challenges: new Map(challengeRows.map((row) => [row.challengeId, row])),
    viewer,
  };
}

const EMPTY_REACTIONS: ReactionSummary = { total: 0, byEmoji: [], mine: [] };

export function toPhoto(row: PhotoRow, ctx: PhotoContext): Photo {
  const challenge = row.challengeId ? ctx.challenges.get(row.challengeId) : undefined;
  return {
    photoId: row.photoId,
    eventId: row.eventId,
    guestId: row.guestId,
    guestName: row.guestName,
    guestEmoji: row.guestEmoji,
    key: row.key,
    url: publicUrl(row.key),
    width: row.width,
    height: row.height,
    size: row.size,
    contentType: row.contentType,
    caption: row.caption,
    takenAt: row.takenAt,
    createdAt: row.createdAt,
    status: row.status,
    challengeId: row.challengeId,
    challengeTitle: challenge?.title ?? null,
    challengeEmoji: challenge?.emoji ?? null,
    rollId: row.rollId,
    reactions: ctx.reactions.get(row.photoId) ?? EMPTY_REACTIONS,
    commentCount: ctx.commentCounts.get(row.photoId) ?? 0,
    favorite: row.favorite,
  };
}

/**
 * Whether a photo row may be read by this viewer.
 *
 * The four statuses answered in one place:
 *
 * - `visible` — what a gallery is made of.
 * - `pending` — waiting for the host. Its author and the host may see it.
 * - `hidden` — taken out of the gallery. Its author and the host may still see it,
 *   which is what makes hiding different from deleting.
 * - `developing` — on a roll that has not come back. **Nobody** but the host, and
 *   the host only in the rolls tab: the camera is disposable, and the frame is not
 *   viewable until the roll is developed. Not even by the person who shot it.
 */
export function canReadPhoto(row: PhotoRow, viewer: Viewer): boolean {
  const isHost = viewer.hostId !== undefined;
  const isAuthor = viewer.guestId !== undefined && viewer.guestId === row.guestId;

  switch (row.status) {
    case 'visible':
      return true;
    case 'pending':
    case 'hidden':
      return isHost || isAuthor;
    case 'developing':
      return isHost;
    default:
      return false;
  }
}

export function toGuest(row: GuestRow, photoCount: number, reactionCount: number): Guest {
  return {
    guestId: row.guestId,
    eventId: row.eventId,
    name: row.name,
    emoji: row.emoji,
    joinedAt: row.joinedAt,
    lastSeenAt: row.lastSeenAt,
    photoCount,
    reactionCount,
    role: row.role,
    openRollId: row.openRollId,
  };
}

export function toChallenge(row: ChallengeRow, photoCount: number): Challenge {
  return {
    challengeId: row.challengeId,
    eventId: row.eventId,
    title: row.title,
    emoji: row.emoji,
    active: row.active,
    photoCount,
    createdAt: row.createdAt,
  };
}

export function toRoll(row: RollRow): Roll {
  return {
    rollId: row.rollId,
    eventId: row.eventId,
    guestId: row.guestId,
    guestName: row.guestName,
    guestEmoji: row.guestEmoji,
    shotLimit: row.shotLimit,
    shotCount: row.shotCount,
    status: row.status,
    startedAt: row.startedAt,
    developAt: row.developAt,
    developedAt: row.developedAt,
  };
}

export function toComment(row: CommentRow): PhotoComment {
  return {
    commentId: row.commentId,
    photoId: row.photoId,
    eventId: row.eventId,
    guestId: row.guestId,
    guestName: row.guestName,
    guestEmoji: row.guestEmoji,
    body: row.body,
    createdAt: row.createdAt,
  };
}

/** Photos of one event in the order a gallery draws them: newest first. */
export async function photosOfEvent(eventId: string): Promise<PhotoRow[]> {
  const rows = await getStore().query(photos, 'eventId', eventId);
  return rows.sort((a, b) => b.createdAt - a.createdAt);
}
