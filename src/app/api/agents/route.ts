import { NextResponse } from 'next/server';
import { AGENT_CATALOG, getModelId } from '@/lib/agents/registry';

export async function GET() {
  const agents = AGENT_CATALOG.map((agent) => ({
    id: agent.id,
    displayName: agent.displayName,
    provider: agent.provider,
    modelId: getModelId(agent),
    color: agent.color,
    availableModels: agent.availableModels,
    // Check API key availability server-side
    available: Boolean(process.env[agent.envKeyName]),
    missingKey: process.env[agent.envKeyName] ? null : agent.envKeyName,
  }));

  return NextResponse.json(agents);
}
