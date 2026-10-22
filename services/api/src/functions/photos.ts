/**
 * Photos: reserving an upload, recording a shot, reading a gallery, moderating,
 * reacting and commenting.
 *
 * The interesting rules all live within a few lines of each other here, and they
 * are the product:
 *
 * - a shot can only be recorded for a key this API reserved for this event, so a
 *   client cannot point a photo row at somebody else's object;
 * - on an event that shoots film, a shot lands on the caller's open roll and is
 *   invisible — to everyone, including them — until that roll develops;
 * - on an event that approves photos, a shot is visible to its author and the host
 *   until the host lets it into the gallery.
 */
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { ulid } from 'ulid';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, REACTIONS, type ReactionEmoji } from '@foto/types';
import { guestOf, hostOf, requireGuestOf, requireHost, type Host } from '../lib/auth';
import { countsFor } from '../lib/counts';
import { currentSettings, eventById, galleryVisibleTo, requireOpen } from '../lib/access';
import {
  HttpError,
  created,
  handle,
  jsonBody,
  noContent,
  ok,
  pathParam,
  query,
  queryFlag,
  queryNumber,
} from '../lib/http';
import {
  canReadPhoto,
  photoContext,
  summariseReactions,
  toComment,
  toPhoto,
  toRoll,
  type Viewer,
} from '../lib/serialize';
import { sanitizeMetadata } from '../lib/photo-metadata';
import { assertUploadable, reserveUpload } from '../lib/storage';
import {
  addFrameToRoll,
  assertRollHasRoom,
  developRoll,
  openRollOf,
  startRoll,
} from '../lib/rolls';
import { getStore } from '../lib/store';
import { challenges, comments, events, guests, photos, reactions, rolls } from '../types/collections';
import type { EventRow, GuestRow, PhotoRow } from '../types/records';

/** The event named in the path, and the viewer asking about it. */
async function loadContext(event: APIGatewayProxyEvent): Promise<{
  row: EventRow;
  viewer: Viewer;
  isHost: boolean;
  guestId: string | undefined;
}> {
  const row = await eventById(pathParam(event, 'eventId'));
  const host = hostOf(event);
  const guest = await guestOf(event);
  const isHost = host?.userId === row.hostId;
  const guestId = guest && guest.eventId === row.eventId ? guest.guestId : undefined;

  return {
    row,
    viewer: {
      ...(host ? { hostId: host.userId } : {}),
      ...(guestId ? { guestId } : {}),
    },
    isHost,
    guestId,
  };
}

/**
 * Reserves a place to put a photo.
 *
 * Open to any guest of the event and to its host: the bytes never pass through
 * this API in AWS, and locally they pass through the dev server's own upload
 * route. Either way the client is told a URL, not a bucket.
 */
async function reserve(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const { row, isHost, guestId } = await loadContext(event);
  if (!isHost && !guestId) throw new HttpError(401, 'Join this event to add photos');
  requireOpen(row);

  const body = jsonBody<{ fileName?: string; contentType?: string; size?: number }>(event);
  const contentType = (body.contentType ?? '').toLowerCase();
  const size = Number(body.size ?? 0);
  assertUploadable(contentType, size);

  const ticket = await reserveUpload({ eventId: row.eventId, contentType });
  return created(ticket);
}

/** The avatar a host's own uploads are credited with, when they have no guest row. */
const HOST_EMOJI = '🎩';

/**
 * The guest row a host's own photos are filed under.
 *
 * A photo is attributed to a guest, and a host who uploads from the console is not
 * one — they never joined, and should not have to. Rather than teach every read about
 * a second kind of author, the console gives them a guest row of their own: role
 * `host`, keyed by their account so it is made once, and shown on the roster as
 * themselves. It is the same row their phone would have made by joining, which is why
 * nothing downstream needs to know the difference.
 */
async function hostGuestRow(event: EventRow, host: Host): Promise<GuestRow> {
  const store = getStore();
  const deviceKey = `${event.eventId}#host:${host.userId}`;
  const [existing] = await store.query(guests, 'deviceKey', deviceKey);
  if (existing) return existing;

  const now = Date.now();
  const row: GuestRow = {
    guestId: ulid(),
    eventId: event.eventId,
    deviceKey,
    name: host.name || 'The host',
    emoji: HOST_EMOJI,
    role: 'host',
    joinedAt: now,
    lastSeenAt: now,
    openRollId: null,
  };
  await store.put(guests, row);
  return row;
}

/**
 * Records a shot.
 *
 * The `key` must be one this API reserved for this event — it is checked by
 * prefix rather than by keeping a list of reservations, because the prefix is
 * what a life-cycle rule and a cache behaviour are scoped by anyway.
 */
