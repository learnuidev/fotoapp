'use client';

import { useState } from 'react';
import { Check, Sparkles } from 'lucide-react';
import type { Challenge, Photo } from '@foto/types';
import { cn } from '@foto/ui';
import { useUpdatePhoto } from '@foto/api';
import { toast } from 'sonner';

/**
 * Which prompt a photo answers, changeable after the fact.
 *
 * The camera tags a shot at the moment it is taken; this is the same field, edited
 * from the console, because the host is the person who knows afterwards that three of
 * the evening's photos were actually "the shoes". It costs one tap and it changes how
 * the album reads: the prompt is what the analytics count, and what the wall groups by.
 *
 * Only the host's side of the viewer draws it — a guest cannot re-file somebody else's
 * photo, and the API would refuse.
 */
export function PromptPicker({
  photo,
  challenges,
  eventId,
  onChanged,
}: {
  photo: Photo;
  challenges: Challenge[];
  eventId: string;
  onChanged?: () => void;
}) {
  const update = useUpdatePhoto(eventId);
  const [saving, setSaving] = useState<string | null>(null);

  if (challenges.length === 0) return null;

  async function assign(challengeId: string | null) {
    if (challengeId === (photo.challengeId ?? null)) return;
    setSaving(challengeId ?? 'none');
    try {
      await update.mutateAsync({ photoId: photo.photoId, payload: { challengeId } });
      onChanged?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not file that photo');
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
        <Sparkles className="size-3.5" /> Filed under
      </span>
      {/*
        Every prompt, active or paused. Paused only means "the guest camera is not
        offering it" — a photo can still be filed under one, and the host is exactly who
        would want to file something under a prompt they have stopped asking for.
      */}
      <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {challenges.map((challenge) => {
            const active = challenge.challengeId === photo.challengeId;
            return (
              <button
                key={challenge.challengeId}
                type="button"
                onClick={() => void assign(active ? null : challenge.challengeId)}
                disabled={saving !== null}
                title={challenge.active ? undefined : 'Paused — the guest camera is not offering this one'}
                className={cn(
                  'flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors disabled:opacity-60',
                  active
                    ? 'border-primary/60 bg-primary/15 text-primary'
                    : 'border-border/70 text-muted-foreground hover:bg-accent',
                  !challenge.active && !active && 'opacity-70',
                )}
              >
                <span>{challenge.emoji}</span>
                {challenge.title}
                {active && <Check className="size-3" />}
              </button>
            );
          })}
      </div>
      {photo.challengeId && (
        <button
          type="button"
          onClick={() => void assign(null)}
          disabled={saving !== null}
          className="w-fit text-xs text-muted-foreground underline-offset-4 hover:underline disabled:opacity-60"
        >
          {saving === 'none' ? 'Taking it out…' : 'Take it out of this prompt'}
        </button>
      )}
    </div>
  );
}
