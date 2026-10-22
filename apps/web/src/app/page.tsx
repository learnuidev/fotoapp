import Link from 'next/link';
import { ArrowRight, Camera, Download, Film, MonitorPlay, ShieldCheck } from 'lucide-react';
import { Button } from '@foto/ui';
import { SiteHeader } from '@/components/site-header';
import { QrCode } from '@/components/qr-code';

/**
 * A real event on the deployed stage, if this build has one.
 *
 * The front page is where somebody decides whether this is worth five minutes, and the
 * fastest way to answer that is a wedding they can walk into. A stage sets
 * `NEXT_PUBLIC_DEMO_CODE` to the code of an event it keeps for exactly that; with none
 * set, the page simply does not offer one.
 */
const DEMO_CODE = process.env.NEXT_PUBLIC_DEMO_CODE;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3100';

/**
 * The front page, which is a poster.
 *
 * Every version before this one explained the product: three paragraphs of how it
 * works, six cards of what it does, and a paragraph on where the ideas came from. A
 * guest lands here once, from a QR code, and a host lands here to make an account —
 * neither of them is reading. So: a headline, one sentence, two buttons, the card, and
 * three things it does, each in a line.
 */
export default function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />

      <main className="mx-auto w-full max-w-5xl flex-1 px-5 pb-20">
        <section className="grid items-center gap-12 py-16 sm:py-24 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="flex flex-col gap-6">
            <h1 className="max-w-xl font-display text-5xl leading-[1.03] tracking-tight text-balance sm:text-6xl">
              Every photo from the event, in one album.
            </h1>
            <p className="max-w-lg text-lg text-muted-foreground">
              Guests scan a code and upload to a shared album. Photos appear on the live
              wall, or stay on film rolls until they are developed.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Button asChild size="lg">
                <Link href="/sign-up">
                  Host an event <ArrowRight />
                </Link>
              </Button>
              {DEMO_CODE && (
                <Button asChild size="lg" variant="outline">
                  <Link href={`/j/${DEMO_CODE}`}>See one as a guest</Link>
                </Button>
              )}
            </div>
          </div>

          <div className="mx-auto w-full max-w-xs rotate-1 rounded-[2rem] bg-gradient-to-br from-[#fdf3e3] via-[#fbe9dc] to-[#f6e2ef] p-6 shadow-[0_28px_60px_-28px_rgba(90,45,10,0.55)] ring-1 ring-black/5">
            <div className="flex flex-col items-center gap-4 text-center">
              <p className="text-[11px] uppercase tracking-[0.28em] text-[#8a6a4d]">
                The table card
              </p>
              <QrCode value={`${APP_URL}/j/${DEMO_CODE ?? 'TABLE'}`} size={168} />
              <p className="font-mono text-2xl tracking-[0.35em] text-[#2a1f16]">
                {DEMO_CODE ?? 'K7M2QX'}
              </p>
              <p className="text-xs text-[#8a6a4d]">Scan, or type the code.</p>
            </div>
          </div>
        </section>

        {/* Three things it does, one line each. */}
        <section className="grid gap-3 sm:grid-cols-3">
          {[
            {
              icon: Camera,
              title: 'Upload',
              body: 'No app and no account. Guests enter a name and use their own camera.',
            },
            {
              icon: Film,
              title: 'Or use film rolls',
              body: 'A fixed number of shots per roll. Photos stay hidden until the roll develops.',
            },
            {
              icon: MonitorPlay,
              title: 'Show the wall',
              body: 'One photo at a time on any screen, with the guest name and reactions.',
            },
          ].map((item) => (
            <div
              key={item.title}
              className="flex flex-col gap-2 rounded-3xl border border-border/60 bg-card/60 p-6"
            >
              <item.icon className="size-5 text-primary" />
              <h2 className="font-display text-xl">{item.title}</h2>
              <p className="text-sm text-muted-foreground">{item.body}</p>
            </div>
          ))}
        </section>

        <section className="mt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 rounded-3xl border border-border/60 bg-card/40 px-6 py-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-primary" /> Host approval and moderation
          </span>
          <span className="flex items-center gap-2">
            <Download className="size-4 text-primary" /> Download the album as a zip
          </span>
        </section>
      </main>

      <footer className="border-t border-border/50 py-6">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-2 px-5 text-xs text-muted-foreground">
          <p>foto — a shared photo album for events.</p>
          {DEMO_CODE && (
            <p>
              Demo code{' '}
              <span className="font-mono tracking-widest text-foreground">{DEMO_CODE}</span>
            </p>
          )}
        </div>
      </footer>
    </div>
  );
}
