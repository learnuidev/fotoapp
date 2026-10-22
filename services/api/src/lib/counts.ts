/**
 * The numbers a screen puts on a card.
 *
 * Counted by reading rows rather than incremented on a counter, which is the one
 * thing here worth explaining. A counter is faster and wrong: every path that
 * deletes a photo, hides one, develops a roll or removes a reaction would have to
 * remember to decrement the right field, and the day one of them forgets, the
 * product shows a number that is not true and nobody knows which screen lied.
 * These reads are one query per collection on an index that exists anyway, and
 * they are exactly right.
 */
import type { EventCounts } from '@foto/types';
import { comments, events, guests, photos, reactions, rolls } from '../types/collections';
import type { EventRow } from '../types/records';
import { getStore } from './store';

export async function countsFor(eventId: string): Promise<EventCounts> {
  const store = getStore();
  const [photoRows, guestRows, reactionRows, commentRows, rollRows] = await Promise.all([
    store.query(photos, 'eventId', eventId),
    store.query(guests, 'eventId', eventId),
    store.query(reactions, 'eventId', eventId),
    store.query(comments, 'eventId', eventId),
    store.query(rolls, 'eventId', eventId),
  ]);

  return {
    photos: photoRows.filter((p) => p.status === 'visible').length,
    pending: photoRows.filter((p) => p.status === 'pending').length,
    hidden: photoRows.filter((p) => p.status === 'hidden').length,
    guests: guestRows.length,
    reactions: reactionRows.length,
    comments: commentRows.length,
    rolls: rollRows.length,
  };
}

/** Counts for several events at once, so a console list is one round of reads per event. */
export async function countsForMany(eventIds: string[]): Promise<Map<string, EventCounts>> {
  const entries = await Promise.all(
    eventIds.map(async (id) => [id, await countsFor(id)] as const),
  );
  return new Map(entries);
}

/** The event a code names, or undefined. Used by every guest-facing read. */
export async function eventByCode(code: string): Promise<EventRow | undefined> {
  const [row] = await getStore().query(events, 'code', code);
  return row;
}
