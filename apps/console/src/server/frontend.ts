/**
 * The app's dev server, started by the console for a stage.
 *
 * "Start the frontend against dev" is three things that are easy to get subtly wrong
 * by hand: the right stage's values, the right port, and a process you can stop. So it
 * is one button here — the console writes `apps/web/.env.local` from the stage, spawns
 * `next dev` with those values in its environment as well, and keeps the process so the
 * next press can stop it.
 *
 * The process belongs to the console: it is killed when the console exits
 * (`stopOnExit`), because a dev server nobody can find is how a stale build gets
 * blamed on a deploy.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import type { FrontendState, Stage } from '@/lib/types';
import { childEnv, paths } from './repo';
import { sharedState } from './shared';

const PORT = 3100;
const MAX_LOG = 200;

interface Managed {
  child: ChildProcess | null;
  state: FrontendState;
}

/**
 * The process and its state, held on `globalThis` so every route bundle sees the same
 * one — see `shared.ts` for why a module-level object is not enough here.
 */
const box = sharedState().frontend as { managed?: Managed };
const managed: Managed = (box.managed ??= {
  child: null,
  state: { status: 'stopped', stage: null, url: `http://localhost:${PORT}`, startedAt: null, log: [] },
});

function log(line: string): void {
  for (const part of line.split(/\r?\n/)) {
    if (!part.trim()) continue;
    managed.state.log.push(part);
  }
  if (managed.state.log.length > MAX_LOG) {
    managed.state.log.splice(0, managed.state.log.length - MAX_LOG);
  }
}

export function frontendState(): FrontendState {
  return managed.state;
}

/** Stops whatever is running. Safe to call when nothing is. */
export function stopFrontend(): FrontendState {
  const child = managed.child;
  if (child && child.exitCode === null) {
    // SIGTERM first: `next dev` cleans up its own children (the compiler) on it, and a
    // SIGKILL would leave the port held for a moment.
    child.kill('SIGTERM');
    const pid = child.pid;
    setTimeout(() => {
      try {
        if (pid) process.kill(pid, 'SIGKILL');
      } catch {
        // Already gone.
      }
    }, 4000).unref?.();
  }
  managed.child = null;
  managed.state = {
    status: 'stopped',
    stage: null,
    url: `http://localhost:${PORT}`,
    startedAt: null,
    log: managed.state.log.slice(-40),
  };
  return managed.state;
}

/**
 * Starts it against one stage.
 *
 * The env values are passed to the process *and* written to `.env.local`: Next reads
 * both, and having them in the file is what makes "what is this app pointed at" a
 * question with a readable answer on disk.
 */
export function startFrontend(
  stage: Stage,
  values: { name: string; value: string | null }[],
): FrontendState {
  stopFrontend();

  const env: Record<string, string> = {};
  for (const entry of values) {
    if (entry.value !== null) env[entry.name] = entry.value;
  }

  managed.state = {
    status: 'starting',
    stage,
    url: `http://localhost:${PORT}`,
    startedAt: Date.now(),
    log: [`Starting the app against ${stage}…`],
  };

  const child = spawn('npm', ['run', 'dev', '--workspace', 'foto-web'], {
    cwd: paths.root,
    env: childEnv(env),
    // A process group of its own, so stopping the console stops Next's children too.
    detached: false,
  });

  managed.child = child;
  child.stdout?.on('data', (chunk: Buffer) => log(chunk.toString('utf8')));
  child.stderr?.on('data', (chunk: Buffer) => log(chunk.toString('utf8')));

  let settled = false;
  child.on('error', (error) => {
    settled = true;
    log(`Could not start the app: ${error.message}`);
    if (managed.child === child) managed.state.status = 'failed';
  });

  child.on('exit', (code) => {
    if (managed.child !== child) return;
    managed.child = null;
    if (!settled && managed.state.status !== 'stopped') {
      managed.state.status = code === 0 ? 'stopped' : 'failed';
      log(code === 0 ? 'The app stopped.' : `The app exited with ${code}.`);
    }
  });

  // Readiness is the line Next prints, not a guess from a timer.
  const watch = (chunk: Buffer) => {
    if (/Ready in|started server/i.test(chunk.toString('utf8')) && managed.child === child) {
      managed.state.status = 'running';
      log(`Ready at http://localhost:${PORT}`);
    }
  };
  child.stdout?.on('data', watch);

  return managed.state;
}

/** What is on the other end of the port, asked directly. */
export async function probeFrontend(): Promise<boolean> {
  try {
    const response = await fetch(`http://localhost:${PORT}/`, { cache: 'no-store' });
    return response.ok;
  } catch {
    return false;
  }
}

/** Kills the dev server when the console itself goes away. */
export function stopOnExit(): void {
  for (const signal of ['SIGINT', 'SIGTERM', 'exit'] as const) {
    process.on(signal, () => {
      if (managed.child && managed.child.exitCode === null) managed.child.kill('SIGKILL');
      if (signal !== 'exit') process.exit(0);
    });
  }
}

stopOnExit();
