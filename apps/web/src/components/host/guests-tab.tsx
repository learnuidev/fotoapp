'use client';

import { UserMinus } from 'lucide-react';
import type { Event } from '@foto/types';
import { Button, Card, CardContent, EmojiAvatar, Skeleton, plural } from '@foto/ui';
import { useGuestRoster, useRemoveGuest } from '@foto/api';
import { toast } from 'sonner';

/**
 * Who is in the room.
 *
 * A guest who shoots nothing is still a guest — the roster is about presence, not
 * contribution — but the contribution is what the host is usually looking at, so the
 * list is ordered by it and the count is on every row.
 */
export function GuestsTab({ event }: { event: Event }) {
  const roster = useGuestRoster(event.eventId);
  const removeGuest = useRemoveGuest(event.eventId);

  if (roster.isLoading) return <Skeleton className="h-56 w-full" />;

  const guests = roster.data ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {plural(guests.length, 'guest')} joined.
        </p>
      </div>

      {guests.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            No guests yet. Share the link or QR code from the Share tab.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="divide-y divide-border/60 p-0">
            {guests.map((guest) => (
              <div key={guest.guestId} className="flex items-center gap-3 px-5 py-3">
                <EmojiAvatar emoji={guest.emoji} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {guest.name}
                    {guest.role === 'host' && (
                      <span className="ml-1.5 text-xs text-muted-foreground">host</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    joined {new Date(guest.joinedAt).toLocaleTimeString()}
                  </p>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="tabular-nums">{guest.photoCount} 📸</span>
                  <span className="tabular-nums">{guest.reactionCount} ❤️</span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove ${guest.name}`}
                    onClick={() =>
                      removeGuest.mutate(guest.guestId, {
                        onSuccess: () => toast('Guest removed', { description: 'Their photos are kept.' }),
                      })
                    }
                  >
                    <UserMinus className="size-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
