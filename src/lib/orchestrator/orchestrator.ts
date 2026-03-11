import type { SSEEvent } from '../sse/types';
import type {
  DiscussionConfig,
  AgentResponse,
  DiscussionResumeState,
  ModeratorAnalysis,
  PersistableMessage,
} from './types';
import { DiscussionPhase } from './types';
import { getProvider } from '../llm/provider-registry';
import { getModelId } from '../agents/registry';
import type { ProviderType, SessionAgent } from '../agents/types';
import type { StreamChunk } from '../llm/types';
import { multiplexStreams } from './stream-multiplexer';
import {
  buildOpeningPrompt,
  buildAgentSystemPrompt,
  buildAnalysisPrompt,
  buildDebatePrompt,
  buildDecisionSummaryPrompt,
  buildSummaryPrompt,
  parseDecisionSummaryContent,
  parseAnalysis,
} from './moderator';
import { conductResearch } from '../search/research';
import type { ResearchRunStatus, ResearchSource } from '../search/types';
import { formatControlInstruction } from '../decision/utils';

interface StreamTimeoutConfig {
  requestTimeoutMs: number;
  startupTimeoutMs: number;
  idleTimeoutMs: number;
}

interface ScheduledAgentStream {
  agentId: string;
  provider: ProviderType;
  modelId: string;
  phase: DiscussionPhase;
  stream: AsyncIterable<StreamChunk>;
  startupTimeoutMs: number;
  idleTimeoutMs: number;
}

export class DiscussionOrchestrator {
  private config: DiscussionConfig;
  private agentResponses: Map<string, AgentResponse> = new Map();
  private allMessages: Array<{
    agentId: string;
    displayName: string;
    content: string;
    phase: string;
  }> = [];
  private lastAnalysis: ModeratorAnalysis | null = null;
  private interjectionContext: string[] = [];
  private stopState = { checkedAt: 0, value: false };
  private researchBrief: string | null = null;
  private researchSources: ResearchSource[] = [];
  private agentTimeoutCount: Map<string, number> = new Map();
  private degradedAgentIds: Set<string> = new Set();
  private degradedThreshold = Math.max(
    1,
    Number(process.env.ROUND_TABLE_AGENT_DEGRADE_TIMEOUT_THRESHOLD ?? 2)
  );

  constructor(config: DiscussionConfig) {
    this.config = config;
    this.seedResumeState(config.resumeState);
  }

  async *run(): AsyncIterable<SSEEvent> {
    if (await this.shouldStop()) {
      yield* this.emitStopped();
      return;
    }

    const resume = this.config.resumeState;

    if (!resume) {
      // Phase 0: Web Research (skipped gracefully if TAVILY_API_KEY not set)
      yield* this.phaseResearch();
      if (await this.shouldStop()) {
        yield* this.emitStopped();
        return;
      }

      // Phase 1: Opening
      yield* this.phaseOpening();
      if (await this.shouldStop()) {
        yield* this.emitStopped();
        return;
      }

      // Phase 2: Initial Responses (parallel)
      yield* this.phaseInitialResponses();
      if (await this.shouldStop()) {
        yield* this.emitStopped();
        return;
      }
    } else {
      if (
        resume.nextPhase === DiscussionPhase.OPENING ||
        resume.nextPhase === DiscussionPhase.INITIAL_RESPONSES
      ) {
        if (
          !resume.researchHandled &&
          this.config.agenda.requireResearch &&
          this.config.researchConfig.enabled
        ) {
          yield* this.phaseResearch();
          if (await this.shouldStop()) {
            yield* this.emitStopped();
            return;
          }
        }

        if (resume.nextPhase === DiscussionPhase.OPENING) {
          yield* this.phaseOpening();
          if (await this.shouldStop()) {
            yield* this.emitStopped();
            return;
          }
        }

        yield* this.phaseInitialResponses();
        if (await this.shouldStop()) {
          yield* this.emitStopped();
          return;
        }
      }
    }

    const startRound =
      resume?.nextPhase === DiscussionPhase.ANALYSIS ||
      resume?.nextPhase === DiscussionPhase.SUMMARY
        ? resume.nextRound
        : 0;

    // Phase 3+4: Analysis and Debate loop
    for (let round = startRound; round < this.config.maxDebateRounds; round++) {
      if (await this.shouldStop()) {
        yield* this.emitStopped();
        return;
      }
      if (resume?.nextPhase === DiscussionPhase.SUMMARY) {
        break;
      }
      yield* this.consumeInterjections(DiscussionPhase.ANALYSIS, round);
      if (await this.shouldStop()) {
        yield* this.emitStopped();
        return;
      }
      yield* this.phaseAnalysis(round);

      if (!this.lastAnalysis || this.lastAnalysis.shouldConverge) break;

      if (this.lastAnalysis.disagreements.length > 0) {
        if (await this.shouldStop()) {
          yield* this.emitStopped();
          return;
        }
        yield* this.consumeInterjections(DiscussionPhase.DEBATE, round);
        if (await this.shouldStop()) {
          yield* this.emitStopped();
          return;
        }
        yield* this.phaseDebate(round);
      } else {
        break;
      }
    }

    // Phase 5: Summary
    if (await this.shouldStop()) {
      yield* this.emitStopped();
      return;
    }
    yield* this.consumeInterjections(DiscussionPhase.SUMMARY);
    if (await this.shouldStop()) {
      yield* this.emitStopped();
      return;
    }
    yield* this.phaseSummary();
    if (await this.shouldStop()) {
      yield* this.emitStopped();
      return;
    }
    await this.generateDecisionSummary();

    yield {
      type: 'phase_change',
      phase: DiscussionPhase.COMPLETED,
      timestamp: Date.now(),
    };
    yield { type: 'discussion_complete', timestamp: Date.now() };
  }

