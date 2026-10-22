'use client';

import { useState } from 'react';
import { Check, Pencil, Plus, Sparkles, Trash2, X } from 'lucide-react';
import type { Event } from '@foto/types';
import {
  Badge,
  Button,
  Card,
  CardContent,
  Input,
  Skeleton,
  Switch,
  cn,
} from '@foto/ui';
import {
  useCreateChallenge,
  useDeleteChallenge,
  useEventChallenges,
  useUpdateChallenge,
} from '@foto/api';
import { toast } from 'sonner';

/**
 * The prompts.
 *
 * A host can add one for something they know will happen — the speech, the dog, the
 * specific uncle — and the count beside each is how many photos it produced, which
 * is the closest this product gets to telling somebody what the room found
 * interesting.
 */
export function PromptsTab({ event }: { event: Event }) {
  const challenges = useEventChallenges(event.eventId);
  const createChallenge = useCreateChallenge(event.eventId);
  const updateChallenge = useUpdateChallenge(event.eventId);
  const deleteChallenge = useDeleteChallenge(event.eventId);
  const [title, setTitle] = useState('');
  const [emoji, setEmoji] = useState('📸');
  /**
   * The prompt currently being renamed, and the draft of its two editable bits.
   *
   * One row at a time: a list of open editors is a form, and this is meant to be the
   * lighter thing than deleting a prompt and writing it again — which is what a host
   * does today when the wording is wrong.
   */
  const [editing, setEditing] = useState<{ challengeId: string; title: string; emoji: string } | null>(null);

  const list = challenges.data ?? [];

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-col gap-3 p-5">
          <div className="flex items-center gap-2 text-sm">
            <Sparkles className="size-4 text-primary" />
            <span className="font-medium">Ask the room for something specific</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Guests pick a prompt on the camera screen and their photo is filed under it. The counts
            below are what each prompt actually produced.
          </p>

          <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={(submitEvent) => {
              submitEvent.preventDefault();
              if (!title.trim()) return;
              createChallenge.mutate(
                { title: title.trim(), emoji },
                {
                  onSuccess: () => {
                    setTitle('');
                    toast.success('Prompt added');
                  },
                },
              );
            }}
          >
            <Input
              value={emoji}
              onChange={(changeEvent) => setEmoji(changeEvent.target.value.slice(0, 4))}
              className="h-10 w-16 text-center text-lg"
              aria-label="Prompt emoji"
            />
            <Input
              value={title}
              onChange={(changeEvent) => setTitle(changeEvent.target.value)}
              placeholder="The speech that went long"
              className="h-10 flex-1"
              maxLength={80}
            />
            <Button type="submit" disabled={!title.trim() || createChallenge.isPending}>
              <Plus /> Add
            </Button>
          </form>
        </CardContent>
      </Card>

      {challenges.isLoading && <Skeleton className="h-40 w-full" />}

      <div className="flex flex-col gap-2">
        {list.map((challenge) => (
          <div
            key={challenge.challengeId}
            /*
             * The whole row is the rename affordance, not just the pencil.
             *
             * A prompt *is* its wording, so tapping the wording is what somebody does
             * when they want to change it — and a 14-pixel pencil is not what a thumb
             * aims at. The switch and the bin stop the click, because those are acts
             * rather than an invitation to edit.
             */
            onClick={() => {
              if (editing?.challengeId === challenge.challengeId) return;
              setEditing({
                challengeId: challenge.challengeId,
                title: challenge.title,
                emoji: challenge.emoji,
              });
            }}
            className={cn(
              'flex cursor-pointer items-center gap-3 rounded-2xl border border-border/60 bg-card/50 px-4 py-3 transition-colors hover:border-primary/40 hover:bg-card',
              !challenge.active && 'opacity-60',
            )}
          >
            {editing?.challengeId === challenge.challengeId ? (
              /* --- renaming it ------------------------------------------------- */
              <form
                className="flex min-w-0 flex-1 items-center gap-2"
                onClick={(clickEvent) => clickEvent.stopPropagation()}
                onSubmit={(submitEvent) => {
                  submitEvent.preventDefault();
                  const next = editing.title.trim();
                  if (!next) return;
                  updateChallenge.mutate(
                    {
                      challengeId: challenge.challengeId,
                      payload: { title: next, emoji: editing.emoji },
                    },
                    {
                      onSuccess: () => {
                        setEditing(null);
                        toast.success('Prompt renamed', {
                          description: 'Every photo filed under it says so now.',
                        });
                      },
                      onError: (error) =>
                        toast.error(
                          error instanceof Error ? error.message : 'Could not rename that prompt',
                        ),
                    },
                  );
                }}
              >
                <Input
                  value={editing.emoji}
                  onChange={(changeEvent) =>
                    setEditing({ ...editing, emoji: changeEvent.target.value.slice(0, 4) })
                  }
                  className="h-9 w-14 text-center text-lg"
                  aria-label="Prompt emoji"
                />
                <Input
                  autoFocus
                  value={editing.title}
                  /*
                   * The whole title is selected on focus, because renaming is what this
                   * box is for: a host who opens it and types means to replace the
                   * wording, not to append to it. Clicking again puts the caret where it
                   * was clicked, for the edit that is only a word.
                   */
                  onFocus={(focusEvent) => focusEvent.currentTarget.select()}
                  onChange={(changeEvent) => setEditing({ ...editing, title: changeEvent.target.value })}
                  onKeyDown={(keyEvent) => {
                    if (keyEvent.key === 'Escape') setEditing(null);
                  }}
                  className="h-9 min-w-0 flex-1"
                  maxLength={80}
                  aria-label="Prompt title"
                />
                <Button
                  type="submit"
                  size="icon-sm"
                  aria-label="Save the prompt"
                  disabled={!editing.title.trim() || updateChallenge.isPending}
                >
                  <Check className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Cancel"
                  onClick={() => setEditing(null)}
                >
                  <X className="size-3.5" />
                </Button>
              </form>
            ) : (
              /* --- reading it -------------------------------------------------- */
              <>
                <span className="text-lg">{challenge.emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{challenge.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {challenge.photoCount} photo{challenge.photoCount === 1 ? '' : 's'} · click to
                    rename
                  </p>
                </div>
                {challenge.photoCount >= 5 && <Badge variant="default">popular</Badge>}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Rename ${challenge.title}`}
                  onClick={() =>
                    setEditing({
                      challengeId: challenge.challengeId,
                      title: challenge.title,
                      emoji: challenge.emoji,
                    })
                  }
                >
                  <Pencil className="size-3.5" />
                </Button>
                <span onClick={(clickEvent) => clickEvent.stopPropagation()}>
                  <Switch
                    checked={challenge.active}
                    aria-label={`${challenge.active ? 'Pause' : 'Show'} ${challenge.title}`}
                    onCheckedChange={(active) =>
                      updateChallenge.mutate({
                        challengeId: challenge.challengeId,
                        payload: { active },
                      })
                    }
                  />
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Delete ${challenge.title}`}
                  onClick={(clickEvent) => {
                    clickEvent.stopPropagation();
                    deleteChallenge.mutate(challenge.challengeId, {
                      onSuccess: () => toast('Prompt removed', { description: 'Its photos stay.' }),
                    });
                  }}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
