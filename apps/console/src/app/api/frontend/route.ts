import { NextResponse } from 'next/server';
import { isStage } from '@/lib/types';
import { frontendState, probeFrontend, startFrontend, stopFrontend } from '@/server/frontend';
import { envFor } from '@/server/plan';
import { writeWebEnv } from '@/server/env-file';

/**
 * The app's dev server — `GET` its state, `POST { action: 'start' | 'stop', stage }`.
 *
 * Starting it also writes `apps/web/.env.local`, because the two are the same act: the
 * app is only "pointed at dev" if both the process and the file say so.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  const state = frontendState();
  return NextResponse.json({ ...state, responding: await probeFrontend() });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { action?: string; stage?: string };

  if (body.action === 'stop') {
    return NextResponse.json(stopFrontend());
  }

  if (!isStage(body.stage)) {
    return NextResponse.json({ error: 'Pick a stage to start the app against' }, { status: 400 });
  }

  const values = await envFor(body.stage);
  const missing = values.filter((entry) => entry.value === null);
  if (missing.length > 0) {
    return NextResponse.json(
      {
        error: `${body.stage} is not deployed far enough to point the app at it: ${missing
          .map((entry) => entry.name)
          .join(', ')} missing`,
      },
      { status: 409 },
    );
  }

  const envPath = writeWebEnv(body.stage, values);
  const state = startFrontend(body.stage, values);
  return NextResponse.json({ ...state, envPath }, { status: 202 });
}