  private seedResumeState(resumeState?: DiscussionResumeState) {
    if (!resumeState) return;

    this.researchBrief = resumeState.researchBrief ?? null;
    this.researchSources = resumeState.researchSources;
    this.allMessages = [...resumeState.allMessages];
    this.agentResponses = new Map(
      resumeState.agentResponses.map((response) => [response.agentId, response])
    );
  }

  private async *consumeInterjections(
    phase: string,
    round?: number
  ): AsyncIterable<SSEEvent> {
    const queue = this.config.drainInterjections
      ? await this.config.drainInterjections({ phase, round })
      : [];

    for (const interjection of queue) {
      const normalizedContent = formatControlInstruction(
        interjection.controlType,
        interjection.content
      );
      this.interjectionContext.push(normalizedContent);
      this.allMessages.push({
        agentId: 'user',
        displayName: 'User',
        content: normalizedContent,
        phase,
      });

      yield {
        type: 'user_interjection',
        agentId: 'user',
        phase,
        round,
        content: normalizedContent,
        timestamp: Date.now(),
      };
    }
  }

  private async *emitStopped(): AsyncIterable<SSEEvent> {
    yield {
      type: 'phase_change',
      phase: DiscussionPhase.COMPLETED,
      timestamp: Date.now(),
    };
    yield { type: 'discussion_complete', timestamp: Date.now() };
  }

  private async shouldStop(force = false): Promise<boolean> {
    if (this.stopState.value) return true;
    if (!this.config.shouldStop) return false;

    const now = Date.now();
    if (!force && now - this.stopState.checkedAt < 500) {
      return false;
    }

    this.stopState.checkedAt = now;
    this.stopState.value = Boolean(await this.config.shouldStop());
    return this.stopState.value;
  }

  private async persistMessage(message: PersistableMessage) {
    if (!this.config.onMessagePersist) return;
    await this.config.onMessagePersist(message);
  }

  private async persistUsage(delta: { inputTokens?: number; outputTokens?: number }) {
    if (!this.config.onUsagePersist) return;
    await this.config.onUsagePersist(delta);
  }

  private async persistSessionEvent(event: {
    type: 'timeout' | 'agent_degraded' | 'provider_error';
    provider?: string;
    modelId?: string;
    phase?: string;
    agentId?: string;
    timeoutType?: 'startup' | 'idle' | 'request';
    message?: string;
    metadata?: Record<string, unknown>;
  }) {
    if (!this.config.onSessionEventPersist) return;
    await this.config.onSessionEventPersist(event);
  }

  private getActiveParticipants() {
    return this.config.agents.filter(
      (agent) =>
        agent.definition.id !== this.config.moderatorAgentId &&
        !this.degradedAgentIds.has(agent.definition.id)
    );
  }

  private estimateTokens(text: string): number {
    return Math.max(1, Math.ceil(text.length / 4));
  }

