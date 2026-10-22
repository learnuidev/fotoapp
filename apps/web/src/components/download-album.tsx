'use client';

import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { zipSync } from 'fflate';
import type { Photo } from '@foto/types';
import { Button, type ButtonProps } from '@foto/ui';
import { toast } from 'sonner';
import { filenameFor } from './photo-viewer';

/**
 * The whole album, as a zip.
 *
 * Built in the browser rather than on the server. In AWS the alternative is a
 * Lambda that streams a hundred megabytes of somebody's wedding through itself,
 * which is slow, expensive and time-limited; here it is a fetch per photo and a
 * compression step that happens on the machine that is going to store the file
 * anyway. `fflate` does the zipping — about 8 KB of library, and it means the
 * archive is made without this app needing a second process anywhere.
 *
 * Stored, not deflated, for the photos: a JPEG and a PNG are already compressed,
 * and re-deflating a hundred of them costs seconds for nothing. The manifest is
 * the one file worth compressing.
 */
export function DownloadAlbum({
  photos,
  eventName,
  variant = 'outline',
  size = 'sm',
  label,
  favoriteOnly = false,
}: {
  photos: Photo[];
  eventName: string;
  variant?: ButtonProps['variant'];
  size?: ButtonProps['size'];
  label?: string;
  favoriteOnly?: boolean;
}) {
  const [done, setDone] = useState(0);
  const [busy, setBusy] = useState(false);

  const queued = favoriteOnly ? photos.filter((photo) => photo.favorite) : photos;

  async function run() {
    if (queued.length === 0) {
      toast('Nothing to download yet');
      return;
    }

    setBusy(true);
    setDone(0);

    try {
      const files: Record<string, Uint8Array> = {};
      const manifest: string[] = [`${eventName} — downloaded from foto`, ''];

      for (const [index, photo] of queued.entries()) {
        const response = await fetch(photo.url);
        if (!response.ok) throw new Error(`Photo ${index + 1} could not be fetched`);
        const buffer = new Uint8Array(await response.arrayBuffer());
        const name = filenameFor(photo);
        files[name] = buffer;
        manifest.push(
          `${name}\t${photo.guestName}\t${new Date(photo.createdAt).toISOString()}\t${photo.caption}`,
        );
        setDone(index + 1);
      }

      files['captions.txt'] = new TextEncoder().encode(manifest.join('\n'));
      const archive = zipSync(files, { level: 0 });
      const blob = new Blob([archive as unknown as BlobPart], { type: 'application/zip' });

      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${eventName.replace(/[^a-zA-Z0-9-_ ]/g, '').trim().replace(/\s+/g, '-') || 'album'}.zip`;
      link.click();
      URL.revokeObjectURL(link.href);

      toast.success(`${queued.length} photo${queued.length === 1 ? '' : 's'} downloaded`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'The download failed');
    } finally {
      setBusy(false);
      setDone(0);
    }
  }

  return (
    <Button variant={variant} size={size} onClick={() => void run()} disabled={busy}>
      {busy ? <Loader2 className="animate-spin" /> : <Download />}
      {busy ? `${done}/${queued.length}` : (label ?? (favoriteOnly ? 'Download stars' : 'Download all'))}
    </Button>
  );
}
