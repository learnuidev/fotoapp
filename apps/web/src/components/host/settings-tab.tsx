'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Trash2 } from 'lucide-react';
import {
  ROLL_REVEAL_OPTIONS,
  ROLL_SIZES,
  WALL_ORDER_OPTIONS,
  WALL_SECONDS,
  type Event,
  type EventSettings,
} from '@foto/types';
import {
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Separator,
  Switch,
  Textarea,
  cn,
} from '@foto/ui';
import { useDeleteEvent, useUpdateEvent } from '@foto/api';
import { toast } from 'sonner';

/**
 * Everything about the event that is not a photo.
 *
 * One form, one save button, and a summary of what each switch actually does —
 * because the difference between "approve photos" and "gallery open to everyone" is
 * the difference between a private album and a public one, and a host should not
 * have to work that out from the labels.
 */
export function SettingsTab({ event }: { event: Event }) {
  const router = useRouter();
  const update = useUpdateEvent(event.eventId);
  const deleteEvent = useDeleteEvent();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const [name, setName] = useState(event.name);
  const [location, setLocation] = useState(event.location);
  const [welcome, setWelcome] = useState(event.welcome);
  const [date, setDate] = useState(
    event.date ? new Date(event.date - new Date(event.date).getTimezoneOffset() * 60_000).toISOString().slice(0, 16) : '',
  );
  const [settings, setSettings] = useState<EventSettings>(event.settings);

  function set<K extends keyof EventSettings>(key: K, value: EventSettings[K]) {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  function save() {
    update.mutate(
      {
        name: name.trim(),
        location: location.trim(),
        welcome: welcome.trim(),
        date: date ? new Date(date).getTime() : null,
        settings,
      },
      {
        onSuccess: () => toast.success('Saved'),
        onError: (error) =>
          toast.error(error instanceof Error ? error.message : 'Could not save that'),
      },
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* --- what it is ---------------------------------------------------- */}
      <Card>
        <CardContent className="flex flex-col gap-4 p-5">
          <h2 className="font-display text-xl">The event</h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={name} onChange={(event) => setName(event.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="date">When</Label>
              <Input
                id="date"
                type="datetime-local"
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="location">Where</Label>
            <Input
              id="location"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="welcome">The line guests read when they join</Label>
            <Textarea
              id="welcome"
              value={welcome}
              onChange={(event) => setWelcome(event.target.value)}
              className="min-h-20"
              maxLength={400}
            />
          </div>
        </CardContent>
      </Card>

      {/* --- the camera ---------------------------------------------------- */}
      <Card>
        <CardContent className="flex flex-col gap-4 p-5">
          <h2 className="font-display text-xl">How the camera behaves</h2>

          <div className="grid gap-2 sm:grid-cols-2">
            <Choice
              active={settings.cameraMode === 'open'}
              onClick={() => set('cameraMode', 'open')}
              title="Open camera"
              body="Photos enter the album immediately."
            />
            <Choice
              active={settings.cameraMode === 'roll'}
              onClick={() => set('cameraMode', 'roll')}
              title="Film rolls"
              body="A fixed number of shots per roll, hidden until developed."
            />
          </div>

          {settings.cameraMode === 'roll' && (
            <div className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-secondary/20 p-4">
              <div className="flex flex-col gap-2">
                <Label>Shots a roll</Label>
                <div className="flex gap-2">
                  {ROLL_SIZES.map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => set('shotsPerRoll', size)}
                      className={cn(
                        'rounded-full border px-3.5 py-1.5 text-sm',
                        settings.shotsPerRoll === size
                          ? 'border-primary bg-primary/15 text-primary'
                          : 'border-border/70 text-muted-foreground hover:bg-accent',
                      )}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Label>When rolls develop</Label>
                <div className="flex flex-col gap-2">
                  {ROLL_REVEAL_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => set('rollReveal', option.value)}
                      className={cn(
                        'flex flex-col items-start rounded-2xl border px-4 py-2.5 text-left text-sm',
                        settings.rollReveal === option.value
                          ? 'border-primary/60 bg-primary/10'
                          : 'border-border/60 hover:bg-accent',
                      )}
                    >
                      <span className="font-medium">{option.label}</span>
                      <span className="text-xs text-muted-foreground">{option.hint}</span>
                    </button>
                  ))}
                </div>
              </div>

              {settings.rollReveal === 'timer' && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="reveal-minutes">Minutes until a roll develops</Label>
                  <Input
                    id="reveal-minutes"
                    type="number"
                    min={1}
                    max={10080}
                    value={settings.rollRevealMinutes}
                    onChange={(changeEvent) =>
                      set('rollRevealMinutes', Number(changeEvent.target.value) || 120)
                    }
                    className="w-32"
                  />
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* --- who may see and do what --------------------------------------- */}
      <Card>
        <CardContent className="flex flex-col gap-4 p-5">
          <h2 className="font-display text-xl">Who sees what</h2>

          <div className="flex flex-col gap-2">
            <Label>The gallery</Label>
            <div className="grid gap-2 sm:grid-cols-3">
              <Choice
                active={settings.galleryVisibility === 'everyone'}
                onClick={() => set('galleryVisibility', 'everyone')}
                title="Anyone with the link"
                body="Required for the public wall."
              />
              <Choice
                active={settings.galleryVisibility === 'guests'}
                onClick={() => set('galleryVisibility', 'guests')}
                title="Only guests who joined"
                body="A valid guest session is required."
              />
              <Choice
                active={settings.galleryVisibility === 'host'}
                onClick={() => set('galleryVisibility', 'host')}
                title="Only you"
                body="Only the host sees the gallery."
              />
            </div>
          </div>

          <Separator />

          <Toggle
            label="Approve photos before they appear"
            hint="New photos are visible to the host only until approved."
            checked={settings.photoApproval}
            onChange={(checked) => set('photoApproval', checked)}
          />
          <Toggle
            label="Reactions"
            hint="Guests can react to photos."
            checked={settings.allowReactions}
            onChange={(checked) => set('allowReactions', checked)}
          />
          <Toggle
            label="Comments"
            hint="Guests can comment on photos."
            checked={settings.allowComments}
            onChange={(checked) => set('allowComments', checked)}
          />
          <Toggle
            label="Downloads"
            hint="Guests can download the album as a zip."
            checked={settings.allowDownloads}
            onChange={(checked) => set('allowDownloads', checked)}
          />
          <Toggle
            label="Prompts"
            hint="Show suggested subjects to guests."
            checked={settings.challengesEnabled}
            onChange={(checked) => set('challengesEnabled', checked)}
          />
        </CardContent>
      </Card>

      {/* --- the wall ------------------------------------------------------ */}
      <Card>
        <CardContent className="flex flex-col gap-4 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-xl">The wall</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                The public screen at <code className="rounded bg-secondary px-1">/e/…/wall</code>: one
                photo at a time, no sign-in.
              </p>
            </div>
            <Switch
              checked={settings.slideshowEnabled}
              aria-label="The wall"
              onCheckedChange={(checked) => set('slideshowEnabled', checked)}
            />
          </div>

          <div className={cn('flex flex-col gap-4', !settings.slideshowEnabled && 'opacity-50')}>
            <div className="flex flex-col gap-2">
              <Label>Which order it plays</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {WALL_ORDER_OPTIONS.map((option) => (
                  <Choice
                    key={option.value}
                    active={settings.wallOrder === option.value}
                    onClick={() => set('wallOrder', option.value as EventSettings['wallOrder'])}
                    title={option.label}
                    body={option.hint}
                  />
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>How long each photo stays</Label>
              <div className="flex flex-wrap items-center gap-2">
                {WALL_SECONDS.map((secs) => (
                  <button
                    key={secs}
                    type="button"
                    onClick={() => set('wallSeconds', secs)}
                    className={cn(
                      'rounded-full border px-3.5 py-1.5 text-sm',
                      settings.wallSeconds === secs
                        ? 'border-primary bg-primary/15 text-primary'
                        : 'border-border/70 text-muted-foreground hover:bg-accent',
                    )}
                  >
                    {secs}s
                  </button>
                ))}
                <span className="text-xs text-muted-foreground">
                  anything from 2 to 60
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>How it fits the screen</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                <Choice
                  active={settings.wallFit === 'contain'}
                  onClick={() => set('wallFit', 'contain')}
                  title="Whole frame"
                  body="Entire photo, with bars where the screen shape differs."
                />
                <Choice
                  active={settings.wallFit === 'cover'}
                  onClick={() => set('wallFit', 'cover')}
                  title="Fill the screen"
                  body="No bars; edges are cropped to fit."
                />
              </div>
            </div>

            <Toggle
              label="Names and captions"
              hint="Guest name, caption and prompt under each photo."
              checked={settings.wallCaptions}
              onChange={(checked) => set('wallCaptions', checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* --- the two big switches ------------------------------------------ */}
      <Card>
        <CardContent className="flex flex-col gap-4 p-5">
          <h2 className="font-display text-xl">Open or closed</h2>
          <p className="text-sm text-muted-foreground">
            {event.closedAt
              ? 'This event is closed. Guests can view the album; nobody can add to it.'
              : 'Closing stops new photos, reactions and comments. Nothing is deleted, and you can reopen it.'}
          </p>
          <Button
            variant={event.closedAt ? 'default' : 'outline'}
            className="w-fit"
            disabled={update.isPending}
            onClick={() =>
              update.mutate(
                { closed: !event.closedAt },
                {
                  onSuccess: () =>
                    toast.success(event.closedAt ? 'Reopened' : 'Closed to new photos'),
                },
              )
            }
          >
            {event.closedAt ? 'Reopen album' : 'Close album'}
          </Button>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <Button variant="ghost" className="text-destructive hover:bg-destructive/10" onClick={() => setConfirmingDelete(true)}>
          <Trash2 /> Delete this event
        </Button>
        <Button size="lg" onClick={save} disabled={update.isPending}>
          {update.isPending && <Loader2 className="animate-spin" />}
          Save changes
        </Button>
      </div>

      <Dialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {event.name}?</DialogTitle>
            <DialogDescription>
              The album, guests, reactions and comments are deleted. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmingDelete(false)}>
              Keep it
            </Button>
            <Button
              variant="destructive"
              disabled={deleteEvent.isPending}
              onClick={() =>
                deleteEvent.mutate(event.eventId, {
                  onSuccess: () => {
                    toast('Event deleted');
                    router.push('/host');
                  },
                })
              }
            >
              {deleteEvent.isPending && <Loader2 className="animate-spin" />}
              Delete it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Choice({
  active,
  onClick,
  title,
  body,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  body: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex flex-col items-start gap-1 rounded-2xl border px-4 py-3 text-left transition-colors',
        active ? 'border-primary/60 bg-primary/10' : 'border-border/60 hover:bg-accent',
      )}
    >
      <span className="text-sm font-medium">{title}</span>
      <span className="text-xs text-muted-foreground">{body}</span>
    </button>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm">{label}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
    </div>
  );
}