  private getStreamTimeoutConfig(
    agent: SessionAgent,
    phase: string
  ): StreamTimeoutConfig {
    const { provider, id } = agent.definition;
    const isDebate = phase === DiscussionPhase.DEBATE;
    const isSummaryLike =
      phase === DiscussionPhase.SUMMARY || phase === DiscussionPhase.OPENING;

    if (provider === 'siliconflow') {
      if (id === 'qwen') {
        return {
          requestTimeoutMs: isDebate ? 240_000 : 300_000,
          startupTimeoutMs: isDebate ? 180_000 : 240_000,
          idleTimeoutMs: isDebate ? 75_000 : 90_000,
        };
      }

      return {
        requestTimeoutMs: isDebate ? 180_000 : 240_000,
        startupTimeoutMs: isDebate ? 120_000 : 180_000,
        idleTimeoutMs: isDebate ? 60_000 : 75_000,
      };
    }

    if (provider === 'deepseek') {
      return {
        requestTimeoutMs: isDebate ? 120_000 : isSummaryLike ? 150_000 : 135_000,
        startupTimeoutMs: isDebate ? 90_000 : 120_000,
        idleTimeoutMs: isDebate ? 45_000 : 60_000,
      };
    }

    if (provider === 'moonshot') {
      return {
        requestTimeoutMs: isDebate ? 120_000 : isSummaryLike ? 150_000 : 135_000,
        startupTimeoutMs: isDebate ? 90_000 : 120_000,
        idleTimeoutMs: isDebate ? 45_000 : 60_000,
      };
    }

    return {
      requestTimeoutMs: isDebate ? 90_000 : isSummaryLike ? 120_000 : 105_000,
      startupTimeoutMs: isDebate ? 60_000 : 90_000,
      idleTimeoutMs: isDebate ? 45_000 : 60_000,
    };
  }

  private getCompletionTimeoutMs(agent: SessionAgent, phase: string): number {
    const { requestTimeoutMs } = this.getStreamTimeoutConfig(agent, phase);
    return requestTimeoutMs;
  }

  private getProviderBatchLimit(provider: ProviderType): number {
    if (provider === 'siliconflow') {
      return Math.max(
        1,
        Number(
          process.env.ROUND_TABLE_SILICONFLOW_BATCH_SIZE ??
            process.env.SILICONFLOW_MAX_CONCURRENCY ??
            1
        )
      );
    }
    return Number.POSITIVE_INFINITY;
  }

  private async *runScheduledAgentStreams(
    streams: ScheduledAgentStream[]
  ): AsyncIterable<SSEEvent> {
    if (streams.length === 0) return;
    const streamMeta = new Map(
      streams.map((stream) => [
        stream.agentId,
        { provider: stream.provider, modelId: stream.modelId, phase: stream.phase },
      ])
    );

    const directStreams = streams.filter((stream) => stream.provider !== 'siliconflow');
    const siliconflowStreams = streams.filter(
      (stream) => stream.provider === 'siliconflow'
    );
    const siliconflowBatchSize = this.getProviderBatchLimit('siliconflow');
    const siliconflowBatches = chunkBySize(siliconflowStreams, siliconflowBatchSize);

    const firstBatch = [...directStreams, ...(siliconflowBatches.shift() ?? [])];
    if (firstBatch.length > 0) {
      for await (const event of multiplexStreams(firstBatch)) {
        yield* this.handleScheduledStreamEvent(event, streamMeta);
      }
    }

    for (const batch of siliconflowBatches) {
      if (await this.shouldStop()) {
        return;
      }
      for await (const event of multiplexStreams(batch)) {
        yield* this.handleScheduledStreamEvent(event, streamMeta);
      }
    }
  }

