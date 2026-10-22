/**
 * Cache keys, in one place.
 *
 * Every query and every invalidation names its key from here rather than building
 * a string at the call site: an invalidation that guessed a key slightly wrong is
 * a screen that quietly shows the state before the last thing the user did, which
 * is the most expensive class of bug this kind of app has.
 */
export const fotoKeys = {
  all: ['foto'] as const,

  // --- the console ---------------------------------------------------------
  events: () => ['foto', 'host', 'events'] as const,
  event: (eventId: string) => ['foto', 'host', 'event', eventId] as const,
  eventStats: (eventId: string) => ['foto', 'host', 'event', eventId, 'stats'] as const,
  guestRoster: (eventId: string) => ['foto', 'host', 'event', eventId, 'guests'] as const,
  eventRolls: (eventId: string) => ['foto', 'host', 'event', eventId, 'rolls'] as const,
  eventChallenges: (eventId: string) => ['foto', 'host', 'event', eventId, 'challenges'] as const,
  hostPhotos: (eventId: string, filters: Record<string, unknown>) =>
    ['foto', 'host', 'event', eventId, 'photos', filters] as const,
  downloads: (eventId: string, favoriteOnly: boolean) =>
    ['foto', 'host', 'event', eventId, 'downloads', favoriteOnly] as const,

  // --- the guest screens ---------------------------------------------------
  join: (code: string) => ['foto', 'guest', 'join', code] as const,
  guestMe: (eventId: string) => ['foto', 'guest', 'me', eventId] as const,
  guestPhotos: (eventId: string, filters: Record<string, unknown>) =>
    ['foto', 'guest', eventId, 'photos', filters] as const,
  guestRolls: (eventId: string) => ['foto', 'guest', eventId, 'rolls'] as const,
  comments: (photoId: string) => ['foto', 'comments', photoId] as const,

  // --- the wall ------------------------------------------------------------
  wall: (code: string) => ['foto', 'wall', code] as const,
};
