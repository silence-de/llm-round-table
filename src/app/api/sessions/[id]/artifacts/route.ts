import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api/errors';
import { getSessionDetail } from '@/lib/db/repository';
import {
  buildDecisionDossierMarkdown,
  buildDecisionSummaryMarkdown,
  buildExecutionChecklistMarkdown,
  buildTranscriptMarkdown,
} from '@/lib/session-artifacts';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const detail = await getSessionDetail(id);
  if (!detail) {
    return apiError(404, 'NOT_FOUND', 'session not found');
  }

  return NextResponse.json({
    transcriptMarkdown: buildTranscriptMarkdown({
      topic: detail.session.topic,
      status: detail.session.status,
      messages: detail.messages.map((message) => ({
        role: message.role,
        phase: message.phase,
        content: message.content,
        displayName: message.displayName ?? message.agentId ?? message.role,
        createdAt:
          message.createdAt instanceof Date
            ? message.createdAt.getTime()
            : message.createdAt,
      })),
    }),
    decisionCardMarkdown: detail.decisionSummary
      ? buildDecisionSummaryMarkdown({
          topic: detail.session.topic,
          status: detail.session.decisionStatus,
          decisionSummary: detail.decisionSummary,
        })
      : '',
    dossierMarkdown: detail.decisionSummary
      ? buildDecisionDossierMarkdown({
          topic: detail.session.topic,
          status: detail.session.decisionStatus,
          brief: {
            goal: detail.session.goal,
            constraints: detail.session.constraints,
            timeHorizon: detail.session.timeHorizon,
            nonNegotiables: detail.session.nonNegotiables,
            acceptableDownside: detail.session.acceptableDownside,
            reviewAt: detail.session.reviewAt ?? '',
          },
          decisionSummary: detail.decisionSummary,
          actionItems: detail.actionItems,
          researchEvaluation: detail.researchRun?.evaluation ?? null,
          parentReviewComparison: detail.parentReviewComparison ?? null,
          review: {
            outcomeSummary: detail.session.outcomeSummary ?? '',
            actualOutcome: detail.session.actualOutcome ?? '',
            outcomeConfidence: detail.session.outcomeConfidence ?? 0,
            retrospectiveNote: detail.session.retrospectiveNote ?? '',
          },
        })
      : '',
    checklistMarkdown: buildExecutionChecklistMarkdown({
      topic: detail.session.topic,
      status: detail.session.decisionStatus,
      actionItems: detail.actionItems,
    }),
  });
}
