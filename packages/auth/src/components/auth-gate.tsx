'use client';

import Link from 'next/link';
import { Button, Card, CardContent, Skeleton } from '@foto/ui';
import { useHostSession } from '../hooks/use-session';

/**
 * The console's door.
 *
 * A layout that renders a section decides who may see it, so every console route
 * is wrapped in this once, at the console's shell, rather than each page asking.
 *
 * The not-signed-in state is a card rather than a redirect: somebody who opens a
 * console link on a phone that is signed out on a laptop should be told why they
 * are looking at nothing, and be able to sign in without losing the URL.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, ready } = useHostSession();

  if (!ready) {
    return (
      <div className="mx-auto w-full max-w-4xl px-5 py-16">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="mt-4 h-40 w-full" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col px-5 py-20">
        <Card>
          <CardContent className="flex flex-col gap-4 p-6">
            <h1 className="font-display text-2xl">Sign in to see your events</h1>
            <p className="text-sm text-muted-foreground">
              The console is where an event is made, watched and moderated. The photos themselves
              live behind the join code, and nobody needs an account to shoot them.
            </p>
            <Button asChild size="lg">
              <Link href="/sign-in">Sign in</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href="/sign-up">Make a host account</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