async function createPhoto(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const { row, isHost, guestId } = await loadContext(event);
  if (!isHost && !guestId) throw new HttpError(401, 'Join this event to add photos');
  requireOpen(row);
  const settings = currentSettings(row);

  const body = jsonBody<{
    key?: string;
    width?: number;
    height?: number;
    size?: number;
    contentType?: string;
    caption?: string;
    challengeId?: string | null;
    takenAt?: number;
    metadata?: unknown;
  }>(event);

  const key = (body.key ?? '').trim();
  if (!key.startsWith(`events/${row.eventId}/`)) {
    throw new HttpError(400, 'That upload was not reserved for this event');
  }

  const contentType = (body.contentType ?? 'image/jpeg').toLowerCase();
  assertUploadable(contentType, Number(body.size ?? 1));

  let challengeId: string | null = null;
  if (body.challengeId) {
    const challenge = await getStore().get(challenges, body.challengeId);
    if (challenge && challenge.eventId === row.eventId) challengeId = challenge.challengeId;
  }

  /**
   * Who is shooting, and what that means for where the photo lands.
   *
   * Three cases, and the third is the console's:
   *
   * - a guest, whose photo is theirs and follows the event's rules — a roll, or the
   *   approval queue;
   * - a host who *joined* their own event from a phone, who is a guest with a host
   *   role and is treated exactly like one, because that is what they are;
   * - a host adding a photo from the console, who is neither waiting on their own
   *   approval nor holding a camera they cannot see into. Their photo goes straight
   *   into the album: a creator adding the one professional shot to their own
   *   wedding should not have to develop a roll to look at it.
   */
  const store = getStore();
  const fromConsole = !guestId && isHost;
  const guestRow = guestId
    ? await store.get(guests, guestId)
    : isHost
      ? await hostGuestRow(row, hostOf(event)!)
      : undefined;
  if (!guestRow) throw new HttpError(403, 'Join this event before adding photos');

  const now = Date.now();
  const onRoll = settings.cameraMode === 'roll' && !fromConsole;

  let rollRow = null;
  if (onRoll) {
    rollRow = await startRoll(row, guestRow);
    assertRollHasRoom(rollRow);
  }

  const width = Math.max(0, Math.round(Number(body.width ?? 0)));
  const height = Math.max(0, Math.round(Number(body.height ?? 0)));

  // Read now, so a payload that is not even an object fails before a row is written.
  const metadata = sanitizeMetadata(body.metadata, { width, height });

  const photoRow: PhotoRow = {
    photoId: ulid(),
    eventId: row.eventId,
    guestId: guestRow.guestId,
    guestName: guestRow.name,
    guestEmoji: guestRow.emoji,
    key,
    width,
    height,
    size: Math.max(0, Math.round(Number(body.size ?? 0))),
    contentType,
    caption: (body.caption ?? '').trim().slice(0, 280),
    takenAt: typeof body.takenAt === 'number' ? body.takenAt : now,
    createdAt: now,
    status: onRoll
      ? 'developing'
      : fromConsole || !settings.photoApproval
        ? 'visible'
        : 'pending',
    challengeId,
    // Omitted, not null: `rollId` is an index key, and DynamoDB will not index a NULL.
    ...(rollRow ? { rollId: rollRow.rollId } : {}),
    ...(metadata ? { metadata } : {}),
    favorite: false,
  };

  await store.put(photos, photoRow);

  if (rollRow) {
    rollRow = await addFrameToRoll(row, rollRow, photoRow);
    // The last frame of a roll develops it, so the row we just wrote may already
    // be readable. Re-read it rather than guessing.
    const fresh = await store.get(photos, photoRow.photoId);
    if (fresh) photoRow.status = fresh.status;
  }

  const ctx = await photoContext(row.eventId, { guestId: guestRow.guestId });
  return created({
    photo: toPhoto(photoRow, ctx),
    roll: rollRow ? toRoll(rollRow) : null,
    shotsLeft: rollRow ? rollRow.shotLimit - rollRow.shotCount : null,
  });
}

/**
 * The gallery.
 *
 * One route, three readers: the host's console (every status, every filter), a
 * guest (what they may see), and the author of a photo still waiting for the host
 * (their own). `canReadPhoto` decides, once.
 */
