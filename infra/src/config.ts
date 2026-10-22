/**
 * The deployment's own identity: which account, which region, which stage.
 *
 * Read from the CDK context (`--context stage=dev`) and from the environment, with a
 * default for the stage so `npm run synth` works with no arguments. There are no
 * account or region literals anywhere else in this app — every stack is built for
 * whatever account it is being synthesised against, which is what makes `cdk deploy`
 * work for somebody who has just cloned the repository.
 */
export interface StageConfig {
  /** `dev`, `staging`, `prod` — part of every physical name. */
  stage: string;
  /** Where the app is served, for links the API builds and the QR a host prints. */
  appUrl: string;
  /** Extra origins allowed to call the API. `*` while the front end is on a laptop. */
  corsOrigin: string;
  /** How many days a photo lives before S3 deletes it. 0 keeps it forever. */
  photoRetentionDays: number;
}

function stageOf(context: Record<string, unknown>): string {
  const stage = (context.stage as string | undefined) ?? process.env.FOTO_STAGE ?? 'dev';
  if (!['dev', 'staging', 'prod'].includes(stage)) {
    throw new Error(`Unknown stage "${stage}" — use dev, staging or prod`);
  }
  return stage;
}

export function configFor(context: Record<string, unknown> = {}): StageConfig {
  const stage = stageOf(context);

  return {
    stage,
    appUrl: (process.env.APP_BASE_URL ?? 'http://localhost:3100').replace(/\/+$/, ''),
    corsOrigin: process.env.CORS_ORIGIN ?? '*',
    // A dev stage should not accumulate every photo anybody ever tests with.
    photoRetentionDays: Number(process.env.PHOTO_RETENTION_DAYS ?? (stage === 'dev' ? 90 : 0)),
  };
}
