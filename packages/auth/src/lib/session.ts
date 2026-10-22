/**
 * The guest session, in the browser.
 *
 * A host's identity lives in Cognito; a guest's is this. Joining an event answers
 * with a token scoped to that event, and it is kept in `localStorage` rather than a
 * cookie or a session: this is a phone at a wedding, the tab will be backgrounded and
 * killed by the camera app, and being signed out by that would be the worst thing
 * the product could do to somebody mid-reception.
 *
 * One event at a time, on purpose. A guest at two events in one evening is a rare
 * case, and one that resolves itself: the device id below is what makes rejoining
 * the other event a single request that hands back the same guest.
 */

const GUEST_KEY = 'foto.guest';
const DEVICE_KEY = 'foto.device';

export interface GuestSession {
  token: string;
  /** The join code this session was made for. */
  code: string;
  eventId: string;
  guest: { guestId: string; name: string; emoji: string };
}

type Listener = () => void;
const listeners = new Set<Listener>();

function notify(): void {
  for (const listener of listeners) listener();
}

/** Subscribe to changes, for the header that re-renders when a guest joins. */
export function subscribeToGuestSession(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function read<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage disabled: the session simply does not survive a reload.
  }
  notify();
}

export function getGuestSession(): GuestSession | null {
  return read<GuestSession>(GUEST_KEY);
}

export function setGuestSession(session: GuestSession): void {
  write(GUEST_KEY, session);
}

export function clearGuestSession(): void {
  write(GUEST_KEY, null);
}

/** The guest's token, for the API client. */
export function guestToken(): string | null {
  return getGuestSession()?.token ?? null;
}

/**
 * A stable id for this browser, used to recognise a returning guest.
 *
 * Not a fingerprint: a random value kept in storage, so a guest who reloads is the
 * same guest and a guest who opens the link on a friend's phone is a new one.
 */
export function getDeviceId(): string {
  if (typeof window === 'undefined') return 'server';
  const existing = read<string>(DEVICE_KEY);
  if (existing) return existing;

  const created =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `dev-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  write(DEVICE_KEY, created);
  return created;
}
