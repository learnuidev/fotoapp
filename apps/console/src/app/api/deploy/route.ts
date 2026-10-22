import { NextResponse } from 'next/server';
import { isStage, type RunAction } from '@/lib/types';
import { startRun } from '@/server/runs';

/**
 * Starts a `cdk` run — `POST { stage, action }`.
 *
 * The answer is the run, not its output: the transcript is read through
 * `/api/deploy/run` while it happens, because a deploy takes minutes and a request
 * that waited for it would be a request that timed out.
 */
export const dynamic = 'force-dynamic';

const ACTIONS: RunAction[] = ['synth', 'diff', 'deploy', 'destroy'];

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { stage?: string; action?: string };
  if (!isStage(body.stage)) {
    return NextResponse.json({ error: 'Unknown stage' }, { status: 400 });
  }
  if (!ACTIONS.includes(body.action as RunAction)) {
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }

  try {
    const run = startRun(body.action as RunAction, body.stage);
    return NextResponse.json({ run }, { status: 202 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not start that run' },
      { status: 409 },
    );
  }
}
