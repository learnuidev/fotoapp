import { NextResponse } from 'next/server';
import { getRun, listRuns } from '@/server/runs';

/**
 * A run's transcript so far — `GET ?id=<run>&from=<line>`.
 *
 * Polled rather than streamed: the console is a local page watching a local process,
 * and a poll every half second is a hundred fewer moving parts than an event stream,
 * with the same result on screen.
 */
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get('id');

  if (!id) {
    return NextResponse.json({
      runs: listRuns().map((run) => ({
        id: run.id,
        action: run.action,
        stage: run.stage,
        status: run.status,
        startedAt: run.startedAt,
        endedAt: run.endedAt,
      })),
    });
  }

  const run = getRun(id);
  if (!run) return NextResponse.json({ error: 'No such run' }, { status: 404 });

  const from = Math.max(0, Number(url.searchParams.get('from') ?? 0));
  return NextResponse.json({
    id: run.id,
    action: run.action,
    stage: run.stage,
    status: run.status,
    startedAt: run.startedAt,
    endedAt: run.endedAt,
    from,
    lines: run.lines.slice(from),
    next: run.lines.length,
  });
}
