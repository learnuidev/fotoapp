/**
 * The hooks the app draws a signed-in or joined state from.
 *
 * The host hook talks to Cognito through `lib/cognito`, and the guest hook to this
 * service through `@foto/api`. Both are written so the first render on the server and
 * the first render on the client agree: nothing is read from storage or from Amplify
 * until an effect has run, and until then a caller is "not yet known" rather than
 * "signed out". A console that flashed its sign-in wall at somebody who was signed in
 * would be a worse bug than a blank frame.
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { guestApi, ApiError } from '@foto/api';
import type { HostUser } from '@foto/types';
import {
  clearTokenCache,
  currentHost,
  signInWithPassword,
  signOutHost,
  signUpWithPassword,
} from '../lib/cognito';
import {
  clearGuestSession,
  getDeviceId,
  getGuestSession,
  setGuestSession,
  subscribeToGuestSession,
  type GuestSession,
} from '../lib/session';

/** Who is signed in to the console, and how to change that. */
export function useHostSession() {
  const [user, setUser] = useState<HostUser | null>(null);
  const [ready, setReady] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    let live = true;
    void currentHost().then((host) => {
      if (!live) return;
      setUser(host);
      setReady(true);
    });
    return () => {
      live = false;
    };
  }, []);

  const signIn = useCallback(async (payload: { email: string; password: string }) => {
    const host = await signInWithPassword(payload.email, payload.password);
    setUser(host);
    return host;
  }, []);

  const signUp = useCallback(
    async (payload: { email: string; password: string; name: string }) => {
      const host = await signUpWithPassword(payload.email, payload.password, payload.name);
      setUser(host);
      return host;
    },
    [],
  );

  const signOut = useCallback(async () => {
    await signOutHost().catch(() => undefined);
    clearTokenCache();
    setUser(null);
    // Everything cached was read as this account; none of it survives the change.
    queryClient.clear();
  }, [queryClient]);

  return { user, ready, signIn, signUp, signOut };
}

/**
 * The guest session for one event.
 *
 * `join` is the whole custom of joining: a name, an avatar, and the device id that
 * makes rejoining free. The API answers with a token scoped to that event, and it is
 * kept here so every guest screen can find it.
 */
export function useGuestSession(code: string | undefined) {
  const [session, setSession] = useState<GuestSession | null>(null);
  const [ready, setReady] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    const stored = getGuestSession();
    setSession(stored && stored.code === code ? stored : null);
    setReady(true);
    return subscribeToGuestSession(() => {
      const next = getGuestSession();
      setSession(next && next.code === code ? next : null);
    });
  }, [code]);

  const join = useCallback(
    async (name: string, emoji: string) => {
      if (!code) throw new Error('No join code');
      setJoining(true);
      setError(null);
      try {
        const result = await guestApi.join(code, {
          name,
          emoji,
          deviceId: getDeviceId(),
        });
        const next: GuestSession = {
          token: result.token,
          code,
          eventId: result.event.eventId,
          guest: {
            guestId: result.guest.guestId,
            name: result.guest.name,
            emoji: result.guest.emoji,
          },
        };
        setGuestSession(next);
        setSession(next);
        return result;
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Could not join — try again');
        throw err;
      } finally {
        setJoining(false);
      }
    },
    [code],
  );

  const leave = useCallback(() => {
    clearGuestSession();
    setSession(null);
    queryClient.clear();
  }, [queryClient]);

  return {
    session,
    guest: session?.guest ?? null,
    eventId: session?.eventId,
    ready,
    joining,
    error,
    join,
    leave,
  };
}
