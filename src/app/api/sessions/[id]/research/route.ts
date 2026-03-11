import { apiError } from '@/lib/api/errors';
import { NextResponse } from 'next/server';
import {
  appendSessionEvent,
  getSessionDetail,
  getSessionResearch,
  replaceResearchSources,
  upsertResearchRun,
} from '@/lib/db/repository';
import { conductResearch } from '@/lib/search/research';
import { normalizeResearchConfig } from '@/lib/search/utils';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const detail = await getSessionDetail(id);
  if (!detail) {
    return apiError(404, 'NOT_FOUND', 'not found');
  }

  const body = (await req.json().catch(() => ({}))) as {
    researchConfig?: unknown;
  };
  const fallbackConfig = detail.researchRun?.searchConfig
    ? detail.researchRun.searchConfig
    : safeParseJson(detail.session.researchConfig);
  const config = normalizeResearchConfig(
    (body.researchConfig as Record<string, unknown> | undefined) ?? fallbackConfig
  );

  if (!config.enabled) {
    return apiError(
      400,
      'INVALID_INPUT',
      'research is disabled for this session'
    );
  }

  const rerunCount = detail.researchRun?.rerunCount ?? 0;
  if (rerunCount >= config.maxReruns) {
    return apiError(
      429,
      'RATE_LIMITED',
      `research rerun limit reached (${config.maxReruns})`,
      { maxReruns: config.maxReruns, rerunCount }
    );
  }

  try {
    await upsertResearchRun(id, {
      status: 'running',
      queryPlan: [],
      searchConfig: config,
      summary: '',
      evaluation: null,
      incrementRerunCount: true,
    });

    const result = await conductResearch({
      brief: {
        topic: detail.session.topic,
        goal: detail.session.goal,
        background: detail.session.background,
        constraints: detail.session.constraints,
        decisionType: detail.session.decisionType as
          | 'general'
          | 'investment'
          | 'product'
          | 'career'
          | 'life'
          | 'risk',
        desiredOutput: detail.session.desiredOutput as
          | 'recommendation'
          | 'comparison'
          | 'risk_assessment'
          | 'action_plan'
          | 'consensus',
        templateId: detail.session.templateId ?? null,
      },
      config,
    });

    const runId = await upsertResearchRun(id, {
      status: result.status,
      queryPlan: result.queryPlan,
      searchConfig: result.searchConfig,
      summary: result.summary,
      evaluation: result.evaluation,
    });
    await replaceResearchSources(runId, result.sources);
    if (result.status === 'partial' || result.status === 'failed') {
      await appendSessionEvent(id, {
        type: 'provider_error',
        phase: 'research',
        message:
          result.status === 'partial'
            ? 'research rerun partially completed'
            : 'research rerun failed',
        metadata: {
          status: result.status,
          queryPlanLength: result.queryPlan.length,
          sourceCount: result.sources.length,
        },
      });
    }

    const refreshed = await getSessionResearch(id);
    return NextResponse.json(refreshed);
  } catch (error) {
    await upsertResearchRun(id, {
      status: 'failed',
      queryPlan: [],
      searchConfig: config,
      summary: '',
      evaluation: {
        coverageScore: 0,
        recencyScore: 0,
        diversityScore: 0,
        overallConfidence: 0,
        gaps: [
          error instanceof Error
            ? error.message
            : 'research rerun failed',
        ],
        staleFlags: ['no_sources'],
      },
    });
    await appendSessionEvent(id, {
      type: 'provider_error',
      phase: 'research',
      message: error instanceof Error ? error.message : 'research rerun failed',
      metadata: { status: 'failed' },
    });

    return apiError(
      502,
      'PROVIDER_UNAVAILABLE',
      error instanceof Error ? error.message : 'research rerun failed'
    );
  }
}

function safeParseJson(value?: string | null) {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}
