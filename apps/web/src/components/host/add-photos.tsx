'use client';

import { useRef, useState } from 'react';
import { ImagePlus, Loader2 } from 'lucide-react';
import { Button, cn } from '@foto/ui';
import { useHostUploadPhoto } from '@foto/api';
import { toast } from 'sonner';

/**
 * Adding photos from the console.
 *
 * The host's own version of the camera: pick files, watch them go up, and they are in
 * the album with their name under them — no roll to develop and no approval to give
 * yourself. It is here, at the top of the gallery, because that is where a host
 * notices a gap: the one shot the photographer sent over, the photo of the venue
 * before anybody arrived.
 *
 * It uploads on selection rather than behind a form. The files are already chosen at
 * that point, and a second "confirm" press is a second chance to lose them.
 */
export function AddPhotos({ eventId }: { eventId: string }) {
  const input = useRef<HTMLInputElement>(null);
  const upload = useHostUploadPhoto(eventId);
  const [queue, setQueue] = useState<{ name: string; percent: number }[]>([]);
  const [sending, setSending] = useState(false);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;

    const chosen = Array.from(files);
    setSending(true);
    setQueue(chosen.map((file) => ({ name: file.name, percent: 0 })));

    let added = 0;
    for (const [index, file] of chosen.entries()) {
      try {
        // A photo the API refuses (a PDF, something over the size limit) should not
        // stop the other nine from going up.
        if (!file.type.startsWith('image/')) {
          throw new Error(`${file.name} is not an image`);
        }
        await upload.mutateAsync({
          file,
          onProgress: (percent) =>
            setQueue((current) =>
              current.map((entry, entryIndex) =>
                entryIndex === index ? { ...entry, percent } : entry,
              ),
            ),
        });
        added += 1;
      } catch (error) {
        toast.error(error instanceof Error ? error.message : `Could not add ${file.name}`);
      }
    }

    setSending(false);
    setQueue([]);
    if (input.current) input.current.value = '';
    if (added > 0) {
      toast.success(`Added ${added} photo${added === 1 ? '' : 's'}`, {
        description: 'They are in the album, credited to you.',
      });
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        onChange={(event) => void handleFiles(event.target.files)}
      />
      <Button
        variant="outline"
        size="sm"
        disabled={sending}
        onClick={() => input.current?.click()}
      >
        {sending ? <Loader2 className="animate-spin" /> : <ImagePlus />}
        {sending ? 'Adding…' : 'Add photos'}
      </Button>

      {queue.length > 0 && (
        <ul className="flex flex-col gap-1">
          {queue.map((entry) => (
            <li key={entry.name} className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <span className="max-w-40 truncate">{entry.name}</span>
              <span className="h-1 w-16 overflow-hidden rounded-full bg-secondary">
                <span
                  className={cn('block h-full rounded-full bg-primary transition-[width]')}
                  style={{ width: `${entry.percent}%` }}
                />
              </span>
              <span className="tabular-nums">{entry.percent}%</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
