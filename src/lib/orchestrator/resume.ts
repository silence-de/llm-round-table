import type { ResearchSource } from '../search/types';
import type {
  DiscussionResumeSnapshot,
  DiscussionResumeState,
  StructuredAgentReply,
  TaskLedger,
} from './types';
import { DiscussionPhase } from './types';
import { listAgentReplyArtifacts } from '../db/repository';
import { resumeNeedsExternalInput } from './cursor-fsm';
import { deserializeLedger } from './task-ledger';

interface SessionDetailLike {
  session: {
    id: string;
    topic: string;
    status: string;
    moderatorAgentId: string;
    selectedAgentIds?: string;
  };
  messages: Array<{
    role: string;
    phase: string;
    round?: number | null;
    content: string;
    agentId?: string | null;
    displayName?: string | null;
  }>;
  researchRun?: {
    status: string;
    summary: string;
    sources: ResearchSource[];
  } | null;
}

export interface DiscussionResumePlan {
  state: DiscussionResumeState;
  snapshot: DiscussionResumeSnapshot;
  ledger?: TaskLedger | null;
  needsExternalInput?: boolean;
}

export function buildResumePlan(detail: SessionDetailLike): DiscussionResumePlan {
  const participantIds = parseSelectedAgentIds(detail.session.selectedAgentIds).filter(
    (agentId) => agentId !== detail.session.moderatorAgentId
  );
  const orderedMessages = detail.messages.filter((message) => message.content.trim());
  const openingMessages = orderedMessages.filter(
    (message) =>
      message.role === 'moderator' && message.phase === DiscussionPhase.OPENING
  );
  const initialMessages = orderedMessages.filter(
    (message) =>
      message.role === 'agent' && message.phase === DiscussionPhase.INITIAL_RESPONSES
  );
  const analysisMessages = orderedMessages.filter(
    (message) =>
      message.role === 'moderator' && message.phase === DiscussionPhase.ANALYSIS
  );
  const summaryMessages = orderedMessages.filter(
    (message) =>
      message.role === 'moderator' && message.phase === DiscussionPhase.SUMMARY
  );
  const debateMessages = orderedMessages.filter(
    (message) => message.role === 'agent' && message.phase === DiscussionPhase.DEBATE
  );

  if (openingMessages.length === 0) {
    return withSnapshot(
      {
        sourceSessionId: detail.session.id,
        nextPhase: DiscussionPhase.OPENING,
        nextRound: 0,
        allMessages: [],
        agentResponses: [],
        researchBrief: getStableResearchBrief(detail),
        researchSources: getStableResearchSources(detail),
        researchHandled: hasStableResearch(detail),
        parentContextAddendum: '恢复时从 opening 重新开始，未复用任何不稳定对话。',
      },
      {
        inherited: hasStableResearch(detail) ? ['research'] : [],
        discarded: ['opening', 'initial_responses', 'analysis', 'debate', 'summary'],
        reason: 'source session has no stable opening message.',
      }
    );
  }

  const completeInitialResponseSet = hasAllParticipantMessages(
    participantIds,
    initialMessages
  );
  if (!completeInitialResponseSet) {
    return withSnapshot(
      {
        sourceSessionId: detail.session.id,
        nextPhase: DiscussionPhase.INITIAL_RESPONSES,
        nextRound: 0,
        allMessages: openingMessages.map(toResumeMessage),
        agentResponses: [],
        researchBrief: getStableResearchBrief(detail),
        researchSources: getStableResearchSources(detail),
        researchHandled: hasStableResearch(detail),
        parentContextAddendum:
          '恢复时保留 research 与 opening，但 initial responses 将整段重跑。',
      },
      {
        inherited: ['opening', ...(hasStableResearch(detail) ? ['research'] : [])],
        discarded: ['partial_initial_responses', 'analysis', 'debate', 'summary'],
        reason: 'initial responses are incomplete and must be re-run as a block.',
      }
    );
  }

  if (summaryMessages.length > 0) {
    return withSnapshot(
      {
        sourceSessionId: detail.session.id,
        nextPhase: DiscussionPhase.SUMMARY,
        nextRound: getNextRound(detail),
        allMessages: buildStableMessageHistory(detail, { keepTrailingDebate: true }),
        agentResponses: buildAgentResponses(detail, { keepTrailingDebate: true }),
        researchBrief: getStableResearchBrief(detail),
        researchSources: getStableResearchSources(detail),
        researchHandled: hasStableResearch(detail),
        parentContextAddendum: '恢复时已保留此前稳定讨论，只重新执行 summary。',
      },
      {
        inherited: [
          'opening',
          'initial_responses',
          'analysis',
          'debate',
          ...(hasStableResearch(detail) ? ['research'] : []),
        ],
        discarded: ['summary'],
        reason: 'summary is the final phase and can be safely regenerated.',
      }
    );
  }

  if (analysisMessages.length === 0) {
    return withSnapshot(
      {
        sourceSessionId: detail.session.id,
        nextPhase: DiscussionPhase.ANALYSIS,
        nextRound: 0,
        allMessages: buildStableMessageHistory(detail, { keepTrailingDebate: false }),
        agentResponses: buildAgentResponses(detail, { keepTrailingDebate: false }),
        researchBrief: getStableResearchBrief(detail),
        researchSources: getStableResearchSources(detail),
        researchHandled: hasStableResearch(detail),
        parentContextAddendum:
          '恢复时保留 opening 与 initial responses，从 analysis 开始继续。',
      },
      {
        inherited: [
          'opening',
          'initial_responses',
          ...(hasStableResearch(detail) ? ['research'] : []),
        ],
        discarded: ['analysis', 'debate', 'summary'],
        reason: 'analysis was not completed in source session.',
      }
    );
  }

  const hasTrailingDebate = debateMessages.length > 0;
  const keepTrailingDebate = false;
  const nextRound = hasTrailingDebate
    ? Math.max(0, getHighestRound(debateMessages))
    : Math.max(0, getHighestRound(analysisMessages));

  return withSnapshot(
    {
      sourceSessionId: detail.session.id,
      nextPhase: DiscussionPhase.ANALYSIS,
      nextRound,
      allMessages: buildStableMessageHistory(detail, { keepTrailingDebate }),
      agentResponses: buildAgentResponses(detail, { keepTrailingDebate }),
      researchBrief: getStableResearchBrief(detail),
      researchSources: getStableResearchSources(detail),
      researchHandled: hasStableResearch(detail),
      parentContextAddendum:
        '恢复时会丢弃最后一个未确认完成的 phase，并从最近稳定边界继续。',
    },
    {
      inherited: [
        'opening',
        'initial_responses',
        ...(hasStableResearch(detail) ? ['research'] : []),
      ],
      discarded: hasTrailingDebate
        ? [`debate_round_${nextRound}`, 'summary']
        : ['analysis', 'summary'],
      reason:
        'last active phase is treated as unstable and replayed from the nearest stable boundary.',
    }
  );
}

