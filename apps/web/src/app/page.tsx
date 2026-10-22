import Link from 'next/link';
import {
  ArrowRight,
  Camera,
  Download,
  Film,
  Heart,
  MonitorPlay,
  QrCode as QrCodeIcon,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { Button } from '@foto/ui';
import { SiteHeader } from '@/components/site-header';
import { QrCode } from '@/components/qr-code';

/**
 * A real event on the deployed stage, if this build has one.
 *
 * The front page is where somebody decides whether this is worth five minutes, and
 * the fastest way to answer that is a wedding they can walk into rather than a video.
 * A stage sets `NEXT_PUBLIC_DEMO_CODE` to the code of an event it keeps for exactly
 * that; with none set, the page simply does not offer one.
 */
const DEMO_CODE = process.env.NEXT_PUBLIC_DEMO_CODE;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3100';

const ACTS = [
  {
    icon: QrCodeIcon,
    title: 'They scan the card',
    body: 'A six-character code and a QR on the table. No app to install, no account, no group chat to join — a name and an emoji and they are in.',
    source: 'Fotify · GuestPix',
  },
  {
    icon: MonitorPlay,
    title: 'It lands on the wall',
    body: 'A projector screen that fills up while the party happens. Every photo arrives with the guest’s name on it, and the reaction counts climb in real time.',
    source: 'Kululu',
  },
  {
    icon: Film,
    title: 'Or comes back at midnight',
    body: 'Hand the room a disposable camera instead: twelve shots, no previews, and nothing — not even your own frames — until the roll is developed.',
    source: 'GuestCam',
  },
];

const FEATURES = [
  {
    icon: Sparkles,
    title: 'Prompts, not instructions',
    body: '“The shoes.” “Your table, mid-laugh.” A room given something to shoot takes better photos, and the console says which prompt produced them.',
  },
  {
    icon: Heart,
    title: 'Reactions and comments',
    body: 'Six emoji, one tap, and the count is on the tile before the request finishes. Comments stay next to the photo they are about.',
  },
  {
    icon: ShieldCheck,
    title: 'A host in the room',
    body: 'Approve before it is public, hide what should not be there, star the ones worth printing, and keep the album closed to outsiders.',
  },
  {
    icon: Download,
    title: 'The whole album, as a zip',
    body: 'One button builds the archive in the browser — originals, no watermark, with the captions in the filenames.',
  },
  {
    icon: Camera,
    title: 'Guests need nothing',
    body: 'The camera is the browser’s. It works on the phone they already have unlocked, in the hand they already have a drink in.',
  },
  {
    icon: MonitorPlay,
    title: 'A wall, not a slideshow',
    body: 'The projector screen polls every few seconds and never signs in, so the laptop under the TV needs one URL and nothing else.',
  },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />

      <main className="mx-auto w-full max-w-5xl flex-1 px-5 pb-24">
        {/* --- the hero: one evening, told in one screen ---------------------- */}
        <section className="grid items-center gap-10 py-16 sm:py-24 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="flex flex-col gap-6">
            <span className="w-fit rounded-full border border-border/70 px-3 py-1 text-xs text-muted-foreground">
              The camera roll of the evening
            </span>
            <h1 className="font-display text-5xl leading-[1.02] tracking-tight sm:text-6xl">
              Every photo of the night,
              <br />
              from every phone in the room.
            </h1>
            <p className="max-w-xl text-lg text-muted-foreground">
              Guests scan a code and start shooting. Their photos land in one album — live on the
              wall as they happen, or held on a film roll that develops when the party is over.
              No app, no accounts for guests, and no group chat to scroll back through.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Button asChild size="lg">
                <Link href="/sign-up">
                  Host an event <ArrowRight />
                </Link>
              </Button>
              {DEMO_CODE && (
                <Button asChild size="lg" variant="outline">
                  <Link href={`/j/${DEMO_CODE}`}>Walk into a wedding we seeded</Link>
                </Button>
              )}
            </div>
            {DEMO_CODE ? (
              <p className="text-xs text-muted-foreground">
                The demo is an event shot on film, code{' '}
                <span className="font-mono tracking-widest text-foreground">{DEMO_CODE}</span>.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Guests need nothing but the code. You need one account.
              </p>
            )}
          </div>

          {/* --- the table card, which is the whole onboarding ---------------- */}
          <div className="table-card relative mx-auto w-full max-w-xs rotate-1 rounded-3xl border border-border/70 p-6 shadow-2xl">
            <div className="flex flex-col items-center gap-4 text-center">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Nadia &amp; Tom
              </p>
              <QrCode
                value={`${APP_URL}/j/${DEMO_CODE ?? 'TABLE'}`}
                size={168}
              />
              <p className="font-mono text-2xl tracking-[0.35em] text-foreground">
                {DEMO_CODE ?? 'K7M2QX'}
              </p>
              <p className="text-xs text-muted-foreground">
                Scan, or type the code at foto.app — then take the photos we will be looking at in
                twenty years.
              </p>
            </div>
          </div>
        </section>

        {/* --- the three acts ----------------------------------------------- */}
        <section className="grid gap-4 sm:grid-cols-3">
          {ACTS.map((act, index) => (
            <div
              key={act.title}
              className="flex flex-col gap-3 rounded-3xl border border-border/60 bg-card/60 p-6"
            >
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="grid size-6 place-items-center rounded-full bg-primary/15 text-[11px] text-primary">
                  {index + 1}
                </span>
                {act.source}
              </div>
              <act.icon className="size-6 text-primary" />
              <h2 className="font-display text-xl">{act.title}</h2>
              <p className="text-sm text-muted-foreground">{act.body}</p>
            </div>
          ))}
        </section>

        {/* --- the register of features ------------------------------------- */}
        <section className="mt-20">
          <h2 className="font-display text-3xl tracking-tight">Everything the four apps do well</h2>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            This is a combination rather than a clone: the QR-code guest camera of Fotify and
            GuestPix, the live wall of Kululu, and the disposable roll of GuestCam, with the
            moderation, prompts and downloads an event with three hundred guests actually needs.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="rounded-2xl border border-border/50 bg-card/40 p-5"
              >
                <feature.icon className="size-5 text-primary" />
                <h3 className="mt-3 font-medium">{feature.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{feature.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* --- how the two audiences split ---------------------------------- */}
        <section className="mt-20 grid gap-4 lg:grid-cols-2">
          <div className="rounded-3xl border border-border/60 bg-card/60 p-7">
            <h2 className="font-display text-2xl">If you are hosting</h2>
            <ul className="mt-4 flex flex-col gap-2.5 text-sm text-muted-foreground">
              <li>· Make the event, and pick open camera or film rolls.</li>
              <li>· Print the card from the share tab; it has the QR on it.</li>
              <li>· Watch photos arrive, approve or hide them, star the good ones.</li>
              <li>· Open the wall on whatever screen the room has.</li>
              <li>· Download the lot the next morning, as a zip.</li>
            </ul>
            <Button asChild className="mt-6">
              <Link href="/sign-up">
                Start an event <ArrowRight />
              </Link>
            </Button>
          </div>

          <div className="rounded-3xl border border-border/60 bg-card/60 p-7">
            <h2 className="font-display text-2xl">If you are a guest</h2>
            <ul className="mt-4 flex flex-col gap-2.5 text-sm text-muted-foreground">
              <li>· Scan the code on the table. Nothing to install.</li>
              <li>· Type a name, pick an emoji, and you are in the album.</li>
              <li>· Shoot against the prompts, or ignore them entirely.</li>
              <li>· On a film event: twelve shots, no previews, develop when you are done.</li>
              <li>· React to everybody else’s, and watch the wall fill up.</li>
            </ul>
            {DEMO_CODE && (
              <Button asChild variant="outline" className="mt-6">
                <Link href={`/j/${DEMO_CODE}`}>
                  Try it as a guest <ArrowRight />
                </Link>
              </Button>
            )}
          </div>
        </section>
      </main>

      <footer className="border-t border-border/50 py-8">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-2 px-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>foto — an album for one evening, assembled by the people in the room.</p>
          <p>
            An idea from{' '}
            <a className="underline-offset-4 hover:underline" href="https://fotify.app/" target="_blank" rel="noreferrer">
              Fotify
            </a>
            {', '}
            <a className="underline-offset-4 hover:underline" href="https://www.kululu.com/" target="_blank" rel="noreferrer">
              Kululu
            </a>
            {', '}
            <a className="underline-offset-4 hover:underline" href="https://guestpix.com/" target="_blank" rel="noreferrer">
              GuestPix
            </a>{' '}
            and{' '}
            <a className="underline-offset-4 hover:underline" href="https://guestcam.co/" target="_blank" rel="noreferrer">
              GuestCam
            </a>
            .
          </p>
        </div>
      </footer>
    </div>
  );
}
