/**
 * The guest screens' reads and writes.
 *
 * These are the calls a person makes standing up, holding a phone, at somebody
 * else's party — so the polling intervals are short, the mutations are optimistic
 * where a reaction is concerned (a heart that waits for a round trip feels broken),
 * and a failure never blocks the next shot.
 */
'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ReactionEmoji } from '@foto/types';
import { guestApi } from '../api';
import { uploadPhoto, type UploadPhotoOptions } from '../lib/upload';
import { fotoKeys } from '../lib/keys';

/** What a join code opens, before the caller has a name. */
export function useJoinEvent(code: string | undefined) {
  return useQuery({
    queryKey: fotoKeys.join(code ?? ''),
    queryFn: () => guestApi.joinEvent(code!),
    enabled: Boolean(code),
    // Somebody is standing at a table waiting for this screen.
    staleTime: 5_000,
  });
}

export function useGuestMe(eventId: string | undefined) {
  return useQuery({
    queryKey: fotoKeys.guestMe(eventId ?? ''),
    queryFn: () => guestApi.myGuest(eventId!),
    enabled: Boolean(eventId),
    retry: false,
  });
}

export function useGuestPhotos(
  eventId: string | undefined,
  filters: { limit?: number; challengeId?: string; guestId?: string } = {},
) {
  return useQuery({
    queryKey: fotoKeys.guestPhotos(eventId ?? '', filters as Record<string, unknown>),
    queryFn: () => guestApi.listPhotos(eventId!, filters),
    enabled: Boolean(eventId),
    refetchInterval: 12_000,
  });
}

export function useGuestRolls(eventId: string | undefined) {
  return useQuery({
    queryKey: fotoKeys.guestRolls(eventId ?? ''),
    queryFn: () => guestApi.listMyRolls(eventId!),
    enabled: Boolean(eventId),
    refetchInterval: 20_000,
  });
}

/** The camera: reserve, upload, record — with progress, because a field is a field. */
export function useUploadPhoto(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (options: { file: File } & UploadPhotoOptions) =>
      uploadPhoto(eventId, options.file, { ...options, scope: 'guest' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['foto', 'guest', eventId] });
      queryClient.invalidateQueries({ queryKey: ['foto', 'host', 'event', eventId] });
      queryClient.invalidateQueries({ queryKey: ['foto', 'wall'] });
    },
  });
}

export function useStartRoll(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (shotLimit?: number) => guestApi.startRoll(eventId, shotLimit),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['foto', 'guest', eventId] });
    },
  });
}

export function useDevelopRoll(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (rollId: string) => guestApi.developRoll(rollId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['foto', 'guest', eventId] });
      queryClient.invalidateQueries({ queryKey: ['foto', 'host', 'event', eventId] });
      queryClient.invalidateQueries({ queryKey: ['foto', 'wall'] });
    },
  });
}

/**
 * A reaction, written into the cache before it is sent.
 *
 * The photo the heart is on is already on screen; waiting for a server round trip
 * to fill it in is the difference between a camera roll and a form.
 */
export function useReact(eventId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ photoId, emoji }: { photoId: string; emoji: ReactionEmoji }) =>
      guestApi.react(photoId, emoji),
    onMutate: async ({ photoId, emoji }) => {
      const keys = queryClient
        .getQueryCache()
        .findAll({ queryKey: ['foto'] })
        .map((query) => query.queryKey);

      for (const key of keys) {
        queryClient.setQueryData(key, (current: unknown) => applyReaction(current, photoId, emoji));
      }
      void eventId;
      return { photoId, emoji };
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['foto', 'guest', eventId] });
      queryClient.invalidateQueries({ queryKey: ['foto', 'wall'] });
    },
  });
}

export function useUnreact(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ photoId, emoji }: { photoId: string; emoji: ReactionEmoji }) =>
      guestApi.unreact(photoId, emoji),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['foto', 'guest', eventId] });
      queryClient.invalidateQueries({ queryKey: ['foto', 'wall'] });
    },
  });
}

/**
 * Folds a reaction into whatever shape a cached response happens to be.
 *
 * The same photo appears in a gallery page, a wall payload, a single-photo
 * response and a guest's roll, and they all nest it differently. Rather than
 * teaching every cache key its own updater, this walks the cached value and
 * updates any object that is this photo.
 */
function applyReaction(current: unknown, photoId: string, emoji: ReactionEmoji): unknown {
  if (!current || typeof current !== 'object') return current;

  if (Array.isArray(current)) {
    return current.map((entry) => applyReaction(entry, photoId, emoji));
  }

  const value = current as Record<string, unknown>;

  if (value.photoId === photoId && value.reactions && typeof value.reactions === 'object') {
    const reactions = value.reactions as {
      total: number;
      byEmoji: { emoji: ReactionEmoji; count: number }[];
      mine: ReactionEmoji[];
    };
    if (reactions.mine.includes(emoji)) return current;

    const byEmoji = reactions.byEmoji.map((entry) => ({ ...entry }));
    const existing = byEmoji.find((entry) => entry.emoji === emoji);
    if (existing) existing.count += 1;
    else byEmoji.push({ emoji, count: 1 });

    return {
      ...value,
      reactions: {
        total: reactions.total + 1,
        byEmoji: byEmoji.sort((a, b) => b.count - a.count),
        mine: [...reactions.mine, emoji],
      },
    };
  }

  let changed = false;
  const next: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    const updated = applyReaction(entry, photoId, emoji);
    if (updated !== entry) changed = true;
    next[key] = updated;
  }
  return changed ? next : current;
}

export function useComments(photoId: string | undefined) {
  return useQuery({
    queryKey: fotoKeys.comments(photoId ?? ''),
    queryFn: () => guestApi.listComments(photoId!),
    select: (data) => data.comments,
    enabled: Boolean(photoId),
  });
}

export function useCreateComment(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ photoId, body }: { photoId: string; body: string }) =>
      guestApi.createComment(photoId, body),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: fotoKeys.comments(variables.photoId) });
      queryClient.invalidateQueries({ queryKey: ['foto', 'guest', eventId] });
    },
  });
}

export function useDeleteComment(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ photoId, commentId }: { photoId: string; commentId: string }) =>
      guestApi.deleteComment(photoId, commentId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: fotoKeys.comments(variables.photoId) });
      queryClient.invalidateQueries({ queryKey: ['foto', 'guest', eventId] });
    },
  });
}

/** A guest deleting their own shot, which is the one act of moderation they have. */
export function useDeleteOwnPhoto(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (photoId: string) => guestApi.deletePhoto(photoId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['foto', 'guest', eventId] }),
  });
}
