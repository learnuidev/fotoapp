/**
 * The host account, as this service sees it.
 *
 * There is no sign-up and no sign-in here, and there is no password store: the host
 * account is a Cognito user, `infra/` creates the pool, and the app signs in through
 * Amplify against it. What is left for this service is `GET /me` — "who does this
 * token belong to" — which is what the console asks on boot so that a token the pool
 * has stopped honouring shows a sign-in screen rather than a console full of errors.
 *
 * The one Cognito job that does happen in this codebase is `preSignUp`: this is a
 * product where somebody makes one account to run one evening, and a verification
 * email standing between them and the album is friction with nothing behind it for a
 * dev stage. The trigger confirms and verifies automatically, and a real deployment
 * would delete it.
 */
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { requireHost } from '../lib/auth';
import { handle, ok } from '../lib/http';

/** Who the caller is, according to the token API Gateway already verified. */
async function me(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const host = requireHost(event);
  return ok({
    user: {
      userId: host.userId,
      email: host.email,
      name: host.name,
      createdAt: 0,
    },
  });
}

export const authHandlers = {
  me: handle(me),
};

/**
 * The Cognito pre-sign-up trigger.
 *
 * Not an HTTP route: this is the function the user pool calls when somebody signs
 * up. It says yes, marks the address verified, and gets out of the way — so a host
 * who types their email and a password is signed in, rather than waiting for a code
 * to arrive at 6pm on the day of the wedding.
 */
export async function preSignUpTrigger(event: {
  triggerSource?: string;
  response: Record<string, unknown>;
}): Promise<typeof event> {
  event.response.autoConfirmUser = true;
  event.response.autoVerifyEmail = true;
  return event;
}
