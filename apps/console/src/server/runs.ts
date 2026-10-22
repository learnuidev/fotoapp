/**
 * The one thing that writes to AWS: `cdk`, run as a child process.
 *
 * Every action is a `cdk` invocation in `infra/` with the stage as context, and its
 * output is kept as a transcript the page can stream. Nothing is parsed out of it to
 * decide what to do next — the console runs the deployment and then re-reads the
 * stacks to see what happened, which is the only version of the truth AWS keeps.
 *
 * Runs live in this module's memory: the console is a local tool for one checkout, and
 * a deploy's transcript surviving the console's own restart would be a feature nobody
 * asked for and one more thing to store.
 */
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import type { Run, RunAction, Stage } from '@/lib/types';
import { stripAnsi } from './output';
import { cdkBin, childEnv, paths } from './repo';
import { sharedState } from './shared';

/**
 * The runs, held on `globalThis` rather than in this module.
 *
 * Every route is its own bundle, so a module-level Map would be a different Map in the
 * route that starts a run and the route that reports on it. See `shared.ts`.
 */
const runs = sharedState().runs as Map<string, Run>;
const MAX_LINES = 1500;

/** The `cdk` arguments one action means. */
function argsFor(action: RunAction, stage: Stage): string[] {
  const base = ['--context', `stage=${stage}`, '--require-approval', 'never'];
  switch (action) {
    case 'synth':
      return ['synth', ...base];
    case 'diff':
      return ['diff', '--all', ...base];
    case 'deploy':
      return ['deploy', '--all', ...base];
    case 'destroy':
      return ['destroy', '--all', ...base];
  }
}

/** The command as a shell would show it, for the transcript's header. */
function display(action: RunAction, stage: Stage): string {
  return `cd infra && npx cdk ${argsFor(action, stage).join(' ')}`;
}

export function startRun(action: RunAction, stage: Stage): Run {
  // One deploy at a time, per stage: two `cdk deploy`s against the same stacks would
  // take each other's lock and the second would fail with a message about a stack
  // being in progress, which is a worse way to learn this.
  for (const run of runs.values()) {
    if (run.stage === stage && run.status === 'running') {
      throw new Error(`A ${run.action} is already running for ${stage}`);
    }
  }

  const run: Run = {
    id: randomUUID(),
    action,
    stage,
    status: 'running',
    startedAt: Date.now(),
    endedAt: null,
    lines: [`$ ${display(action, stage)}`, ''],
    command: display(action, stage),
  };
  runs.set(run.id, run);

  const child = spawn('npx', ['--no-install', 'cdk', ...argsFor(action, stage)], {
    cwd: paths.infra,
    env: childEnv(),
  });

  const push = (chunk: Buffer) => {
    for (const raw of chunk.toString('utf8').split(/\r?\n/)) {
      // CloudFormation prints its progress as carriage-returned rewrites of one line;
      // after the split above they are separate lines, and blank ones are noise.
      const line = stripAnsi(raw).trimEnd();
      if (!line.trim()) continue;
      run.lines.push(line);
    }
    if (run.lines.length > MAX_LINES) run.lines.splice(0, run.lines.length - MAX_LINES);
  };

  child.stdout.on('data', push);
  child.stderr.on('data', push);

  child.on('error', (error) => {
    run.lines.push(`Could not start cdk: ${error.message}`);
    run.status = 'failed';
    run.endedAt = Date.now();
  });

  child.on('close', (code) => {
    run.status = code === 0 ? 'succeeded' : 'failed';
    run.endedAt = Date.now();
    run.lines.push('');
    run.lines.push(code === 0 ? '— done —' : `— exited with ${code} —`);
  });

  return run;
}

export function getRun(id: string): Run | undefined {
  return runs.get(id);
}

/** Newest first, for the list under the buttons. */
export function listRuns(): Run[] {
  return [...runs.values()].sort((a, b) => b.startedAt - a.startedAt);
}

export { cdkBin };
