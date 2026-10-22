/**
 * Where photo bytes go.
 *
 * A client asks the API for a place to put a file; the API reserves a key and
 * answers with a presigned S3 URL; the client PUTs straight to S3; then it tells the
 * API the key that is now there. That is how a browser sends forty megabytes of
 * wedding photos without a Lambda ever holding them.
 *
 * Reading is the other half: every photo the API returns carries a `url` on the
 * CloudFront distribution in front of the bucket, built here. A client never learns
 * a key it could build a URL from, and the bucket itself is private.
 */
import { randomUUID } from 'node:crypto';
import { config } from './config';
import { HttpError } from './http';

export interface UploadTicket {
  key: string;
  upload: { url: string; method: string; headers: Record<string, string> };
  publicUrl: string;
}

/** What a photo may be. Anything else is refused before a key is issued. */
const CONTENT_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
  'image/heic': 'heic',
  'image/heif': 'heif',
};

/** How long a reserved upload URL stays usable. */
const UPLOAD_TTL_SECONDS = 15 * 60;

export function assertUploadable(contentType: string, size: number): void {
  if (!CONTENT_TYPES[contentType]) {
    throw new HttpError(415, 'That file type is not a photo this album accepts');
  }
  if (!Number.isFinite(size) || size <= 0) {
    throw new HttpError(400, 'The file has no size');
  }
  if (size > config.maxUploadBytes) {
    const mb = Math.round(config.maxUploadBytes / (1024 * 1024));
    throw new HttpError(413, `Photos are limited to ${mb} MB`);
  }
}

/** The URL a stored key is readable at. */
export function publicUrl(key: string): string {
  return `${config.photosCdnUrl}/${key}`;
}

/**
 * Reserves a key and answers with the URL to upload to.
 *
 * The key is not a filename a client sent — it is a fresh UUID under a prefix chosen
 * by the API, so nobody can write over another event's photo by guessing a name. The
 * prefix is what a lifecycle rule or a cache behaviour could be scoped by later.
 */
export async function reserveUpload(params: {
  eventId: string;
  contentType: string;
}): Promise<UploadTicket> {
  const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
  const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');

  const key = `events/${params.eventId}/${randomUUID()}.${CONTENT_TYPES[params.contentType]}`;
  const client = new S3Client({ region: config.awsRegion });

  const url = await getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: config.photosBucket,
      Key: key,
      ContentType: params.contentType,
    }),
    { expiresIn: UPLOAD_TTL_SECONDS },
  );

  return {
    key,
    // No `Content-Type` header: S3 signed it into the URL, and a browser that also
    // sets it after signing is refused for having changed a signed header.
    upload: { url, method: 'PUT', headers: {} },
    publicUrl: publicUrl(key),
  };
}
