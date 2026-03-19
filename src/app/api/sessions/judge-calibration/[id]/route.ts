import { NextResponse } from 'next/server';
import { recordJudgeHumanReview } from '@/lib/db/repository';

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const body = await req.json() as {
    humanReviewResult: 'PASS' | 'FAIL';
    humanReviewerId: string;
    agreement: boolean;
  };

  if (!body.humanReviewResult || !body.humanReviewerId) {
    return NextResponse.json({ error: 'humanReviewResult and humanReviewerId are required' }, { status: 400 });
  }

  await recordJudgeHumanReview({
    judgeEvaluationId: params.id,
    humanReviewResult: body.humanReviewResult,
    humanReviewerId: body.humanReviewerId,
    agreement: body.agreement ?? false,
  });

  return NextResponse.json({ ok: true });
}
