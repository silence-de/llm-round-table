'use client';

import { useEffect, useState } from 'react';
import type { PersonaPreset, PersonaSelection } from '@/lib/agents/types';
import type { AgentInfo } from '@/lib/session/types';

export function useWorkspaceBootstrap() {
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [selectedAgents, setSelectedAgents] = useState<Set<string>>(new Set());
  const [modelSelections, setModelSelections] = useState<Record<string, string>>({});
  const [personaSelections, setPersonaSelections] = useState<Record<string, PersonaSelection>>({});
  const [personaPresets, setPersonaPresets] = useState<PersonaPreset[]>([]);
  const [moderatorAgentId, setModeratorAgentId] = useState<string>('claude');
  const [loadingAgents, setLoadingAgents] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void fetch('/api/agents')
      .then((response) => response.json())
      .then(
        (
          payload:
            | AgentInfo[]
            | { agents: AgentInfo[]; personaPresets?: PersonaPreset[] }
        ) => {
          if (cancelled) return;

          const nextAgents = Array.isArray(payload) ? payload : payload.agents;
          const nextPersonaPresets = Array.isArray(payload)
            ? []
            : (payload.personaPresets ?? []);
          const available = nextAgents.filter((agent) => agent.available);
          const preferredModerator =
            available.find((agent) => agent.id === 'claude') ?? available[0];
          const presetIds = new Set(nextPersonaPresets.map((preset) => preset.id));
          const defaultModelSelections: Record<string, string> = {};
          const defaultPersonaSelections: Record<string, PersonaSelection> = {};

          for (const agent of nextAgents) {
            defaultModelSelections[agent.id] = agent.modelId;
            const recommendedPresetId = (agent.recommendedPersonaPresetIds ?? []).find((id) =>
              presetIds.has(id)
            );
            defaultPersonaSelections[agent.id] = recommendedPresetId
              ? { presetId: recommendedPresetId, customNote: '' }
              : { customNote: '' };
          }

          setAgents(nextAgents);
          setPersonaPresets(nextPersonaPresets);
          setSelectedAgents(new Set(available.map((agent) => agent.id)));
          setModelSelections(defaultModelSelections);
          setPersonaSelections(defaultPersonaSelections);
          if (preferredModerator) {
            setModeratorAgentId(preferredModerator.id);
          }
          setLoadingAgents(false);
        }
      )
      .catch(() => {
        if (!cancelled) {
          setLoadingAgents(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return {
    agents,
    selectedAgents,
    setSelectedAgents,
    modelSelections,
    setModelSelections,
    personaSelections,
    setPersonaSelections,
    personaPresets,
    moderatorAgentId,
    setModeratorAgentId,
    loadingAgents,
  };
}
