import { NextResponse } from 'next/server';
import { getOperationalSummary } from '@/lib/db/repository';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limitRaw = Number(url.searchParams.get('limit'));
  const limit = Number.isFinite(limitRaw) ? limitRaw : 20;
  const summary = await getOperationalSummary(limit);
  return NextResponse.json(summary);
}
