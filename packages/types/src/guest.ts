/**
 * A guest — somebody at the event, holding a phone and a join code.
 *
 * There is no account here on purpose. Every one of the apps this is built from
 * learned the same thing: the moment a wedding guest has to install something or
 * make a password, the photos stop arriving. A guest is a name, an emoji, a
 * device, and a session token for one event.
 */
export interface Guest {
  guestId: string;
  eventId: string;
  name: string;
  /** The avatar: one emoji, chosen on the join screen. */
  emoji: string;
  joinedAt: number;
  lastSeenAt: number;
  photoCount: number;
  reactionCount: number;
  /** `host` when the person who made the event joined it from their own phone. */
  role: 'host' | 'guest';
  /** The roll they are shooting, while an event shoots on film. */
  openRollId: string | null;
}

/**
 * What a join answers with: the token that stands for this guest from here on.
 *
 * The token is per event and is not an account. It is what tells the API "this
 * is the person who shot that", and it is handed out again to the same device
 * when it rejoins, so a guest who clears a tab does not become a second guest.
 */
export interface GuestSession {
  token: string;
  guest: Guest;
  /** Whether this call made a new guest or recognised the device. */
  created: boolean;
}
