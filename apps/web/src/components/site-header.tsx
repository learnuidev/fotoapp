'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { useHostSession } from '@foto/auth';
import { Button, Mark, cn } from '@foto/ui';

/**
 * The thin bar at the top of the marketing and console pages.
 *
 * It shows the one piece of session state that changes what the page is: whether
 * this browser is a host. The guest screens do not use it — a guest is looking at
 * their friend's wedding, not at this product's navigation.
 */
export function SiteHeader({ className }: { className?: string }) {
  const { user, ready, signOut } = useHostSession();
  const pathname = usePathname();

  return (
    <header
      className={cn(
        'sticky top-0 z-30 border-b border-border/50 bg-background/80 backdrop-blur-xl',
        className,
      )}
    >
      <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-5">
        <Link href="/" className="transition-opacity hover:opacity-80">
          <Mark />
        </Link>

        <nav className="flex items-center gap-1 text-sm">
          {ready && user ? (
            <>
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Link href="/host">Your events</Link>
              </Button>
              <span className="hidden px-2 text-xs text-muted-foreground sm:inline">
                {user.name}
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Sign out"
                onClick={() => {
                  void signOut();
                }}
              >
                <LogOut />
              </Button>
            </>
          ) : (
            ready && (
              <>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/sign-in">Sign in</Link>
                </Button>
                <Button asChild size="sm">
                  <Link href={pathname === '/sign-up' ? '/sign-in' : '/sign-up'}>
                    Host an event
                  </Link>
                </Button>
              </>
            )
          )}
        </nav>
      </div>
    </header>
  );
}
