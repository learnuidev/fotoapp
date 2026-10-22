/**
 * Everything this service needs to know about the deployment it is running in.
 *
 * There are no defaults here that make a missing value harmless — this service has
 * exactly one runtime, the one `infra/` deploys, and every value below is written into
 * the function's environment by that stack. A missing one is a broken deploy, and
 * saying so at the first request is the fastest way to find out.
 *
 * Every value is a **getter** rather than a field, and that matters: `infra/` imports
 * the route table to build API Gateway routes from it, which imports these handlers,
 * which import this file — at synth time, in a process where none of these variables
 * exist. Reading the environment when a value is *used* keeps that import harmless and
 * keeps a missing variable a runtime failure of the one request that needed it.
 *
 * The one value that is not an environment variable is the key guest sessions are
 * signed with. It lives in Secrets Manager and is fetched once per container
 * (`lib/guest-tokens`), because a signing key in a Lambda's environment is a key
 * readable in the console from every function that never signs anything.
 */
function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export const config = {
  get stage(): string {
    return process.env.FOTO_STAGE ?? 'dev';
  },

  get awsRegion(): string {
    return process.env.AWS_REGION ?? 'us-east-1';
  },

  /** Where the app is served — the origin a QR code points at. */
  get appBaseUrl(): string {
    return (process.env.APP_BASE_URL ?? '').replace(/\/+$/, '');
  },

  /** The photo bucket, and the CDN in front of it that a browser reads through. */
  get photosBucket(): string {
    return required('PHOTOS_BUCKET');
  },

  get photosCdnUrl(): string {
    return (process.env.PHOTOS_CDN_URL ?? '').replace(/\/+$/, '');
  },

  /** The Secrets Manager secret holding the guest-session signing key. */
  get guestSecretName(): string {
    return required('GUEST_TOKEN_SECRET_NAME');
  },

  /** How long a guest's session lasts. Long on purpose: an album is read for weeks. */
  get guestTokenTtlSeconds(): number {
    return Number(process.env.GUEST_TOKEN_TTL_SECONDS ?? 60 * 60 * 24 * 60);
  },

  /** The largest object a client may upload, enforced before a URL is signed. */
  get maxUploadBytes(): number {
    return Number(process.env.MAX_UPLOAD_BYTES ?? 25 * 1024 * 1024);
  },

  /** The origin the API allows browsers at. */
  get corsOrigin(): string {
    return process.env.CORS_ORIGIN ?? '*';
  },
} as const;

/** The DynamoDB table name for one collection, as `infra/` names it. */
export function tableName(envVar: string, fallback: string): string {
  return process.env[envVar] ?? fallback;
}
