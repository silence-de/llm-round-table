import { AGENT_CATALOG } from '@/lib/agents/registry';
import type { SessionAgent } from '@/lib/agents/types';
import {
  appendMessage,
  createSession,
  updateSessionUsage,
  updateSessionStatus,
  upsertMinutes,
} from '@/lib/db/repository';
import { DiscussionOrchestrator } from '@/lib/orchestrator/orchestrator';
import {
  clearInterjections,
  drainInterjections,
} from '@/lib/orchestrator/interjection-queue';
import { encodeSSE } from '@/lib/sse/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes max

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const {
    topic,
    agentIds,
    modelSelections = {},
    personas = {},
    moderatorAgentId = 'claude',
    maxDebateRounds = 2,
  } = body as {
    topic: string;
    agentIds: string[];
    modelSelections?: Record<string, string>; // agentId -> selectedModelId
    personas?: Record<string, string>;
    moderatorAgentId?: string;
    maxDebateRounds?: number;
  };

  if (!topic || !agentIds?.length) {
    return new Response(JSON.stringify({ error: 'topic and agentIds required' }), {
      status: 400,
    });
  }

  if (!id || id === '_') {
    return new Response(JSON.stringify({ error: 'invalid session id' }), {
      status: 400,
    });
  }

  // Build session agents from catalog, skipping those without API keys
  const agents: SessionAgent[] = [];
  for (const agentId of agentIds) {
    const definition = AGENT_CATALOG.find((a) => a.id === agentId);
    if (!definition) continue;
    // Skip if API key is missing
    if (!process.env[definition.envKeyName]) continue;
    agents.push({
      definition,
      selectedModelId: modelSelections[agentId],
      persona: personas[agentId],
    });
  }

  // Ensure moderator is included
  if (!agents.find((a) => a.definition.id === moderatorAgentId)) {
    const moderatorDef = AGENT_CATALOG.find((a) => a.id === moderatorAgentId);
    if (moderatorDef) {
      agents.unshift({
        definition: moderatorDef,
        selectedModelId: modelSelections[moderatorAgentId],
        persona: personas[moderatorAgentId],
      });
    }
  }

  await createSession({
    id,
    topic,
    moderatorAgentId,
    maxDebateRounds,
    selectedAgentIds: agentIds,
    modelSelections,
    personas,
  });
  clearInterjections(id);

  const orchestrator = new DiscussionOrchestrator({
    sessionId: id,
    topic,
    agents,
    moderatorAgentId,
    maxDebateRounds,
    drainInterjections: () => drainInterjections(id),
    onMessagePersist: (message) =>
      appendMessage({
        sessionId: id,
        role: message.role,
        agentId: message.agentId,
        displayName: message.displayName,
        phase: message.phase,
        round: message.round,
        content: message.content,
      }),
    onSummaryPersist: (summary) => upsertMinutes(id, summary),
    onUsagePersist: (usage) =>
      updateSessionUsage(id, {
        inputDelta: usage.inputTokens ?? 0,
        outputDelta: usage.outputTokens ?? 0,
      }),
  });

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of orchestrator.run()) {
          controller.enqueue(encoder.encode(encodeSSE(event)));
        }
        await updateSessionStatus(id, 'completed');
      } catch (error) {
        await updateSessionStatus(id, 'failed');
        const errorEvent = encodeSSE({
          type: 'agent_error',
          content: error instanceof Error ? error.message : String(error),
          timestamp: Date.now(),
        });
        controller.enqueue(encoder.encode(errorEvent));
      } finally {
        clearInterjections(id);
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
