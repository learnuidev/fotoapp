/**
 * Cognito, through Amplify.
 *
 * The host account is a Cognito user and this is the only way to be one. There is no
 * password anywhere in this repository: the pool owns it, the pool's pre-sign-up
 * trigger confirms the address without an email round trip (see
 * `services/api/src/functions/auth`), and this app asks Amplify for a token when it
 * needs one.
 *
 * Tokens are read lazily and cached until shortly before they expire, because
 * `fetchAuthSession` is the entry point to a token that every API request needs — a
 * cache miss on every query would be a great deal of work for a string that changes
 * once an hour.
 */
import { Amplify } from 'aws-amplify';
import {
  fetchAuthSession,
  getCurrentUser,
  signIn,
  signOut,
  signUp,
} from 'aws-amplify/auth';
import type { HostUser } from '@foto/types';

const userPoolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID;
const userPoolClientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID;

/** Whether this build has a pool to sign in to at all. */
export const isAuthConfigured = Boolean(userPoolId && userPoolClientId);

if (isAuthConfigured) {
  Amplify.configure({
    Auth: { Cognito: { userPoolId: userPoolId!, userPoolClientId: userPoolClientId! } },
  });
}

interface CachedToken {
  token: string;
  /** Unix seconds, from the token's own `exp`. */
  exp: number;
}

let cached: CachedToken | null = null;

/** Drops the cached token, after signing in or out. */
export function clearTokenCache(): void {
  cached = null;
}

/**
 * The host's ID token, or null.
 *
 * Null is "this browser is not signed in", which is an ordinary state rather than a
 * failure: the public pages and the guest screens ask for it and get nothing.
 */
export async function hostIdToken(): Promise<string | null> {
  if (!isAuthConfigured) return null;
  if (cached && cached.exp * 1000 > Date.now() + 60_000) return cached.token;

  try {
    const session = await fetchAuthSession();
    const idToken = session.tokens?.idToken;
    if (!idToken) return null;
    cached = { token: idToken.toString(), exp: Number(idToken.payload.exp ?? 0) };
    return cached.token;
  } catch {
    // No session, an expired refresh token, a pool that does not exist: all of them
    // mean the same thing here.
    cached = null;
    return null;
  }
}

/** The signed-in host, or null. */
export async function currentHost(): Promise<HostUser | null> {
  if (!isAuthConfigured) return null;
  try {
    const user = await getCurrentUser();
    const session = await fetchAuthSession();
    const claims = (session.tokens?.idToken?.payload ?? {}) as Record<string, unknown>;
    return {
      userId: user.userId,
      email: String(claims.email ?? user.signInDetails?.loginId ?? ''),
      name: String(claims.name ?? claims.email ?? user.signInDetails?.loginId ?? ''),
      createdAt: 0,
    };
  } catch {
    return null;
  }
}

/** A host signing in with the email and password the pool holds for them. */
export async function signInWithPassword(email: string, password: string): Promise<HostUser> {
  await signIn({ username: email, password });
  clearTokenCache();
  const host = await currentHost();
  if (!host) throw new Error('Signed in, but no account came back — try again');
  return host;
}

/**
 * A host making an account.
 *
 * The name is written into the pool as an attribute because it is what the gallery
 * credits and what a guest sees on the join screen — an account with no name would
 * be an event hosted by an email address.
 */
export async function signUpWithPassword(
  email: string,
  password: string,
  name: string,
): Promise<HostUser> {
  const result = await signUp({
    username: email,
    password,
    options: { userAttributes: { email, name } },
  });

  // The pool's pre-sign-up trigger confirms and verifies the address (see
  // `infra/src/stacks/auth-stack.ts`), so this normally answers
  // `isSignUpComplete: true` and the sign-in below is all that is left. If a
  // deployment ever turned that trigger off, the account exists but is unconfirmed,
  // and saying so is better than a sign-in that fails for an unexplained reason.
  if (!result.isSignUpComplete) {
    throw new Error(
      'The account was made, but this user pool wants a confirmation code. Check the inbox for it, or turn the pool’s auto-confirm trigger back on.',
    );
  }

  return signInWithPassword(email, password);
}

export async function signOutHost(): Promise<void> {
  await signOut();
  clearTokenCache();
}
