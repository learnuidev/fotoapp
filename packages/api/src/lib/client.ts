/**
 * One request, to whoever is asking.
 *
 * The product has two kinds of caller and they are not interchangeable: a host
 * sends their account token, and a guest sends the per-event token their join
 * handed them. Both go through this function; the scope decides which credential
 * is attached. Where an app is signed in *and* has joined, both are sent — the
 * guest token in `X-Foto-Guest` and the host token in `Authorization` — which is
 * what lets a host who joined their own event see the moderation controls on a
 * gallery tile.
 */

export type AuthScope = 'host' | 'guest' | 'none';

/**
 * Where the tokens come from. `@foto/auth` is the implementation; this is the seam.
 *
 * Asynchronous because a host's token does not live in this app: it lives in
 * Amplify's Cognito session, which is read through an API that may have to refresh
 * it. A guest's token is a string in storage and resolves immediately.
 */
export type TokenSource = (
  scope: 'host' | 'guest',
) => string | null | Promise<string | null>;

let baseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4100';
let getToken: TokenSource = () => null;

/**
 * Points the client at an API and tells it where the tokens are.
 *
 * Called once, by `AppProviders`, before anything renders. Both apps share one
 * client module, so this is also how a second app would talk to a second API.
 */
export function configureApi(config: { baseUrl?: string; getToken?: TokenSource }): void {
  if (config.baseUrl) baseUrl = config.baseUrl.replace(/\/+$/, '');
  if (config.getToken) getToken = config.getToken;
}

/** The URL a path resolves to. Exported because uploads are not JSON requests. */
export function apiUrl(path: string): string {
  return `${baseUrl}${path}`;
}

/**
 * A failed request, carrying its status.
 *
 * The status is the part a page acts on: a 401 means sign in or join, a 403 means
 * this is not yours, a 409 is a sentence the server wrote about the state of
 * something. `message` is already the server's sentence and is fit to print.
 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Whether an unknown error is the API saying 401. */
export function isUnauthorized(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

/** Whether an unknown error is the API saying 404. */
export function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

export async function request<T>(
  path: string,
  init: RequestInit = {},
  scope: AuthScope = 'host',
): Promise<T> {
  const headers = new Headers(init.headers);

  if (scope !== 'none') {
    if (!headers.has('Content-Type') && init.body) headers.set('Content-Type', 'application/json');
    const hostToken = await getToken('host');
    const guestToken = await getToken('guest');
    if (scope === 'host' && hostToken) headers.set('Authorization', `Bearer ${hostToken}`);
    if (scope === 'guest' && guestToken) headers.set('X-Foto-Guest', guestToken);
    // A host who joined their own event is both; the API reads both.
    if (scope === 'guest' && hostToken) headers.set('Authorization', `Bearer ${hostToken}`);
  }

  const response = await fetch(apiUrl(path), { ...init, headers });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = (await response.json()) as { error?: { message?: string } };
      if (body.error?.message) message = body.error.message;
    } catch {
      // A body that is not the error envelope is not worth a second failure.
    }
    throw new ApiError(response.status, message);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
