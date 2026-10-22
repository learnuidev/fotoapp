/**
 * Who is calling.
 *
 * Two kinds of identity meet in this product and they are not the same thing:
 *
 * - a **host**, who has an account. In AWS that account is a Cognito user, and API
 *   Gateway has already verified the token before the handler runs — so this file
 *   only reads the claims out of the authorizer context. There is no token
 *   verification for hosts here, and there should not be: doing it twice would mean
 *   two answers to "who is signed in".
 * - a **guest**, who has no account and a token per event, which this service signed
 *   itself (`lib/guest-tokens`). Guest routes carry no authorizer, so each one asks
 *   here.
 *
 * A request may carry both. A host who joins their own event from their phone is
 * both, and the guest screens need to know that — it is what decides whether the
 * moderation controls appear over a photo.
 */
import type { APIGatewayProxyEvent } from 'aws-lambda';
import { HttpError } from './http';
import { verifyGuestToken } from './guest-tokens';

export interface Host {
  userId: string;
  email: string;
  name: string;
}

export interface GuestIdentity {
  guestId: string;
  eventId: string;
  name: string;
}

interface AuthorizerClaims {
  sub?: string;
  email?: string;
  name?: string;
  [key: string]: unknown;
}

/** The two authorizer shapes API Gateway uses: REST puts `claims`, HTTP puts `jwt`. */
function claimsOf(event: APIGatewayProxyEvent): AuthorizerClaims | undefined {
  const authorizer = event.requestContext?.authorizer as
    | { claims?: AuthorizerClaims; jwt?: { claims?: AuthorizerClaims } }
    | undefined;
  return authorizer?.jwt?.claims ?? authorizer?.claims;
}

/**
 * The signed-in host behind this request, or null.
 *
 * Null in two very different situations: nobody sent a token, and a token was sent
 * with no authorizer in front of the route. The second is a bug in the deployment —
 * the route table says `authorized: true` for every host route — and it fails closed
 * here, which is the right way for a deployment mistake to behave.
 */
export function hostOf(event: APIGatewayProxyEvent): Host | null {
  const claims = claimsOf(event);
  if (!claims?.sub) return null;
  return {
    userId: claims.sub,
    email: claims.email ?? '',
    name: claims.name?.trim() || claims.email?.trim() || claims.sub,
  };
}

/** The same, for a handler that cannot work without one. */
export function requireHost(event: APIGatewayProxyEvent): Host {
  const host = hostOf(event);
  if (!host) throw new HttpError(401, 'Sign in to continue');
  return host;
}

/** The guest token a request carries, from either header, and what it claims. */
export async function guestOf(event: APIGatewayProxyEvent): Promise<GuestIdentity | null> {
  const token = guestToken(event);
  const claims = await verifyGuestToken(token);
  if (!claims) return null;
  return { guestId: claims.sub, eventId: claims.eid, name: claims.name };
}

/** The token itself: the explicit header first, then the one a guest screen sends. */
function guestToken(event: APIGatewayProxyEvent): string | undefined {
  const explicit = event.headers?.['X-Foto-Guest'] ?? event.headers?.['x-foto-guest'];
  if (explicit) return explicit.trim();

  const header = event.headers?.Authorization ?? event.headers?.authorization;
  if (!header) return undefined;
  const [scheme, token] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' ? token : undefined;
}

/** The guest behind this request, for a handler that cannot work without one. */
export async function requireGuest(event: APIGatewayProxyEvent): Promise<GuestIdentity> {
  const guest = await guestOf(event);
  if (!guest) throw new HttpError(401, 'Join this event to continue');
  return guest;
}

/**
 * The guest token, scoped to one event.
 *
 * A token names the event it was issued for, so a route can refuse a token that is
 * valid but belongs elsewhere. That claim is the whole reason it is in the token:
 * without it, a guest of one event would be a guest of every event whose code they
 * had ever typed.
 */
export async function requireGuestOf(
  event: APIGatewayProxyEvent,
  eventId: string,
): Promise<GuestIdentity> {
  const guest = await requireGuest(event);
  if (guest.eventId !== eventId) {
    throw new HttpError(403, 'That guest session belongs to another event');
  }
  return guest;
}
