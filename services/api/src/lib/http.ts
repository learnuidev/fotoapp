/**
 * The response shapes, and the one error type every handler throws.
 *
 * A Lambda behind API Gateway and the local server both answer in this shape,
 * because the local server runs the handlers rather than reimplementing them.
 */
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { config } from './config';

export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

/**
 * CORS, deliberately open.
 *
 * The API is read from two origins in development (`localhost:3100` for the app,
 * and whatever a phone on the same network uses) and from one in production, and
 * it authenticates with a bearer token rather than a cookie. A wildcard origin
 * therefore grants a browser nothing it could not already do with `curl`; what
 * protects an event is its code and its token, not the origin.
 */
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': config.corsOrigin,
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Foto-Guest',
  'Access-Control-Allow-Methods': 'OPTIONS, GET, POST, PUT, PATCH, DELETE',
  'Access-Control-Max-Age': '86400',
};

export const ok = (data: unknown, statusCode = 200): APIGatewayProxyResult => ({
  statusCode,
  headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  body: JSON.stringify(data),
});

export const created = (data: unknown): APIGatewayProxyResult => ok(data, 201);

export const noContent = (): APIGatewayProxyResult => ({
  statusCode: 204,
  headers: CORS_HEADERS,
  body: '',
});

export const fail = (statusCode: number, message: string): APIGatewayProxyResult => ({
  statusCode,
  headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  body: JSON.stringify({ error: { code: statusCode, message } }),
});

/** The shape of a handler, in both runtimes. */
export type Handler = (event: APIGatewayProxyEvent) => Promise<APIGatewayProxyResult>;

/**
 * Wraps a handler so a thrown `HttpError` becomes the JSON body the client
 * prints, and anything else becomes a 500 the client prints as a sentence rather
 * than as a stack trace.
 */
export function handle(fn: Handler): Handler {
  return async (event) => {
    try {
      return await fn(event);
    } catch (err) {
      if (err instanceof HttpError) return fail(err.statusCode, err.message);
      console.error('Unhandled error', err);
      return fail(500, 'Something went wrong');
    }
  };
}

/** Reads a path parameter, failing the request rather than the handler when it is missing. */
export function pathParam(event: APIGatewayProxyEvent, name: string): string {
  const value = event.pathParameters?.[name];
  if (!value) throw new HttpError(400, `${name} is required`);
  return value;
}

/** Parses a JSON request body, treating an absent one as `{}`. */
export function jsonBody<T extends object>(event: APIGatewayProxyEvent): T {
  if (!event.body) return {} as T;
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body, 'base64').toString('utf8')
    : event.body;
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new HttpError(400, 'Request body must be valid JSON');
  }
}

/** A query-string value, or undefined when it is absent or blank. */
export function query(event: APIGatewayProxyEvent, name: string): string | undefined {
  const value = event.queryStringParameters?.[name];
  return value === undefined || value === '' ? undefined : value;
}

/** A query-string number, with a fallback for when it is absent or nonsense. */
export function queryNumber(
  event: APIGatewayProxyEvent,
  name: string,
  fallback: number,
): number {
  const raw = query(event, name);
  if (raw === undefined) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

/** A query-string boolean: `?favorite=1`, `?favorite=true`. Anything else is false. */
export function queryFlag(event: APIGatewayProxyEvent, name: string): boolean {
  const raw = query(event, name);
  return raw === '1' || raw === 'true';
}
