/**
 * The API, as data.
 *
 * This table is the whole surface of the backend: the dev server dispatches
 * through it, and `infra/` reads it to create one Lambda per domain and one
 * API Gateway route per line. A route that exists in one and not the other is
 * therefore not a thing that can happen, which is worth more than the small
 * awkwardness of a CDK app importing a file from `services/api`.
 *
 * `authorized` is not "does this route have an identity" — every route but the
 * public three does. It is "does API Gateway check a Cognito token before the
 * handler runs". Guest routes cannot: a guest has no Cognito account, so they
 * carry a token this API signed and verify themselves. That is why the field is
 * declared here rather than guessed at deploy time.
 */
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { authHandlers } from './functions/auth';
import { challengeHandlers } from './functions/challenges';
import { eventHandlers } from './functions/events';
import { joinHandlers } from './functions/join';
import { photoHandlers } from './functions/photos';
import { rollHandlers } from './functions/rolls';
import { handle, ok } from './lib/http';

/** The Lambda a route is deployed into. One function per domain, not per route. */
export type Domain = 'auth' | 'events' | 'photos' | 'join' | 'rolls' | 'challenges';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** Who may call a route. Documentation for the reader; the handlers enforce it. */
export type Audience = 'public' | 'guest' | 'host' | 'any';

export interface Route {
  domain: Domain;
  method: HttpMethod;
  /** Path with `{param}` placeholders, no leading slash. */
  path: string;
  audience: Audience;
  /** Whether API Gateway requires a Cognito token for this route. */
  authorized: boolean;
  summary: string;
  handler: (event: APIGatewayProxyEvent) => Promise<APIGatewayProxyResult>;
}

const health = handle(async () =>
  ok({ service: 'foto-api', ok: true, time: Date.now() }),
);

