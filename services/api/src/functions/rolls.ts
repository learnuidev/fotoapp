/**
 * Rolls, from both sides.
 *
 * A guest starts one, shoots it, and may develop it early. A host watches them
 * come back — and, when the event reveals by hand, presses the button that brings
 * them all back at once. That press is the second act of the evening, so it is a
 * route rather than a side effect of the last shot.
 */
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { requireGuestOf, requireHost } from '../lib/auth';
import { currentSettings, eventById, requireOpen, requireOwnedEvent } from '../lib/access';
import { countsFor } from '../lib/counts';
import { HttpError, created, handle, jsonBody, ok, pathParam } from '../lib/http';
import { photoContext, toPhoto, toRoll } from '../lib/serialize';
import { developDueRolls, developRoll, rollsOfEvent, rollsOfGuest, startRoll } from '../lib/rolls';
import { getStore } from '../lib/store';
import { guests, photos } from '../types/collections';
import type { PhotoRow } from '../types/records';

/** Starts a roll for the caller, or hands back the one they are already shooting. */
async function startMyRoll(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const eventId = pathParam(event, 'eventId');
  const row = await eventById(eventId);
  requireOpen(row);

  const identity = await requireGuestOf(event, eventId);
  const guestRow = await getStore().get(guests, identity.guestId);
  if (!guestRow) throw new HttpError(403, 'Join this event first');

  const body = jsonBody<{ shotLimit?: number }>(event);
  const roll = await startRoll(row, guestRow, body.shotLimit);
  return created({ roll: toRoll(roll) });
}

/** The caller's rolls, newest first, with the frames on the developed ones. */
async function myRolls(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const eventId = pathParam(event, 'eventId');
  const identity = await requireGuestOf(event, eventId);
  const eventRow = await eventById(eventId);
  await developDueRolls(eventRow);

  const store = getStore();
  const rows = await rollsOfGuest(identity.guestId);

  // A guest may see the frames on a roll that has developed — they are the reason
  // the roll was shot — but never on one still developing, including their own.
  const photoRows = await store.query(photos, 'eventId', eventId);
  const byRoll = new Map<string, PhotoRow[]>();
  for (const photo of photoRows) {
    if (!photo.rollId || photo.guestId !== identity.guestId) continue;
    const list = byRoll.get(photo.rollId);
    if (list) list.push(photo);
    else byRoll.set(photo.rollId, [photo]);
  }

  const ctx = await photoContext(eventId, { guestId: identity.guestId });
  return ok({
    rolls: rows.map((roll) => ({
      ...toRoll(roll),
      photos:
        roll.status === 'developed'
          ? (byRoll.get(roll.rollId) ?? [])
              .sort((a, b) => a.createdAt - b.createdAt)
              .map((photo) => toPhoto(photo, ctx))
          : [],
    })),
  });
}

/**
 * Every roll of an event, for the host.
 *
 * A developing roll is listed with its shot count and *no frames*: the host can
 * see that a roll exists and how far along it is, and pressing develop is what
 * makes its photos exist as far as anybody is concerned. That is the one place
 * the host's privilege is deliberately withheld from them.
 */
async function eventRolls(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const host = requireHost(event);
  const row = await requireOwnedEvent(pathParam(event, 'eventId'), host.userId);
  await developDueRolls(row);

  const store = getStore();
  const [rows, photoRows] = await Promise.all([
    rollsOfEvent(row.eventId),
    store.query(photos, 'eventId', row.eventId),
  ]);

  const byRoll = new Map<string, PhotoRow[]>();
  for (const photo of photoRows) {
    if (!photo.rollId) continue;
    const list = byRoll.get(photo.rollId);
    if (list) list.push(photo);
    else byRoll.set(photo.rollId, [photo]);
  }

  const ctx = await photoContext(row.eventId, { hostId: host.userId });
  return ok({
    rolls: rows.map((roll) => ({
      ...toRoll(roll),
      photos:
        roll.status === 'developed'
          ? (byRoll.get(roll.rollId) ?? [])
              .sort((a, b) => a.createdAt - b.createdAt)
              .map((photo) => toPhoto(photo, ctx))
          : [],
    })),
    settings: currentSettings(row),
  });
}

/** "Develop everything" — how an event set to reveal by hand comes back at the end. */
async function developAll(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const host = requireHost(event);
  const row = await requireOwnedEvent(pathParam(event, 'eventId'), host.userId);
  const store = getStore();

  const rows = await rollsOfEvent(row.eventId);
  const shooting = rows.filter((roll) => roll.status === 'shooting');
  for (const roll of shooting) await developRoll(roll, row);

  return ok({ developed: shooting.length, counts: await countsFor(row.eventId) });
}

export const rollHandlers = {
  start: handle(startMyRoll),
  mine: handle(myRolls),
  list: handle(eventRolls),
  developAll: handle(developAll),
};
