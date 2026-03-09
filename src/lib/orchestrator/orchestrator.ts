import type { SSEEvent } from '../sse/types';
import type {
  DiscussionConfig,
  AgentResponse,
  ModeratorAnalysis,
  PersistableMessage,
} from './types';
import { DiscussionPhase } from './types';
import { getProvider } from '../llm/provider-registry';
import { getModelId } from '../agents/registry';
import { multiplexStreams } from './stream-multiplexer';
import {
  buildOpeningPrompt,
  buildAgentSystemPrompt,
  buildAnalysisPrompt,
  buildDebatePrompt,
  buildSummaryPrompt,
  parseAnalysis,
} from './moderator';

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

  constructor(config: DiscussionConfig) {
    this.config = config;
  }

  async *run(): AsyncIterable<SSEEvent> {
    // Phase 1: Opening
    yield* this.phaseOpening();

    // Phase 2: Initial Responses (parallel)
    yield* this.phaseInitialResponses();

    // Phase 3+4: Analysis and Debate loop
    for (let round = 0; round < this.config.maxDebateRounds; round++) {
      yield* this.consumeInterjections(DiscussionPhase.ANALYSIS, round);
      yield* this.phaseAnalysis(round);

      if (!this.lastAnalysis || this.lastAnalysis.shouldConverge) break;

      if (this.lastAnalysis.disagreements.length > 0) {
        yield* this.consumeInterjections(DiscussionPhase.DEBATE, round);
        yield* this.phaseDebate(round);
      } else {
        break;
      }
    }

    // Phase 5: Summary
    yield* this.consumeInterjections(DiscussionPhase.SUMMARY);
    yield* this.phaseSummary();

    yield {
      type: 'phase_change',
      phase: DiscussionPhase.COMPLETED,
      timestamp: Date.now(),
    };
    yield { type: 'discussion_complete', timestamp: Date.now() };
  }

  private async *consumeInterjections(
    phase: string,
    round?: number
  ): AsyncIterable<SSEEvent> {
    const queue = this.config.drainInterjections ? await this.config.drainInterjections() : [];

    for (const interjection of queue) {
      this.interjectionContext.push(interjection.content);
      this.allMessages.push({
        agentId: 'user',
        displayName: 'User',
        content: interjection.content,
        phase,
      });

      yield {
        type: 'user_interjection',
        agentId: 'user',
        phase,
        round,
        content: interjection.content,
        timestamp: Date.now(),
      };
    }
  }

  private async persistMessage(message: PersistableMessage) {
    if (!this.config.onMessagePersist) return;
    await this.config.onMessagePersist(message);
  }

  private async persistUsage(delta: { inputTokens?: number; outputTokens?: number }) {
    if (!this.config.onUsagePersist) return;
    await this.config.onUsagePersist(delta);
  }

  private estimateTokens(text: string): number {
    return Math.max(1, Math.ceil(text.length / 4));
  }

  private getAgentTimeoutMs(agentId: string, phase: string): number {
    if (agentId === 'qwen') {
      return phase === DiscussionPhase.DEBATE ? 30_000 : 40_000;
    }
    return phase === DiscussionPhase.DEBATE ? 45_000 : 60_000;
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

    const prompt = buildOpeningPrompt(this.config.topic, agentNames);
    await this.persistUsage({ inputTokens: this.estimateTokens(prompt) });

    yield { type: 'moderator_start', agentId: 'moderator', timestamp: Date.now() };

    let fullContent = '';
    for await (const chunk of provider.streamChat({
      model: modelId,
      messages: [{ role: 'user', content: prompt }],
      temperature: moderator.definition.defaultTemperature,
      maxTokens: moderator.definition.maxTokens,
      timeoutMs: 60_000,
    })) {
      if (chunk.type === 'text_delta') {
        fullContent += chunk.content;
        yield {
          type: 'moderator_token',
          agentId: 'moderator',
          content: chunk.content,
          timestamp: Date.now(),
        };
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

    const participants = this.config.agents.filter(
      (a) => a.definition.id !== this.config.moderatorAgentId
    );

    const contentCollectors = new Map<string, string>();

    const agentStreams = participants.map((agent) => {
      const provider = getProvider(agent.definition.provider);
      const modelId = getModelId(agent.definition, agent.selectedModelId);
      const systemPrompt = buildAgentSystemPrompt(
        this.config.topic,
        agent.persona,
        this.interjectionContext
      );
      const userPrompt = `请就以下议题发表你的观点：「${this.config.topic}」`;
      const timeoutMs = this.getAgentTimeoutMs(
        agent.definition.id,
        DiscussionPhase.INITIAL_RESPONSES
      );

      void this.persistUsage({
        inputTokens:
          this.estimateTokens(systemPrompt) + this.estimateTokens(userPrompt),
      });

      contentCollectors.set(agent.definition.id, '');

      return {
        agentId: agent.definition.id,
        timeoutMs,
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
          timeoutMs,
        }),
      };
    });

    for await (const event of multiplexStreams(agentStreams)) {
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

    const prompt = buildAnalysisPrompt(this.config.topic, responses, this.interjectionContext);
    await this.persistUsage({ inputTokens: this.estimateTokens(prompt) });

    yield { type: 'moderator_start', agentId: 'moderator', timestamp: Date.now() };

    const result = await provider.chat({
      model: modelId,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      maxTokens: 2000,
      timeoutMs: 45_000,
    });

    const analysis = parseAnalysis(result.content);
    this.lastAnalysis = analysis;
    await this.persistUsage({
      inputTokens: result.usage?.inputTokens,
      outputTokens:
        result.usage?.outputTokens ??
        this.estimateTokens(analysis.moderatorNarrative),
    });

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

    const participants = this.config.agents.filter(
      (a) => a.definition.id !== this.config.moderatorAgentId
    );

    for (const disagreement of this.lastAnalysis.disagreements.slice(0, 2)) {
      const contentCollectors = new Map<string, string>();

      const agentStreams = participants.map((agent) => {
        const provider = getProvider(agent.definition.provider);
        const modelId = getModelId(agent.definition, agent.selectedModelId);
        const previousResponse = this.agentResponses.get(agent.definition.id);

        contentCollectors.set(agent.definition.id, '');

        return {
          agentId: agent.definition.id,
          timeoutMs: this.getAgentTimeoutMs(agent.definition.id, DiscussionPhase.DEBATE),
          stream: provider.streamChat({
            model: modelId,
            messages: [
              {
                role: 'user',
                content: buildDebatePrompt(
                  this.config.topic,
                  agent.definition.id,
                  previousResponse?.content ?? '',
                  disagreement.point,
                  disagreement.followUpQuestion,
                  this.interjectionContext
                ),
              },
            ],
            systemPrompt: buildAgentSystemPrompt(
              this.config.topic,
              agent.persona,
              this.interjectionContext
            ),
            temperature: agent.definition.defaultTemperature,
            maxTokens: 1500,
            timeoutMs: this.getAgentTimeoutMs(agent.definition.id, DiscussionPhase.DEBATE),
          }),
        };
      });

      for await (const event of multiplexStreams(agentStreams)) {
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

    const prompt = buildSummaryPrompt(this.config.topic, this.allMessages);
    await this.persistUsage({ inputTokens: this.estimateTokens(prompt) });

    yield { type: 'moderator_start', agentId: 'moderator', timestamp: Date.now() };

    let fullContent = '';
    for await (const chunk of provider.streamChat({
      model: modelId,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      maxTokens: 4096,
      timeoutMs: 70_000,
    })) {
      if (chunk.type === 'text_delta') {
        fullContent += chunk.content;
        yield {
          type: 'moderator_token',
          agentId: 'moderator',
          content: chunk.content,
          timestamp: Date.now(),
        };
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
}
