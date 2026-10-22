import { NextResponse } from 'next/server';
import { isStage } from '@/lib/types';
import { readStage } from '@/server/plan';

/** One stage in full: its stacks, its env, what a deploy would run into. */
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: { stage: string } }) {
  if (!isStage(params.stage)) {
    return NextResponse.json({ error: 'Unknown stage' }, { status: 404 });
  }
  return NextResponse.json(await readStage(params.stage));
}
