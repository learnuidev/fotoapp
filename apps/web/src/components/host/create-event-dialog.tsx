'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Plus } from 'lucide-react';
import { EVENT_KINDS, type EventKind } from '@foto/types';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
  Switch,
  Textarea,
  cn,
} from '@foto/ui';
import { useCreateEvent } from '@foto/api';
import { toast } from 'sonner';

/**
 * Making an event.
 *
 * Three fields and one switch that changes what the evening *is*: the open camera
 * puts photos on the wall as they are taken, and the film roll gives everybody a
 * disposable camera instead. Everything else — the prompts, the layout, the
 * permissions — has a default that is right for most parties, and is edited later
 * on the event's own page rather than asked for here.
 */
export function CreateEventDialog({ trigger }: { trigger?: React.ReactNode }) {
  const router = useRouter();
  const createEvent = useCreateEvent();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<EventKind>('wedding');
  const [date, setDate] = useState('');
  const [location, setLocation] = useState('');
  const [welcome, setWelcome] = useState('');
  const [film, setFilm] = useState(false);

  async function submit(submitEvent: React.FormEvent) {
    submitEvent.preventDefault();
    if (!name.trim()) return;

    try {
      const result = await createEvent.mutateAsync({
        name: name.trim(),
        kind,
        date: date ? new Date(date).getTime() : null,
        location: location.trim(),
        welcome: welcome.trim(),
        settings: film ? { cameraMode: 'roll', rollReveal: 'host' } : { cameraMode: 'open' },
      });
      toast.success('Event made', { description: `Join code ${result.event.code}` });
      setOpen(false);
      router.push(`/host/e/${result.event.eventId}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not make that event');
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus /> New event
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Make an event</DialogTitle>
          <DialogDescription>
            A join code and a QR come with it. Everything here can be changed afterwards.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="event-name">What is it called?</Label>
            <Input
              id="event-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Nadia & Tom"
              required
              maxLength={120}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>What kind of evening?</Label>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {EVENT_KINDS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setKind(option.value)}
                  className={cn(
                    'flex flex-col items-center gap-1 rounded-2xl border px-2 py-3 text-xs transition-colors',
                    kind === option.value
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'border-border/60 text-muted-foreground hover:bg-accent',
                  )}
                >
                  <span className="text-lg">{option.emoji}</span>
                  {option.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              This only decides which prompts the event starts with — “the first dance”, “your
              table, mid-laugh” — and you can edit them.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="event-date">When</Label>
              <Input
                id="event-date"
                type="datetime-local"
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="event-location">Where</Label>
              <Input
                id="event-location"
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                placeholder="The Old Barn, Somerset"
                maxLength={160}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="event-welcome">A line for the guests</Label>
            <Textarea
              id="event-welcome"
              value={welcome}
              onChange={(event) => setWelcome(event.target.value)}
              placeholder="You are the photographer tonight."
              maxLength={400}
              className="min-h-20"
            />
          </div>

          <div className="flex items-start justify-between gap-4 rounded-2xl border border-border/60 bg-secondary/30 p-4">
            <div>
              <p className="text-sm font-medium">Shoot on film</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Guests get a roll of 12 shots and no previews. Nothing develops until you bring the
                rolls back — which is the good bit, later on.
              </p>
            </div>
            <Switch checked={film} onCheckedChange={setFilm} aria-label="Shoot on film" />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={createEvent.isPending || !name.trim()}>
              {createEvent.isPending && <Loader2 className="animate-spin" />}
              Make the event
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
