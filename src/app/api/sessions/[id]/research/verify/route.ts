import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api/errors';
import {
  appendSessionEvent,
  appendVerifiedResearchSource,
  getSessionDetail,
} from '@/lib/db/repository';
import { verifyWebPageSource } from '@/lib/search/browser-verify';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    url?: string;
    profileId?: string;
    claimHint?: string;
    note?: string;
  };
  if (!body.url?.trim()) {
    return apiError(400, 'INVALID_INPUT', 'verification url required');
  }

  const detail = await getSessionDetail(id);
  if (!detail) {
    return apiError(404, 'NOT_FOUND', 'session not found');
  }

  try {
    const source = await verifyWebPageSource({
      sessionId: id,
      url: body.url,
      profileId: body.profileId,
      claimHint: body.claimHint,
      note: body.note,
    });
    const researchRun = await appendVerifiedResearchSource(id, source);
    await appendSessionEvent(id, {
      type: 'browser_verification',
      phase: 'research',
      agentId: 'browser_verification',
      message: `captured ${source.url}`,
      metadata: {
        sourceType: 'browser_verification',
        sourceId: source.id,
        verificationProfile: source.verificationProfile,
        snapshotPath: source.snapshotPath,
        capturedAt: source.capturedAt,
        extractedSignalCount: source.verifiedFields?.length ?? 0,
        extractionMethod: source.extractionMethod,
        extractionQuality: source.extractionQuality,
      },
    });
    return NextResponse.json(researchRun);
  } catch (error) {
    return apiError(
      502,
      'INTERNAL_ERROR',
      error instanceof Error ? error.message : 'browser verification failed'
    );
  }
}
