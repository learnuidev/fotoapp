'use client';

import type { Photo } from '@foto/types';
import { cn, formatBytes, formatMoment } from '@foto/ui';

/**
 * What the camera said.
 *
 * Collapsed behind one line, because most of the time this album is being read by
 * wedding guests and the aperture is not what they came for — but the photographer who
 * uploaded the frame wants all of it, in the order a photographer reads it: body,
 * lens, exposure, then the file itself.
 *
 * Nothing here is invented. A row appears because the file carried that tag, and a
 * photo with no EXIF (a screenshot, a phone's stripped export) simply has fewer rows.
 */
export function PhotoDetails({ photo, defaultOpen = false }: { photo: Photo; defaultOpen?: boolean }) {
  const meta = photo.metadata;
  const hasExif =
    !!meta &&
    Object.keys(meta).some((key) => key !== 'megapixels' && key !== 'takenAt');

  const rows: { label: string; value: string; mono?: boolean; href?: string }[] = [];

  if (meta) {
    const camera = cameraName(meta.cameraMake, meta.cameraModel);
    if (camera) rows.push({ label: 'Camera', value: camera });
    if (meta.lens) rows.push({ label: 'Lens', value: meta.lens });

    const exposure: string[] = [];
    if (meta.shutterSpeed) exposure.push(meta.shutterSpeed);
    if (meta.aperture) exposure.push(`ƒ/${meta.aperture}`);
    if (meta.iso) exposure.push(`ISO ${meta.iso}`);
    if (exposure.length) rows.push({ label: 'Exposure', value: exposure.join(' · '), mono: true });

    if (meta.focalLength) {
      const equivalent = meta.focalLength35mm ? ` (${meta.focalLength35mm}mm equiv)` : '';
      rows.push({ label: 'Focal length', value: `${meta.focalLength}mm${equivalent}` });
    }

    if (meta.exposureBias !== undefined && meta.exposureBias !== 0) {
      rows.push({
        label: 'Exposure bias',
        value: `${meta.exposureBias > 0 ? '+' : ''}${meta.exposureBias} EV`,
      });
    }

    const capture = [meta.exposureProgram, meta.meteringMode, meta.whiteBalance]
      .filter(Boolean)
      .join(' · ');
    if (capture) rows.push({ label: 'Mode', value: capture });
    if (meta.flash !== undefined) rows.push({ label: 'Flash', value: meta.flash ? 'fired' : 'did not fire' });
    if (meta.colorSpace) rows.push({ label: 'Colour', value: meta.colorSpace });
    if (meta.software) rows.push({ label: 'Software', value: meta.software });

    if (meta.takenAt && Math.abs(meta.takenAt - photo.createdAt) > 60_000) {
      rows.push({ label: 'Taken', value: formatMoment(meta.takenAt) });
    }
    if (meta.gps) {
      rows.push({
        label: 'Location',
        value: `${meta.gps.lat.toFixed(4)}, ${meta.gps.lon.toFixed(4)}`,
        mono: true,
        href: `https://www.openstreetmap.org/?mlat=${meta.gps.lat}&mlon=${meta.gps.lon}#map=16/${meta.gps.lat}/${meta.gps.lon}`,
      });
    }
  }

  // The file's own facts are always known, whether or not the camera wrote anything.
  rows.push({
    label: 'File',
    value: [
      formatOf(photo.contentType),
      photo.width && photo.height ? `${photo.width}×${photo.height}` : null,
      meta?.megapixels ? `${meta.megapixels} MP` : null,
      photo.size ? formatBytes(photo.size) : null,
    ]
      .filter(Boolean)
      .join(' · '),
    mono: true,
  });

  return (
    <details
      open={defaultOpen}
      className="group rounded-2xl border border-border/60 bg-secondary/30 px-4 py-2.5 open:pb-3"
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 text-xs text-muted-foreground marker:hidden">
        <span className="transition-transform group-open:rotate-90">▸</span>
        Photo details
        {meta?.cameraModel && <span className="text-muted-foreground/70">· {meta.cameraModel}</span>}
        {!hasExif && <span className="text-muted-foreground/60">· none in the file</span>}
      </summary>

      <dl className="mt-2.5 grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-3 text-xs">
            <dt className="shrink-0 text-muted-foreground">{row.label}</dt>
            <dd className={cn('truncate text-right text-foreground/90', row.mono && 'font-mono')}>
              {row.href ? (
                <a
                  href={row.href}
                  target="_blank"
                  rel="noreferrer"
                  className="underline decoration-border underline-offset-2 hover:decoration-foreground"
                  title="Open in OpenStreetMap"
                >
                  {row.value}
                </a>
              ) : (
                row.value
              )}
            </dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

/** `Canon` + `Canon EOS R5` is one camera, not two. */
function cameraName(make: string | undefined, model: string | undefined): string | undefined {
  if (!model) return make;
  if (!make) return model;
  return model.toLowerCase().startsWith(make.toLowerCase()) ? model : `${make} ${model}`;
}

/** `image/jpeg` is `JPEG` to everybody who is not a content-type header. */
function formatOf(contentType: string): string {
  const subtype = contentType.split('/')[1] ?? contentType;
  return subtype.replace('jpeg', 'jpg').toUpperCase();
}
