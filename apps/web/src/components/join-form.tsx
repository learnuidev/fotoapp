'use client';

import { useState } from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';
import { GUEST_EMOJI, type PublicEvent } from '@foto/types';
import { Button, Card, CardContent, Input, Label, Mark, cn, formatMoment } from '@foto/ui';
import { useGuestSession } from '@foto/auth';

/**
 * The two taps that make somebody a guest.
 *
 * This screen is the highest-stakes one in the product: it is what a guest sees
 * after scanning a card, in a dark room, having had a drink, possibly on somebody
 * else's wi-fi. So it asks for two things — a name and an emoji — and it makes the
 * emoji grid big enough to hit.
 */
export function JoinForm({
  event,
  onJoined,
}: {
  event: PublicEvent;
  onJoined?: () => void;
}) {
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState(GUEST_EMOJI[0]!);
  const { join, joining, error } = useGuestSession(event.code);

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <Mark />
        {event.coverUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={event.coverUrl}
            alt=""
            className="size-20 rounded-3xl object-cover ring-2 ring-border/60"
          />
        )}
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            You are invited to
          </p>
          <h1 className="mt-1 font-display text-4xl tracking-tight">{event.name}</h1>
          {event.date && (
            <p className="mt-1 text-sm text-muted-foreground">{formatMoment(event.date)}</p>
          )}
          {event.location && <p className="text-sm text-muted-foreground">{event.location}</p>}
        </div>
      </div>

      <Card className="bg-card/70">
        <CardContent className="flex flex-col gap-5 p-6">
          <p className="text-sm text-muted-foreground">
            {event.welcome || 'Join this album to add your photos. No app and no account required.'}
          </p>

          <form
            className="flex flex-col gap-4"
            onSubmit={async (submitEvent) => {
              submitEvent.preventDefault();
              if (!name.trim()) return;
              try {
                await join(name.trim(), emoji);
                onJoined?.();
              } catch {
                // The hook has already put the reason in `error`.
              }
            }}
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="guest-name">What should we call you?</Label>
              <Input
                id="guest-name"
                value={name}
                onChange={(changeEvent) => setName(changeEvent.target.value)}
                placeholder="Priya"
                autoComplete="given-name"
                maxLength={40}
                required
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label>Pick an avatar</Label>
              <div className="grid grid-cols-6 gap-2">
                {GUEST_EMOJI.map((choice) => (
                  <button
                    key={choice}
                    type="button"
                    onClick={() => setEmoji(choice)}
                    className={cn(
                      'grid aspect-square place-items-center rounded-2xl border text-xl transition-colors',
                      choice === emoji
                        ? 'border-primary bg-primary/15'
                        : 'border-border/60 hover:bg-accent',
                    )}
                    aria-pressed={choice === emoji}
                  >
                    {choice}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <p className="rounded-2xl bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
                {error}
              </p>
            )}

            <Button type="submit" size="lg" disabled={joining || !name.trim()}>
              {joining ? 'Joining…' : 'Join the album'} <ArrowRight />
            </Button>
          </form>

          <div className="flex items-start gap-2 rounded-2xl bg-secondary/50 px-4 py-3 text-xs text-muted-foreground">
            <Sparkles className="mt-0.5 size-3.5 shrink-0 text-primary" />
            <span>
              {event.settings.cameraMode === 'roll'
                ? `${event.settings.shotsPerRoll} shots per roll. Photos stay hidden until the roll is developed.`
                : 'Photos go straight into the album, with your name on them.'}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
