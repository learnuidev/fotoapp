import { NextResponse } from 'next/server';
import { readIdentity } from '@/server/aws';

/** Who the console is acting as, for the header and the AWS page. */
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(await readIdentity());
}
