/**
 * Where things are, and how a shell command is spelled in this checkout.
 *
 * The console is the only app here that runs commands, so it is the only one that
 * has to know the repository's layout. It is resolved from this file rather than
 * from the working directory, because `npm run console` may be started from the root
 * or from `apps/console`.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/**
 * The repository root.
 *
 * Found by walking up from the working directory until a folder has both
 * `apps/web/package.json` and `infra/cdk.json`, rather than from `__dirname`: Next
 * bundles this file, and a bundled `__dirname` is whatever the bundler decided, not the
 * path on disk. The walk is also what makes `npm run console` work from the root or from
 * `apps/console`, which is the difference between a tool that works and one that works
 * once.
 */
function findRepoRoot(): string {
  let current = process.cwd();
  for (let depth = 0; depth < 6; depth += 1) {
    if (
      existsSync(join(current, 'apps', 'web', 'package.json')) &&
      existsSync(join(current, 'infra', 'cdk.json'))
    ) {
      return current;
    }
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return process.cwd();
}

export const repoRoot = findRepoRoot();

export const paths = {
  root: repoRoot,
  infra: join(repoRoot, 'infra'),
  web: join(repoRoot, 'apps', 'web'),
  webEnvFile: join(repoRoot, 'apps', 'web', '.env.local'),
  nodeModules: join(repoRoot, 'node_modules'),
};

/** The `cdk` this repository installed, not whatever is on the PATH. */
export const cdkBin = join(paths.nodeModules, '.bin', 'cdk');

/** The AWS CLI is not needed; the console talks to the SDK directly. */
export const awsRegion =
  process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? 'us-east-1';

/** The profile the console acts as, if one was named when it was started. */
export const awsProfile = process.env.AWS_PROFILE ?? null;

/**
 * What every spawned command is given.
 *
 * `AWS_PROFILE` is passed through rather than read: the console has no opinion about
 * which account it acts as, and inheriting the shell's choice is both the least
 * surprising thing and the only one that lets somebody switch accounts by restarting
 * it with a different profile.
 */
export function childEnv(extra: Record<string, string> = {}): NodeJS.ProcessEnv {
  return {
    ...process.env,
    AWS_REGION: awsRegion,
    AWS_DEFAULT_REGION: awsRegion,
    ...(awsProfile ? { AWS_PROFILE: awsProfile } : {}),
    // `cdk` prints a banner and colours; the transcript wants neither.
    CI: '1',
    FORCE_COLOR: '0',
    ...extra,
  };
}

/** Reads a file, or returns null when it is not there. */
export function readIfPresent(path: string): string | null {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
}

/** Writes a file, creating its directory. */
export function writeFile(path: string, contents: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents, 'utf8');
}
