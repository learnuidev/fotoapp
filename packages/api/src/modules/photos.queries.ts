/**
 * Photos, from the console: the moderation queue, the gallery, the downloads.
 *
 * The console's photo reads are the ones that see everything — waiting, hidden,
 * favourited — and the mutations are the ones a host actually performs while an
 * event is happening: publish it, hide it, star it, delete it, keep them all.
 */
'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UpdatePhotoPayload } from '@foto/types';
import { api } from '../api';
import { fotoKeys } from '../lib/keys';
import { uploadPhoto, type UploadPhotoOptions } from '../lib/upload';

export interface PhotoFilters {
  status?: string;
  guestId?: string;
  challengeId?: string;
  rollId?: string;
  favorite?: boolean;
  limit?: number;
  sort?: 'uploaded' | 'captured';
}

export function useHostPhotos(eventId: string | undefined, filters: PhotoFilters = {}) {
  const key = fotoKeys.hostPhotos(eventId ?? '', filters as Record<string, unknown>);
  return useQuery({
    queryKey: key,
    queryFn: () => api.listPhotos(eventId!, filters),
    enabled: Boolean(eventId),
    refetchInterval: 15_000,
  });
}

/** Everything a mutation on a photo can change about the screens showing it. */
function useRefreshEvent(eventId: string) {
  const queryClient = useQueryClient();
  return (photoId?: string) => {
    queryClient.invalidateQueries({ queryKey: ['foto', 'host', 'event', eventId] });
    queryClient.invalidateQueries({ queryKey: ['foto', 'guest', eventId] });
    queryClient.invalidateQueries({ queryKey: ['foto', 'wall'] });
    if (photoId) queryClient.invalidateQueries({ queryKey: fotoKeys.comments(photoId) });
  };
}

export function useUpdatePhoto(eventId: string) {
  const refresh = useRefreshEvent(eventId);
  return useMutation({
    mutationFn: ({ photoId, payload }: { photoId: string; payload: UpdatePhotoPayload }) =>
      api.updatePhoto(photoId, payload),
    onSuccess: (_data, variables) => refresh(variables.photoId),
  });
}

export function useDeletePhoto(eventId: string) {
  const refresh = useRefreshEvent(eventId);
  return useMutation({
    mutationFn: (photoId: string) => api.deletePhoto(photoId),
    onSuccess: (_data, photoId) => refresh(photoId),
  });
}

/**
 * A host adding photos from the console.
 *
 * The same three-step upload the guest camera uses — reserve, PUT, record — with the
 * host's own token, and the API answers by putting the photo straight in the album.
 * A creator uploading the professional shot into their own wedding should not have to
 * join the event as a guest, and should not have to develop a roll to see it.
 */
export function useHostUploadPhoto(eventId: string) {
  const refresh = useRefreshEvent(eventId);
  return useMutation({
    mutationFn: (options: { file: File } & UploadPhotoOptions) =>
      uploadPhoto(eventId, options.file, { ...options, scope: 'host' }),
    onSuccess: (_data, variables) => {
      void variables;
      refresh();
    },
  });
}

export function useSetCover(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (photoId: string | null) => api.updateEvent(eventId, { coverPhotoId: photoId }),
    onSuccess: (data) => {
      queryClient.setQueryData(fotoKeys.event(eventId), data);
      queryClient.invalidateQueries({ queryKey: fotoKeys.events() });
    },
  });
}

export function useDownloads(eventId: string | undefined, favoriteOnly = false) {
  return useQuery({
    queryKey: fotoKeys.downloads(eventId ?? '', favoriteOnly),
    queryFn: () => api.listDownloads(eventId!, favoriteOnly),
    enabled: Boolean(eventId),
    // Downloads are a deliberate act, not something to refetch in the background.
    staleTime: 60_000,
  });
}
