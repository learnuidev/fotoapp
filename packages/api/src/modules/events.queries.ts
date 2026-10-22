/**
 * The console's reads and writes: events, the roster, the prompts, the analytics.
 *
 * Every mutation invalidates what it changed. A console is a screen a host watches
 * while the party happens, so "the numbers did not move" is indistinguishable from
 * "the thing did not work".
 */
'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateChallengePayload,
  CreateEventPayload,
  UpdateChallengePayload,
  UpdateEventPayload,
} from '@foto/types';
import { api } from '../api';
import { ApiError } from '../lib/client';
import { fotoKeys } from '../lib/keys';

export function useEvents() {
  return useQuery({
    queryKey: fotoKeys.events(),
    queryFn: () => api.listEvents(),
    select: (data) => data.events,
  });
}

export function useEvent(eventId: string | undefined) {
  return useQuery({
    queryKey: fotoKeys.event(eventId ?? ''),
    queryFn: () => api.getEvent(eventId!),
    select: (data) => data.event,
    enabled: Boolean(eventId),
    // A console left open on a table while photos arrive is the normal case.
    refetchInterval: 20_000,
  });
}

export function useEventStats(eventId: string | undefined) {
  return useQuery({
    queryKey: fotoKeys.eventStats(eventId ?? ''),
    queryFn: () => api.getEventStats(eventId!),
    select: (data) => data.stats,
    enabled: Boolean(eventId),
    refetchInterval: 20_000,
  });
}

export function useGuestRoster(eventId: string | undefined) {
  return useQuery({
    queryKey: fotoKeys.guestRoster(eventId ?? ''),
    queryFn: () => api.listGuests(eventId!),
    select: (data) => data.guests,
    enabled: Boolean(eventId),
  });
}

export function useEventChallenges(eventId: string | undefined) {
  return useQuery({
    queryKey: fotoKeys.eventChallenges(eventId ?? ''),
    queryFn: () => api.listChallenges(eventId!),
    select: (data) => data.challenges,
    enabled: Boolean(eventId),
  });
}

export function useCreateEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateEventPayload) => api.createEvent(payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: fotoKeys.events() });
      queryClient.setQueryData(fotoKeys.event(data.event.eventId), data);
    },
  });
}

export function useUpdateEvent(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateEventPayload) => api.updateEvent(eventId, payload),
    onSuccess: (data) => {
      queryClient.setQueryData(fotoKeys.event(eventId), data);
      queryClient.invalidateQueries({ queryKey: fotoKeys.events() });
    },
  });
}

export function useDeleteEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (eventId: string) => api.deleteEvent(eventId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: fotoKeys.events() }),
  });
}

export function useRotateCode(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.rotateCode(eventId),
    onSuccess: (data) => {
      queryClient.setQueryData(fotoKeys.event(eventId), data);
      queryClient.invalidateQueries({ queryKey: fotoKeys.events() });
    },
  });
}

export function useRemoveGuest(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (guestId: string) => api.removeGuest(eventId, guestId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: fotoKeys.guestRoster(eventId) });
      queryClient.invalidateQueries({ queryKey: fotoKeys.event(eventId) });
    },
  });
}

export function useCreateChallenge(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateChallengePayload) => api.createChallenge(eventId, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: fotoKeys.eventChallenges(eventId) }),
  });
}

export function useUpdateChallenge(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ challengeId, payload }: { challengeId: string; payload: UpdateChallengePayload }) =>
      api.updateChallenge(challengeId, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: fotoKeys.eventChallenges(eventId) }),
  });
}

export function useDeleteChallenge(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (challengeId: string) => api.deleteChallenge(challengeId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: fotoKeys.eventChallenges(eventId) }),
  });
}

/** The one error a console turns into a sign-in screen rather than a sentence. */
export function isSignInRequired(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}
