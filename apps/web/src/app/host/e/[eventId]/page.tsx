'use client';

import Link from 'next/link';
import {
  Film,
  Images,
  LayoutDashboard,
  MonitorPlay,
  Settings,
  Share2,
  Sparkles,
  Users,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  formatMoment,
} from '@foto/ui';
import { useEvent } from '@foto/api';
import { GalleryTab } from '@/components/host/gallery-tab';
import { GuestsTab } from '@/components/host/guests-tab';
import { PromptsTab } from '@/components/host/prompts-tab';
import { RollsTab } from '@/components/host/rolls-tab';
import { SettingsTab } from '@/components/host/settings-tab';
import { ShareTab } from '@/components/host/share-tab';
import { StatsTab } from '@/components/host/stats-tab';

/**
 * One event, everything about it.
 *
 * This is the page a host leaves open on a laptop during the party, so it is tabs
 * rather than routes: switching from the gallery to the rolls to the wall should not
 * be a navigation, and it should not lose the scroll position of a gallery somebody
 * was reading.
 */
export default function ConsolePage({ params }: { params: { eventId: string } }) {
  const event = useEvent(params.eventId);

  if (event.isLoading) {
    return (
      <div className="flex flex-col gap-4 py-10">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  if (event.error || !event.data) {
    return (
      <div className="py-20">
        <Card>
          <CardContent className="flex flex-col gap-3 p-8 text-center">
            <h1 className="font-display text-2xl">That event is not here</h1>
            <p className="text-sm text-muted-foreground">
              Either it was deleted, or it belongs to somebody else.
            </p>
            <Button asChild variant="outline" className="mx-auto w-fit">
              <Link href="/host">Back to your events</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const data = event.data;

  return (
    <div className="flex flex-col gap-6 py-8">
      {/* --- the header ----------------------------------------------------- */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/host" className="text-xs text-muted-foreground hover:underline">
              Your events
            </Link>
            <span className="text-xs text-muted-foreground">/</span>
            <span className="font-mono text-xs tracking-[0.25em] text-muted-foreground">
              {data.code}
            </span>
          </div>
          <h1 className="mt-1 font-display text-4xl tracking-tight">{data.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {data.date && <span>{formatMoment(data.date)}</span>}
            {data.location && <span>· {data.location}</span>}
            {data.closedAt ? (
              <Badge variant="outline">closed</Badge>
            ) : (
              <Badge variant="live">live</Badge>
            )}
            {data.settings.cameraMode === 'roll' ? (
              <Badge variant="film">
                <Film className="size-3" /> film · {data.settings.shotsPerRoll}
              </Badge>
            ) : (
              <Badge variant="secondary">
                <Images className="size-3" /> open camera
              </Badge>
            )}
            {data.counts.pending > 0 && (
              <Badge variant="waiting">{data.counts.pending} waiting</Badge>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/e/${data.code}/wall`} target="_blank">
              <MonitorPlay /> Open the wall
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/j/${data.code}`} target="_blank">
              <Users /> Guest view
            </Link>
          </Button>
        </div>
      </header>

      {/* --- the tabs ------------------------------------------------------- */}
      <Tabs defaultValue="gallery">
        <TabsList>
          <TabsTrigger value="gallery">
            <LayoutDashboard className="size-4" /> Gallery
          </TabsTrigger>
          <TabsTrigger value="rolls">
            <Film className="size-4" /> Rolls
          </TabsTrigger>
          <TabsTrigger value="guests">
            <Users className="size-4" /> Guests
          </TabsTrigger>
          <TabsTrigger value="prompts">
            <Sparkles className="size-4" /> Prompts
          </TabsTrigger>
          <TabsTrigger value="stats">
            <Images className="size-4" /> Numbers
          </TabsTrigger>
          <TabsTrigger value="share">
            <Share2 className="size-4" /> Share
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Settings className="size-4" /> Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="gallery">
          <GalleryTab event={data} />
        </TabsContent>
        <TabsContent value="rolls">
          <RollsTab event={data} />
        </TabsContent>
        <TabsContent value="guests">
          <GuestsTab event={data} />
        </TabsContent>
        <TabsContent value="prompts">
          <PromptsTab event={data} />
        </TabsContent>
        <TabsContent value="stats">
          <StatsTab event={data} />
        </TabsContent>
        <TabsContent value="share">
          <ShareTab event={data} />
        </TabsContent>
        <TabsContent value="settings">
          <SettingsTab event={data} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
