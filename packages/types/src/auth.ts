/**
 * The account behind the console, and the two ways to get one.
 *
 * Only a host has an account. In AWS that account is a Cognito user and the API
 * learns who is calling from the authorizer's claims; the local runtime signs the
 * same shape of token itself so the console can be developed without a deploy.
 * `packages/auth` picks between the two — see `foto-auth/src/lib/drivers`.
 */

/** The person who made an event, as the console draws them. */
export interface HostUser {
  userId: string;
  email: string;
  name: string;
  createdAt: number;
}

export interface SignUpPayload {
  email: string;
  password: string;
  name: string;
}

export interface SignInPayload {
  email: string;
  password: string;
}

/** What both sign-in and sign-up answer with. */
export interface AuthResponse {
  token: string;
  user: HostUser;
}
