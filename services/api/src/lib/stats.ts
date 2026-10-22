/**
 * The console's analytics.
 *
 * Computed here rather than in the page because every number in it is a read over
 * all of the event's photos and reactions: a console that wanted to draw the
 * upload chart would otherwise download the gallery to count it, on a phone, over
 * hotel wi-fi, while the party is happening.
 */
import { REACTIONS, type EventStats, type StatBar } from '@foto/types';
import { challenges, comments, guests, photos, reactions } from '../types/collections';
import type { EventRow } from '../types/records';
import { getStore } from '../lib/store';

/** The hour of a moment, as a label a chart can print: `21`. */
function hourLabel(timestamp: number): string {
  return `${String(new Date(timestamp).getHours()).padStart(2, '0')}:00`;
}

export async function statsFor(event: EventRow): Promise<EventStats> {
  const store = getStore();
  const [photoRows, reactionRows, commentRows, challengeRows, guestRows] = await Promise.all([
    store.query(photos, 'eventId', event.eventId),
    store.query(reactions, 'eventId', event.eventId),
    store.query(comments, 'eventId', event.eventId),
    store.query(challenges, 'eventId', event.eventId),
    store.query(guests, 'eventId', event.eventId),
  ]);

  const guestNames = new Map(guestRows.map((guest) => [guest.guestId, guest] as const));
  const byHour = new Map<string, number>();
  const byGuest = new Map<string, { count: number; emoji: string; name: string }>();
  const byChallenge = new Map<string, number>();
  const byReaction = new Map<string, number>();

  let totalBytes = 0;
  let favoriteCount = 0;

  for (const photo of photoRows) {
    totalBytes += photo.size;
    if (photo.favorite) favoriteCount += 1;

    const hour = hourLabel(photo.createdAt);
    byHour.set(hour, (byHour.get(hour) ?? 0) + 1);

    const guest = byGuest.get(photo.guestId);
    byGuest.set(photo.guestId, {
      count: (guest?.count ?? 0) + 1,
      emoji: guest?.emoji ?? photo.guestEmoji,
      // The photo carries the name it was shot under, which is the only name a host
      // who never joined the roster has.
      name: guest?.name ?? photo.guestName,
    });

    if (photo.challengeId) {
      byChallenge.set(photo.challengeId, (byChallenge.get(photo.challengeId) ?? 0) + 1);
    }
  }

  for (const reaction of reactionRows) {
    byReaction.set(reaction.emoji, (byReaction.get(reaction.emoji) ?? 0) + 1);
  }

  const challengeTitles = new Map(challengeRows.map((row) => [row.challengeId, row] as const));

  const uploadsByHour: StatBar[] = [...byHour.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-24)
    .map(([label, value]) => ({ label, value }));

  const topGuests: StatBar[] = [...byGuest.entries()]
    .map(([guestId, entry]) => ({
      label: guestNames.get(guestId)?.name ?? entry.name ?? 'A guest',
      value: entry.count,
      emoji: entry.emoji,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  const topChallenges: StatBar[] = [...byChallenge.entries()]
    .map(([challengeId, value]) => ({
      label: challengeTitles.get(challengeId)?.title ?? 'A prompt',
      value,
      emoji: challengeTitles.get(challengeId)?.emoji ?? '📸',
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  const reactionBreakdown: StatBar[] = REACTIONS.map((emoji) => ({
    label: emoji,
    value: byReaction.get(emoji) ?? 0,
  })).filter((bar) => bar.value > 0);

  return {
    photoCount: photoRows.length,
    pendingCount: photoRows.filter((photo) => photo.status === 'pending').length,
    hiddenCount: photoRows.filter((photo) => photo.status === 'hidden').length,
    guestCount: guestRows.length,
    rollCount: photoRows.filter((photo) => Boolean(photo.rollId)).length,
    reactionCount: reactionRows.length,
    commentCount: commentRows.length,
    favoriteCount,
    totalBytes,
    uploadsByHour,
    topGuests,
    topChallenges,
    reactionBreakdown,
  };
}
