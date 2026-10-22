/**
 * The store the deployed service uses: DynamoDB, one table per collection.
 *
 * It answers the same small interface as the local JSON store, which is why the
 * handlers are written once. Where the two differ, the difference is expressed in
 * the collections themselves (`types/collections.ts`): every read the handlers
 * make names an indexed attribute, so a query that works locally is a query
 * DynamoDB can serve, and `infra/` creates exactly the indexes declared there.
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { config, tableName } from '../config';
import type { Collection, Store } from './types';

let client: DynamoDBDocumentClient | null = null;

function db(): DynamoDBDocumentClient {
  client ??= DynamoDBDocumentClient.from(
    new DynamoDBClient({ region: config.awsRegion }),
    // The document client hands back numbers as numbers and cannot store
    // `undefined`, which is what the row types are written in. Omitting
    // undefined values rather than rejecting them keeps `patch` calls that pass
    // an optional field as undefined from failing the request.
    { marshallOptions: { removeUndefinedValues: true } },
  );
  return client;
}

function tableFor<T extends object>(collection: Collection<T>): string {
  return tableName(collection.tableEnv, `foto-${config.stage}-${collection.name}`);
}

export class DynamoStore implements Store {
  async get<T extends object>(collection: Collection<T>, id: string): Promise<T | undefined> {
    const out = await db().send(
      new GetCommand({
        TableName: tableFor(collection),
        Key: { [collection.key]: id },
      }),
    );
    return out.Item as T | undefined;
  }

  async put<T extends object>(collection: Collection<T>, row: T): Promise<void> {
    await db().send(new PutCommand({ TableName: tableFor(collection), Item: row }));
  }

  async patch<T extends object>(
    collection: Collection<T>,
    id: string,
    changes: Partial<T>,
  ): Promise<T | undefined> {
    const entries = Object.entries(changes as Record<string, unknown>).filter(
      ([, value]) => value !== undefined,
    );
    if (!entries.length) return this.get(collection, id);

    const names: Record<string, string> = { '#pk': collection.key };
    // `:pk` is deliberately absent: the condition below names the key attribute but
    // never compares it to a value, and DynamoDB refuses a request carrying an
    // ExpressionAttributeValue that no expression uses.
    const values: Record<string, unknown> = {};
    const sets = entries.map(([field, value], i) => {
      names[`#f${i}`] = field;
      values[`:v${i}`] = value;
      return `#f${i} = :v${i}`;
    });

    const out = await db().send(
      new UpdateCommand({
        TableName: tableFor(collection),
        Key: { [collection.key]: id },
        UpdateExpression: `SET ${sets.join(', ')}`,
        ConditionExpression: 'attribute_exists(#pk)',
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
        ReturnValues: 'ALL_NEW',
      }),
    );
    return out.Attributes as T | undefined;
  }

  async remove<T extends object>(collection: Collection<T>, id: string): Promise<void> {
    await db().send(
      new DeleteCommand({ TableName: tableFor(collection), Key: { [collection.key]: id } }),
    );
  }

  async query<T extends object>(
    collection: Collection<T>,
    field: keyof T & string,
    value: string | number,
  ): Promise<T[]> {
    const rows: T[] = [];
    let exclusiveStartKey: Record<string, unknown> | undefined;

    const index = field === collection.key ? undefined : collection.indexes[field];
    if (field !== collection.key && !index) {
      throw new Error(
        `Collection "${collection.name}" has no index on "${field}"; add one in types/collections.ts`,
      );
    }

    do {
      const out = await db().send(
        new QueryCommand({
          TableName: tableFor(collection),
          ...(index ? { IndexName: index.name } : {}),
          KeyConditionExpression: '#field = :value',
          ExpressionAttributeNames: { '#field': field },
          ExpressionAttributeValues: { ':value': value },
          ExclusiveStartKey: exclusiveStartKey,
        }),
      );
      rows.push(...((out.Items ?? []) as T[]));
      exclusiveStartKey = out.LastEvaluatedKey as Record<string, unknown> | undefined;
    } while (exclusiveStartKey);

    return rows;
  }

  async all<T extends object>(collection: Collection<T>): Promise<T[]> {
    const rows: T[] = [];
    let exclusiveStartKey: Record<string, unknown> | undefined;
    do {
      const out = await db().send(
        new ScanCommand({
          TableName: tableFor(collection),
          ExclusiveStartKey: exclusiveStartKey,
        }),
      );
      rows.push(...((out.Items ?? []) as T[]));
      exclusiveStartKey = out.LastEvaluatedKey as Record<string, unknown> | undefined;
    } while (exclusiveStartKey);
    return rows;
  }
}