  private async *handleScheduledStreamEvent(
    event: SSEEvent,
    streamMeta: Map<string, { provider: ProviderType; modelId: string; phase: DiscussionPhase }>
  ): AsyncIterable<SSEEvent> {
    if (event.type === 'agent_done' && event.agentId) {
      this.agentTimeoutCount.set(event.agentId, 0);
      yield event;
      return;
    }

    if (event.type !== 'agent_error' || !event.agentId) {
      yield event;
      return;
    }

    const meta = streamMeta.get(event.agentId);
    const errorCode = event.meta?.errorCode;
    const timeoutType = normalizeTimeoutType(event.meta?.timeoutType);

    if (timeoutType) {
      const timeoutCount = (this.agentTimeoutCount.get(event.agentId) ?? 0) + 1;
      this.agentTimeoutCount.set(event.agentId, timeoutCount);
      await this.persistSessionEvent({
        type: 'timeout',
        provider: meta?.provider,
        modelId: meta?.modelId,
        phase: meta?.phase,
        agentId: event.agentId,
        timeoutType,
        message: event.content,
        metadata: { errorCode, timeoutCount },
      });

      if (
        timeoutCount >= this.degradedThreshold &&
        !this.degradedAgentIds.has(event.agentId)
      ) {
        this.degradedAgentIds.add(event.agentId);
        await this.persistSessionEvent({
          type: 'agent_degraded',
          provider: meta?.provider,
          modelId: meta?.modelId,
          phase: meta?.phase,
          agentId: event.agentId,
          timeoutType,
          message: `agent degraded after ${timeoutCount} consecutive timeouts`,
          metadata: { timeoutCount },
        });
        yield {
          type: 'agent_degraded',
          agentId: event.agentId,
          content: `Agent degraded after ${timeoutCount} timeouts and will be skipped in later rounds.`,
          timestamp: Date.now(),
        };
      }
    } else if (errorCode === 'provider_error') {
      await this.persistSessionEvent({
        type: 'provider_error',
        provider: meta?.provider,
        modelId: meta?.modelId,
        phase: meta?.phase,
        agentId: event.agentId,
        message: event.content,
        metadata: { errorCode },
      });
    }

    yield event;
  }

  private async *phaseResearch(): AsyncIterable<SSEEvent> {
    if (!this.config.agenda.requireResearch || !this.config.researchConfig.enabled) {
      await this.persistResearchRun({
        status: 'skipped',
        queryPlan: [],
        summary: '',
        evaluation: null,
      });
      yield { type: 'research_start', timestamp: Date.now() };
      yield { type: 'research_complete', content: '', timestamp: Date.now() };
      return;
    }

    // Skip gracefully when TAVILY_API_KEY is not configured
    if (!process.env.TAVILY_API_KEY) {
      await this.persistResearchRun({
        status: 'skipped',
        queryPlan: [],
        summary: '',
        evaluation: null,
      });
      yield { type: 'research_start', timestamp: Date.now() };
      yield { type: 'research_complete', content: '', timestamp: Date.now() };
      return;
    }

    yield {
      type: 'phase_change',
      phase: DiscussionPhase.RESEARCH,
      timestamp: Date.now(),
    };
    yield { type: 'research_start', timestamp: Date.now() };

    try {
      await this.persistResearchRun({
        status: 'running',
        queryPlan: [],
        summary: '',
        evaluation: null,
      });
      const result = await conductResearch({
        brief: this.config.brief,
        config: this.config.researchConfig,
      });
      this.researchBrief = result.summary;
      this.researchSources = result.sources;
      await this.persistResearchRun({
        status: result.status,
        queryPlan: result.queryPlan,
        summary: result.summary,
        evaluation: result.evaluation,
      });
      if (this.config.onResearchSourcesPersist) {
        await this.config.onResearchSourcesPersist(this.config.sessionId, result.sources);
      }

      // Emit sources as JSON-encoded content for the client to display
      yield {
        type: 'research_result',
        content: JSON.stringify(result.sources),
        timestamp: Date.now(),
      };

      if (result.status === 'partial' || result.status === 'failed') {
        await this.persistSessionEvent({
          type: 'provider_error',
          phase: DiscussionPhase.RESEARCH,
          message:
            result.status === 'partial'
              ? 'research finished with partial sources'
              : 'research failed',
          metadata: {
            status: result.status,
            sourceCount: result.sources.length,
            queryPlanLength: result.queryPlan.length,
          },
        });
      }

      if (result.status === 'failed') {
        yield {
          type: 'research_failed',
          content: result.evaluation?.gaps.join('\n') || 'Research failed.',
          timestamp: Date.now(),
        };
        return;
      }

      yield {
        type: 'research_complete',
        content: result.summary,
        meta: { status: result.status },
        timestamp: Date.now(),
      };
    } catch (err) {
      // Non-fatal: log and continue without research
      console.error('[Research] Failed, continuing without research brief:', err);
      await this.persistResearchRun({
        status: 'failed',
        queryPlan: [],
        summary: '',
        evaluation: {
          coverageScore: 0,
          recencyScore: 0,
          diversityScore: 0,
          overallConfidence: 0,
          gaps: [err instanceof Error ? err.message : String(err)],
          staleFlags: ['no_sources'],
        },
      });
      yield {
        type: 'research_failed',
        content: err instanceof Error ? err.message : String(err),
        timestamp: Date.now(),
      };
    }
  }

