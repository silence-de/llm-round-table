import { NextResponse } from 'next/server';
import { listSessions } from '@/lib/db/repository';

export async function GET() {
  const sessions = await listSessions();
  return NextResponse.json(sessions);
}
