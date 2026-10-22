/**
 * Events: the console's side of them.
 *
 * Creating one seeds the prompts its kind suggests (`EVENT_KINDS` in
 * `@foto/types`), so a host who makes a wedding is handed "the first dance"
 * without having to think of it. The prompts are the part of this product people
 * do not know to want until they have used it once.
 */
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { ulid } from 'ulid';
import {
  DEFAULT_EVENT_SETTINGS,
  EVENT_KINDS,
  type Challenge,
  type EventKind,
  type EventSettings,
} from '@foto/types';
import { requireHost } from '../lib/auth';
import { uniqueCode } from '../lib/codes';
import { countsFor, countsForMany } from '../lib/counts';
import { mergeSettings, requireOwnedEvent } from '../lib/access';
import { HttpError, created, handle, jsonBody, noContent, ok, pathParam } from '../lib/http';
import { settingsOf, toChallenge, toEvent, toGuest } from '../lib/serialize';
import { statsFor } from '../lib/stats';
import { getStore } from '../lib/store';
import {
  challenges,
  comments,
  events,
  guests,
  photos,
  reactions,
  rolls,
} from '../types/collections';
import type { ChallengeRow, EventRow } from '../types/records';
import type { EventCounts } from '@foto/types';

const NO_COUNTS: EventCounts = {
  photos: 0,
  pending: 0,
  guests: 0,
  reactions: 0,
  comments: 0,
  rolls: 0,
};

function isKind(value: unknown): value is EventKind {
  return EVENT_KINDS.some((kind) => kind.value === value);
}

async function seedChallenges(eventId: string, kind: EventKind): Promise<void> {
  const prompts = EVENT_KINDS.find((entry) => entry.value === kind)?.prompts ?? [];
  const store = getStore();
  const now = Date.now();

  for (const [index, title] of prompts.entries()) {
    const row: ChallengeRow = {
      challengeId: ulid(),
      eventId,
      title,
      emoji: '📸',
      active: index === 0,
      createdAt: now + index,
    };
    await store.put(challenges, row);
  }
}

async function createEvent(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const host = requireHost(event);
  const body = jsonBody<{
    name?: string;
    kind?: string;
    date?: number | null;
    location?: string;
    welcome?: string;
    settings?: Partial<EventSettings>;
  }>(event);

  const name = (body.name ?? '').trim();
  if (!name) throw new HttpError(400, 'Give the event a name');
  if (name.length > 120) throw new HttpError(400, 'That name is too long');

  const kind: EventKind = isKind(body.kind) ? body.kind : 'other';
  const now = Date.now();
  const eventId = ulid();
  const settings = mergeSettings(DEFAULT_EVENT_SETTINGS, body.settings);

  const row: EventRow = {
    eventId,
    code: await uniqueCode(),
    name,
    kind,
    date: typeof body.date === 'number' ? body.date : null,
    location: (body.location ?? '').trim().slice(0, 160),
    welcome: (body.welcome ?? '').trim().slice(0, 400),
    hostId: host.userId,
    hostName: host.name,
    coverKey: null,
    coverPhotoId: null,
    settings: settings as unknown as Record<string, unknown>,
    createdAt: now,
    updatedAt: now,
    closedAt: null,
  };

  await getStore().put(events, row);
  await seedChallenges(eventId, kind);

  return created({ event: toEvent(row, await countsFor(eventId)) });
}

async function listEvents(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const host = requireHost(event);
  const rows = (await getStore().query(events, 'hostId', host.userId)).sort(
    (a, b) => b.createdAt - a.createdAt,
  );
  const counts = await countsForMany(rows.map((row) => row.eventId));
  return ok({
    events: rows.map((row) => toEvent(row, counts.get(row.eventId) ?? NO_COUNTS)),
  });
}

async function getEvent(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const host = requireHost(event);
  const row = await requireOwnedEvent(pathParam(event, 'eventId'), host.userId);
  return ok({ event: toEvent(row, await countsFor(row.eventId)) });
}

async function updateEvent(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const host = requireHost(event);
  const current = await requireOwnedEvent(pathParam(event, 'eventId'), host.userId);
  const body = jsonBody<{
    name?: string;
    kind?: string;
    date?: number | null;
    location?: string;
    welcome?: string;
    settings?: Partial<EventSettings>;
    closed?: boolean;
    coverPhotoId?: string | null;
  }>(event);

  const patch: Partial<EventRow> = { updatedAt: Date.now() };

  if (body.name !== undefined) {
    const name = body.name.trim();
    if (!name) throw new HttpError(400, 'Give the event a name');
    if (name.length > 120) throw new HttpError(400, 'That name is too long');
    patch.name = name;
  }
  if (body.kind !== undefined && isKind(body.kind)) patch.kind = body.kind;
  if (body.date !== undefined) patch.date = typeof body.date === 'number' ? body.date : null;
  if (body.location !== undefined) patch.location = body.location.trim().slice(0, 160);
  if (body.welcome !== undefined) patch.welcome = body.welcome.trim().slice(0, 400);
  if (body.settings !== undefined) {
    patch.settings = mergeSettings(settingsOf(current), body.settings) as unknown as Record<
      string,
      unknown
    >;
  }
  if (body.closed !== undefined) {
    patch.closedAt = body.closed ? (current.closedAt ?? Date.now()) : null;
  }

  if (body.coverPhotoId !== undefined) {
    if (body.coverPhotoId === null) {
      patch.coverPhotoId = null;
      patch.coverKey = null;
    } else {
      const photo = await getStore().get(photos, body.coverPhotoId);
      if (!photo || photo.eventId !== current.eventId) {
        throw new HttpError(400, 'That photo is not from this event');
      }
      patch.coverPhotoId = photo.photoId;
      patch.coverKey = photo.key;
    }
  }

  const updated = await getStore().patch(events, current.eventId, patch);
  return ok({ event: toEvent(updated ?? current, await countsFor(current.eventId)) });
}