export function buildResumeState(detail: SessionDetailLike): DiscussionResumeState {
  return buildResumePlan(detail).state;
}

export function buildResumeSnapshot(detail: SessionDetailLike) {
  return buildResumePlan(detail).snapshot;
}

/**
 * 用 ledger checkpoint 数据丰富 resume plan
 * 如果 ledger 的 cursor.waitingOn === 'human_input'，标记 needsExternalInput
 */
export function enrichResumePlanWithLedger(
  plan: DiscussionResumePlan,
  ledgerJson: string | null | undefined
): DiscussionResumePlan {
  if (!ledgerJson) return plan;
  const ledger = deserializeLedger(ledgerJson);
  if (!ledger) return plan;
  return {
    ...plan,
    ledger,
    needsExternalInput: resumeNeedsExternalInput(ledger.cursor),
  };
}

function withSnapshot(
  state: DiscussionResumeState,
  summary: {
    inherited: string[];
    discarded: string[];
    reason: string;
  }
): DiscussionResumePlan {
  return {
    state,
    snapshot: {
      sourceSessionId: state.sourceSessionId,
      nextPhase: state.nextPhase,
      nextRound: state.nextRound,
      inherited: summary.inherited,
      discarded: summary.discarded,
      reason: summary.reason,
    },
    ledger: null,
    needsExternalInput: false,
  };
}

function buildStableMessageHistory(
  detail: SessionDetailLike,
  options: { keepTrailingDebate: boolean }
) {
  const cutOffRound = options.keepTrailingDebate
    ? null
    : getTrailingDebateRound(detail.messages);

  return detail.messages
    .filter((message) => message.content.trim())
    .filter((message) => {
      if (
        !options.keepTrailingDebate &&
        cutOffRound !== null &&
        message.phase === DiscussionPhase.DEBATE &&
        (message.round ?? 0) === cutOffRound
      ) {
        return false;
      }
      if (message.phase === DiscussionPhase.SUMMARY) {
        return options.keepTrailingDebate;
      }
      return true;
    })
    .map(toResumeMessage);
}

