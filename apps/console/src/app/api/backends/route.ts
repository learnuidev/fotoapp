import { NextResponse } from 'next/server';
import { STAGES } from '@/lib/types';
import { readStageSummaries } from '@/server/plan';

/** Every stage, with its four stacks. */
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ stages: await readStageSummaries([...STAGES]) });
}
