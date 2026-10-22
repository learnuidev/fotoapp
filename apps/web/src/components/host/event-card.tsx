'use client';

import Link from 'next/link';
import { ArrowRight, CalendarDays, Film, Images, MapPin, Users } from 'lucide-react';
import type { Event } from '@foto/types';
import { Badge, Card, CardContent, cn, formatMoment, plural } from '@foto/ui';

/**
 * One event, in the console's list.
 *
 * The card is a status line more than a link: a host opening this screen during a
 * party wants to know, in one look, how many photos have arrived, how many guests
 * are in, and whether anything is waiting for them.
 */
export function EventCard({ event }: { event: Event }) {
  const live = event.closedAt === null;

  return (
    <Card className="overflow-hidden transition-colors hover:border-primary/40">
      <CardContent className="flex flex-col gap-4 p-0 sm:flex-row">
        <Link
          href={`/host/e/${event.eventId}`}
          className="relative block h-40 w-full shrink-0 overflow-hidden bg-muted/40 sm:h-auto sm:w-44"
        >
          {event.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={event.coverUrl}
              alt=""
              className={cn('size-full object-cover', event.settings.filmLook && 'film')}
            />
          ) : (
            <div className="grid size-full place-items-center text-3xl">
              {event.kind === 'wedding' ? '💍' : event.kind === 'party' ? '🎉' : '📸'}
            </div>
          )}
        </Link>

        <div className="flex flex-1 flex-col justify-between gap-4 p-5 pt-0 sm:py-5 sm:pl-0">
          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/host/e/${event.eventId}`}
                className="font-display text-xl tracking-tight hover:underline"
              >
                {event.name}
              </Link>
              {live ? (
                <Badge variant="live">live</Badge>
              ) : (
                <Badge variant="outline">closed</Badge>
              )}
              {event.settings.cameraMode === 'roll' && (
                <Badge variant="film">
                  <Film className="size-3" /> film
                </Badge>
              )}
              {event.counts.pending > 0 && (
                <Badge variant="waiting">{event.counts.pending} waiting</Badge>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="font-mono tracking-[0.25em] text-foreground">{event.code}</span>
              {event.date && (
                <span className="flex items-center gap-1">
                  <CalendarDays className="size-3" /> {formatMoment(event.date)}
                </span>
              )}
              {event.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="size-3" /> {event.location}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1 text-sm">
              <span className="flex items-center gap-1.5">
                <Images className="size-3.5 text-primary" /> {plural(event.counts.photos, 'photo')}
              </span>
              <span className="flex items-center gap-1.5">
                <Users className="size-3.5 text-primary" /> {event.counts.guests}
              </span>
              <span className="flex items-center gap-1.5">
                <span aria-hidden>❤️</span> {event.counts.reactions}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Link
              href={`/host/e/${event.eventId}`}
              className="inline-flex items-center gap-1 rounded-full bg-primary px-3.5 py-1.5 text-xs font-medium text-primary-foreground"
            >
              Open console <ArrowRight className="size-3" />
            </Link>
            <Link
              href={`/e/${event.code}/wall`}
              target="_blank"
              className="rounded-full border border-border/70 px-3.5 py-1.5 text-xs text-muted-foreground hover:bg-accent"
            >
              Wall
            </Link>
            <Link
              href={`/j/${event.code}`}
              target="_blank"
              className="rounded-full border border-border/70 px-3.5 py-1.5 text-xs text-muted-foreground hover:bg-accent"
            >
              Guest view
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