function buildAgentResponses(
  detail: SessionDetailLike,
  options: { keepTrailingDebate: boolean }
) {
  const cutOffRound = options.keepTrailingDebate
    ? null
    : getTrailingDebateRound(detail.messages);
  const responses = new Map<
    string,
    { agentId: string; displayName: string; content: string; structured?: StructuredAgentReply }
  >();

  for (const message of detail.messages) {
    if (message.role !== 'agent' || !message.content.trim() || !message.agentId) continue;
    if (
      !options.keepTrailingDebate &&
      cutOffRound !== null &&
      message.phase === DiscussionPhase.DEBATE &&
      (message.round ?? 0) === cutOffRound
    ) {
      continue;
    }

    const existing = responses.get(message.agentId);
    if (!existing) {
      responses.set(message.agentId, {
        agentId: message.agentId,
        displayName: message.displayName ?? message.agentId,
        content: message.content,
      });
      continue;
    }

    if (message.phase === DiscussionPhase.DEBATE) {
      existing.content += `\n\n[辩论轮次] ${message.content}`;
    } else {
      existing.content = message.content;
    }
  }

  return Array.from(responses.values());
}

/**
 * Enrich agent responses with structured data from persisted artifacts.
 * Falls back gracefully if no artifacts exist (backward compat).
 */
export async function enrichAgentResponsesFromArtifacts(
  sessionId: string,
  responses: Array<{ agentId: string; displayName: string; content: string; structured?: StructuredAgentReply }>
): Promise<typeof responses> {
  try {
    const artifacts = await listAgentReplyArtifacts(sessionId);
    if (artifacts.length === 0) return responses;

    const artifactMap = new Map(
      artifacts.map((a) => [a.agentId, a])
    );

    return responses.map((r) => {
      if (r.structured) return r; // already has structured data
      const artifact = artifactMap.get(r.agentId);
      if (!artifact || !artifact.parseSuccess) return r;
      try {
        const structured = JSON.parse(artifact.artifactJson) as StructuredAgentReply;
        return { ...r, structured };
      } catch {
        return r;
      }
    });
  } catch {
    // DB not available or table missing — degrade silently
    return responses;
  }
}

function getStableResearchBrief(detail: SessionDetailLike) {
  return detail.researchRun &&
    ['completed', 'partial', 'skipped'].includes(detail.researchRun.status)
    ? detail.researchRun.summary
    : '';
}

function getStableResearchSources(detail: SessionDetailLike) {
  return detail.researchRun && ['completed', 'partial'].includes(detail.researchRun.status)
    ? detail.researchRun.sources
    : [];
}

function hasStableResearch(detail: SessionDetailLike) {
  return Boolean(
    detail.researchRun &&
      ['completed', 'partial', 'skipped'].includes(detail.researchRun.status)
  );
}

function hasAllParticipantMessages(
  participantIds: string[],
  messages: SessionDetailLike['messages']
) {
  const seen = new Set(
    messages
      .map((message) => (message.role === 'agent' ? message.agentId : null))
      .filter((value): value is string => Boolean(value))
  );

  return participantIds.every((agentId) => seen.has(agentId));
}

function parseSelectedAgentIds(value?: string) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    return [];
  }
}

function toResumeMessage(message: SessionDetailLike['messages'][number]) {
  return {
    agentId: message.agentId ?? message.role,
    displayName: message.displayName ?? message.agentId ?? message.role,
    content: message.content,
    phase: message.phase,
  };
}

function getTrailingDebateRound(messages: SessionDetailLike['messages']) {
  const debateRounds = messages
    .filter((message) => message.phase === DiscussionPhase.DEBATE)
    .map((message) => message.round ?? 0);
  return debateRounds.length > 0 ? Math.max(...debateRounds) : null;
}

function getHighestRound(messages: SessionDetailLike['messages']) {
  const rounds = messages.map((message) => message.round ?? 0);
  return rounds.length > 0 ? Math.max(...rounds) : 0;
}

function getNextRound(detail: SessionDetailLike) {
  const analysisRounds = detail.messages
    .filter((message) => message.phase === DiscussionPhase.ANALYSIS)
    .map((message) => message.round ?? 0);
  return analysisRounds.length > 0 ? Math.max(...analysisRounds) + 1 : 0;
}