/**
 * Deletes an event and the rows under it.
 *
 * The photo objects are left in storage on purpose: a lifecycle rule on the
 * bucket is the honest place to expire bytes, and deleting a thousand objects
 * inside one request is how half-deleted albums happen.
 */
async function deleteEvent(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const host = requireHost(event);
  const row = await requireOwnedEvent(pathParam(event, 'eventId'), host.userId);
  const store = getStore();

  const [photoRows, guestRows, challengeRows, reactionRows, commentRows, rollRows] =
    await Promise.all([
      store.query(photos, 'eventId', row.eventId),
      store.query(guests, 'eventId', row.eventId),
      store.query(challenges, 'eventId', row.eventId),
      store.query(reactions, 'eventId', row.eventId),
      store.query(comments, 'eventId', row.eventId),
      store.query(rolls, 'eventId', row.eventId),
    ]);

  await Promise.all([
    ...photoRows.map((item) => store.remove(photos, item.photoId)),
    ...guestRows.map((item) => store.remove(guests, item.guestId)),
    ...challengeRows.map((item) => store.remove(challenges, item.challengeId)),
    ...reactionRows.map((item) => store.remove(reactions, item.reactionId)),
    ...commentRows.map((item) => store.remove(comments, item.commentId)),
    ...rollRows.map((item) => store.remove(rolls, item.rollId)),
  ]);
  await store.remove(events, row.eventId);

  return noContent();
}

/** A new join code — for a host whose code was seen by people it should not have been. */
async function rotateCode(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const host = requireHost(event);
  const current = await requireOwnedEvent(pathParam(event, 'eventId'), host.userId);
  const updated = await getStore().patch(events, current.eventId, {
    code: await uniqueCode(),
    updatedAt: Date.now(),
  });
  return ok({ event: toEvent(updated ?? current, await countsFor(current.eventId)) });
}

async function eventStats(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const host = requireHost(event);
  const row = await requireOwnedEvent(pathParam(event, 'eventId'), host.userId);
  return ok({ stats: await statsFor(row) });
}

/**
 * The guest roster, with each guest's contribution.
 *
 * Names and counts are all a host needs to answer "who shot this", and the counts
 * are why it is a server read: the leaderboard is everybody's photos counted, not
 * one page of them.
 */
async function listGuests(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const host = requireHost(event);
  const row = await requireOwnedEvent(pathParam(event, 'eventId'), host.userId);
  const store = getStore();

  const [guestRows, photoRows, reactionRows] = await Promise.all([
    store.query(guests, 'eventId', row.eventId),
    store.query(photos, 'eventId', row.eventId),
    store.query(reactions, 'eventId', row.eventId),
  ]);

  const photosByGuest = new Map<string, number>();
  for (const photo of photoRows) {
    photosByGuest.set(photo.guestId, (photosByGuest.get(photo.guestId) ?? 0) + 1);
  }
  const reactionsByGuest = new Map<string, number>();
  for (const reaction of reactionRows) {
    reactionsByGuest.set(reaction.guestId, (reactionsByGuest.get(reaction.guestId) ?? 0) + 1);
  }

  return ok({
    guests: guestRows
      .map((guest) =>
        toGuest(
          guest,
          photosByGuest.get(guest.guestId) ?? 0,
          reactionsByGuest.get(guest.guestId) ?? 0,
        ),
      )
      .sort((a, b) => b.photoCount - a.photoCount || a.joinedAt - b.joinedAt),
  });
}

async function removeGuest(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const host = requireHost(event);
  const row = await requireOwnedEvent(pathParam(event, 'eventId'), host.userId);
  const guestId = pathParam(event, 'guestId');

  const store = getStore();
  const guest = await store.get(guests, guestId);
  if (!guest || guest.eventId !== row.eventId) throw new HttpError(404, 'No such guest');

  // Their photos stay: they are part of the evening, and removing somebody from
  // the roster is a statement about access rather than about what happened.
  await store.remove(guests, guestId);
  return noContent();
}

async function listChallenges(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const host = requireHost(event);
  const row = await requireOwnedEvent(pathParam(event, 'eventId'), host.userId);
  return ok({ challenges: await challengesOfEvent(row.eventId) });
}

/** The prompts of one event, each with how many photos it has produced. */
export async function challengesOfEvent(eventId: string): Promise<Challenge[]> {
  const store = getStore();
  const [rows, photoRows] = await Promise.all([
    store.query(challenges, 'eventId', eventId),
    store.query(photos, 'eventId', eventId),
  ]);

  const counts = new Map<string, number>();
  for (const photo of photoRows) {
    if (!photo.challengeId) continue;
    counts.set(photo.challengeId, (counts.get(photo.challengeId) ?? 0) + 1);
  }

  return rows
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((row) => toChallenge(row, counts.get(row.challengeId) ?? 0));
}

export const eventHandlers = {
  create: handle(createEvent),
  list: handle(listEvents),
  get: handle(getEvent),
  update: handle(updateEvent),
  remove: handle(deleteEvent),
  rotateCode: handle(rotateCode),
  stats: handle(eventStats),
  guests: handle(listGuests),
  removeGuest: handle(removeGuest),
  challenges: handle(listChallenges),
};
