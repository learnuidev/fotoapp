'use client';

import { useState } from 'react';
import { Film, Loader2, Sparkles } from 'lucide-react';
import type { Event } from '@foto/types';
import { Badge, Button, Card, CardContent, EmojiAvatar, Skeleton, cn } from '@foto/ui';
import { useDevelopAllRolls, useEventChallenges, useEventRolls } from '@foto/api';
import { toast } from 'sonner';
import { Gallery } from '@/components/gallery';

/**
 * The rolls, from the host's side.
 *
 * A developing roll appears here with its shot count and no frames, which is the one
 * place this product withholds something from the host — the option to peek would
 * spoil the reveal the event was built around. Pressing develop is what brings them
 * back, and pressing it with the room watching is the point.
 */
export function RollsTab({ event }: { event: Event }) {
  const rolls = useEventRolls(event.eventId);
  const challenges = useEventChallenges(event.eventId);
  const developAll = useDevelopAllRolls(event.eventId);
  const [revealed, setRevealed] = useState(false);

  const list = rolls.data ?? [];
  const shooting = list.filter((roll) => roll.status === 'shooting');

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="flex items-start gap-3">
            <span className="grid size-10 place-items-center rounded-full bg-violet-500/15 text-violet-700 dark:text-violet-300">
              <Film className="size-5" />
            </span>
            <div>
              <p className="font-medium">
                {shooting.length === 0
                  ? 'Every roll is back'
                  : `${shooting.length} roll${shooting.length === 1 ? '' : 's'} still in a camera`}
              </p>
              <p className="mt-0.5 max-w-md text-xs text-muted-foreground">
                {event.settings.rollReveal === 'host'
                  ? 'This event reveals by hand: nothing on a roll is visible until you develop it.'
                  : event.settings.rollReveal === 'timer'
                    ? `Rolls develop themselves after ${event.settings.rollRevealMinutes} minutes.`
                    : 'Rolls develop when they are full.'}
              </p>
            </div>
          </div>

          <Button
            disabled={shooting.length === 0 || developAll.isPending}
            onClick={() =>
              developAll.mutate(undefined, {
                onSuccess: (result) => {
                  setRevealed(true);
                  toast.success(
                    result.developed === 0
                      ? 'Nothing to develop'
                      : `${result.developed} roll${result.developed === 1 ? '' : 's'} developed`,
                    {
                      description:
                        result.developed === 0
                          ? undefined
                          : 'Whatever was on them is in the album now.',
                    },
                  );
                  void rolls.refetch();
                },
              })
            }
          >
            {developAll.isPending ? <Loader2 className="animate-spin" /> : <Sparkles />}
            {revealed ? 'Develop again' : 'Develop everything'}
          </Button>
        </CardContent>
      </Card>

      {rolls.isLoading && <Skeleton className="h-40 w-full" />}

      {list.length === 0 && !rolls.isLoading && (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            No guest has loaded a roll yet. The camera tab on a guest’s phone does that.
          </CardContent>
        </Card>
      )}

      {list.map((roll) => (
        <Card key={roll.rollId} className={cn(roll.status === 'shooting' && 'border-violet-500/30')}>
          <CardContent className="flex flex-col gap-3 p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <EmojiAvatar emoji={roll.guestEmoji} size="sm" />
                <div>
                  <p className="text-sm font-medium">{roll.guestName}</p>
                  <p className="text-xs text-muted-foreground">
                    started {new Date(roll.startedAt).toLocaleTimeString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {roll.status === 'shooting' ? (
                  <Badge variant="film">in the camera</Badge>
                ) : (
                  <Badge variant="secondary">developed</Badge>
                )}
                <span className="text-xs text-muted-foreground">
                  {roll.shotCount} / {roll.shotLimit}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {Array.from({ length: roll.shotLimit }).map((_, index) => (
                <span
                  key={index}
                  className={cn(
                    'size-3.5 rounded-full border',
                    index < roll.shotCount
                      ? 'border-transparent bg-foreground/80'
                      : 'border-border/70',
                  )}
                />
              ))}
            </div>

            {roll.status === 'developed' ? (
              <Gallery
                photos={roll.photos}
                eventId={event.eventId}
                scope="host"
                allowComments={event.settings.allowComments}
                allowReactions={event.settings.allowReactions}
                challenges={challenges.data}
                emptyTitle="An empty roll"
                emptyBody="Developed with nothing on it."
              />
            ) : (
              <p className="text-xs text-muted-foreground">
                {roll.shotCount} frame{roll.shotCount === 1 ? '' : 's'} on it, and no way to see any
                of them until it develops.
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