  private async *phaseOpening(): AsyncIterable<SSEEvent> {
    yield {
      type: 'phase_change',
      phase: DiscussionPhase.OPENING,
      timestamp: Date.now(),
    };

    const moderator = this.config.agents.find(
      (a) => a.definition.id === this.config.moderatorAgentId
    );
    if (!moderator) return;

    const provider = getProvider(moderator.definition.provider);
    const modelId = getModelId(moderator.definition, moderator.selectedModelId);
    const agentNames = this.config.agents
      .filter((a) => a.definition.id !== this.config.moderatorAgentId)
      .map((a) => a.definition.displayName);

    const prompt = buildOpeningPrompt(
      this.config.brief,
      agentNames,
      this.config.agenda,
      this.researchBrief ?? undefined,
      this.config.parentContext
    );
    await this.persistUsage({ inputTokens: this.estimateTokens(prompt) });
    if (await this.shouldStop()) {
      return;
    }

    yield { type: 'moderator_start', agentId: 'moderator', timestamp: Date.now() };
    const timeoutConfig = this.getStreamTimeoutConfig(
      moderator,
      DiscussionPhase.OPENING
    );

    let fullContent = '';
    for await (const chunk of provider.streamChat({
      model: modelId,
      messages: [{ role: 'user', content: prompt }],
      temperature: moderator.definition.defaultTemperature,
      maxTokens: moderator.definition.maxTokens,
      timeoutMs: timeoutConfig.requestTimeoutMs,
    })) {
      if (await this.shouldStop()) {
        break;
      }
      if (chunk.type === 'text_delta') {
        fullContent += chunk.content;
        yield {
          type: 'moderator_token',
          agentId: 'moderator',
          content: chunk.content,
          timestamp: Date.now(),
        };
      } else if (chunk.type === 'error') {
        await this.persistSessionEvent({
          type: chunk.timeoutType ? 'timeout' : 'provider_error',
          provider: moderator.definition.provider,
          modelId,
          phase: DiscussionPhase.OPENING,
          agentId: 'moderator',
          timeoutType: normalizeTimeoutType(chunk.timeoutType),
          message: chunk.content,
          metadata: { errorCode: chunk.errorCode },
        });
        yield {
          type: 'agent_error',
          agentId: 'moderator',
          content: chunk.content,
          timestamp: Date.now(),
        };
        break;
      }
    }

    yield { type: 'moderator_done', agentId: 'moderator', timestamp: Date.now() };

    this.allMessages.push({
      agentId: 'moderator',
      displayName: 'Moderator',
      content: fullContent,
      phase: DiscussionPhase.OPENING,
    });
    await this.persistMessage({
      role: 'moderator',
      agentId: 'moderator',
      displayName: 'Moderator',
      content: fullContent,
      phase: DiscussionPhase.OPENING,
    });
    await this.persistUsage({ outputTokens: this.estimateTokens(fullContent) });
  }

