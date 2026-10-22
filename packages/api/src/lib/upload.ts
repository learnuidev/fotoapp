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
import type {
  CreatePhotoResponse,
  PhotoMetadata,
  PresignedUpload,
  ReserveUploadResponse,
} from '@foto/types';
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
 * The EXIF the browser can read, in this product's own shape.
 *
 * Read here, on the way up, from the file the browser already has in memory: the
 * alternative is a Lambda fetching every uploaded object back out of S3 to parse it,
 * which is a second copy of the bytes and a second place to fail. The numbers are
 * folded into the fields a photographer reads — body, lens, shutter, aperture, ISO,
 * focal length — rather than passed through as EXIF's own tag soup, and anything the
 * file does not carry is simply absent.
 *
 * `exifr` is imported lazily so a guest's phone only downloads the parser when it is
 * actually uploading a file that might have metadata in it.
 */
export async function readPhotoMetadata(file: File | Blob): Promise<PhotoMetadata | null> {
  try {
    const { parse } = await import('exifr');
    const raw = (await parse(file, {
      // `pick` keeps the parser from walking the whole directory: these are the tags
      // this product has a use for. Asking for the GPS tags is also what makes exifr
      // compute `latitude`/`longitude` from them, sign and all.
      pick: [
        'Make',
        'Model',
        'LensModel',
        'LensInfo',
        'FNumber',
        'ApertureValue',
        'ExposureTime',
        'ShutterSpeedValue',
        'ISO',
        'ISOSpeedRatings',
        'FocalLength',
        'FocalLengthIn35mmFormat',
        'ExposureBiasValue',
        'Flash',
        'WhiteBalance',
        'MeteringMode',
        'ExposureProgram',
        'ColorSpace',
        'Software',
        'DateTimeOriginal',
        'CreateDate',
        'GPSLatitude',
        'GPSLongitude',
        'GPSLatitudeRef',
        'GPSLongitudeRef',
        'latitude',
        'longitude',
      ],
      translateValues: true,
      reviveValues: true,
    })) as Record<string, unknown> | undefined;

    if (!raw) return null;

    const metadata: PhotoMetadata = {};

    const text = (value: unknown, max = 80): string | undefined => {
      if (typeof value !== 'string') return undefined;
      const trimmed = value.trim();
      return trimmed ? trimmed.slice(0, max) : undefined;
    };

    /**
     * EXIF rationals, whatever the parser hands back.
     *
     * A shutter speed or an f-number is written as two integers, and depending on the
     * file and the parser's mood it arrives as a number, a two-element typed array, or
     * an object with `0` and `1` keys. All three mean the same thing here.
     */
    const ratio = (value: unknown): number | undefined => {
      if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
      if (Array.isArray(value) && value.length === 2) {
        const [n, d] = value as [unknown, unknown];
        if (typeof n === 'number' && typeof d === 'number' && d !== 0) return n / d;
        return undefined;
      }
      if (value && typeof value === 'object') {
        const pair = value as Record<string, unknown> & ArrayLike<unknown>;
        const n = Number(pair[0] ?? pair.numerator);
        const d = Number(pair[1] ?? pair.denominator);
        if (Number.isFinite(n) && Number.isFinite(d) && d !== 0) return n / d;
      }
      return undefined;
    };

    const number = (value: unknown): number | undefined => {
      if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
      return ratio(value);
    };

    const make = text(raw.Make, 40);
    const model = text(raw.Model, 60);
    if (make) metadata.cameraMake = make;
    if (model) metadata.cameraModel = model;

    const lens = text(
      raw.LensModel ??
        (Array.isArray(raw.LensInfo) && typeof raw.LensInfo[0] === 'string'
          ? raw.LensInfo[0]
          : undefined),
      80,
    );
    if (lens) metadata.lens = lens;

    const aperture = number(raw.FNumber) ?? number(raw.ApertureValue);
    if (aperture && aperture > 0) metadata.aperture = Math.round(aperture * 10) / 10;

    const exposure = number(raw.ExposureTime) ?? number(raw.ShutterSpeedValue);
    if (exposure && exposure > 0) {
      metadata.exposureSeconds = Math.round(exposure * 10000) / 10000;
      metadata.shutterSpeed =
        exposure >= 1
          ? `${Math.round(exposure * 10) / 10}s`
          : `1/${Math.round(1 / exposure)}`;
    }

    const iso = number(raw.ISO) ?? number(raw.ISOSpeedRatings);
    if (iso) metadata.iso = Math.round(iso);

    const focal = number(raw.FocalLength);
    if (focal) metadata.focalLength = Math.round(focal * 10) / 10;

    const focal35 = number(raw.FocalLengthIn35mmFormat);
    if (focal35) metadata.focalLength35mm = Math.round(focal35);

    const bias = number(raw.ExposureBiasValue);
    if (bias !== undefined) metadata.exposureBias = Math.round(bias * 10) / 10;

    if (typeof raw.Flash === 'boolean') metadata.flash = raw.Flash;
    else if (typeof raw.Flash === 'string') metadata.flash = !/no flash|did not fire/i.test(raw.Flash);

    const whiteBalance = text(raw.WhiteBalance, 24);
    if (whiteBalance) metadata.whiteBalance = whiteBalance;
    const metering = text(raw.MeteringMode, 32);
    if (metering) metadata.meteringMode = metering;
    const program = text(raw.ExposureProgram, 32);
    if (program) metadata.exposureProgram = program;
    // `ColorSpace` is one of the few tags exifr leaves as its raw code, so the two
    // values that mean something are named here.
    const colorSpace =
      typeof raw.ColorSpace === 'number'
        ? raw.ColorSpace === 1
          ? 'sRGB'
          : raw.ColorSpace === 65535
            ? 'Uncalibrated'
            : undefined
        : text(raw.ColorSpace, 24);
    if (colorSpace) metadata.colorSpace = colorSpace;
    const software = text(raw.Software, 48);
    if (software) metadata.software = software;

    const taken = raw.DateTimeOriginal ?? raw.CreateDate;
    if (taken instanceof Date && Number.isFinite(taken.getTime())) metadata.takenAt = taken.getTime();

    /**
     * The coordinates.
     *
     * The computed `latitude`/`longitude` is preferred — it has already applied the
     * `N/S` and `E/W` refs. The raw three-part value is the fallback, converted here,
     * because a file that names its hemisphere differently should still land on the
     * right side of the equator.
     */
    const lat = number(raw.latitude) ?? degrees(raw.GPSLatitude, raw.GPSLatitudeRef, 'S');
    const lon = number(raw.longitude) ?? degrees(raw.GPSLongitude, raw.GPSLongitudeRef, 'W');
    if (lat !== undefined && lon !== undefined && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
      metadata.gps = {
        lat: Math.round(lat * 1e6) / 1e6,
        lon: Math.round(lon * 1e6) / 1e6,
      };
    }

    return Object.keys(metadata).length > 0 ? metadata : null;
  } catch {
    // A file with no EXIF, or one the parser cannot read, is a photo without details
    // rather than a failed upload.
    return null;
  }
}

/** `[51, 27, 12.84]` + `N` → `51.4535…`. Degrees, minutes and seconds, in decimal. */
function degrees(parts: unknown, ref: unknown, negative: string): number | undefined {
  if (!Array.isArray(parts) || parts.length !== 3) return undefined;
  const [d, m, s] = parts.map((part) => Number(part));
  if ([d, m, s].some((value) => !Number.isFinite(value))) return undefined;
  const decimal = Math.abs(d!) + m! / 60 + s! / 3600;
  return typeof ref === 'string' && ref.trim().toUpperCase().startsWith(negative) ? -decimal : decimal;
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
  /** Read from the file, unless a caller has already done it. */
  metadata?: PhotoMetadata | null;
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

  // Read in parallel with the upload's tail: the bytes are already local, so metadata
  // and dimensions cost one pass over the file rather than a wait.
  const [size, metadata] = await Promise.all([
    readImageSize(file),
    options.metadata !== undefined ? Promise.resolve(options.metadata) : readPhotoMetadata(file),
  ]);

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
        // The shutter's own time, when the file knows it, beats the moment the browser
        // got round to uploading it.
        takenAt: metadata?.takenAt ?? options.takenAt ?? Date.now(),
        metadata,
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
