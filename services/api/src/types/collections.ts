/**
 * The collections, and the indexes each one is read by.
 *
 * One description serves both runtimes: the local store reads it to know what a
 * query means, and `infra/` reads it to create the tables and their global
 * secondary indexes. That is deliberate — a query the API can make that the
 * table cannot answer is a bug that only shows up in AWS, and the way to make
 * that impossible is to have one list.
 *
 * An index is named after the attribute it keys on (`eventIdIndex`), so the
 * CDK stack can create them without a second table of names, and the sort key is
 * always the attribute the API orders by.
 */
import type { Collection } from '../lib/store/types';
import type {
  ChallengeRow,
  CommentRow,
  EventRow,
  GuestRow,
  PhotoRow,
  ReactionRow,
  RollRow,
} from '../types/records';

export const events: Collection<EventRow> = {
  name: 'events',
  tableEnv: 'EVENTS_TABLE',
  key: 'eventId',
  indexes: {
    code: { name: 'codeIndex' },
    hostId: { name: 'hostIdIndex', sortKey: 'createdAt' },
  },
};

export const guests: Collection<GuestRow> = {
  name: 'guests',
  tableEnv: 'GUESTS_TABLE',
  key: 'guestId',
  indexes: {
    eventId: { name: 'eventIdIndex', sortKey: 'joinedAt' },
    deviceKey: { name: 'deviceKeyIndex' },
  },
};

export const photos: Collection<PhotoRow> = {
  name: 'photos',
  tableEnv: 'PHOTOS_TABLE',
  key: 'photoId',
  indexes: {
    eventId: { name: 'eventIdIndex', sortKey: 'createdAt' },
    rollId: { name: 'rollIdIndex', sortKey: 'createdAt' },
  },
};

export const reactions: Collection<ReactionRow> = {
  name: 'reactions',
  tableEnv: 'REACTIONS_TABLE',
  key: 'reactionId',
  indexes: {
    eventId: { name: 'eventIdIndex', sortKey: 'createdAt' },
    photoId: { name: 'photoIdIndex', sortKey: 'createdAt' },
  },
};

export const comments: Collection<CommentRow> = {
  name: 'comments',
  tableEnv: 'COMMENTS_TABLE',
  key: 'commentId',
  indexes: {
    eventId: { name: 'eventIdIndex', sortKey: 'createdAt' },
    photoId: { name: 'photoIdIndex', sortKey: 'createdAt' },
  },
};

export const challenges: Collection<ChallengeRow> = {
  name: 'challenges',
  tableEnv: 'CHALLENGES_TABLE',
  key: 'challengeId',
  indexes: {
    eventId: { name: 'eventIdIndex', sortKey: 'createdAt' },
  },
};

export const rolls: Collection<RollRow> = {
  name: 'rolls',
  tableEnv: 'ROLLS_TABLE',
  key: 'rollId',
  indexes: {
    eventId: { name: 'eventIdIndex', sortKey: 'startedAt' },
    guestId: { name: 'guestIdIndex', sortKey: 'startedAt' },
  },
};

/** Every collection, so `infra/` can create a table for each and the seed can clear them. */
export const COLLECTIONS = [events, guests, photos, reactions, comments, challenges, rolls];
