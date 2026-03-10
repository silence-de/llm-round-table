import { NextResponse } from 'next/server';
import {
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
    return NextResponse.json({ error: 'not found' }, { status: 404 });
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
    return NextResponse.json(
      { error: 'research is disabled for this session' },
      { status: 400 }
    );
  }

  try {
    await upsertResearchRun(id, {
      status: 'running',
      queryPlan: [],
      searchConfig: config,
      summary: '',
      evaluation: null,
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
      },
    });

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'research rerun failed',
      },
      { status: 502 }
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
