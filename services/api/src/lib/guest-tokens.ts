/**
 * The guest-session signing secret, and the tokens it signs.
 *
 * Only guests have a token this service issues. A host's token comes from Cognito
 * and is verified by API Gateway before the handler runs, so nothing here touches
 * it. A guest has no account to verify anything against — the point of this product
 * is that they never make one — so the API signs a small statement of its own: "this
 * is the guest who joined event E from this device, until this date".
 *
 * The secret is fetched from Secrets Manager on first use and held for the life of
 * the container. A cold start pays one `GetSecretValue`; every request after it is
 * an HMAC over a few dozen bytes.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { config } from './config';

export interface GuestClaims {
  typ: 'guest';
  /** The guest id. */
  sub: string;
  /** The event the guest joined. A token is worthless on another event. */
  eid: string;
  code: string;
  name: string;
  iat: number;
  exp: number;
}

let cachedSecret: string | null = null;
let inFlight: Promise<string> | null = null;

async function secret(): Promise<string> {
  if (cachedSecret) return cachedSecret;
  if (!inFlight) {
    inFlight = (async () => {
      // Loaded lazily: a container that only ever serves public reads should not
      // pay for the SDK module.
      const { SecretsManagerClient, GetSecretValueCommand } = await import(
        '@aws-sdk/client-secrets-manager'
      );
      const client = new SecretsManagerClient({ region: config.awsRegion });
      const result = await client.send(
        new GetSecretValueCommand({ SecretId: config.guestSecretName }),
      );
      const value = result.SecretString;
      if (!value) throw new Error('The guest token secret has no value');
      cachedSecret = value;
      return value;
    })();
  }
  return inFlight;
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

/** A guest's token: the guest, the event, and an expiry. */
export async function issueGuestToken(claims: Omit<GuestClaims, 'typ' | 'iat' | 'exp'>): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload: GuestClaims = {
    typ: 'guest',
    ...claims,
    iat: now,
    exp: now + config.guestTokenTtlSeconds,
  };
  const body = base64url(JSON.stringify(payload));
  const mac = createHmac('sha256', await secret()).update(body).digest('base64url');
  return `${body}.${mac}`;
}

/**
 * The claims a token carries, or null.
 *
 * Null covers every way a token can be wrong — malformed, signed with another
 * secret, expired — because they are the same answer to the caller: this request
 * speaks for nobody, and the guest has to join again.
 */
export async function verifyGuestToken(token: string | undefined | null): Promise<GuestClaims | null> {
  if (!token) return null;
  const dot = token.lastIndexOf('.');
  if (dot <= 0) return null;

  const body = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  const expected = createHmac('sha256', await secret()).update(body).digest('base64url');

  const given = Buffer.from(mac);
  const wanted = Buffer.from(expected);
  if (given.length !== wanted.length || !timingSafeEqual(given, wanted)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as GuestClaims;
    if (payload.typ !== 'guest') return null;
    if (typeof payload.exp !== 'number' || payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
