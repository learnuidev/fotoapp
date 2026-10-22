/**
 * The wall, and the console's roll controls.
 *
 * The wall is the one screen in this product that is watched rather than used: a
 * projector in a room, with nobody touching it. It polls, and it polls hard,
 * because a photo that appears on the wall twelve seconds after it was shot is
 * the entire promise of the screen.
 */
'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { guestApi, api } from '../api';
import { fotoKeys } from '../lib/keys';

export function useWall(code: string | undefined) {
  return useQuery({
    queryKey: fotoKeys.wall(code ?? ''),
    queryFn: () => guestApi.wall(code!),
    enabled: Boolean(code),
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
  });
}

export function useEventRolls(eventId: string | undefined) {
  return useQuery({
    queryKey: fotoKeys.eventRolls(eventId ?? ''),
    queryFn: () => api.listRolls(eventId!),
    select: (data) => data.rolls,
    enabled: Boolean(eventId),
    refetchInterval: 20_000,
  });
}

export function useDevelopAllRolls(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.developAllRolls(eventId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['foto', 'host', 'event', eventId] });
      queryClient.invalidateQueries({ queryKey: ['foto', 'guest', eventId] });
      queryClient.invalidateQueries({ queryKey: ['foto', 'wall'] });
    },
  });
}
