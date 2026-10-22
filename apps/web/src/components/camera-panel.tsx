'use client';

import { useRef, useState } from 'react';
import { Camera, Check, Film, Loader2, Sparkles } from 'lucide-react';
import type { Challenge, PublicEventSettings, Roll } from '@foto/types';
import { Badge, Button, cn, relativeTime } from '@foto/ui';
import { useDevelopRoll, useStartRoll, useUploadPhoto } from '@foto/api';
import { toast } from 'sonner';

/**
 * The camera, and the roll it might be shooting into.
 *
 * One component for both camera modes, because the act is the same — a big button
 * and the phone's own photo picker — and only the aftermath differs. On an open
 * event a shot is in the album before the shutter sound has finished; on a film
 * event it goes into a roll that is developed later, and the screen is careful to
 * say so, because a film camera that looks like it did nothing is the one thing
 * this product must not ship.
 *
 * `capture="environment"` is what makes a phone offer its camera rather than its
 * files. On a desktop it is ignored and the file picker opens, which is how a host
 * tests the whole thing.
 */
export function CameraPanel({
  eventId,
  settings,
  challenges,
  roll,
  shotsLeft,
  closed = false,
  onShot,
}: {
  eventId: string;
  settings: PublicEventSettings;
  challenges: Challenge[];
  roll: Roll | null;
  shotsLeft: number | null;
  closed?: boolean;
  onShot?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [promptId, setPromptId] = useState<string | null>(
    challenges.find((challenge) => challenge.active)?.challengeId ?? null,
  );
  const [progress, setProgress] = useState<number | null>(null);
  const [sending, setSending] = useState(0);

  const upload = useUploadPhoto(eventId);
  const startRoll = useStartRoll(eventId);
  const developRoll = useDevelopRoll(eventId);

  const onRoll = settings.cameraMode === 'roll';
  const outOfFilm = onRoll && roll !== null && (shotsLeft ?? 0) <= 0;

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;

    // On a roll, the number of shots left is a hard limit: shoot the extra frames
    // into nothing and the guest has lost them without being told why.
    if (onRoll && shotsLeft !== null && files.length > shotsLeft) {
      toast(`Only ${shotsLeft} shot${shotsLeft === 1 ? '' : 's'} left on this roll`);
      return;
    }

    setSending(files.length);
    let uploaded = 0;

    for (const file of Array.from(files)) {
      try {
        const result = await upload.mutateAsync({
          file,
          challengeId: promptId,
          onProgress: setProgress,
        });

        uploaded += 1;

        if (result.roll && result.roll.status === 'developed') {
          toast.success('That was the last shot — the roll just developed', {
            description: 'Everybody can see it now.',
          });
        } else if (result.roll) {
          toast.success(`Shot ${result.roll.shotCount} of ${result.roll.shotLimit}`, {
            description: 'Nothing to see until the roll develops.',
          });
        } else if (settings.photoApproval) {
          toast.success('Sent — the host will let it into the album');
        } else {
          toast.success('In the album');
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'That shot did not upload');
      } finally {
        setProgress(null);
      }
    }

    setSending(0);
    if (inputRef.current) inputRef.current.value = '';
    if (uploaded > 0) onShot?.();
  }

  if (closed) {
    return (
      <div className="rounded-3xl border border-border/60 bg-card/50 p-6 text-center text-sm text-muted-foreground">
        This event has closed. The album is still here to look at.
      </div>
    );
  }

  const busy = upload.isPending || startRoll.isPending || developRoll.isPending;
  const activePrompt = challenges.find((challenge) => challenge.challengeId === promptId);

  return (
    <div className="flex flex-col gap-5">
      {/* --- what to shoot -------------------------------------------------- */}
      {settings.challengesEnabled && challenges.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
            <Sparkles className="size-3.5" /> Tonight’s prompts
          </div>
          <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {challenges.map((challenge) => (
              <button
                key={challenge.challengeId}
                type="button"
                onClick={() =>
                  setPromptId(challenge.challengeId === promptId ? null : challenge.challengeId)
                }
                className={cn(
                  'flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors',
                  challenge.challengeId === promptId
                    ? 'border-primary/60 bg-primary/15 text-primary'
                    : 'border-border/70 text-muted-foreground hover:bg-accent',
                )}
              >
                <span>{challenge.emoji}</span>
                {challenge.title}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* --- the shutter ---------------------------------------------------- */}
      <div className="flex flex-col items-center gap-3 py-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className="sr-only"
          onChange={(event) => void handleFiles(event.target.files)}
        />

        <button
          type="button"
          disabled={busy || outOfFilm}
          onClick={() => inputRef.current?.click()}
          className={cn(
            'relative grid size-24 place-items-center rounded-full border-4 border-white/80 bg-white text-black shadow-2xl transition-transform',
            'hover:scale-[1.02] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40',
          )}
          aria-label="Take a photo"
        >
          {busy ? (
            <Loader2 className="size-7 animate-spin" />
          ) : (
            <Camera className="size-8" strokeWidth={1.75} />
          )}
          {progress !== null && (
            <span className="absolute inset-0 grid place-items-center rounded-full bg-black/60 text-xs font-medium text-white">
              {progress}%
            </span>
          )}
        </button>

        <p className="text-center text-sm text-muted-foreground">
          {outOfFilm
            ? 'That roll is finished — develop it to see what you got.'
            : onRoll
              ? shotsLeft !== null
                ? `${shotsLeft} shot${shotsLeft === 1 ? '' : 's'} left on this roll`
                : `${settings.shotsPerRoll} shots a roll`
              : settings.photoApproval
                ? 'The host sees it before anybody else does'
                : 'Shoot anything — it lands in the album as you take it'}
        </p>

        {activePrompt && (
          <Badge variant="secondary">
            {activePrompt.emoji} shooting “{activePrompt.title}”
          </Badge>
        )}

        {sending > 0 && (
          <p className="text-xs text-muted-foreground">
            Uploading {sending} photo{sending === 1 ? '' : 's'}…
          </p>
        )}
      </div>

      {/* --- the roll ------------------------------------------------------- */}
      {onRoll && roll && (
        <div className="rounded-3xl border border-border/70 bg-card/60 p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm">
              <Film className="size-4 text-violet-300" />
              <span className="font-medium">Roll in the camera</span>
            </div>
            <span className="text-xs text-muted-foreground">
              {roll.shotCount} / {roll.shotLimit}
            </span>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {Array.from({ length: roll.shotLimit }).map((_, index) => (
              <span
                key={index}
                className={cn(
                  'size-4 rounded-full border',
                  index < roll.shotCount
                    ? 'border-transparent bg-foreground/80'
                    : 'border-border/80',
                )}
              />
            ))}
          </div>

          <p className="mt-3 text-xs text-muted-foreground">
            {settings.rollReveal === 'host'
              ? 'Developed by the host, at the end of the night.'
              : settings.rollReveal === 'timer'
                ? roll.developAt
                  ? `Develops ${relativeTime(roll.developAt)}.`
                  : 'Develops in the morning.'
                : 'Develops by itself when the roll is full.'}
          </p>

          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            disabled={busy || roll.shotCount === 0}
            onClick={() =>
              developRoll.mutate(roll.rollId, {
                onSuccess: () => {
                  toast.success('Roll developed', {
                    description: 'Whatever you shot is in the album now.',
                  });
                  onShot?.();
                },
              })
            }
          >
            {developRoll.isPending ? <Loader2 className="animate-spin" /> : <Check />}
            Develop now
            {roll.shotCount < roll.shotLimit && ` · ${roll.shotLimit - roll.shotCount} unused`}
          </Button>
        </div>
      )}

      {onRoll && !roll && !busy && (
        <div className="rounded-3xl border border-dashed border-border/70 bg-card/40 p-5 text-center">
          <p className="text-sm text-muted-foreground">
            {settings.shotsPerRoll} shots to a roll. Nothing on it is visible — not even to you —
            until it is developed.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => startRoll.mutate(undefined)}
            disabled={startRoll.isPending}
          >
            {startRoll.isPending ? <Loader2 className="animate-spin" /> : <Film />}
            Load a roll
          </Button>
        </div>
      )}
    </div>
  );
}