  private async *phaseInitialResponses(): AsyncIterable<SSEEvent> {
    yield {
      type: 'phase_change',
      phase: DiscussionPhase.INITIAL_RESPONSES,
      timestamp: Date.now(),
    };

    const participants = this.getActiveParticipants();
    if (participants.length === 0) {
      yield {
        type: 'agent_error',
        content: 'No active participants available after degradation filtering.',
        timestamp: Date.now(),
      };
      return;
    }
    if (await this.shouldStop()) {
      return;
    }

    const contentCollectors = new Map<string, string>();

    const agentStreams = participants.map((agent) => {
      const provider = getProvider(agent.definition.provider);
      const modelId = getModelId(agent.definition, agent.selectedModelId);
      const systemPrompt = buildAgentSystemPrompt(
        this.config.brief,
        this.config.agenda,
        agent.persona,
        this.interjectionContext,
        this.researchBrief ?? undefined
      );
      const userPrompt = `请就以下议题发表你的观点：「${this.config.topic}」`;
      const timeoutConfig = this.getStreamTimeoutConfig(
        agent,
        DiscussionPhase.INITIAL_RESPONSES
      );

      void this.persistUsage({
        inputTokens:
          this.estimateTokens(systemPrompt) + this.estimateTokens(userPrompt),
      });

      contentCollectors.set(agent.definition.id, '');

      return {
        agentId: agent.definition.id,
        provider: agent.definition.provider,
        modelId,
        phase: DiscussionPhase.INITIAL_RESPONSES,
        startupTimeoutMs: timeoutConfig.startupTimeoutMs,
        idleTimeoutMs: timeoutConfig.idleTimeoutMs,
        stream: provider.streamChat({
          model: modelId,
          messages: [
            {
              role: 'user',
              content: userPrompt,
            },
          ],
          systemPrompt,
          temperature: agent.definition.defaultTemperature,
          maxTokens: agent.definition.maxTokens,
          timeoutMs: timeoutConfig.requestTimeoutMs,
        }),
      };
    });

    for await (const event of this.runScheduledAgentStreams(agentStreams)) {
      if (await this.shouldStop()) {
        break;
      }
      if (event.type === 'agent_token' && event.agentId && event.content) {
        const current = contentCollectors.get(event.agentId) ?? '';
        contentCollectors.set(event.agentId, current + event.content);
      }
      yield event;
    }

    for (const agent of participants) {
      const content = contentCollectors.get(agent.definition.id) ?? '';
      const response: AgentResponse = {
        agentId: agent.definition.id,
        displayName: agent.definition.displayName,
        content,
      };
      this.agentResponses.set(agent.definition.id, response);
      this.allMessages.push({
        ...response,
        phase: DiscussionPhase.INITIAL_RESPONSES,
      });
      await this.persistMessage({
        role: 'agent',
        agentId: agent.definition.id,
        displayName: agent.definition.displayName,
        content,
        phase: DiscussionPhase.INITIAL_RESPONSES,
      });
      if (content) {
        await this.persistUsage({ outputTokens: this.estimateTokens(content) });
      }
    }
  }

  private async *phaseAnalysis(round: number): AsyncIterable<SSEEvent> {
    yield {
      type: 'phase_change',
      phase: DiscussionPhase.ANALYSIS,
      round,
      timestamp: Date.now(),
    };

    const moderator = this.config.agents.find(
      (a) => a.definition.id === this.config.moderatorAgentId
    );
    if (!moderator) {
      this.lastAnalysis = {
        agreements: [],
        disagreements: [],
        shouldConverge: true,
        moderatorNarrative: '',
      };
      return;
    }

    const provider = getProvider(moderator.definition.provider);
    const modelId = getModelId(moderator.definition, moderator.selectedModelId);
    const responses = Array.from(this.agentResponses.values());

    const prompt = buildAnalysisPrompt(
      this.config.brief,
      this.config.agenda,
      responses,
      this.interjectionContext,
      this.config.parentContext
    );
    if (await this.shouldStop()) {
      return;
    }

    yield { type: 'moderator_start', agentId: 'moderator', timestamp: Date.now() };
    const timeoutMs = this.getCompletionTimeoutMs(
      moderator,
      DiscussionPhase.ANALYSIS
    );

    let analysis: ModeratorAnalysis;
    try {
      const result = await provider.chat({
        model: modelId,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        maxTokens: 2000,
        timeoutMs,
      });
      analysis = parseAnalysis(result.content);
      await this.persistUsage({
        inputTokens: result.usage?.inputTokens ?? this.estimateTokens(prompt),
        outputTokens:
          result.usage?.outputTokens ??
          this.estimateTokens(analysis.moderatorNarrative),
      });
    } catch (error) {
      await this.persistSessionEvent({
        type: 'provider_error',
        provider: moderator.definition.provider,
        modelId,
        phase: DiscussionPhase.ANALYSIS,
        agentId: 'moderator',
        timeoutType: 'request',
        message: error instanceof Error ? error.message : String(error),
      });
      analysis = {
        agreements: [],
        disagreements: [],
        shouldConverge: true,
        moderatorNarrative: '分析阶段出现异常，主持人将直接进入总结。',
      };
      yield {
        type: 'agent_error',
        agentId: 'moderator',
        content: analysis.moderatorNarrative,
        timestamp: Date.now(),
      };
    }

    this.lastAnalysis = analysis;

    // Stream the narrative to the client
    for (const char of analysis.moderatorNarrative) {
      yield {
        type: 'moderator_token',
        agentId: 'moderator',
        content: char,
        timestamp: Date.now(),
      };
    }

    yield { type: 'moderator_done', agentId: 'moderator', timestamp: Date.now() };

    this.allMessages.push({
      agentId: 'moderator',
      displayName: 'Moderator',
      content: analysis.moderatorNarrative,
      phase: DiscussionPhase.ANALYSIS,
    });
    await this.persistMessage({
      role: 'moderator',
      agentId: 'moderator',
      displayName: 'Moderator',
      content: analysis.moderatorNarrative,
      phase: DiscussionPhase.ANALYSIS,
      round,
    });
  }

