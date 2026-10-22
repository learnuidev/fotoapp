'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useJoinEvent } from '@foto/api';
import { useGuestSession } from '@foto/auth';
import { Button, Card, CardContent, Skeleton } from '@foto/ui';
import { JoinForm } from '@/components/join-form';

/**
 * What a scanned card opens.
 *
 * Three states, and the order matters: if this browser has already joined, the
 * screen is a doorway and gets out of the way; if it has not, it is the two-tap
 * form; and if the code is wrong, it says so without pretending the guest did
 * something wrong.
 */
export default function JoinPage({ params }: { params: { code: string } }) {
  const code = params.code.toUpperCase();
  const router = useRouter();
  const join = useJoinEvent(code);
  const { session, ready } = useGuestSession(code);

  useEffect(() => {
    if (ready && session) router.replace(`/e/${code}`);
  }, [ready, session, router, code]);

  if (join.isLoading || !ready) {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-4 px-5">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (join.error || !join.data) {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5">
        <Card>
          <CardContent className="flex flex-col gap-4 p-6">
            <h1 className="font-display text-2xl">No album with that code</h1>
            <p className="text-sm text-muted-foreground">
              Codes are six characters and do not contain O, 0, I or 1. Check the card, or ask
              whoever is hosting for the link.
            </p>
            <Button variant="outline" onClick={() => router.push('/')}>
              Back to the front page
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-12">
      <JoinForm event={join.data.event} onJoined={() => router.replace(`/e/${code}`)} />
    </div>
  );
}
