/**
 * The Lambda entry point.
 *
 * One file, bundled once per domain, and told which slice of the route table it
 * answers for by an environment variable. The `infra/` stack creates one function
 * per domain, each with its own routes — so a function that answered a route it was
 * not deployed for, and therefore had no IAM permission for, cannot happen.
 *
 * The only real work here is shape: API Gateway's HTTP API (payload v2) and its REST
 * API (payload v1) describe the same request differently, and every handler in this
 * service is written against v1 because that is what `aws-lambda`'s
 * `APIGatewayProxyEvent` is. So a v2 event is translated on the way in, and the v1
 * response shape is returned — which HTTP API accepts unchanged.
 */
import type {
  APIGatewayProxyEvent,
  APIGatewayProxyEventV2,
  APIGatewayProxyResult,
} from 'aws-lambda';
import { createDispatcher } from './lib/router';
import type { Domain, HttpMethod } from './routes';

const domain = (process.env.FOTO_DOMAIN as Domain | undefined) ?? undefined;
const dispatch = createDispatcher(domain);

function isV2(event: APIGatewayProxyEvent | APIGatewayProxyEventV2): event is APIGatewayProxyEventV2 {
  return 'rawPath' in event && 'requestContext' in event && !('httpMethod' in event);
}

/**
 * A v2 request as a v1 one.
 *
 * The fields the handlers read are `path`, `httpMethod`, `headers`, the query string
 * and the path parameters. Everything else here exists so that the object is the type
 * the handlers expect, not because anything uses it.
 */
function toV1(event: APIGatewayProxyEventV2): APIGatewayProxyEvent {
  const headers: Record<string, string> = {};
  for (const [name, value] of Object.entries(event.headers ?? {})) {
    if (typeof value === 'string') headers[name] = value;
  }

  const query: Record<string, string> = event.queryStringParameters
    ? Object.fromEntries(
        Object.entries(event.queryStringParameters).filter(
          (entry): entry is [string, string] => typeof entry[1] === 'string',
        ),
      )
    : {};

  return {
    path: event.rawPath,
    resource: event.rawPath,
    httpMethod: event.requestContext?.http?.method ?? 'GET',
    headers,
    multiValueHeaders: {},
    queryStringParameters: Object.keys(query).length ? query : null,
    multiValueQueryStringParameters: null,
    pathParameters: event.pathParameters ?? null,
    stageVariables: null,
    body: event.body ? (event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body) : null,
    isBase64Encoded: false,
    requestContext: {
      accountId: 'http-api',
      apiId: 'http-api',
      authorizer: (event.requestContext as unknown as { authorizer?: unknown })?.authorizer as
        | Record<string, unknown>
        | undefined,
      protocol: 'HTTP/1.1',
      httpMethod: event.requestContext?.http?.method ?? 'GET',
      identity: {} as never,
      path: event.rawPath,
      stage: event.requestContext?.stage ?? '$default',
      requestId: event.requestContext?.requestId ?? '',
      requestTimeEpoch: event.requestContext?.timeEpoch ?? Date.now(),
      resourceId: 'http-api',
      resourcePath: event.rawPath,
    },
  } as APIGatewayProxyEvent;
}

export const handler = async (
  incoming: APIGatewayProxyEvent | APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResult> => {
  const event = isV2(incoming) ? toV1(incoming) : incoming;
  return dispatch(event);
};

/** Kept beside the handler so the route table's method type is used somewhere real. */
export type { HttpMethod };
