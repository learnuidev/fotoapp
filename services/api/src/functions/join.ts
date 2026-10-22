/**
 * The guest side of the door: what a join code opens, and who it makes you.
 *
 * Everything here is reachable without an account, which is the product decision
 * all four of the apps this is built from arrived at: the moment a wedding guest
 * has to install something, the photos stop arriving. What protects an event is
 * the code — six characters on a card on the table — plus, for the reads that are
 * not public at all, the token a join hands back.
 */
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { ulid } from 'ulid';
import { GUEST_EMOJI, type JoinEventResponse, type JoinSessionResponse } from '@foto/types';
import { guestOf, hostOf, requireGuestOf } from '../lib/auth';
import { countsFor } from '../lib/counts';
import { eventByJoinCode } from '../lib/access';
import {
  HttpError,
  created,
  handle,
  jsonBody,
  ok,
  pathParam,
  queryNumber,
} from '../lib/http';
import { photoContext, toChallenge, toGuest, toPhoto, toPublicEvent, toRoll, type Viewer } from '../lib/serialize';
import { developDueRolls, openRollOf } from '../lib/rolls';
import { getStore } from '../lib/store';
import { issueGuestToken } from '../lib/guest-tokens';
import { challenges, guests, photos, reactions } from '../types/collections';
import type { EventRow, GuestRow } from '../types/records';
import { challengesOfEvent } from './events';

/** Who is calling, in the shape the serialisers want. */
async function viewerOf(event: APIGatewayProxyEvent, row: EventRow): Promise<Viewer> {
  const host = hostOf(event);
  const guest = await guestOf(event);
  return {
    ...(host ? { hostId: host.userId } : {}),
    ...(guest && guest.eventId === row.eventId ? { guestId: guest.guestId } : {}),
  };
}

async function publicEventOf(event: APIGatewayProxyEvent, row: EventRow) {
  await developDueRolls(row);
  return toPublicEvent(row, await countsFor(row.eventId), await viewerOf(event, row));
}

/** What the join screen and the gallery header read, before a guest has a name. */
async function getJoin(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const row = await eventByJoinCode(pathParam(event, 'code'));
  const guest = await guestOf(event);
  const guestRow =
    guest && guest.eventId === row.eventId
      ? await getStore().get(guests, guest.guestId)
      : undefined;

  const body: JoinEventResponse = {
    event: await publicEventOf(event, row),
    challenges: await challengesOfEvent(row.eventId),
    guest: guestRow ? toGuest(guestRow, 0, 0) : null,
    rollsOpen: guestRow?.openRollId != null,
  };
  return ok(body);
}

/**
 * Joins, or comes back.
 *
 * The device id is what makes this idempotent: a guest who closes the tab,
 * reloads, or opens the link again the next morning is the same guest with the
 * same name and the same rolls, not a second row beside the first. A guest who
 * genuinely wants a second identity can clear their storage, which is the correct
 * amount of friction for that.
 */
async function createGuest(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const row = await eventByJoinCode(pathParam(event, 'code'));
  if (row.closedAt !== null) throw new HttpError(409, 'This event has closed');

  const body = jsonBody<{ name?: string; emoji?: string; deviceId?: string }>(event);
  const name = (body.name ?? '').trim();
  if (!name) throw new HttpError(400, 'What should we call you?');
  if (name.length > 40) throw new HttpError(400, 'That name is too long');

  const emoji = body.emoji && GUEST_EMOJI.includes(body.emoji) ? body.emoji : pickEmoji(name);
  const deviceId = (body.deviceId ?? '').trim();
  if (!deviceId) throw new HttpError(400, 'A device id is required');

  const store = getStore();
  const deviceKey = `${row.eventId}#${deviceId}`;
  const [existing] = await store.query(guests, 'deviceKey', deviceKey);
  const host = hostOf(event);
  const isHostOfEvent = host?.userId === row.hostId;

  let guestRow: GuestRow;
  let isNew = false;

  if (existing) {
    guestRow =
      (await store.patch(guests, existing.guestId, {
        name,
        emoji,
        lastSeenAt: Date.now(),
        role: isHostOfEvent ? 'host' : 'guest',
      })) ?? existing;
  } else {
    isNew = true;
    guestRow = {
      guestId: ulid(),
      eventId: row.eventId,
      deviceKey,
      name,
      emoji,
      role: isHostOfEvent ? 'host' : 'guest',
      joinedAt: Date.now(),
      lastSeenAt: Date.now(),
      openRollId: null,
    };
    await store.put(guests, guestRow);
  }

  const response: JoinSessionResponse = {
    token: await issueGuestToken({
      sub: guestRow.guestId,
      eid: row.eventId,
      code: row.code,
      name: guestRow.name,
    }),
    guest: toGuest(guestRow, 0, 0),
    created: isNew,
    event: await publicEventOf(event, row),
  };
  return created(response);
}

/** One of the twelve, when a guest does not care which. */
function pickEmoji(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) % 997;
  return GUEST_EMOJI[hash % GUEST_EMOJI.length]!;
}

