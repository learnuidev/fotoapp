/**
 * Turning a route table into something that answers a request.
 *
 * The same matcher runs in two places. In AWS, API Gateway has already matched
 * the route and the handler is the one function that route was deployed to — so
 * the match is a formality, but a useful one, because it is the same code the dev
 * server ran. Locally there is no gateway at all, so this *is* the router.
 */
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { ROUTES, routesOf, type Domain, type Route } from '../routes';
import { fail } from './http';

export interface Match {
  route: Route;
  pathParameters: Record<string, string>;
}

function segments(path: string): string[] {
  return path.split('/').filter(Boolean);
}

/** Matches one method and path against the table. */
export function matchRoute(
  method: string,
  rawPath: string,
  routes: Route[] = ROUTES,
): Match | null {
  const wanted = segments(rawPath);
  const upper = method.toUpperCase();

  for (const route of routes) {
    if (route.method !== upper) continue;
    const pattern = segments(route.path);
    if (pattern.length !== wanted.length) continue;

    const params: Record<string, string> = {};
    let ok = true;
    for (const [index, part] of pattern.entries()) {
      const actual = wanted[index]!;
      if (part.startsWith('{') && part.endsWith('}')) {
        params[part.slice(1, -1)] = decodeURIComponent(actual);
      } else if (part !== actual) {
        ok = false;
        break;
      }
    }
    if (ok) return { route, pathParameters: params };
  }
  return null;
}

/**
 * A Lambda handler that dispatches through the table.
 *
 * `undefined` domain means every route: that is the local server. A domain means
 * just that domain's routes, which is what each deployed function is given — a
 * function that answered routes it was not deployed for would be a function
 * Nobody granted the IAM permissions for.
 */
export function createDispatcher(domain?: Domain) {
  const routes = domain ? routesOf(domain) : ROUTES;

  return async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const rawPath = event.path ?? event.resource ?? '';
    const match = matchRoute(event.httpMethod, rawPath, routes);

    if (!match) {
      // A path that exists under another method is a 405 with an Allow header;
      // anything else is a 404. Both are more useful than an empty body.
      const others = routes
        .filter((route) => segments(route.path).length === segments(rawPath).length)
        .map((route) => route.method);
      if (others.length) {
        return fail(405, `${event.httpMethod} is not allowed on ${rawPath}`);
      }
      return fail(404, `No route for ${event.httpMethod} ${rawPath}`);
    }

    // API Gateway percent-decodes path parameters already; the local server does
    // not, so both are written here and the handlers read one place.
    return match.route.handler({
      ...event,
      pathParameters: { ...event.pathParameters, ...match.pathParameters },
    });
  };
}

/** The route a method and path resolve to, exported for the dev server's preflight. */
export function knownMethods(path: string, domain?: Domain): string[] {
  const routes = domain ? routesOf(domain) : ROUTES;
  return [
    ...new Set(
      routes
        .filter((route) => matchRoute(route.method, path, [route]) !== null)
        .map((route) => route.method),
    ),
    'OPTIONS',
  ];
}

export { ROUTES };