export const ROUTES: Route[] = [
  // --- the account behind the console ----------------------------------------
  // A host signs in through Cognito, not through this API: there is no sign-up or
  // sign-in route here on purpose (see `functions/auth.ts`).
  {
    domain: 'auth',
    method: 'GET',
    path: 'health',
    audience: 'public',
    authorized: false,
    summary: 'Liveness, and the clock a polling client aligns to.',
    handler: health,
  },
  {
    domain: 'auth',
    method: 'GET',
    path: 'me',
    audience: 'host',
    authorized: true,
    summary: 'The signed-in host, or 401.',
    handler: authHandlers.me,
  },

  // --- events, from the console ----------------------------------------------
  {
    domain: 'events',
    method: 'POST',
    path: 'events',
    audience: 'host',
    authorized: true,
    summary: 'Creates an event, its join code and its starter prompts.',
    handler: eventHandlers.create,
  },
  {
    domain: 'events',
    method: 'GET',
    path: 'events',
    audience: 'host',
    authorized: true,
    summary: 'Every event this host owns, newest first.',
    handler: eventHandlers.list,
  },
  {
    domain: 'events',
    method: 'GET',
    path: 'events/{eventId}',
    audience: 'host',
    authorized: true,
    summary: 'One event, every setting, with its counts.',
    handler: eventHandlers.get,
  },
  {
    domain: 'events',
    method: 'PATCH',
    path: 'events/{eventId}',
    audience: 'host',
    authorized: true,
    summary: 'Edits an event: name, date, settings, cover, open/closed.',
    handler: eventHandlers.update,
  },
  {
    domain: 'events',
    method: 'DELETE',
    path: 'events/{eventId}',
    audience: 'host',
    authorized: true,
    summary: 'Deletes an event and every row under it.',
    handler: eventHandlers.remove,
  },
  {
    domain: 'events',
    method: 'POST',
    path: 'events/{eventId}/code',
    audience: 'host',
    authorized: true,
    summary: 'Rotates the join code.',
    handler: eventHandlers.rotateCode,
  },
  {
    domain: 'events',
    method: 'GET',
    path: 'events/{eventId}/stats',
    audience: 'host',
    authorized: true,
    summary: 'The console analytics: uploads, leaders, prompts, reactions.',
    handler: eventHandlers.stats,
  },
  {
    domain: 'events',
    method: 'GET',
    path: 'events/{eventId}/guests',
    audience: 'host',
    authorized: true,
    summary: 'The guest roster, ordered by contribution.',
    handler: eventHandlers.guests,
  },
  {
    domain: 'events',
    method: 'DELETE',
    path: 'events/{eventId}/guests/{guestId}',
    audience: 'host',
    authorized: true,
    summary: 'Takes a guest off the roster; their photos stay.',
    handler: eventHandlers.removeGuest,
  },
  {
    domain: 'events',
    method: 'GET',
    path: 'events/{eventId}/challenges',
    audience: 'host',
    authorized: true,
    summary: 'The event prompts, with how many photos each produced.',
    handler: eventHandlers.challenges,
  },

  // --- prompts ---------------------------------------------------------------
  {
    domain: 'challenges',
    method: 'POST',
    path: 'events/{eventId}/challenges',
    audience: 'host',
    authorized: true,
    summary: 'Adds a prompt.',
    handler: challengeHandlers.create,
  },
  {
    domain: 'challenges',
    method: 'PATCH',
    path: 'challenges/{challengeId}',
    audience: 'host',
    authorized: true,
    summary: 'Retitles, re-emojis or pauses a prompt.',
    handler: challengeHandlers.update,
  },
  {
    domain: 'challenges',
    method: 'DELETE',
    path: 'challenges/{challengeId}',
    audience: 'host',
    authorized: true,
    summary: 'Deletes a prompt; the photos shot for it stay.',
    handler: challengeHandlers.remove,
  },
  {
    domain: 'challenges',
    method: 'GET',
    path: 'challenges/{challengeId}/photos',
    audience: 'host',
    authorized: true,
    summary: 'What a prompt has produced so far.',
    handler: challengeHandlers.photos,
  },

  // --- photos ----------------------------------------------------------------
  {
    domain: 'photos',
    method: 'POST',
    path: 'events/{eventId}/uploads',
    audience: 'any',
    authorized: false,
    summary: 'Reserves a key and answers with a URL to PUT the bytes to.',
    handler: photoHandlers.reserve,
  },
  {
    domain: 'photos',
    method: 'POST',
    path: 'events/{eventId}/photos',
    audience: 'any',
    authorized: false,
    summary: 'Records a shot once its bytes are in storage.',
    handler: photoHandlers.create,
  },
  {
    domain: 'photos',
    method: 'GET',
    path: 'events/{eventId}/photos',
    audience: 'any',
    authorized: false,
    summary: 'The gallery, filtered by status, guest, prompt, roll or favourites.',
    handler: photoHandlers.list,
  },
  {
    domain: 'photos',
    method: 'GET',
    path: 'events/{eventId}/downloads',
    audience: 'any',
    authorized: false,
    summary: 'Every photo a downloader may keep, oldest first.',
    handler: photoHandlers.downloadList,
  },
  {
    domain: 'photos',
    method: 'GET',
    path: 'photos/{photoId}',
    audience: 'any',
    authorized: false,
    summary: 'One photo, if the caller may read it.',
    handler: photoHandlers.get,
  },
  {
    domain: 'photos',
    method: 'PATCH',
    path: 'photos/{photoId}',
    audience: 'host',
    authorized: true,
    summary: 'Moderation: publish, hide, retitle, favourite.',
    handler: photoHandlers.update,
  },
  {
    domain: 'photos',
    method: 'DELETE',
    path: 'photos/{photoId}',
    audience: 'any',
    authorized: false,
    summary: 'Deletes a photo — its host, or the guest who shot it.',
    handler: photoHandlers.remove,
  },
  {
    domain: 'photos',
    method: 'PUT',
    path: 'photos/{photoId}/reaction',
    audience: 'guest',
    authorized: false,
    summary: 'Leaves a reaction.',
    handler: photoHandlers.react,
  },
  {
    domain: 'photos',
    method: 'DELETE',
    path: 'photos/{photoId}/reaction/{emoji}',
    audience: 'guest',
    authorized: false,
    summary: 'Takes a reaction back.',
    handler: photoHandlers.unreact,
  },
  {
    domain: 'photos',
    method: 'GET',
    path: 'photos/{photoId}/comments',
    audience: 'any',
    authorized: false,
    summary: 'The comments on one photo, oldest first.',
    handler: photoHandlers.comments,
  },
  {
    domain: 'photos',
    method: 'POST',
    path: 'photos/{photoId}/comments',
    audience: 'guest',
    authorized: false,
    summary: 'Comments on a photo.',
    handler: photoHandlers.createComment,
  },
  {
    domain: 'photos',
    method: 'DELETE',
    path: 'photos/{photoId}/comments/{commentId}',
    audience: 'any',
    authorized: false,
    summary: 'Deletes a comment — its author, or the host.',
    handler: photoHandlers.deleteComment,
  },

  // --- rolls -----------------------------------------------------------------
  {
    domain: 'rolls',
    method: 'POST',
    path: 'events/{eventId}/rolls',
    audience: 'guest',
    authorized: false,
    summary: 'Starts a roll, or returns the open one.',
    handler: rollHandlers.start,
  },
  {
    domain: 'rolls',
    method: 'GET',
    path: 'events/{eventId}/rolls/mine',
    audience: 'guest',
    authorized: false,
    summary: 'The caller’s rolls, with frames on the developed ones.',
    handler: rollHandlers.mine,
  },
  {
    domain: 'rolls',
    method: 'GET',
    path: 'events/{eventId}/rolls',
    audience: 'host',
    authorized: true,
    summary: 'Every roll of the event, for the host.',
    handler: rollHandlers.list,
  },
  {
    domain: 'rolls',
    method: 'POST',
    path: 'events/{eventId}/rolls/develop',
    audience: 'host',
    authorized: true,
    summary: 'Develops every roll still shooting.',
    handler: rollHandlers.developAll,
  },
  {
    domain: 'rolls',
    method: 'PUT',
    path: 'rolls/{rollId}/develop',
    audience: 'any',
    authorized: false,
    summary: 'Develops one roll — its guest, or the host.',
    handler: photoHandlers.develop,
  },

  // --- the guest side of the door --------------------------------------------
  {
    domain: 'join',
    method: 'GET',
    path: 'join/{code}',
    audience: 'public',
    authorized: false,
    summary: 'What a join code opens: the album, its prompts, and who you are.',
    handler: joinHandlers.get,
  },
  {
    domain: 'join',
    method: 'POST',
    path: 'join/{code}/guests',
    audience: 'public',
    authorized: false,
    summary: 'Joins with a name and an avatar, and answers with a guest token.',
    handler: joinHandlers.createGuest,
  },
  {
    domain: 'join',
    method: 'GET',
    path: 'join/{code}/photos',
    audience: 'public',
    authorized: false,
    summary: 'The public gallery of an event left open to everyone — what the wall polls.',
    handler: joinHandlers.publicPhotos,
  },
  {
    domain: 'join',
    method: 'GET',
    path: 'wall/{code}',
    audience: 'public',
    authorized: false,
    summary: 'Everything the projector screen draws, in one request.',
    handler: joinHandlers.wall,
  },
  {
    domain: 'join',
    method: 'GET',
    path: 'events/{eventId}/guest',
    audience: 'guest',
    authorized: false,
    summary: 'The caller’s own guest row, with their counts and open roll.',
    handler: joinHandlers.myGuest,
  },
  {
    domain: 'join',
    method: 'PATCH',
    path: 'events/{eventId}/guest',
    audience: 'guest',
    authorized: false,
    summary: 'Changes the name or avatar the gallery credits you with.',
    handler: joinHandlers.updateMyGuest,
  },
];

/** The domains a Lambda is deployed for. */
export const DOMAINS: Domain[] = ['auth', 'events', 'photos', 'join', 'rolls', 'challenges'];

export function routesOf(domain: Domain): Route[] {
  return ROUTES.filter((route) => route.domain === domain);
}
