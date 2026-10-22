/**
 * Getting photo bytes from a phone into the bucket.
 *
 * Three steps, and the client owns all of them:
 *
 * 1. ask the API for a place to put the file (it answers with a URL);
 * 2. PUT the bytes straight to that URL, with progress;
 * 3. tell the API the key that is now there, and get back the photo.
 *
 * The middle step is why this uses `XMLHttpRequest`: it is the only browser API
 * that reports upload progress, and a guest standing in a field watching a
 * spinner with no idea whether it is moving is how photos get lost.
 */
import type { CreatePhotoResponse, PresignedUpload, ReserveUploadResponse } from '@foto/types';
import { request } from './client';

export function putFileToUrl(
  file: File | Blob,
  upload: PresignedUpload,
  onProgress?: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(upload.method, upload.url);

    for (const [name, value] of Object.entries(upload.headers)) {
      xhr.setRequestHeader(name, value);
    }

    if (onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          onProgress(Math.round((event.loaded / event.total) * 100));
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error('Upload failed — check the connection'));
    xhr.ontimeout = () => reject(new Error('Upload timed out'));
    xhr.send(file);
  });
}

/**
 * The pixel size of an image file.
 *
 * Sent with the photo so a gallery can lay tiles out at the right shape before a
 * single byte of the image has loaded — which is the difference between a grid
 * that settles and a grid that jumps around as photos arrive.
 */
export async function readImageSize(file: File | Blob): Promise<{ width: number; height: number }> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file);
      const size = { width: bitmap.width, height: bitmap.height };
      bitmap.close();
      return size;
    } catch {
      // HEIC on a browser that cannot decode it still uploads; it just has no
      // dimensions, and the tile falls back to a square.
    }
  }
  return { width: 0, height: 0 };
}

export interface UploadPhotoOptions {
  caption?: string;
  challengeId?: string | null;
  takenAt?: number;
  onProgress?: (percent: number) => void;
  scope?: 'host' | 'guest';
}

/**
 * The whole pipeline in one call: reserve, upload, record.
 *
 * `eventId` and the scope decide who is shooting; on an event that shoots film
 * the answer carries the roll this frame landed on, which is what the camera
 * screen draws its remaining shots from.
 */
export async function uploadPhoto(
  eventId: string,
  file: File,
  options: UploadPhotoOptions = {},
): Promise<CreatePhotoResponse> {
  const scope = options.scope ?? 'guest';
  /**
   * Which pair of routes this upload goes through.
   *
   * A host has a Cognito token and no guest session, and the guest routes are public at
   * the gateway by necessity — a guest token is not a Cognito token. So the host's
   * upload takes the `host/` pair, which is behind the authorizer and lands in the same
   * two handlers. It is the same upload; only the door differs.
   */
  const base = scope === 'host' ? `/events/${eventId}/host` : `/events/${eventId}`;

  const reserved = await request<ReserveUploadResponse>(
    `${base}/uploads`,
    {
      method: 'POST',
      body: JSON.stringify({
        fileName: file.name,
        contentType: file.type || 'image/jpeg',
        size: file.size,
      }),
    },
    scope,
  );

  await putFileToUrl(file, reserved.upload, options.onProgress);
  const size = await readImageSize(file);

  return request<CreatePhotoResponse>(
    `${base}/photos`,
    {
      method: 'POST',
      body: JSON.stringify({
        key: reserved.key,
        width: size.width,
        height: size.height,
        size: file.size,
        contentType: file.type || 'image/jpeg',
        caption: options.caption ?? '',
        challengeId: options.challengeId ?? null,
        takenAt: options.takenAt ?? Date.now(),
      }),
    },
    scope,
  );
}

/** Downloads one photo as a blob, for the zip the host's album button builds. */
export async function fetchPhotoBlob(url: string): Promise<Blob> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not fetch that photo (${response.status})`);
  return response.blob();
}
