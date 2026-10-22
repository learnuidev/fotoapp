/**
 * Writing the app's environment.
 *
 * `apps/web/.env.local` is the one file that connects a deployed backend to the app on
 * a laptop, and the console's job is to make it a *derived* file rather than a
 * hand-edited one: every value below comes from the stage's own stacks and parameters,
 * the file says where each came from, and switching stage is a rewrite rather than an
 * edit.
 *
 * The file is written with a header that names the stage and the moment, because the
 * first question anybody asks about a stale build is "which backend was this pointed
 * at".
 */
import type { EnvValue, Stage } from '@/lib/types';
import { paths, readIfPresent, writeFile } from './repo';

function line(value: EnvValue): string {
  if (value.value === null) {
    // A missing value is written as a comment rather than a blank assignment: the app
    // refuses to start without its API and pool, and an empty string would look set.
    return `# ${value.name} — missing (${value.source})`;
  }
  return `${value.name}=${value.value}`;
}

/** The file's contents, for a stage and the values it gave. */
export function renderEnvFile(stage: Stage, values: EnvValue[]): string {
  return [
    '# Written by the fotoshare console — edits here are overwritten the next time it',
    '# points the app at a stage. Change the stage\'s stacks, not this file.',
    '#',
    `# stage: ${stage}`,
    `# written: ${new Date().toISOString()}`,
    '',
    ...values.map(line),
    '',
  ].join('\n');
}

/** Writes it, and answers with the path it wrote. */
export function writeWebEnv(stage: Stage, values: EnvValue[]): string {
  writeFile(paths.webEnvFile, renderEnvFile(stage, values));
  return paths.webEnvFile;
}

/** What the app is pointed at right now, read back off disk. */
export function currentWebEnv(): string | null {
  return readIfPresent(paths.webEnvFile);
}
