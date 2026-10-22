/**
 * A roll — the disposable camera.
 *
 * This is the idea taken from GuestCam and folded into everything the other
 * three apps do. A guest is handed a film roll with a fixed number of shots.
 * Nothing on it can be seen until it is developed: not by the other guests, not
 * by the host, and notably not by the person who shot it. What that buys is a
 * different kind of photo — nobody is performing for a gallery that updates
 * live — and a second act for the event, when the rolls come back.
 */
import type { Photo } from './photo';

export type RollStatus = 'shooting' | 'developed';

export interface Roll {
  rollId: string;
  eventId: string;
  guestId: string;
  guestName: string;
  guestEmoji: string;
  /** How many shots this roll was handed. */
  shotLimit: number;
  shotCount: number;
  status: RollStatus;
  startedAt: number;
  /** When a `timer` roll develops by itself. Null for the other reveal modes. */
  developAt: number | null;
  developedAt: number | null;
}

/** A roll as the host's console lists it: with what was on it, once developed. */
export interface RollWithPhotos extends Roll {
  photos: Photo[];
}
