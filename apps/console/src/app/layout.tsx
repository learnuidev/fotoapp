import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'foto console',
  description: 'Deploy the API to an environment, and run the app against it',
};

/**
 * The console's frame: a header that says what it is and which AWS account it is
 * acting as, and a nav with three pages.
 *
 * The identity is read by a client component so a signed-out shell still renders the
 * pages that explain what to do about it — see `components/identity.tsx`.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh">
        <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur-xl">
          <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-6 px-5">
            <div className="flex items-center gap-6">
              <Link href="/backends" className="flex items-center gap-2">
                <span className="relative grid size-7 place-items-center rounded-full bg-gradient-to-br from-amber-300 via-rose-400 to-violet-500">
                  <span className="size-2.5 rounded-full bg-background/90" />
                </span>
                <span className="font-mono text-sm tracking-tight">foto console</span>
              </Link>
              <nav className="flex items-center gap-1 text-sm">
                <NavLink href="/backends">Backends</NavLink>
                <NavLink href="/frontend">Frontend</NavLink>
                <NavLink href="/aws">AWS</NavLink>
              </nav>
            </div>
            <IdentityBadge />
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl px-5 pb-24 pt-8">{children}</main>
      </body>
    </html>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-full px-3 py-1.5 text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
    >
      {children}
    </Link>
  );
}

import { IdentityBadge } from '@/components/identity';
