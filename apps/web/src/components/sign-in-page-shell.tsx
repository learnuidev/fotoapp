'use client';

import { useRouter } from 'next/navigation';
import { SignInScreen } from '@foto/auth';

/**
 * The sign-in page's frame: the shared screen, plus where to go once it works.
 *
 * It is a client component only because the destination is a router call. The
 * screen itself is the same component the console's gate uses, so a host never
 * sees two different sign-in forms.
 */
export function SignInPageShell({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const router = useRouter();

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-16">
      <SignInScreen defaultMode={mode} onSignedIn={() => router.replace('/host')} />
    </div>
  );
}
