'use client';

import { Camera } from 'lucide-react';
import { Button, Card, CardContent, Skeleton } from '@foto/ui';
import { useEvents } from '@foto/api';
import { CreateEventDialog } from '@/components/host/create-event-dialog';
import { EventCard } from '@/components/host/event-card';

/**
 * The console's front page: every event this host has made.
 *
 * It is the only page in the console that is a list, and the only one where the
 * primary action is a creation rather than a decision — so the button is large, the
 * empty state says what an event *is* rather than apologising, and a host with one
 * wedding on the list gets straight to it.
 */
export default function HostPage() {
  const events = useEvents();

  return (
    <div className="flex flex-col gap-8 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl tracking-tight">Your events</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Each one has a code, an album, a wall, and however many guests you hand the card to.
          </p>
        </div>
        <CreateEventDialog />
      </div>

      {events.isLoading && (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      )}

      {events.data && events.data.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-12 text-center">
            <span className="grid size-12 place-items-center rounded-full bg-secondary/70">
              <Camera className="size-5" />
            </span>
            <h2 className="font-display text-2xl">No events yet</h2>
            <p className="max-w-sm text-sm text-muted-foreground">
              Make one for the wedding, the party, or the Tuesday nobody wants to forget. You can
              print a card with the code on it a minute later.
            </p>
            <div className="mt-2">
              <CreateEventDialog
                trigger={
                  <Button>
                    <Camera /> Make the first one
                  </Button>
                }
              />
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-3">
        {events.data?.map((event) => <EventCard key={event.eventId} event={event} />)}
      </div>
    </div>
  );
}
