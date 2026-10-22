'use client';

import { useState } from 'react';
import { Plus, Sparkles, Trash2 } from 'lucide-react';
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
            className={cn(
              'flex items-center gap-3 rounded-2xl border border-border/60 bg-card/50 px-4 py-3',
              !challenge.active && 'opacity-60',
            )}
          >
            <span className="text-lg">{challenge.emoji}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">{challenge.title}</p>
              <p className="text-xs text-muted-foreground">
                {challenge.photoCount} photo{challenge.photoCount === 1 ? '' : 's'}
              </p>
            </div>
            {challenge.photoCount >= 5 && <Badge variant="default">popular</Badge>}
            <Switch
              checked={challenge.active}
              aria-label={`${challenge.active ? 'Pause' : 'Show'} ${challenge.title}`}
              onCheckedChange={(active) =>
                updateChallenge.mutate({ challengeId: challenge.challengeId, payload: { active } })
              }
            />
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Delete ${challenge.title}`}
              onClick={() =>
                deleteChallenge.mutate(challenge.challengeId, {
                  onSuccess: () => toast('Prompt removed', { description: 'Its photos stay.' }),
                })
              }
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