/** The caller's own guest row: their name, their counts, their open roll. */
async function myGuest(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const eventId = pathParam(event, 'eventId');
  const identity = await requireGuestOf(event, eventId);
  const store = getStore();
  const row = await store.get(guests, identity.guestId);
  if (!row) throw new HttpError(404, 'You are not in this event any more');

  const [photoRows, reactionRows] = await Promise.all([
    store.query(photos, 'eventId', eventId),
    store.query(reactions, 'eventId', eventId),
  ]);

  const mine = photoRows.filter((photo) => photo.guestId === identity.guestId).length;
  const reactionsMine = reactionRows.filter((entry) => entry.guestId === identity.guestId).length;
  const roll = await openRollOf(row);

  return ok({
    guest: toGuest(row, mine, reactionsMine),
    roll: roll ? toRoll(roll) : null,
    shotsLeft: roll ? roll.shotLimit - roll.shotCount : null,
  });
}

/** Renaming yourself. Past photos keep the name they were shot under. */
async function updateMyGuest(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const eventId = pathParam(event, 'eventId');
  const identity = await requireGuestOf(event, eventId);
  const body = jsonBody<{ name?: string; emoji?: string }>(event);

  const changes: Partial<GuestRow> = { lastSeenAt: Date.now() };
  if (body.name !== undefined) {
    const name = body.name.trim();
    if (!name) throw new HttpError(400, 'What should we call you?');
    if (name.length > 40) throw new HttpError(400, 'That name is too long');
    changes.name = name;
  }
  if (body.emoji !== undefined && GUEST_EMOJI.includes(body.emoji)) changes.emoji = body.emoji;

  const updated = await getStore().patch(guests, identity.guestId, changes);
  if (!updated) throw new HttpError(404, 'You are not in this event any more');
  return ok({ guest: toGuest(updated, 0, 0) });
}

/**
 * The gallery, read without an account.
 *
 * This is what the wall polls: a projector cannot sign in, so the public read
 * exists for exactly as long as the host has left the gallery open to everyone.
 * A wall on a link somebody forwarded finds nothing to show, which is the correct
 * amount of exposure for a link that can be forwarded.
 */
async function publicPhotos(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const row = await eventByJoinCode(pathParam(event, 'code'));
  const settings = row.settings as { galleryVisibility?: string };
  if (settings.galleryVisibility !== 'everyone') {
    throw new HttpError(403, 'This album is not public');
  }

  const since = queryNumber(event, 'since', 0);
  const limit = Math.min(200, Math.max(1, queryNumber(event, 'limit', 200)));

  await developDueRolls(row);
  const store = getStore();
  const [photoRows, counts] = await Promise.all([
    store.query(photos, 'eventId', row.eventId),
    countsFor(row.eventId),
  ]);

  const visible = photoRows
    .filter((photo) => photo.status === 'visible' && photo.createdAt > since)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, limit);

  const ctx = await photoContext(row.eventId, {});
  return ok({
    photos: visible.map((photo) => toPhoto(photo, ctx)),
    counts: { photos: counts.photos, guests: counts.guests, reactions: counts.reactions },
    serverTime: Date.now(),
  });
}

/**
 * Everything a wall needs, in one request.
 *
 * The wall is the screen a host puts on a projector, and it polls. One request
 * that answers the album, its prompts and its photos keeps that poll to a single
 * round trip on a venue's wi-fi.
 */
async function wall(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const row = await eventByJoinCode(pathParam(event, 'code'));
  const settings = row.settings as { galleryVisibility?: string; slideshowEnabled?: boolean };
  if (settings.galleryVisibility !== 'everyone' || settings.slideshowEnabled === false) {
    throw new HttpError(403, 'This event has no public wall');
  }

  await developDueRolls(row);
  const store = getStore();
  const [photoRows, counts, challengeRows] = await Promise.all([
    store.query(photos, 'eventId', row.eventId),
    countsFor(row.eventId),
    store.query(challenges, 'eventId', row.eventId),
  ]);

  const visible = photoRows
    .filter((photo) => photo.status === 'visible')
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 120);

  const challengeCounts = new Map<string, number>();
  for (const photo of photoRows) {
    if (!photo.challengeId) continue;
    challengeCounts.set(photo.challengeId, (challengeCounts.get(photo.challengeId) ?? 0) + 1);
  }

  const ctx = await photoContext(row.eventId, {});
  return ok({
    event: toPublicEvent(row, counts, {}),
    photos: visible.map((photo) => toPhoto(photo, ctx)),
    challenges: challengeRows
      .filter((challenge) => challenge.active)
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((challenge) => toChallenge(challenge, challengeCounts.get(challenge.challengeId) ?? 0)),
    serverTime: Date.now(),
  });
}

export const joinHandlers = {
  get: handle(getJoin),
  createGuest: handle(createGuest),
  myGuest: handle(myGuest),
  updateMyGuest: handle(updateMyGuest),
  publicPhotos: handle(publicPhotos),
  wall: handle(wall),
};
