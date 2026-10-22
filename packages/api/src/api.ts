/**
 * The API, one method per route.
 *
 * The same method list is exported twice — `api` for the console and `guestApi`
 * for the guest screens — because the two differ only in which token they attach.
 * Writing them once is what keeps a gallery read and a gallery read-as-host from
 * drifting apart.
 */
import type {
  Challenge,
  ChallengeResponse,
  CreateChallengePayload,
  CreateEventPayload,
  CreatePhotoResponse,
  Event,
  EventResponse,
  EventStats,
  EventStatsResponse,
  Guest,
  GuestResponse,
  HostUser,
  JoinEventResponse,
  JoinSessionResponse,
  ListChallengesResponse,
  ListCommentsResponse,
  ListEventsResponse,
  ListPhotosResponse,
  ListRollsResponse,
  Photo,
  PhotoComment,
  PhotoFeedResponse,
  PhotoResponse,
  ReactionEmoji,
  ReactionResponse,
  ReserveUploadResponse,
  Roll,
  RollResponse,
  UpdateChallengePayload,
  UpdateEventPayload,
  UpdatePhotoPayload,
  WallResponse,
} from '@foto/types';
import { request } from './lib/client';

function endpoints(scope: 'host' | 'guest') {
  const call = <T>(path: string, init?: RequestInit) => request<T>(path, init, scope);

  /**
   * Where the photo routes begin, which differs by who is asking.
   *
   * The deletions and the download list serve both audiences, and the public ones
   * cannot see a host's token — so the console's copies live under `host/` where the
   * authorizer does. The handlers are the same; only the door changes.
   */
  const photoBase = scope === 'host' ? '/host/photos' : '/photos';
  const json = (method: string, body: unknown): RequestInit => ({
    method,
    body: JSON.stringify(body),
  });

  return {
    // --- the account ---------------------------------------------------------
    // Signing in is Cognito's job and happens through Amplify in `@foto/auth`;
    // this is only the "who does this token belong to" check the console makes on
    // boot.
    me: () => call<{ user: HostUser }>('/me'),

    // --- events, as their host ----------------------------------------------
    listEvents: () => call<ListEventsResponse>('/events'),
    getEvent: (eventId: string) => call<EventResponse>(`/events/${eventId}`),
    createEvent: (payload: CreateEventPayload) => call<EventResponse>('/events', json('POST', payload)),
    updateEvent: (eventId: string, payload: UpdateEventPayload) =>
      call<EventResponse>(`/events/${eventId}`, json('PATCH', payload)),
    deleteEvent: (eventId: string) => call<void>(`/events/${eventId}`, { method: 'DELETE' }),
    rotateCode: (eventId: string) =>
      call<EventResponse>(`/events/${eventId}/code`, { method: 'POST' }),
    getEventStats: (eventId: string) => call<EventStatsResponse>(`/events/${eventId}/stats`),
    listGuests: (eventId: string) => call<{ guests: Guest[] }>(`/events/${eventId}/guests`),
    removeGuest: (eventId: string, guestId: string) =>
      call<void>(`/events/${eventId}/guests/${guestId}`, { method: 'DELETE' }),
    listChallenges: (eventId: string) =>
      call<ListChallengesResponse>(`/events/${eventId}/challenges`),
    createChallenge: (eventId: string, payload: CreateChallengePayload) =>
      call<ChallengeResponse>(`/events/${eventId}/challenges`, json('POST', payload)),
    updateChallenge: (challengeId: string, payload: UpdateChallengePayload) =>
      call<ChallengeResponse>(`/challenges/${challengeId}`, json('PATCH', payload)),
    deleteChallenge: (challengeId: string) =>
      call<void>(`/challenges/${challengeId}`, { method: 'DELETE' }),

    // --- photos -------------------------------------------------------------
    listPhotos: (
      eventId: string,
      filters: {
        limit?: number;
        before?: number;
        status?: string;
        guestId?: string;
        challengeId?: string;
        rollId?: string;
        favorite?: boolean;
      } = {},
    ) => {
      const query = new URLSearchParams();
      if (filters.limit) query.set('limit', String(filters.limit));
      if (filters.before) query.set('before', String(filters.before));
      if (filters.status) query.set('status', filters.status);
      if (filters.guestId) query.set('guestId', filters.guestId);
      if (filters.challengeId) query.set('challengeId', filters.challengeId);
      if (filters.rollId) query.set('rollId', filters.rollId);
      if (filters.favorite) query.set('favorite', '1');
      const suffix = query.toString();
      // The console reads its own copy of this route, behind the authorizer: the public
      // one cannot see a host's token, and would answer with the gallery minus the
      // photos the host is actually asking about.
      const base = scope === 'host' ? `/events/${eventId}/host/photos` : `/events/${eventId}/photos`;
      return call<ListPhotosResponse>(`${base}${suffix ? `?${suffix}` : ''}`);
    },
    getPhoto: (photoId: string) => call<PhotoResponse>(`/photos/${photoId}`),
    updatePhoto: (photoId: string, payload: UpdatePhotoPayload) =>
      call<PhotoResponse>(`/photos/${photoId}`, json('PATCH', payload)),
    deletePhoto: (photoId: string) =>
      call<void>(`${photoBase}/${photoId}`, { method: 'DELETE' }),
    react: (photoId: string, emoji: ReactionEmoji) =>
      call<ReactionResponse>(`/photos/${photoId}/reaction`, json('PUT', { emoji })),
    unreact: (photoId: string, emoji: ReactionEmoji) =>
      call<ReactionResponse>(`/photos/${photoId}/reaction/${encodeURIComponent(emoji)}`, {
        method: 'DELETE',
      }),
    listComments: (photoId: string) =>
      call<ListCommentsResponse>(`/photos/${photoId}/comments`),
    createComment: (photoId: string, body: string) =>
      call<{ comment: PhotoComment }>(`/photos/${photoId}/comments`, json('POST', { body })),
    deleteComment: (photoId: string, commentId: string) =>
      call<void>(`${photoBase}/${photoId}/comments/${commentId}`, { method: 'DELETE' }),
    listDownloads: (eventId: string, favoriteOnly = false) => {
      const base = scope === 'host' ? `/events/${eventId}/host/downloads` : `/events/${eventId}/downloads`;
      return call<{ photos: Photo[]; event: { name: string; code: string; date: number | null } }>(
        `${base}${favoriteOnly ? '?favorite=1' : ''}`,
      );
    },

    // --- rolls --------------------------------------------------------------
    startRoll: (eventId: string, shotLimit?: number) =>
      call<RollResponse>(`/events/${eventId}/rolls`, json('POST', shotLimit ? { shotLimit } : {})),
    listMyRolls: (eventId: string) => call<ListRollsResponse>(`/events/${eventId}/rolls/mine`),
    listRolls: (eventId: string) => call<ListRollsResponse>(`/events/${eventId}/rolls`),
    developRoll: (rollId: string) =>
      call<{ roll: Roll; developed: number }>(`/rolls/${rollId}/develop`, { method: 'PUT' }),
    developAllRolls: (eventId: string) =>
      call<{ developed: number }>(`/events/${eventId}/rolls/develop`, { method: 'POST' }),

    // --- the guest side of the door -----------------------------------------
    // Guest scope even though the route is public: a token, when there is one,
    // is what tells the API whether the gallery is open to this reader.
    joinEvent: (code: string) => call<JoinEventResponse>(`/join/${code}`),
    join: (code: string, payload: { name: string; emoji: string; deviceId: string }) =>
      request<JoinSessionResponse>(`/join/${code}/guests`, json('POST', payload), 'none'),
    myGuest: (eventId: string) =>
      call<GuestResponse & { roll: Roll | null; shotsLeft: number | null }>(
        `/events/${eventId}/guest`,
      ),
    updateMyGuest: (eventId: string, payload: { name?: string; emoji?: string }) =>
      call<GuestResponse>(`/events/${eventId}/guest`, json('PATCH', payload)),
    publicPhotos: (code: string, since = 0) =>
      request<PhotoFeedResponse>(`/join/${code}/photos?since=${since}`, {}, 'none'),
    wall: (code: string) => request<WallResponse>(`/wall/${code}`, {}, 'none'),
  };
}

/** The console's client: every call carries the host's token. */
export const api = endpoints('host');

/** The guest screens' client: every call carries the event's guest token. */
export const guestApi = endpoints('guest');

export type FotoApi = ReturnType<typeof endpoints>;

export type { Challenge, Event, EventStats };
