/**
 * Film rolls — the disposable camera, and the rules it needs.
 *
 * Three of them, and each is a decision the product made rather than an
 * implementation detail:
 *
 * 1. **A shot is invisible until its roll develops**, and that includes to the
 *    person who shot it. That is the whole difference between this and a normal
 *    camera: nobody is performing for a live gallery.
 * 2. **A roll develops once**, by whichever of the three reveals the host chose —
 *    the last shot, a timer, or the host pressing the button.
 * 3. **A developed roll cannot be un-developed.** Hidden photos can be hidden
 *    again, but a reveal does not go backwards.
 *
 * The timer reveal has no cron behind it: a roll whose time has passed develops
 * the next time anybody reads the event, which is indistinguishable from having
 * developed on time to everybody who could see it.
 */
import { ulid } from 'ulid';
import { guests, photos, rolls } from '../types/collections';
import type { EventRow, GuestRow, PhotoRow, RollRow } from '../types/records';
import { HttpError } from './http';
import { getStore } from './store';
import { settingsOf } from './serialize';

/** How many shots are on the caller's open roll, if they have one. */
export async function openRollOf(guest: GuestRow): Promise<RollRow | null> {
  if (!guest.openRollId) return null;
  const row = await getStore().get(rolls, guest.openRollId);
  if (!row || row.status === 'developed') {
    // A roll that has developed is no longer open. Clearing the pointer here keeps
    // the guest row honest without a scheduled job.
    if (row?.status === 'developed') {
      await getStore().patch(guests, guest.guestId, {
        openRollId: null,
      });
    }
    return null;
  }
  return row;
}

/** Starts a roll for a guest, or answers with the one they already have open. */
export async function startRoll(
  event: EventRow,
  guest: GuestRow,
  shotLimit?: number,
): Promise<RollRow> {
  const open = await openRollOf(guest);
  if (open) return open;

  const settings = settingsOf(event);
  const limit = Math.min(
    48,
    Math.max(1, Math.round(shotLimit ?? settings.shotsPerRoll)),
  );
  const now = Date.now();

  const row: RollRow = {
    rollId: ulid(),
    eventId: event.eventId,
    guestId: guest.guestId,
    guestName: guest.name,
    guestEmoji: guest.emoji,
    shotLimit: limit,
    shotCount: 0,
    status: 'shooting',
    startedAt: now,
    developAt: settings.rollReveal === 'timer' ? now + settings.rollRevealMinutes * 60_000 : null,
    developedAt: null,
  };

  await getStore().put(rolls, row);
  await getStore().patch(guests, guest.guestId, {
    openRollId: row.rollId,
  });
  return row;
}

/**
 * Develops a roll: every frame on it becomes readable at once.
 *
 * Where they land depends on the event: a host who approves photos still approves
 * them, so the reveal is that they exist rather than that they are public.
 */
export async function developRoll(row: RollRow, event: EventRow): Promise<RollRow> {
  if (row.status === 'developed') return row;

  const settings = settingsOf(event);
  const store = getStore();
  const frames = await store.query(photos, 'rollId', row.rollId);
  const status = settings.photoApproval ? 'pending' : 'visible';

  await Promise.all(
    frames
      .filter((frame) => frame.status === 'developing')
      .map((frame) => store.patch(photos, frame.photoId, { status })),
  );

  const developed = await store.patch(rolls, row.rollId, {
    status: 'developed',
    developedAt: Date.now(),
    developAt: null,
  });

  const guest = await store.get(
    guests,
    row.guestId,
  );
  if (guest?.openRollId === row.rollId) {
    await store.patch(guests, row.guestId, { openRollId: null });
  }

  return developed ?? { ...row, status: 'developed', developedAt: Date.now() };
}

/** Develops every roll of an event whose timer has run out. Called by the reads. */
export async function developDueRolls(event: EventRow): Promise<void> {
  const store = getStore();
  const rows = await store.query(rolls, 'eventId', event.eventId);
  const now = Date.now();
  const due = rows.filter(
    (row) => row.status === 'shooting' && row.developAt !== null && row.developAt <= now,
  );
  for (const row of due) await developRoll(row, event);
}

/**
 * Records a frame against a roll.
 *
 * It answers the roll as it now stands — which matters, because the last shot of
 * a roll develops it, and the client that took that shot needs to be told the
 * reveal just happened rather than discovering it on a poll.
 */
export async function addFrameToRoll(
  event: EventRow,
  roll: RollRow,
  photo: PhotoRow,
): Promise<RollRow> {
  const shotCount = roll.shotCount + 1;
  await getStore().patch(photos, photo.photoId, { rollId: roll.rollId });

  const updated = await getStore().patch(rolls, roll.rollId, { shotCount });
  const current = updated ?? { ...roll, shotCount };

  const settings = settingsOf(event);
  const full = current.shotCount >= current.shotLimit;
  if (full && settings.rollReveal === 'shots') return developRoll(current, event);
  return current;
}

/** A guest's rolls, newest first. */
export async function rollsOfGuest(guestId: string): Promise<RollRow[]> {
  const rows = await getStore().query(rolls, 'guestId', guestId);
  return rows.sort((a, b) => b.startedAt - a.startedAt);
}

/** Every roll of an event, newest first. */
export async function rollsOfEvent(eventId: string): Promise<RollRow[]> {
  const rows = await getStore().query(rolls, 'eventId', eventId);
  return rows.sort((a, b) => b.startedAt - a.startedAt);
}

/** Refuses a shot when the roll it would land on is already full. */
export function assertRollHasRoom(roll: RollRow): void {
  if (roll.shotCount >= roll.shotLimit) {
    throw new HttpError(409, 'This roll is full — develop it and start another');
  }
}
