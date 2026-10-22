'use client';

import { Heart, Images, Inbox, MessageCircle, Sparkles, Star } from 'lucide-react';
import type { Event, StatBar } from '@foto/types';
import { Card, CardContent, Skeleton, cn, formatBytes } from '@foto/ui';
import { useEventStats } from '@foto/api';

/**
 * What the evening looked like, as numbers.
 *
 * The chart is deliberately crude — a bar per hour, drawn with a div — because a
 * charting library would be 60 KB to draw twelve rectangles. Every number here is
 * computed by the API (see `services/api/src/lib/stats.ts`), so opening this tab
 * does not download the gallery to count it.
 */
export function StatsTab({ event }: { event: Event }) {
  const stats = useEventStats(event.eventId);

  if (stats.isLoading || !stats.data) return <Skeleton className="h-64 w-full" />;
  const data = stats.data;

  const peak = Math.max(1, ...data.uploadsByHour.map((bar) => bar.value));

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Figure icon={<Images className="size-4" />} label="Photos" value={String(data.photoCount)} />
        <Figure icon={<Inbox className="size-4" />} label="Waiting" value={String(data.pendingCount)} />
        <Figure icon={<Heart className="size-4" />} label="Reactions" value={String(data.reactionCount)} />
        <Figure icon={<MessageCircle className="size-4" />} label="Comments" value={String(data.commentCount)} />
        <Figure icon={<Star className="size-4" />} label="Starred" value={String(data.favoriteCount)} />
        <Figure icon={<Sparkles className="size-4" />} label="Guests" value={String(data.guestCount)} />
        <Figure label="From rolls" value={String(data.rollCount)} />
        <Figure label="On disk" value={formatBytes(data.totalBytes)} />
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 p-5">
          <h3 className="text-sm font-medium">When they arrived</h3>
          {data.uploadsByHour.length === 0 ? (
            <p className="text-xs text-muted-foreground">No photos yet.</p>
          ) : (
            <div className="flex h-32 items-end gap-1.5">
              {data.uploadsByHour.map((bar) => (
                <div key={bar.label} className="flex flex-1 flex-col items-center gap-1.5">
                  <div
                    className="w-full rounded-t-md bg-primary/70 transition-all"
                    style={{ height: `${Math.max(4, (bar.value / peak) * 100)}%` }}
                    title={`${bar.value} photos`}
                  />
                  <span className="text-[10px] tabular-nums text-muted-foreground">{bar.label}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Leaderboard title="Who shot the most" bars={data.topGuests} empty="Nobody has shot anything yet." />
        <Leaderboard
          title="Which prompts worked"
          bars={data.topChallenges}
          empty="No photo has been filed under a prompt."
        />
      </div>

      {data.reactionBreakdown.length > 0 && (
        <Card>
          <CardContent className="flex flex-col gap-3 p-5">
            <h3 className="text-sm font-medium">How the room reacted</h3>
            <div className="flex flex-wrap gap-3">
              {data.reactionBreakdown.map((bar) => (
                <span key={bar.label} className="flex items-center gap-1.5 rounded-full bg-secondary/60 px-3 py-1.5 text-sm">
                  <span className="text-base">{bar.label}</span>
                  <span className="tabular-nums text-muted-foreground">{bar.value}</span>
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {data.hiddenCount > 0 && (
        <p className="text-xs text-muted-foreground">
          {data.hiddenCount} photo{data.hiddenCount === 1 ? ' is' : 's are'} hidden from the gallery.
        </p>
      )}
    </div>
  );
}

function Figure({
  icon,
  label,
  value,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/50 p-4">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="mt-1.5 font-display text-2xl tabular-nums">{value}</p>
    </div>
  );
}

function Leaderboard({
  title,
  bars,
  empty,
}: {
  title: string;
  bars: StatBar[];
  empty: string;
}) {
  const peak = Math.max(1, ...bars.map((bar) => bar.value));

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-5">
        <h3 className="text-sm font-medium">{title}</h3>
        {bars.length === 0 ? (
          <p className="text-xs text-muted-foreground">{empty}</p>
        ) : (
          <div className="flex flex-col gap-2.5">
            {bars.map((bar) => (
              <div key={bar.label} className="flex items-center gap-2">
                {bar.emoji && <span className="text-sm">{bar.emoji}</span>}
                <span className="w-28 shrink-0 truncate text-xs">{bar.label}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary/70">
                  <div
                    className={cn('h-full rounded-full bg-primary/70')}
                    style={{ width: `${(bar.value / peak) * 100}%` }}
                  />
                </div>
                <span className="w-6 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                  {bar.value}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
