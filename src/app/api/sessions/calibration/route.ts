import { NextResponse } from 'next/server';
import { getCalibrationDashboard } from '@/lib/db/repository';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const window = url.searchParams.get('window');
  const decisionType = url.searchParams.get('decisionType');
  const templateId = url.searchParams.get('templateId');

  const summary = await getCalibrationDashboard({
    window:
      window === '30d' || window === '90d' || window === '180d' || window === 'all'
        ? window
        : '90d',
    decisionType: decisionType?.trim() || null,
    templateId: templateId?.trim() || null,
  });

  return NextResponse.json(summary);
}
