/**
 * The little document store this service is written against.
 *
 * There are two implementations — a JSON file for `npm run dev`, DynamoDB for
 * AWS — and the handlers know neither. That is the point: every rule about who
 * may shoot, hide, develop or react lives in one place and is exercised locally,
 * and the deploy only swaps where the rows are kept.
 *
 * The interface is deliberately small. It has no joins, no transactions and no
 * atomic counters, because those are the things the two implementations could
 * not do the same way; what needs counting is counted by reading the rows, which
 * is both exact and branch-free. See `lib/counts.ts`.
 */

/** One collection of rows, keyed by one attribute, with the indexes it is read by. */
export interface Collection<T extends object> {
  /** The collection's name: the local store's key, and part of the table name in AWS. */
  name: string;
  /** The environment variable that carries this table's name in AWS. */
  tableEnv: string;
  /** The primary key attribute, e.g. `photoId`. */
  key: keyof T & string;
  /**
   * The secondary reads this collection supports, keyed by the attribute that is
   * queried. `sortKey` is the attribute the index orders by, when ordering is
   * part of the read.
   */
  indexes: Record<string, { name: string; sortKey?: string }>;
}

export interface Store {
  get<T extends object>(collection: Collection<T>, id: string): Promise<T | undefined>;

  put<T extends object>(collection: Collection<T>, row: T): Promise<void>;

  /**
   * Merges `changes` into a stored row and answers with the result.
   *
   * Read-then-write in both implementations rather than an atomic update: the
   * things this product patches — a caption, a status, a photo's favourite flag,
   * a roll's shot count — are each written by exactly one person, and the counts
   * every screen shows are read from rows rather than stored on one.
   */
  patch<T extends object>(
    collection: Collection<T>,
    id: string,
    changes: Partial<T>,
  ): Promise<T | undefined>;

  remove<T extends object>(collection: Collection<T>, id: string): Promise<void>;

  /**
   * Every row whose `field` equals `value`.
   *
   * `field` must be the primary key or one of the collection's indexed
   * attributes; a field with no index is a query AWS cannot answer, so it is
   * refused here rather than in production.
   */
  query<T extends object>(
    collection: Collection<T>,
    field: keyof T & string,
    value: string | number,
  ): Promise<T[]>;

  /** Every row of a collection. For analytics and the seed, not for a page. */
  all<T extends object>(collection: Collection<T>): Promise<T[]>;
}
