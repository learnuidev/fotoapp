/**
 * Prompts — the things a host asks the room to shoot.
 *
 * The idea is Kululu's and it is the cheapest good idea in this product: a person
 * handed a camera and no instructions takes a photo of the table. A person asked
 * for "the shoes" takes a photo somebody wants to look at, and the host's
 * analytics can then say which prompt produced the evening.
 */
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { ulid } from 'ulid';
import { requireHost } from '../lib/auth';
import { requireOwnedEvent } from '../lib/access';
import { HttpError, created, handle, jsonBody, noContent, ok, pathParam } from '../lib/http';
import { toChallenge } from '../lib/serialize';
import { getStore } from '../lib/store';
import { challenges, photos } from '../types/collections';
import type { ChallengeRow } from '../types/records';
import { challengesOfEvent } from './events';

async function ownedChallenge(
  event: APIGatewayProxyEvent,
): Promise<{ challenge: ChallengeRow; hostId: string }> {
  const host = requireHost(event);
  const challenge = await getStore().get(challenges, pathParam(event, 'challengeId'));
  if (!challenge) throw new HttpError(404, 'No such prompt');
  await requireOwnedEvent(challenge.eventId, host.userId);
  return { challenge, hostId: host.userId };
}

async function createChallenge(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const host = requireHost(event);
  const eventRow = await requireOwnedEvent(pathParam(event, 'eventId'), host.userId);
  const body = jsonBody<{ title?: string; emoji?: string }>(event);

  const title = (body.title ?? '').trim();
  if (!title) throw new HttpError(400, 'Give the prompt a title');
  if (title.length > 80) throw new HttpError(400, 'That title is too long');

  const row: ChallengeRow = {
    challengeId: ulid(),
    eventId: eventRow.eventId,
    title,
    emoji: (body.emoji ?? '📸').slice(0, 8),
    active: true,
    createdAt: Date.now(),
  };
  await getStore().put(challenges, row);
  return created({ challenge: toChallenge(row, 0) });
}

async function updateChallenge(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const { challenge } = await ownedChallenge(event);
  const body = jsonBody<{ title?: string; emoji?: string; active?: boolean }>(event);

  const patch: Partial<ChallengeRow> = {};
  if (body.title !== undefined) {
    const title = body.title.trim();
    if (!title) throw new HttpError(400, 'Give the prompt a title');
    patch.title = title.slice(0, 80);
  }
  if (body.emoji !== undefined) patch.emoji = body.emoji.slice(0, 8) || '📸';
  if (body.active !== undefined) patch.active = Boolean(body.active);

  const updated = await getStore().patch(challenges, challenge.challengeId, patch);
  return ok({ challenge: toChallenge(updated ?? challenge, 0) });
}

/**
 * Deletes a prompt. Photos shot for it keep their caption and lose their prompt,
 * which is the least surprising thing to do with a photo of the shoes.
 */
async function deleteChallenge(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const { challenge } = await ownedChallenge(event);
  const store = getStore();

  const shot = await store.query(photos, 'eventId', challenge.eventId);
  await Promise.all(
    shot
      .filter((photo) => photo.challengeId === challenge.challengeId)
      .map((photo) => store.patch(photos, photo.photoId, { challengeId: null })),
  );
  await store.remove(challenges, challenge.challengeId);
  return noContent();
}

async function listChallengePhotos(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const { challenge } = await ownedChallenge(event);
  const store = getStore();
  const rows = (await store.query(photos, 'eventId', challenge.eventId)).filter(
    (photo) => photo.challengeId === challenge.challengeId,
  );
  return ok({ challenges: await challengesOfEvent(challenge.eventId), count: rows.length });
}

export const challengeHandlers = {
  create: handle(createChallenge),
  update: handle(updateChallenge),
  remove: handle(deleteChallenge),
  photos: handle(listChallengePhotos),
};