async function listPhotos(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const { row, viewer, isHost, guestId } = await loadContext(event);

  // An album that is closed to the room is closed on this route too. Without this,
  // knowing an event id — which is in the URL of every photo response — would be
  // enough to read an album the host had kept to themselves.
  if (!galleryVisibleTo(currentSettings(row), { isHost, isGuest: Boolean(guestId) })) {
    throw new HttpError(403, 'This album is closed to guests');
  }

  const store = getStore();
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, queryNumber(event, 'limit', DEFAULT_PAGE_SIZE)));
  const before = queryNumber(event, 'before', Number.POSITIVE_INFINITY);
  /**
   * Which date the gallery is ordered by.
   *
   * `uploaded` is the live order: newest first, which is what a host watching an event
   * wants. `captured` is by the shutter — EXIF's own `DateTimeOriginal` when the file has
   * one, the client's timestamp otherwise — earliest first, which is how an album is read
   * afterwards and how a developed film roll replays.
   */
  const sort = query(event, 'sort') === 'captured' ? 'captured' : 'uploaded';
  const statusFilter = query(event, 'status');
  const guestFilter = query(event, 'guestId');
  const challengeFilter = query(event, 'challengeId');
  const rollFilter = query(event, 'rollId');
  const favoritesOnly = queryFlag(event, 'favorite');

  const all = await store.query(photos, 'eventId', row.eventId);
  const readable = all.filter((photo) => canReadPhoto(photo, viewer));

  const filtered = readable.filter((photo) => {
    if (statusFilter && photo.status !== statusFilter) return false;
    if (guestFilter && photo.guestId !== guestFilter) return false;
    if (challengeFilter && photo.challengeId !== challengeFilter) return false;
    if (rollFilter && photo.rollId !== rollFilter) return false;
    if (favoritesOnly && !photo.favorite) return false;
    if (photo.createdAt >= before) return false;
    return true;
  });

  const takenAt = (photo: PhotoRow) => photo.metadata?.takenAt ?? photo.takenAt;
  const page = filtered
    .sort((a, b) =>
      sort === 'captured' ? takenAt(a) - takenAt(b) : b.createdAt - a.createdAt,
    )
    .slice(0, limit);
  const ctx = await photoContext(row.eventId, { guestId });

  return ok({
    photos: page.map((photo) => toPhoto(photo, ctx)),
    // Paging is a position in the upload order; the capture order is read in one go.
    nextBefore:
      sort === 'uploaded' && page.length === limit ? page[page.length - 1]!.createdAt : null,
    counts: await countsFor(row.eventId),
    // The host console's moderation chips need to know how much is waiting and how
    // much is hidden without a second request; guests are simply told zero.
    pending: isHost ? all.filter((photo) => photo.status === 'pending').length : 0,
    hidden: isHost ? all.filter((photo) => photo.status === 'hidden').length : 0,
  });
}

async function getPhoto(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const photoId = pathParam(event, 'photoId');
  const store = getStore();
  const row = await store.get(photos, photoId);
  if (!row) throw new HttpError(404, 'No such photo');

  const eventRow = await eventById(row.eventId);
  const host = hostOf(event);
  const guest = await guestOf(event);
  const isHost = host?.userId === eventRow.hostId;
  const viewer: Viewer = {
    ...(host ? { hostId: host.userId } : {}),
    ...(guest && guest.eventId === eventRow.eventId ? { guestId: guest.guestId } : {}),
  };
  if (
    !canReadPhoto(row, viewer) ||
    !galleryVisibleTo(currentSettings(eventRow), { isHost, isGuest: Boolean(viewer.guestId) })
  ) {
    throw new HttpError(404, 'No such photo');
  }

  const ctx = await photoContext(row.eventId, viewer);
  return ok({ photo: toPhoto(row, ctx) });
}

/**
 * Moderation: the host's switches over one photo.
 *
 * A host may publish a waiting photo, hide one from the gallery, bring it back,
 * rename what it says, mark it a favourite — which is what the wall plays first and
 * what downloading keeps — and **file it under a prompt**, including after the fact.
 *
 * That last one matters more than it sounds: a prompt is how a room is asked for
 * something, and the host is the one person who knows afterwards which of the
 * evening's photos answered it. The guest camera tags at the moment of shooting; this
 * is the same field, editable later, by the person keeping the album.
 *
 * None of these deletes anything.
 */
