"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink, Printer, RefreshCw } from "lucide-react";
import type { Event } from "@foto/types";
import {
  Button,
  Card,
  CardContent,
  Label,
  Mark,
  Separator,
  cn,
} from "@foto/ui";
import { useRotateCode } from "@foto/api";
import { toast } from "sonner";
import { QrCode } from "@/components/qr-code";

/**
 * The table card.
 *
 * This tab exists because the QR code is the product's entire onboarding, and a
 * host standing in a venue needs three things from it: something to show (the card,
 * printed), something to send (the link, in a group chat that already exists), and a
 * way to undo a leak (a new code).
 */
export function ShareTab({ event }: { event: Event }) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3100";
  const joinUrl = `${appUrl}/j/${event.code}`;
  const wallUrl = `${appUrl}/e/${event.code}/wall`;
  const rotate = useRotateCode(event.eventId);
  const [copied, setCopied] = useState<string | null>(null);

  async function copy(value: string, key: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      toast.error("Could not copy — the code is on the card below");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        {/* --- the printable card ------------------------------------------ */}
        <Card className="table-card overflow-hidden">
          <CardContent className="flex flex-col items-center gap-4 p-6 text-center">
            <Mark />
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                {event.name}
              </p>
              {event.date && (
                <p className="text-xs text-muted-foreground">
                  {new Date(event.date).toLocaleDateString(undefined, {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              )}
            </div>

            <QrCode value={joinUrl} size={168} />

            <div className="flex flex-col gap-1">
              <p className="font-mono text-2xl tracking-[0.35em]">
                {event.code}
              </p>
              <p className="text-xs text-muted-foreground">
                Scan, or enter the code.
              </p>
            </div>

            <p className="text-[11px] leading-relaxed text-muted-foreground">
              {event.settings.cameraMode === "roll"
                ? `${event.settings.shotsPerRoll} shots per roll. Photos stay hidden until the roll is developed.`
                : "Photos join the album with your name on them."}
            </p>

            <Button
              variant="outline"
              size="sm"
              className="no-print"
              onClick={() => window.print()}
            >
              <Printer /> Print this card
            </Button>
          </CardContent>
        </Card>

        {/* --- the links ---------------------------------------------------- */}
        <div className="flex flex-col gap-3">
          <Card>
            <CardContent className="flex flex-col gap-3 p-5">
              <Label>Guest link</Label>
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-xl bg-secondary/60 px-3 py-2 text-xs">
                  {joinUrl}
                </code>
                <Button
                  size="icon-sm"
                  variant="outline"
                  aria-label="Copy guest link"
                  onClick={() => void copy(joinUrl, "join")}
                >
                  {copied === "join" ? <Check /> : <Copy />}
                </Button>
                <Button
                  size="icon-sm"
                  variant="outline"
                  aria-label="Open guest view"
                  asChild
                >
                  <a href={joinUrl} target="_blank" rel="noreferrer">
                    <ExternalLink />
                  </a>
                </Button>
              </div>

              <Separator />

              <Label>Wall link</Label>
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-xl bg-secondary/60 px-3 py-2 text-xs">
                  {wallUrl}
                </code>
                <Button
                  size="icon-sm"
                  variant="outline"
                  aria-label="Copy wall link"
                  onClick={() => void copy(wallUrl, "wall")}
                >
                  {copied === "wall" ? <Check /> : <Copy />}
                </Button>
                <Button
                  size="icon-sm"
                  variant="outline"
                  aria-label="Open the wall"
                  asChild
                >
                  <a href={wallUrl} target="_blank" rel="noreferrer">
                    <ExternalLink />
                  </a>
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Open on any screen. No sign-in required; it updates
                automatically.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex flex-col gap-3 p-5">
              <Label>The join code</Label>
              <div className="flex items-center justify-between gap-3">
                <span className="font-mono text-3xl tracking-[0.35em]">
                  {event.code}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void copy(event.code, "code")}
                >
                  {copied === "code" ? <Check /> : <Copy />} Copy
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Six characters, no vowels, and no characters that are easy to
                confuse.
              </p>
              <Button
                variant="ghost"
                size="sm"
                className={cn("w-fit text-muted-foreground")}
                disabled={rotate.isPending}
                onClick={() =>
                  rotate.mutate(undefined, {
                    onSuccess: (result) =>
                      toast.success("New code", {
                        description: `The previous code no longer works. New code: ${result.event.code}.`,
                      }),
                  })
                }
              >
                <RefreshCw className={cn(rotate.isPending && "animate-spin")} />{" "}
                Generate new code
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
