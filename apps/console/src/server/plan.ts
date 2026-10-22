/**
 * What a stage is, and what it needs.
 *
 * The plan is the console's answer to "what does this environment have to have before
 * the app can talk to it", assembled from the four stacks' outputs and the parameters
 * the auth stack publishes. Nothing here runs anything: it reads, and the Deploy
 * button is what changes the answer.
 */
import type { ChecklistItem, EnvValue, Stage, StageDetail, StageSummary } from '@/lib/types';
import { readParameter, readStacks } from './aws';
import { currentWebEnv } from './env-file';

/**
 * A value in the app's current `.env.local`, if it has one.
 *
 * The console owns the five values a stage derives. Anything else in that file — the
 * demo code on the front page, say — is the app's, and rewriting the file must not throw
 * it away. Reading it back before writing is the cheapest way to keep that promise.
 */
function existingEnvValue(name: string): string | null {
  const contents = currentWebEnv();
  if (!contents) return null;
  const line = contents
    .split('\n')
    .map((entry) => entry.trim())
    .filter((entry) => entry.startsWith(`${name}=`))
    .pop();
  return line ? line.slice(name.length + 1) : null;
}

/** Where the console expects the app to be served for a stage. */
export function appUrlFor(stage: Stage): string {
  const configured = process.env[`FOTO_APP_URL_${stage.toUpperCase()}`];
  if (configured) return configured.replace(/\/+$/, '');
  // The app runs on the developer's machine against a deployed API; the port does
  // not change with the stage, because there is only ever one app running.
  return 'http://localhost:3100';
}

/**
 * The five values the app is started with.
 *
 * Read from the stacks that own them — the API's URL and the photos CDN from
 * `FotoApiStack-*` / `FotoMediaStack-*`, the pool from the parameters `FotoAuthStack-*`
 * writes — so "the env this stage gives the app" is a fact about the deployment
 * rather than a file somebody edited by hand.
 */
export async function envFor(stage: Stage): Promise<EnvValue[]> {
  const stacks = await readStacks(stage);
  const byId = new Map(stacks.map((stack) => [stack.id, stack]));
  const api = byId.get('api')?.outputs ?? {};
  const media = byId.get('media')?.outputs ?? {};

  const [poolId, clientId] = await Promise.all([
    readParameter(`/foto/${stage}/cognito/user-pool-id`),
    readParameter(`/foto/${stage}/cognito/client-id`),
  ]);

  return [
    {
      name: 'NEXT_PUBLIC_API_URL',
      value: api.ApiUrl ?? null,
      source: 'FotoApiStack output ApiUrl',
    },
    {
      name: 'NEXT_PUBLIC_COGNITO_USER_POOL_ID',
      value: poolId,
      source: `/foto/${stage}/cognito/user-pool-id (SSM)`,
    },
    {
      name: 'NEXT_PUBLIC_COGNITO_CLIENT_ID',
      value: clientId,
      source: `/foto/${stage}/cognito/client-id (SSM)`,
    },
    {
      name: 'NEXT_PUBLIC_APP_URL',
      value: appUrlFor(stage),
      source: 'where the app is served',
    },
    {
      name: 'NEXT_PUBLIC_DEMO_CODE',
      value: process.env.NEXT_PUBLIC_DEMO_CODE ?? existingEnvValue('NEXT_PUBLIC_DEMO_CODE'),
      source: 'optional: the event the front page offers as a demo (kept from the current file)',
    },
  ];
}

/** Everything one stage is, in the shape a page draws. */
export async function readStage(stage: Stage): Promise<StageDetail> {
  const stacks = await readStacks(stage);
  const env = await envFor(stage);
  const api = stacks.find((stack) => stack.id === 'api');
  const media = stacks.find((stack) => stack.id === 'media');
  const auth = stacks.find((stack) => stack.id === 'auth');
  const data = stacks.find((stack) => stack.id === 'data');

  const apiUrl = api?.outputs.ApiUrl ?? null;
  const poolId = env.find((entry) => entry.name === 'NEXT_PUBLIC_COGNITO_USER_POOL_ID')?.value ?? null;
  const clientId = env.find((entry) => entry.name === 'NEXT_PUBLIC_COGNITO_CLIENT_ID')?.value ?? null;
  const cdn = media?.outputs.PhotosCdnUrl ?? null;
  const bucket = media?.outputs.PhotosBucketName ?? null;
  const secret = api?.outputs.GuestTokenSecretName ?? null;

  const problems: string[] = [];
  if (!api?.healthy) problems.push('The API stack is not deployed, so the app has nothing to call.');
  if (!auth?.healthy) problems.push('The auth stack is not deployed, so no host can sign in.');
  if (!media?.healthy) problems.push('The media stack is not deployed, so photos have nowhere to go.');
  if (!data?.healthy) problems.push('The data stack is not deployed, so there is nothing to read.');
  if (auth?.healthy && !poolId) problems.push(`The pool id parameter /foto/${stage}/cognito/user-pool-id is missing.`);
  if (auth?.healthy && !clientId) problems.push(`The client id parameter /foto/${stage}/cognito/client-id is missing.`);
  if (api?.status === 'UPDATE_ROLLBACK_COMPLETE') {
    problems.push('The last deploy of the API stack failed and was rolled back — its transcript says why.');
  }

  const checklist: ChecklistItem[] = [
    {
      label: 'CDK bootstrapped',
      detail: 'The CDKToolkit stack exists in this account and region, so assets can be uploaded.',
      done: stacks.some((stack) => stack.healthy),
    },
    {
      label: 'Data',
      detail: 'Seven tables, one per collection, with the indexes the API queries by.',
      done: !!data?.healthy,
    },
    {
      label: 'Media',
      detail: 'A private photos bucket and the CloudFront distribution that serves it.',
      done: !!media?.healthy && !!cdn && !!bucket,
    },
    {
      label: 'Auth',
      detail: 'A host user pool, a browser client, and the three parameters that advertise them.',
      done: !!auth?.healthy && !!poolId && !!clientId,
    },
    {
      label: 'API',
      detail: 'The HTTP API, one Lambda per domain, and the secret guest sessions are signed with.',
      done: !!api?.healthy && !!apiUrl && !!secret,
    },
    {
      label: 'The app pointed at it',
      detail: 'apps/web/.env.local written from this stage — the Frontend page does that.',
      done: false,
    },
  ];

  return {
    stage,
    stacks,
    deployed: stacks.some((stack) => stack.healthy),
    healthy: stacks.every((stack) => stack.healthy),
    apiUrl,
    appUrl: appUrlFor(stage),
    env,
    problems,
    checklist,
  };
}

/** The list page's data: one summary per stage, read in parallel. */
export async function readStageSummaries(stages: Stage[]): Promise<StageSummary[]> {
  return Promise.all(
    stages.map(async (stage) => {
      const stacks = await readStacks(stage);
      return {
        stage,
        stacks,
        deployed: stacks.some((stack) => stack.healthy),
        healthy: stacks.every((stack) => stack.healthy),
        apiUrl: stacks.find((stack) => stack.id === 'api')?.outputs.ApiUrl ?? null,
        appUrl: appUrlFor(stage),
      };
    }),
  );
}