  private async *phaseDebate(round: number): AsyncIterable<SSEEvent> {
    if (!this.lastAnalysis) return;

    yield {
      type: 'phase_change',
      phase: DiscussionPhase.DEBATE,
      round,
      timestamp: Date.now(),
    };

    const participants = this.getActiveParticipants();
    if (participants.length === 0) {
      return;
    }

    for (const disagreement of this.lastAnalysis.disagreements.slice(0, 2)) {
      const contentCollectors = new Map<string, string>();

      const agentStreams = participants.map((agent) => {
        const provider = getProvider(agent.definition.provider);
        const modelId = getModelId(agent.definition, agent.selectedModelId);
        const previousResponse = this.agentResponses.get(agent.definition.id);
        const timeoutConfig = this.getStreamTimeoutConfig(
          agent,
          DiscussionPhase.DEBATE
        );

        contentCollectors.set(agent.definition.id, '');

        return {
          agentId: agent.definition.id,
          provider: agent.definition.provider,
          modelId,
          phase: DiscussionPhase.DEBATE,
          startupTimeoutMs: timeoutConfig.startupTimeoutMs,
          idleTimeoutMs: timeoutConfig.idleTimeoutMs,
          stream: provider.streamChat({
            model: modelId,
            messages: [
              {
                role: 'user',
                content: buildDebatePrompt(
                  this.config.brief,
                  this.config.agenda,
                  agent.definition.id,
                  previousResponse?.content ?? '',
                  disagreement.point,
                  disagreement.followUpQuestion,
                  this.interjectionContext
                ),
              },
            ],
            systemPrompt: buildAgentSystemPrompt(
              this.config.brief,
              this.config.agenda,
              agent.persona,
              this.interjectionContext,
              this.researchBrief ?? undefined
            ),
            temperature: agent.definition.defaultTemperature,
            maxTokens: 1500,
            timeoutMs: timeoutConfig.requestTimeoutMs,
          }),
        };
      });

      for await (const event of this.runScheduledAgentStreams(agentStreams)) {
        if (await this.shouldStop()) {
          break;
        }
        if (event.type === 'agent_token' && event.agentId && event.content) {
          const current = contentCollectors.get(event.agentId) ?? '';
          contentCollectors.set(event.agentId, current + event.content);
        }
        yield event;
      }

      for (const agent of participants) {
        const newContent = contentCollectors.get(agent.definition.id) ?? '';
        if (newContent) {
          const existing = this.agentResponses.get(agent.definition.id);
          if (existing) {
            existing.content += '\n\n[辩论轮次] ' + newContent;
          }
          this.allMessages.push({
            agentId: agent.definition.id,
            displayName: agent.definition.displayName,
            content: newContent,
            phase: DiscussionPhase.DEBATE,
          });
          await this.persistMessage({
            role: 'agent',
            agentId: agent.definition.id,
            displayName: agent.definition.displayName,
            content: newContent,
            phase: DiscussionPhase.DEBATE,
            round,
          });
          await this.persistUsage({
            outputTokens: this.estimateTokens(newContent),
          });
        }
      }
    }
  }

