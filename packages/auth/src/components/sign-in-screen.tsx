'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { ApiError } from '@foto/api';
import { Button, Input, Label, Mark, cn } from '@foto/ui';
import { useHostSession } from '../hooks/use-session';

type Mode = 'sign-in' | 'sign-up';

/**
 * The screen a host meets once.
 *
 * Two fields and a button in the default mode, one more field to make an account,
 * and no social buttons: this product is one host making one album for one
 * evening, and the fastest way through this screen is a password manager. Google
 * sign-in is a Cognito deployment setting, and when it is on it is one button
 * added here rather than a different screen.
 */
export function SignInScreen({
  defaultMode = 'sign-in',
  onSignedIn,
  footer,
}: {
  defaultMode?: Mode;
  onSignedIn?: () => void;
  footer?: React.ReactNode;
}) {
  const { signIn, signUp } = useHostSession();
  const [mode, setMode] = useState<Mode>(defaultMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === 'sign-up') await signUp({ email, password, name });
      else await signIn({ email, password });
      onSignedIn?.();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'That did not work — try again',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-6">
      <div className="flex flex-col items-start gap-2">
        <Mark />
        <h1 className="font-display text-3xl tracking-tight">
          {mode === 'sign-in' ? 'Sign in to run an event' : 'Make a host account'}
        </h1>
        <p className="text-sm text-muted-foreground">
          {mode === 'sign-in'
            ? 'Your events, their photos, and the wall on the projector.'
            : 'One account, however many evenings you photograph.'}
        </p>
      </div>

      <form onSubmit={submit} className="flex flex-col gap-4">
        {mode === 'sign-up' && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Your name</Label>
            <Input
              id="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Nadia"
              autoComplete="name"
              required
            />
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={mode === 'sign-up' ? 'At least 8 characters' : '••••••••'}
            autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'}
            required
          />
        </div>

        {error && (
          <p className="rounded-2xl bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
            {error}
          </p>
        )}

        <Button type="submit" size="lg" disabled={busy} className="mt-1">
          {busy && <Loader2 className="animate-spin" />}
          {mode === 'sign-in' ? 'Sign in' : 'Make the account'}
        </Button>
      </form>

      <div className={cn('flex flex-col gap-2 text-sm text-muted-foreground')}>
        <button
          type="button"
          className="text-left underline-offset-4 hover:text-foreground hover:underline"
          onClick={() => {
            setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in');
            setError(null);
          }}
        >
          {mode === 'sign-in' ? 'No account yet? Make one.' : 'Already host of something? Sign in.'}
        </button>
        <Link href="/" className="underline-offset-4 hover:text-foreground hover:underline">
          Back to the front page
        </Link>
        {footer}
      </div>
    </div>
  );
}
