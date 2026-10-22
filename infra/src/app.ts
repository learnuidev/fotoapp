/**
 * The four stacks, in the order they depend on each other.
 *
 * Data, media and auth hold no product logic at all — they are the tables, the bucket
 * and the user pool — and the API stack is the only one that knows what the product
 * does. They are separate stacks so that a change to a route does not risk the tables,
 * which is the whole argument for splitting infrastructure from code in the first
 * place.
 */
import { App } from 'aws-cdk-lib';
import { configFor } from './config';
import { ApiStack } from './stacks/api-stack';
import { AuthStack } from './stacks/auth-stack';
import { DataStack } from './stacks/data-stack';
import { MediaStack } from './stacks/media-stack';

export function buildApp(app: App, context: Record<string, unknown> = {}): void {
  const config = configFor(context);
  const prefix = `Foto`;
  const suffix = config.stage;
  const env = {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  };

  const data = new DataStack(app, `${prefix}DataStack-${suffix}`, config, {
    env,
    description: `foto ${config.stage} — the tables behind every event, photo and roll`,
  });

  const media = new MediaStack(app, `${prefix}MediaStack-${suffix}`, config, {
    env,
    description: `foto ${config.stage} — the photos bucket and the CDN in front of it`,
  });

  // Built for its parameters as much as for its resources: the API stack reads the
  // pool's issuer and client id from Parameter Store, so auth is deployed first.
  new AuthStack(app, `${prefix}AuthStack-${suffix}`, config, {
    env,
    description: `foto ${config.stage} — the host user pool`,
  });

  new ApiStack(app, `${prefix}ApiStack-${suffix}`, config, { data, media }, {
    env,
    description: `foto ${config.stage} — the API, one Lambda per domain`,
  });
}
