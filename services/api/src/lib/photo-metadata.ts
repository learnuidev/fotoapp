/**
 * The camera's own notes, made safe to store.
 *
 * The metadata arrives from the browser — it was parsed out of a file the browser had
 * — so it is client-supplied data like a caption or a name, and it is treated the same
 * way: every field is checked, clamped and truncated, and anything unrecognised is
 * dropped rather than stored. A photo's row is not a place for arbitrary JSON.
 *
 * Two decisions live here rather than in the parser:
 *
 * - **megapixels are derived from the pixels**, not from what the client said the
 *   image's size was, because the size in the payload is a claim and the file is not;
 * - **GPS is taken as given, or not at all.** It is already in the file; this service
 *   neither asks for it separately nor invents one from the event's venue.
 */
import type { PhotoMetadata } from '@foto/types';
import { HttpError } from './http';

/** Longest string this service will keep, per text field. */
const MAX_TEXT = 80;

function text(value: unknown, max = MAX_TEXT): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : undefined;
}

function num(value: unknown, min: number, max: number): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  if (value < min || value > max) return undefined;
  return value;
}

/**
 * Reads what the client sent, or nothing.
 *
 * A malformed blob is not a failed upload — the photo is still a photo — so the
 * metadata is dropped and the picture is kept. The one exception is a value that is
 * not an object at all, which means the caller is confused about the contract.
 */
export function sanitizeMetadata(
  input: unknown,
  options: { width: number; height: number },
): PhotoMetadata | null {
  if (input === undefined || input === null) return null;
  if (typeof input !== 'object' || Array.isArray(input)) {
    throw new HttpError(400, 'metadata must be an object');
  }

  const raw = input as Record<string, unknown>;
  const metadata: PhotoMetadata = {};

  const assign = <K extends keyof PhotoMetadata>(key: K, value: PhotoMetadata[K] | undefined) => {
    if (value !== undefined) metadata[key] = value;
  };

  assign('cameraMake', text(raw.cameraMake, 40));
  assign('cameraModel', text(raw.cameraModel, 60));
  assign('lens', text(raw.lens, 80));
  assign('shutterSpeed', text(raw.shutterSpeed, 16));
  assign('exposureSeconds', num(raw.exposureSeconds, 0, 3600));
  assign('aperture', num(raw.aperture, 0.5, 128));
  assign('iso', num(raw.iso, 1, 409600));
  assign('focalLength', num(raw.focalLength, 0.1, 5000));
  assign('focalLength35mm', num(raw.focalLength35mm, 1, 20000));
  assign('exposureBias', num(raw.exposureBias, -20, 20));
  if (typeof raw.flash === 'boolean') metadata.flash = raw.flash;
  assign('whiteBalance', text(raw.whiteBalance, 24));
  assign('meteringMode', text(raw.meteringMode, 32));
  assign('exposureProgram', text(raw.exposureProgram, 32));
  assign('colorSpace', text(raw.colorSpace, 24));
  assign('software', text(raw.software, 48));

  const takenAt = num(raw.takenAt, 0, 4102444800000); // 2100-01-01, in ms
  if (takenAt) metadata.takenAt = Math.round(takenAt);

  if (raw.gps && typeof raw.gps === 'object') {
    const gps = raw.gps as Record<string, unknown>;
    const lat = num(gps.lat, -90, 90);
    const lon = num(gps.lon, -180, 180);
    if (lat !== undefined && lon !== undefined) metadata.gps = { lat, lon };
  }

  // A megapixel count is a fact about the file, so it is worked out here from the
  // dimensions the API already validated rather than taken from the payload.
  if (options.width > 0 && options.height > 0) {
    metadata.megapixels = Math.round((options.width * options.height) / 10000) / 100;
  }

  return Object.keys(metadata).length > 0 ? metadata : null;
}
