/**
 * The one place a handler gets a store from.
 *
 * There is one implementation: DynamoDB, with one table per collection, created by
 * `infra/` from the collection descriptions in `types/collections.ts`. The store is
 * built once per container and reused, because a Lambda that re-reads its
 * configuration on every query is a Lambda spending its time on setup.
 */
import { DynamoStore } from './dynamo';
import type { Store } from './types';

let store: Store | null = null;

export function getStore(): Store {
  store ??= new DynamoStore();
  return store;
}

export type { Collection, Store } from './types';