async function updatePhoto(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const photoId = pathParam(event, 'photoId');
  const store = getStore();
  const row = await store.get(photos, photoId);
  if (!row) throw new HttpError(404, 'No such photo');

  const eventRow = await eventById(row.eventId);
  const host = requireHost(event);
  if (eventRow.hostId !== host.userId) throw new HttpError(404, 'No such photo');

  const body = jsonBody<{
    status?: string;
    caption?: string;
    favorite?: boolean;
    challengeId?: string | null;
  }>(event);
  const changes: Partial<PhotoRow> = {};

  if (body.status !== undefined) {
    if (!['visible', 'pending', 'hidden'].includes(body.status)) {
      throw new HttpError(400, 'That is not a status a host can set');
    }
    if (row.status === 'developing') {
      throw new HttpError(409, 'That photo is still on a roll — develop the roll first');
    }
    changes.status = body.status as PhotoRow['status'];
  }
  if (body.caption !== undefined) changes.caption = body.caption.trim().slice(0, 280);
  if (body.favorite !== undefined) changes.favorite = Boolean(body.favorite);

  if (body.challengeId !== undefined) {
    if (body.challengeId === null || body.challengeId === '') {
      changes.challengeId = null;
    } else {
      // A prompt from another event would be a photo filed where nobody can find it.
      const challenge = await store.get(challenges, body.challengeId);
      if (!challenge || challenge.eventId !== row.eventId) {
        throw new HttpError(400, 'That prompt is not from this event');
      }
      changes.challengeId = challenge.challengeId;
    }
  }

  const updated = await store.patch(photos, photoId, changes);
  const ctx = await photoContext(row.eventId, { hostId: host.userId });
  return ok({ photo: toPhoto(updated ?? row, ctx) });
}

/** Deletes a photo: its host may, and so may the guest who shot it. */
async function deletePhoto(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const photoId = pathParam(event, 'photoId');
  const store = getStore();
  const row = await store.get(photos, photoId);
  if (!row) throw new HttpError(404, 'No such photo');

  const eventRow = await eventById(row.eventId);
  const host = hostOf(event);
  const guest = await guestOf(event);
  const isHost = host?.userId === eventRow.hostId;
  const isAuthor = guest?.guestId === row.guestId;
  if (!isHost && !isAuthor) throw new HttpError(403, 'That is not yours to delete');

  const [reactionRows, commentRows] = await Promise.all([
    store.query(reactions, 'photoId', row.photoId),
    store.query(comments, 'photoId', row.photoId),
  ]);

  await Promise.all([
    ...reactionRows.map((item) => store.remove(reactions, item.reactionId)),
    ...commentRows.map((item) => store.remove(comments, item.commentId)),
  ]);
  await store.remove(photos, row.photoId);

  // A cover photo that has just been deleted is not a cover any more.
  if (eventRow.coverPhotoId === row.photoId) {
    await store.patch(events, eventRow.eventId, { coverPhotoId: null, coverKey: null });
  }
  return noContent();
}

/** Leaving a reaction. One per emoji per person per photo, so this is idempotent. */
async function react(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const photoId = pathParam(event, 'photoId');
  const store = getStore();
  const row = await store.get(photos, photoId);
  if (!row) throw new HttpError(404, 'No such photo');

  const eventRow = await eventById(row.eventId);
  const identity = await requireGuestOf(event, row.eventId);
  const settings = currentSettings(eventRow);
  if (!settings.allowReactions) throw new HttpError(403, 'Reactions are off for this event');
  if (row.status !== 'visible') throw new HttpError(404, 'No such photo');

  const body = jsonBody<{ emoji?: string }>(event);
  const emoji = body.emoji as ReactionEmoji | undefined;
  if (!emoji || !REACTIONS.includes(emoji)) throw new HttpError(400, 'That is not a reaction');

  const reactionId = `${photoId}#${identity.guestId}#${emoji}`;
  await store.put(reactions, {
    reactionId,
    eventId: row.eventId,
    photoId,
    guestId: identity.guestId,
    emoji,
    createdAt: Date.now(),
  });

  const rows = await store.query(reactions, 'photoId', photoId);
  return ok({ reactions: summariseReactions(rows, identity.guestId) });
}

/** Taking one back. */
async function unreact(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const photoId = pathParam(event, 'photoId');
  const emoji = decodeURIComponent(pathParam(event, 'emoji')) as ReactionEmoji;
  const store = getStore();
  const row = await store.get(photos, photoId);
  if (!row) throw new HttpError(404, 'No such photo');

  const identity = await requireGuestOf(event, row.eventId);
  await store.remove(reactions, `${photoId}#${identity.guestId}#${emoji}`);

  const rows = await store.query(reactions, 'photoId', photoId);
  return ok({ reactions: summariseReactions(rows, identity.guestId) });
}

async function listComments(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const photoId = pathParam(event, 'photoId');
  const store = getStore();
  const row = await store.get(photos, photoId);
  if (!row) throw new HttpError(404, 'No such photo');

  const rows = (await store.query(comments, 'photoId', photoId)).sort(
    (a, b) => a.createdAt - b.createdAt,
  );
  return ok({ comments: rows.map(toComment) });
}