  private async *phaseSummary(): AsyncIterable<SSEEvent> {
    yield {
      type: 'phase_change',
      phase: DiscussionPhase.SUMMARY,
      timestamp: Date.now(),
    };

    const moderator = this.config.agents.find(
      (a) => a.definition.id === this.config.moderatorAgentId
    );
    if (!moderator) return;

    const provider = getProvider(moderator.definition.provider);
    const modelId = getModelId(moderator.definition, moderator.selectedModelId);

    const prompt = buildSummaryPrompt(
      this.config.brief,
      this.config.agenda,
      this.allMessages,
      this.config.parentContext
    );
    await this.persistUsage({ inputTokens: this.estimateTokens(prompt) });
    if (await this.shouldStop()) {
      return;
    }

    yield { type: 'moderator_start', agentId: 'moderator', timestamp: Date.now() };
    const timeoutConfig = this.getStreamTimeoutConfig(
      moderator,
      DiscussionPhase.SUMMARY
    );

    let fullContent = '';
    for await (const chunk of provider.streamChat({
      model: modelId,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      maxTokens: 4096,
      timeoutMs: timeoutConfig.requestTimeoutMs,
    })) {
      if (await this.shouldStop()) {
        break;
      }
      if (chunk.type === 'text_delta') {
        fullContent += chunk.content;
        yield {
          type: 'moderator_token',
          agentId: 'moderator',
          content: chunk.content,
          timestamp: Date.now(),
        };
      } else if (chunk.type === 'error') {
        await this.persistSessionEvent({
          type: chunk.timeoutType ? 'timeout' : 'provider_error',
          provider: moderator.definition.provider,
          modelId,
          phase: DiscussionPhase.SUMMARY,
          agentId: 'moderator',
          timeoutType: normalizeTimeoutType(chunk.timeoutType),
          message: chunk.content,
          metadata: { errorCode: chunk.errorCode },
        });
        yield {
          type: 'agent_error',
          agentId: 'moderator',
          content: chunk.content,
          timestamp: Date.now(),
        };
        break;
      }
    }

    yield { type: 'moderator_done', agentId: 'moderator', timestamp: Date.now() };

    this.allMessages.push({
      agentId: 'moderator',
      displayName: 'Moderator',
      content: fullContent,
      phase: DiscussionPhase.SUMMARY,
    });
    await this.persistMessage({
      role: 'moderator',
      agentId: 'moderator',
      displayName: 'Moderator',
      content: fullContent,
      phase: DiscussionPhase.SUMMARY,
    });
    await this.persistUsage({ outputTokens: this.estimateTokens(fullContent) });
    if (this.config.onSummaryPersist) {
      await this.config.onSummaryPersist(fullContent);
    }
  }

  private async generateDecisionSummary() {
    if (!this.config.onDecisionSummaryPersist) return;

    const moderator = this.config.agents.find(
      (agent) => agent.definition.id === this.config.moderatorAgentId
    );
    if (!moderator) return;

    const minutes = this.allMessages
      .filter((message) => message.phase === DiscussionPhase.SUMMARY)
      .at(-1)?.content;
    if (!minutes) return;

    const provider = getProvider(moderator.definition.provider);
    const modelId = getModelId(moderator.definition, moderator.selectedModelId);
    const prompt = buildDecisionSummaryPrompt({
      brief: this.config.brief,
      agenda: this.config.agenda,
      allMessages: this.allMessages,
      minutes,
      researchSources: this.researchSources,
    });
    try {
      const timeoutMs = this.getCompletionTimeoutMs(
        moderator,
        DiscussionPhase.SUMMARY
      );
      const result = await provider.chat({
        model: modelId,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        maxTokens: 1800,
        timeoutMs,
      });

      await this.persistUsage({
        inputTokens: result.usage?.inputTokens ?? this.estimateTokens(prompt),
        outputTokens: result.usage?.outputTokens ?? this.estimateTokens(result.content),
      });

      await this.config.onDecisionSummaryPersist(
        parseDecisionSummaryContent(result.content, minutes, this.researchSources)
      );
    } catch (error) {
      await this.persistSessionEvent({
        type: 'provider_error',
        provider: moderator.definition.provider,
        modelId,
        phase: DiscussionPhase.SUMMARY,
        agentId: 'moderator',
        timeoutType: 'request',
        message: error instanceof Error ? error.message : String(error),
      });
      await this.config.onDecisionSummaryPersist(
        parseDecisionSummaryContent('', minutes, this.researchSources)
      );
    }
  }

  private async persistResearchRun(input: {
    status: ResearchRunStatus;
    queryPlan: string[];
    summary: string;
    evaluation: {
      coverageScore: number;
      recencyScore: number;
      diversityScore: number;
      overallConfidence: number;
      gaps: string[];
      staleFlags: string[];
    } | null;
  }) {
    if (!this.config.onResearchRunPersist) return;
    await this.config.onResearchRunPersist({
      id: this.config.sessionId,
      sessionId: this.config.sessionId,
      status: input.status,
      queryPlan: input.queryPlan,
      searchConfig: this.config.researchConfig,
      summary: input.summary,
      evaluation: input.evaluation,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  }
}

function chunkBySize<T>(items: T[], size: number) {
  if (!Number.isFinite(size) || size <= 0) {
    return items.length > 0 ? [items] : [];
  }

  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function normalizeTimeoutType(
  value: unknown
): 'startup' | 'idle' | 'request' | undefined {
  if (value === 'startup' || value === 'idle' || value === 'request') {
    return value;
  }
  return undefined;
}
