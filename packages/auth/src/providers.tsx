'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { configureApi, ApiError } from '@foto/api';
import { TooltipProvider, Toaster } from '@foto/ui';
import { hostIdToken, isAuthConfigured } from './lib/cognito';
import { guestToken } from './lib/session';

/**
 * Everything a page needs to exist, without deciding who may see it.
 *
 * The one thing here that is not a provider: it points the API client at the deployed
 * API and hands it the two token sources. That happens here rather than inside
 * `@foto/api` because the client package has to stay usable with no browser storage
 * and no Cognito, and because it is the app — not the package — that decides which API
 * this build talks to.
 */
export function AppProviders({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 15_000,
            refetchOnWindowFocus: true,
            retry: (failureCount, error) => {
              // A 401 or a 404 is the server's answer, not a flake: retrying it three
              // times only delays the screen that explains it.
              if (error instanceof ApiError && error.status < 500) return false;
              return failureCount < 2;
            },
          },
        },
      }),
  );

  configureApi({
    baseUrl: process.env.NEXT_PUBLIC_API_URL,
    getToken: (scope) => (scope === 'host' ? hostIdToken() : guestToken()),
  });

  if (!isAuthConfigured) return <ConfigurationRequired />;

  return (
    <QueryClientProvider client={client}>
      <TooltipProvider delayDuration={200}>
        {children}
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

/**
 * What this app shows when it has not been pointed at a deployment.
 *
 * A build with no API URL and no user pool is not "signed out" — it is a build that
 * cannot work, and saying so is far more useful than a sign-in form that would fail
 * in a way nobody can debug.
 */
function ConfigurationRequired() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-3 px-6">
      <h1 className="font-display text-3xl">This build is not pointed at a deployment</h1>
      <p className="text-sm text-muted-foreground">
        Set these in <code className="rounded bg-secondary px-1">apps/web/.env.local</code> and
        restart:
      </p>
      <ul className="flex flex-col gap-1 font-mono text-xs text-muted-foreground">
        <li>NEXT_PUBLIC_API_URL</li>
        <li>NEXT_PUBLIC_COGNITO_USER_POOL_ID</li>
        <li>NEXT_PUBLIC_COGNITO_CLIENT_ID</li>
      </ul>
      <p className="text-sm text-muted-foreground">
        `npm run deploy` prints every one of them for the stage it deployed.
      </p>
    </div>
  );
}