async function createComment(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const photoId = pathParam(event, 'photoId');
  const body = jsonBody<{ body?: string }>(event);
  const text = (body.body ?? '').trim();
  if (!text) throw new HttpError(400, 'Say something first');
  if (text.length > 500) throw new HttpError(400, 'That comment is too long');

  const store = getStore();
  const row = await store.get(photos, photoId);
  if (!row) throw new HttpError(404, 'No such photo');

  const eventRow = await eventById(row.eventId);
  const identity = await requireGuestOf(event, row.eventId);
  if (!currentSettings(eventRow).allowComments) {
    throw new HttpError(403, 'Comments are off for this event');
  }
  if (row.status !== 'visible') throw new HttpError(404, 'No such photo');

  const guestRow = await store.get(guests, identity.guestId);
  if (!guestRow) throw new HttpError(403, 'Join this event to comment');

  const commentRow = {
    commentId: ulid(),
    eventId: row.eventId,
    photoId,
    guestId: guestRow.guestId,
    guestName: guestRow.name,
    guestEmoji: guestRow.emoji,
    body: text,
    createdAt: Date.now(),
  };
  await store.put(comments, commentRow);
  return created({ comment: toComment(commentRow) });
}

/** Deletes a comment: its author may, and so may the host. */
async function deleteComment(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const photoId = pathParam(event, 'photoId');
  const commentId = pathParam(event, 'commentId');
  const store = getStore();
  const row = await store.get(comments, commentId);
  if (!row || row.photoId !== photoId) throw new HttpError(404, 'No such comment');

  const eventRow = await eventById(row.eventId);
  const host = hostOf(event);
  const guest = await guestOf(event);
  const isHost = host?.userId === eventRow.hostId;
  if (!isHost && guest?.guestId !== row.guestId) {
    throw new HttpError(403, 'That is not yours to delete');
  }

  await store.remove(comments, commentId);
  return noContent();
}

/**
 * The host's download list.
 *
 * Answered as URLs rather than as a zip: AWS would have to stream a zip through a
 * Lambda, and the app builds it in the browser anyway (`fflate`), which is faster
 * for the host and costs the backend nothing. Favourites-only is the host's way of
 * keeping the twenty photos they would actually print.
 */
async function downloadList(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const { row, isHost, viewer } = await loadContext(event);
  const settings = currentSettings(row);
  if (!isHost && !settings.allowDownloads) {
    throw new HttpError(403, 'Downloads are off for this album');
  }

  const store = getStore();
  const all = await store.query(photos, 'eventId', row.eventId);
  const visible = all.filter(
    (photo) =>
      photo.status === 'visible' &&
      canReadPhoto(photo, viewer) &&
      (!queryFlag(event, 'favorite') || photo.favorite),
  );

  const ctx = await photoContext(row.eventId, viewer);
  return ok({
    photos: visible
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((photo) => toPhoto(photo, ctx)),
    event: { name: row.name, code: row.code, date: row.date },
  });
}

/**
 * Develops a roll.
 *
 * Two callers, one rule: the guest who shot it may develop early (they are done,
 * and want to see it), and the host may develop any roll when the event is set to
 * reveal by hand. Nobody can un-develop one.
 */
async function develop(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const rollId = pathParam(event, 'rollId');
  const store = getStore();
  const rollRow = await store.get(rolls, rollId);
  if (!rollRow) throw new HttpError(404, 'No such roll');

  const eventRow = await eventById(rollRow.eventId);
  const host = hostOf(event);
  const guest = await guestOf(event);
  const isHost = host?.userId === eventRow.hostId;
  const isOwner = guest?.guestId === rollRow.guestId;
  if (!isHost && !isOwner) throw new HttpError(403, 'That is not your roll');

  const developed = await developRoll(rollRow, eventRow);
  const photoRows = await store.query(photos, 'rollId', developed.rollId);
  return ok({
    roll: toRoll(developed),
    developed: photoRows.length,
    counts: await countsFor(eventRow.eventId),
  });
}

export const photoHandlers = {
  reserve: handle(reserve),
  create: handle(createPhoto),
  list: handle(listPhotos),
  get: handle(getPhoto),
  update: handle(updatePhoto),
  remove: handle(deletePhoto),
  react: handle(react),
  unreact: handle(unreact),
  comments: handle(listComments),
  createComment: handle(createComment),
  deleteComment: handle(deleteComment),
  downloadList: handle(downloadList),
  develop: handle(develop),
};
