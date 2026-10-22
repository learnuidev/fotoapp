import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Tailwind's own conflict resolution, in front of `clsx`. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** "1 photo" / "12 photos", the plural rule every count in this product needs. */
export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** A short, human date: `Sat 14 Feb, 21:40`. */
export function formatMoment(timestamp: number | null | undefined): string {
  if (!timestamp) return '';
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp));
}

/** Just the clock: `21:40`, for a gallery that is all one evening. */
export function formatClock(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(
    new Date(timestamp),
  );
}

/** "in 3 minutes" / "2 hours ago", for a roll that is still in the camera. */
export function relativeTime(timestamp: number, now = Date.now()): string {
  const delta = timestamp - now;
  const minutes = Math.round(Math.abs(delta) / 60_000);
  const format = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  if (minutes < 60) return format.format(Math.sign(delta) * minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (hours < 36) return format.format(Math.sign(delta) * hours, 'hour');
  return format.format(Math.sign(delta) * Math.round(hours / 24), 'day');
}

/** Bytes, for a console that says how much of a bucket an evening used. */
export function formatBytes(bytes: number): string {
  if (!bytes) return '0 MB';
  const mb = bytes / (1024 * 1024);
  if (mb < 1) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (mb < 1000) return `${mb.toFixed(mb < 10 ? 1 : 0)} MB`;
  return `${(mb / 1024).toFixed(1)} GB`;
}
