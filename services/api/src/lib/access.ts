/**
 * Who may do what to an event.
 *
 * Two rules shape this file. A host may do anything to their own event and
 * nothing to anybody else's, and a guest may do the guest things — shoot, react,
 * comment — to the event their token names. Everything else in the API asks these
 * two questions rather than comparing ids itself.
 */
import type { CameraMode, EventSettings } from '@foto/types';
import { events, guests } from '../types/collections';
import type { EventRow, GuestRow } from '../types/records';
import { HttpError } from './http';
import { getStore } from './store';
import { normalizeCode } from './codes';
import { settingsOf } from './serialize';

export async function eventById(eventId: string): Promise<EventRow> {
  const row = await getStore().get(events, eventId);
  if (!row) throw new HttpError(404, 'That event does not exist');
  return row;
}

export async function eventByJoinCode(code: string): Promise<EventRow> {
  const [row] = await getStore().query(events, 'code', normalizeCode(code));
  if (!row) throw new HttpError(404, 'No event has that code');
  return row;
}

/** The event, if this host owns it. Somebody else's event answers 404, not 403. */
export async function requireOwnedEvent(eventId: string, hostId: string): Promise<EventRow> {
  const row = await eventById(eventId);
  if (row.hostId !== hostId) throw new HttpError(404, 'That event does not exist');
  return row;
}

/** An event that is still accepting photos. */
export function requireOpen(row: EventRow): EventRow {
  if (row.closedAt !== null) {
    throw new HttpError(409, 'This event is closed — the album is read-only now');
  }
  return row;
}

export async function guestRow(eventId: string, guestId: string): Promise<GuestRow> {
  const row = await getStore().get(guests, guestId);
  if (!row || row.eventId !== eventId) {
    throw new HttpError(403, 'That guest session is not part of this event');
  }
  return row;
}

/** Whether a guest may see the gallery, given the event's visibility setting. */
export function galleryVisibleTo(settings: EventSettings, viewer: {
  isHost: boolean;
  isGuest: boolean;
}): boolean {
  if (viewer.isHost) return true;
  if (settings.galleryVisibility === 'everyone') return true;
  if (settings.galleryVisibility === 'guests') return viewer.isGuest;
  return false;
}

/** Narrows a `Record<string, unknown>` from a settings patch into real settings. */
export function mergeSettings(
  current: EventSettings,
  patch: Partial<EventSettings> | undefined,
): EventSettings {
  if (!patch) return current;
  const next: EventSettings = { ...current };

  const modes: CameraMode[] = ['open', 'roll'];
  if (patch.cameraMode && modes.includes(patch.cameraMode)) next.cameraMode = patch.cameraMode;

  if (patch.galleryVisibility && ['everyone', 'guests', 'host'].includes(patch.galleryVisibility)) {
    next.galleryVisibility = patch.galleryVisibility;
  }
  if (patch.rollReveal && ['shots', 'host', 'timer'].includes(patch.rollReveal)) {
    next.rollReveal = patch.rollReveal;
  }
  if (patch.wallOrder && ['newest', 'chronological'].includes(patch.wallOrder)) {
    next.wallOrder = patch.wallOrder;
  }
  if (patch.wallFit && ['contain', 'cover'].includes(patch.wallFit)) {
    next.wallFit = patch.wallFit;
  }
  if (typeof patch.wallSeconds === 'number') {
    // A wall that changes every second is a strobe; two minutes is a slideshow nobody
    // is watching any more. The floor and ceiling are the product's, not a preference.
    next.wallSeconds = Math.min(60, Math.max(2, Math.round(patch.wallSeconds)));
  }
  if (typeof patch.shotsPerRoll === 'number') {
    next.shotsPerRoll = Math.min(48, Math.max(1, Math.round(patch.shotsPerRoll)));
  }
  if (typeof patch.rollRevealMinutes === 'number') {
    next.rollRevealMinutes = Math.min(60 * 24 * 7, Math.max(1, Math.round(patch.rollRevealMinutes)));
  }
  const flags: (keyof EventSettings)[] = [
    'photoApproval',
    'allowComments',
    'allowReactions',
    'allowDownloads',
    'challengesEnabled',
    'slideshowEnabled',
    'wallCaptions',
  ];
  for (const flag of flags) {
    const value = patch[flag];
    if (typeof value === 'boolean') (next[flag] as boolean) = value;
  }
  return next;
}

/** The settings of an event, as stored-and-defaulted. */
export function currentSettings(row: EventRow): EventSettings {
  return settingsOf(row);
}
