'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Activity,
  Cpu,
  FastForward,
  History,
  Pause,
  Play,
  RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useDiscussionStore } from '@/stores/discussion-store';
import { useDiscussionStream } from '@/hooks/use-discussion-stream';
import { PhaseIndicator } from '@/components/discussion/phase-indicator';
import { RoundTableStage } from '@/components/discussion/round-table-stage';
import { ResearchPanel } from '@/components/discussion/research-panel';
import { MarkdownContent } from '@/components/ui/markdown-content';
import { DiscussionFeed } from '@/components/discussion/discussion-feed';
import { DecisionSummaryCard } from '@/components/discussion/decision-summary-card';
import type { FeedMessage } from '@/components/discussion/discussion-feed';
import type { PersonaPreset, PersonaSelection } from '@/lib/agents/types';
import {
  DECISION_TEMPLATES,
} from '@/lib/decision/templates';
import type {
  ActionItem,
  ActionItemStatus,
  DecisionBrief,
  DecisionControlType,
  DecisionStatus,
  DecisionSummary,
  DiscussionAgenda,
} from '@/lib/decision/types';
import {
  ACTION_ITEM_STATUS_LABELS,
  ACTION_ITEM_STATUS_OPTIONS,
  DECISION_CONTROL_LABELS,
  DECISION_STATUS_OPTIONS,
  DEFAULT_DECISION_BRIEF,
  DEFAULT_DISCUSSION_AGENDA,
  normalizeDecisionBrief,
  normalizeDiscussionAgenda,
} from '@/lib/decision/utils';
import {
  buildDecisionSummaryMarkdown,
  buildExecutionChecklistMarkdown,
  buildTranscriptMarkdown,
  type TranscriptMessage,
} from '@/lib/session-artifacts';
import type { ResearchConfig, ResearchRunDetail } from '@/lib/search/types';
import {
  DEFAULT_RESEARCH_CONFIG,
  normalizeResearchConfig,
} from '@/lib/search/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

// ─── Types ────────────────────────────────────────────────────────────────────

interface AgentInfo {
  id: string;
  displayName: string;
  provider: string;
  modelId: string;
  color: string;
  sprite: string;
  accentGlow?: string;
  recommendedPersonaPresetIds?: string[];
  available: boolean;
  missingKey: string | null;
  availableModels: Array<{ id: string; label: string }>;
}

interface SessionRecord {
  id: string;
  topic: string;
  status: string;
  goal: string;
  background: string;
  constraints: string;
  retrospectiveNote?: string;
  outcomeSummary?: string;
  decisionType: string;
  desiredOutput: string;
  templateId?: string | null;
  agendaConfig?: string;
  researchConfig?: string;
  parentSessionId?: string | null;
  decisionStatus: DecisionStatus;
  createdAt: number | string;
  moderatorAgentId: string;
  maxDebateRounds: number;
  selectedAgentIds?: string;
  modelSelections?: string;
  personaSelections?: string;
  usageInputTokens: number;
  usageOutputTokens: number;
}

interface SessionDetail {
  session: SessionRecord;
  messages: Array<{
    id: string;
    role: string;
    phase: string;
    content: string;
    displayName?: string | null;
    agentId?: string | null;
    createdAt: number | string;
  }>;
  minutes: { content: string } | null;
  decisionSummary: DecisionSummary | null;
  actionItems: ActionItem[];
  researchRun: ResearchRunDetail | null;
  interjections: Array<{
    id: string;
    content: string;
    controlType?: DecisionControlType;
    phaseHint?: string | null;
    roundHint?: number | null;
    createdAt: number | string;
  }>;
  parentSession:
    | {
        id: string;
        topic: string;
        templateId?: string | null;
        decisionType: string;
        decisionStatus: DecisionStatus;
        createdAt: number | string;
      }
    | null;
  childSessions: Array<{
    id: string;
    topic: string;
    templateId?: string | null;
    decisionType: string;
    decisionStatus: DecisionStatus;
    createdAt: number | string;
  }>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function downloadMarkdown(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function parseAgentList(value?: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function parsePersonaSelectionMap(value?: string | null): Record<string, PersonaSelection> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as Record<string, PersonaSelection>;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed;
  } catch {
    return {};
  }
}

function parseModelSelectionMap(value?: string | null): Record<string, string> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object') return {};
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
    );
  } catch {
    return {};
  }
}

function parseAgendaConfig(value?: string | null): DiscussionAgenda {
  if (!value) return DEFAULT_DISCUSSION_AGENDA;
  try {
    return normalizeDiscussionAgenda(JSON.parse(value) as Partial<DiscussionAgenda>);
  } catch {
    return DEFAULT_DISCUSSION_AGENDA;
  }
}

function parseResearchConfig(value?: string | null): ResearchConfig {
  if (!value) return DEFAULT_RESEARCH_CONFIG;
  try {
    return normalizeResearchConfig(JSON.parse(value) as Partial<ResearchConfig>);
  } catch {
    return DEFAULT_RESEARCH_CONFIG;
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HomePage() {
  // ── Local state ──────────────────────────────────────────────────────────
  const [brief, setBrief] = useState<DecisionBrief>(DEFAULT_DECISION_BRIEF);
  const [agenda, setAgenda] = useState<DiscussionAgenda>(DEFAULT_DISCUSSION_AGENDA);
  const [researchConfig, setResearchConfig] =
    useState<ResearchConfig>(DEFAULT_RESEARCH_CONFIG);
  const [interjection, setInterjection] = useState('');
  const [interjectionControlType, setInterjectionControlType] =
    useState<DecisionControlType>('general');
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [selectedAgents, setSelectedAgents] = useState<Set<string>>(new Set());
  const [modelSelections, setModelSelections] = useState<Record<string, string>>({});
  const [personaSelections, setPersonaSelections] = useState<Record<string, PersonaSelection>>({});
  const [personaPresets, setPersonaPresets] = useState<PersonaPreset[]>([]);
  const [moderatorAgentId, setModeratorAgentId] = useState<string>('claude');
  const [maxDebateRounds, setMaxDebateRounds] = useState<number>(2);
  const [loadingAgents, setLoadingAgents] = useState(true);

  const [rightTab, setRightTab] = useState<'context' | 'history'>('context');
  const [historyQuery, setHistoryQuery] = useState('');
  const [historyStatusFilter, setHistoryStatusFilter] = useState<'all' | SessionRecord['status']>('all');
  const [historyTemplateFilter, setHistoryTemplateFilter] = useState<string>('all');
  const [historyTimeRange, setHistoryTimeRange] = useState<'all' | '7d' | '30d' | '90d'>('all');
  const [followUpParentSession, setFollowUpParentSession] = useState<{
    id: string;
    topic: string;
  } | null>(null);
  const [compareSessionIds, setCompareSessionIds] = useState<string[]>([]);
  const [compareDetails, setCompareDetails] = useState<SessionDetail[]>([]);

  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);
  const [historyDetail, setHistoryDetail] = useState<SessionDetail | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [researchBusySessionId, setResearchBusySessionId] = useState<string | null>(
    null
  );

  // ── Store ────────────────────────────────────────────────────────────────
  const {
    phase,
    round,
    isRunning,
    sessionId,
    usageInputTokens,
    usageOutputTokens,
    agentMessages,
    moderatorMessages,
    interjections,
    decisionSummary,
    actionItems,
    review,
    error,
    research,
    ui,
    replay,
    setError,
    setAutoScroll,
    setActionItems,
    setReview,
    setResearchRun,
    setResearchStatus,
    setReplayStatus,
    setReplayCursor,
    advanceReplayCursor,
    resetReplay,
  } = useDiscussionStore();

  const { startDiscussion, stopDiscussion, sendStructuredInterjection } =
    useDiscussionStream();

  // ── Data fetching ────────────────────────────────────────────────────────

  // ── Data fetching ────────────────────────────────────────────────────────

  const refreshSessions = useCallback(async () => {
    const res = await fetch('/api/sessions');
    if (!res.ok) return;
    const data = (await res.json()) as SessionRecord[];
    setSessions([...data].reverse());
  }, []);

  const loadHistory = useCallback(
    async (id: string) => {
      setLoadingHistory(true);
      setActiveHistoryId(id);
      setAutoScroll('follow');
      resetReplay();
      try {
        const res = await fetch(`/api/sessions/${id}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as SessionDetail;
        setHistoryDetail(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoadingHistory(false);
      }
    },
    [resetReplay, setAutoScroll, setError]
  );

  const deleteHistory = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/sessions/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        setError(`Delete failed: ${res.status}`);
        return;
      }
      if (activeHistoryId === id) {
        setActiveHistoryId(null);
        setHistoryDetail(null);
        resetReplay();
      }
      await refreshSessions();
    },
    [activeHistoryId, refreshSessions, resetReplay, setError]
  );

  // ── Bootstrap ────────────────────────────────────────────────────────────

  useEffect(() => {
    fetch('/api/agents')
      .then((r) => r.json())
      .then(
        (
          payload:
            | AgentInfo[]
            | { agents: AgentInfo[]; personaPresets?: PersonaPreset[] }
        ) => {
          const data = Array.isArray(payload) ? payload : payload.agents;
          const presets = Array.isArray(payload) ? [] : (payload.personaPresets ?? []);
          setAgents(data);
          setPersonaPresets(presets);
          const available = data.filter((a) => a.available);
          setSelectedAgents(new Set(available.map((a) => a.id)));

          const preferredMod = available.find((a) => a.id === 'claude') ?? available[0];
          if (preferredMod) setModeratorAgentId(preferredMod.id);

          const defaults: Record<string, string> = {};
          const defaultPersonaSelections: Record<string, PersonaSelection> = {};
          const presetIds = new Set(presets.map((preset) => preset.id));
          for (const a of data) {
            defaults[a.id] = a.modelId;
            const recommended = (a.recommendedPersonaPresetIds ?? []).find(
              (id) => presetIds.has(id)
            );
            defaultPersonaSelections[a.id] = recommended
              ? { presetId: recommended, customNote: '' }
              : { customNote: '' };
          }
          setModelSelections(defaults);
          setPersonaSelections(defaultPersonaSelections);
          setLoadingAgents(false);
        }
      )
      .catch(() => setLoadingAgents(false));

    void refreshSessions();
  }, [refreshSessions]);

  useEffect(() => {
    if (!isRunning) {
      void refreshSessions();
    }
  }, [isRunning, refreshSessions]);

  // ── Right-panel tab auto-switching ───────────────────────────────────────

  useEffect(() => {
    if (historyDetail) setRightTab('history');
  }, [historyDetail]);

  useEffect(() => {
    if (isRunning) setRightTab('context');
  }, [isRunning]);

  useEffect(() => {
    if (compareSessionIds.length === 0) {
      setCompareDetails([]);
      return;
    }

    void Promise.all(
      compareSessionIds.map(async (id) => {
        const response = await fetch(`/api/sessions/${id}`);
        if (!response.ok) {
          throw new Error(`Failed to load comparison session ${id}`);
        }
        return (await response.json()) as SessionDetail;
      })
    )
      .then(setCompareDetails)
      .catch((error) =>
        setError(error instanceof Error ? error.message : String(error))
      );
  }, [compareSessionIds, setError]);

  // ── Agent config callbacks ───────────────────────────────────────────────

  const updateBrief = useCallback(
    <K extends keyof DecisionBrief>(key: K, value: DecisionBrief[K]) => {
      setBrief((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const updateAgenda = useCallback(
    <K extends keyof DiscussionAgenda>(key: K, value: DiscussionAgenda[K]) => {
      setAgenda((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const updateResearchConfig = useCallback(
    <K extends keyof ResearchConfig>(key: K, value: ResearchConfig[K]) => {
      setResearchConfig((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const applyTemplate = useCallback((templateId: string) => {
    const template = DECISION_TEMPLATES.find((item) => item.id === templateId);
    if (!template) {
      setBrief((prev) => ({ ...prev, templateId: null }));
      return;
    }

    setBrief((prev) => ({
      ...prev,
      templateId: template.id,
      goal: prev.goal || template.goal,
      background: prev.background || template.background,
      constraints: prev.constraints || template.constraints,
      decisionType: template.decisionType,
      desiredOutput: template.desiredOutput,
    }));
    setAgenda((prev) => ({
      ...prev,
      focalQuestions: prev.focalQuestions || template.focalQuestions,
      requiredDimensions: prev.requiredDimensions || template.requiredDimensions,
    }));
  }, []);

  const toggleAgent = useCallback(
    (agentId: string) => {
      const agent = agents.find((a) => a.id === agentId);
      if (!agent?.available) return;

      setSelectedAgents((prev) => {
        const next = new Set(prev);
        if (next.has(agentId)) {
          if (agentId === moderatorAgentId) return prev;
          if (next.size <= 2) return prev;
          next.delete(agentId);
        } else {
          next.add(agentId);
        }
        return next;
      });
    },
    [agents, moderatorAgentId]
  );

  const handleModelChange = useCallback((agentId: string, modelId: string) => {
    setModelSelections((prev) => ({ ...prev, [agentId]: modelId }));
  }, []);

  const handlePersonaPresetChange = useCallback(
    (agentId: string, presetId?: string) => {
      setPersonaSelections((prev) => ({
        ...prev,
        [agentId]: { ...prev[agentId], presetId },
      }));
    },
    []
  );

  // ── Session actions ──────────────────────────────────────────────────────

  const handleStart = useCallback(() => {
    if (!brief.topic.trim() || selectedAgents.size < 2) return;
    setHistoryDetail(null);
    setActiveHistoryId(null);
    resetReplay();

    const legacyPersonas: Record<string, string> = {};
    for (const [agentId, selection] of Object.entries(personaSelections)) {
      if (selection.customNote?.trim()) {
        legacyPersonas[agentId] = selection.customNote.trim();
      }
    }

    void startDiscussion({
      topic: brief.topic.trim(),
      brief,
      agenda,
      researchConfig,
      agentIds: Array.from(selectedAgents),
      modelSelections,
      personaSelections,
      personas: legacyPersonas,
      moderatorAgentId,
      maxDebateRounds,
      parentSessionId: followUpParentSession?.id ?? null,
    });
  }, [
    agenda,
    brief,
    followUpParentSession,
    maxDebateRounds,
    modelSelections,
    moderatorAgentId,
    personaSelections,
    researchConfig,
    resetReplay,
    selectedAgents,
    startDiscussion,
  ]);

  const handleInterjection = useCallback(async () => {
    if (!interjection.trim() || !isRunning) return;
    try {
      await sendStructuredInterjection({
        content: interjection.trim(),
        controlType: interjectionControlType,
      });
      setInterjection('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [
    interjection,
    interjectionControlType,
    isRunning,
    sendStructuredInterjection,
    setError,
  ]);

  // ── Derived data ─────────────────────────────────────────────────────────

  // ── Derived data ─────────────────────────────────────────────────────────

  const currentSummary = useMemo(
    () =>
      [...moderatorMessages].reverse().find((message) => message.phase === 'summary')
        ?.content,
    [moderatorMessages]
  );

  const activeSpeakerIds = useMemo(
    () =>
      Array.from(agentMessages.values())
        .filter((message) => message.isStreaming)
        .map((message) => message.agentId),
    [agentMessages]
  );

  const moderatorAgent = useMemo(
    () =>
      agents.find((agent) => agent.id === moderatorAgentId) ?? {
        id: 'moderator',
        displayName: 'Moderator',
        color: 'var(--rt-warning-state)',
        sprite: '/sprites/fallback.svg',
        accentGlow: 'var(--rt-warning-state)',
      },
    [agents, moderatorAgentId]
  );

  const participants = agents.filter(
    (agent) => selectedAgents.has(agent.id) && agent.id !== moderatorAgentId
  );

  const personaPresetMap = useMemo(
    () => new Map(personaPresets.map((preset) => [preset.id, preset])),
    [personaPresets]
  );
  const activeTemplate = useMemo(
    () =>
      brief.templateId
        ? DECISION_TEMPLATES.find((template) => template.id === brief.templateId) ?? null
        : null,
    [brief.templateId]
  );

  const historyPersonaSelections = useMemo(
    () => parsePersonaSelectionMap(historyDetail?.session.personaSelections),
    [historyDetail]
  );
  const historyModelSelections = useMemo(
    () => parseModelSelectionMap(historyDetail?.session.modelSelections),
    [historyDetail]
  );

  const replayableMessages = useMemo(
    () =>
      (historyDetail?.messages ?? []).filter(
        (message) => message.role === 'agent' || message.role === 'moderator'
      ),
    [historyDetail]
  );

  useEffect(() => {
    if (replay.status !== 'playing') return;
    if (replayableMessages.length === 0) return;
    const timer = window.setInterval(() => {
      advanceReplayCursor(replayableMessages.length - 1);
    }, 900);
    return () => window.clearInterval(timer);
  }, [advanceReplayCursor, replay.status, replayableMessages.length]);

  useEffect(() => {
    if (!historyDetail) return;
    const maxCursor = Math.max(0, replayableMessages.length - 1);
    if (replay.cursor > maxCursor) {
      setReplayCursor(maxCursor);
    }
  }, [historyDetail, replay.cursor, replayableMessages.length, setReplayCursor]);

  const replayVisibleMessages = useMemo(() => {
    if (!historyDetail) return [];
    if (replay.status === 'idle') return replayableMessages;
    if (replayableMessages.length === 0) return [];
    return replayableMessages.slice(
      0,
      Math.min(replay.cursor + 1, replayableMessages.length)
    );
  }, [historyDetail, replay.cursor, replay.status, replayableMessages]);

  const historySelectedAgentIds = useMemo(
    () => parseAgentList(historyDetail?.session.selectedAgentIds),
    [historyDetail]
  );

  const historyModerator = useMemo(() => {
    if (!historyDetail) return moderatorAgent;
    return (
      agents.find((agent) => agent.id === historyDetail.session.moderatorAgentId) ?? {
        id: historyDetail.session.moderatorAgentId,
        displayName: historyDetail.session.moderatorAgentId,
        color: 'var(--rt-warning-state)',
        sprite: '/sprites/fallback.svg',
        accentGlow: 'var(--rt-warning-state)',
      }
    );
  }, [agents, historyDetail, moderatorAgent]);

  const historyParticipants = useMemo(() => {
    if (!historyDetail) return [] as AgentInfo[];
    return historySelectedAgentIds
      .filter((id) => id !== historyDetail.session.moderatorAgentId)
      .map((id) => {
        const found = agents.find((agent) => agent.id === id);
        if (found) return found;
        return {
          id,
          displayName: id,
          provider: 'unknown',
          modelId: '',
          color: 'var(--rt-live-state)',
          sprite: '/sprites/fallback.svg',
          accentGlow: 'var(--rt-live-state)',
          available: true,
          missingKey: null,
          availableModels: [],
        } satisfies AgentInfo;
      });
  }, [agents, historyDetail, historySelectedAgentIds]);

  // Stage data for the right-panel visual ─────────────────────────────────
  const replayStageData = useMemo(() => {
    const map = new Map<
      string,
      { agentId: string; content: string; isStreaming: boolean; phase: string }
    >();
    let moderatorMessage = '';
    let activeSpeakerId: string | null = null;
    let phaseLabel = '';

    for (const message of replayVisibleMessages) {
      if (message.role === 'moderator') {
        moderatorMessage = message.content;
        activeSpeakerId = 'moderator';
        phaseLabel = message.phase || phaseLabel;
        continue;
      }
      if (message.role !== 'agent') continue;
      const guessedId =
        message.agentId ??
        agents.find((agent) => agent.displayName === message.displayName)?.id ??
        '';
      if (!guessedId) continue;
      map.set(guessedId, {
        agentId: guessedId,
        content: message.content,
        isStreaming: false,
        phase: message.phase,
      });
      activeSpeakerId = guessedId;
      phaseLabel = message.phase || phaseLabel;
    }
    return { map, moderatorMessage, activeSpeakerId, phase: phaseLabel };
  }, [agents, replayVisibleMessages]);

  const stageParticipants = !isRunning && historyDetail ? historyParticipants : participants;
  const stageModerator = !isRunning && historyDetail ? historyModerator : moderatorAgent;
  const stageModeratorMessage = isRunning
    ? moderatorMessages.at(-1)?.content
    : replayStageData.moderatorMessage;
  const stageActiveSpeakerId = isRunning
    ? ui.activeSpeakerId ?? activeSpeakerIds[0] ?? null
    : replayStageData.activeSpeakerId;
  const stagePhase = isRunning
    ? phase
    : replayStageData.phase || historyDetail?.session.status || phase;

  // ── Unified discussion feed messages ─────────────────────────────────────

  const feedMessages = useMemo<FeedMessage[]>(() => {
    // History / replay mode: map all chronological messages
    if (historyDetail) {
      return replayVisibleMessages.map((msg) => {
        if (msg.role === 'moderator') {
          return {
            id: msg.id,
            role: 'moderator' as const,
            phase: msg.phase,
            content: msg.content,
            displayName: historyModerator.displayName,
            color: historyModerator.color,
            sprite: historyModerator.sprite,
          };
        }
        const agent = agents.find(
          (a) => a.id === msg.agentId || a.displayName === msg.displayName
        );
        return {
          id: msg.id,
          role: 'agent' as const,
          phase: msg.phase,
          content: msg.content,
          displayName: msg.displayName ?? msg.agentId ?? 'Unknown',
          agentId: msg.agentId ?? undefined,
          color: agent?.color,
          sprite: agent?.sprite,
        };
      });
    }

    // Live mode: all moderator messages in order + current-round agent messages
    const msgs: FeedMessage[] = [];

    moderatorMessages.forEach((msg, i) => {
      if (!msg.content.trim()) return;
      msgs.push({
        id: `live-mod-${i}`,
        role: 'moderator',
        phase: msg.phase,
        content: msg.content,
        displayName: moderatorAgent.displayName,
        color: moderatorAgent.color,
        sprite: moderatorAgent.sprite,
      });
    });

    participants.forEach((agent) => {
      const msg = agentMessages.get(agent.id);
      if (!msg?.content.trim()) return;
      msgs.push({
        id: `live-agent-${agent.id}`,
        role: 'agent',
        phase: msg.phase,
        content: msg.content,
        displayName: agent.displayName,
        agentId: agent.id,
        color: agent.color,
        sprite: agent.sprite,
        isStreaming: msg.isStreaming,
      });
    });

    return msgs;
  }, [
    agentMessages,
    agents,
    historyDetail,
    historyModerator,
    moderatorAgent,
    moderatorMessages,
    participants,
    replayVisibleMessages,
  ]);

  // ── Replay controls ──────────────────────────────────────────────────────

  const startReplay = useCallback(() => {
    if (!historyDetail || replayableMessages.length === 0) return;
    if (replay.status === 'idle') setReplayCursor(0);
    setReplayStatus('playing');
  }, [historyDetail, replay.status, replayableMessages.length, setReplayCursor, setReplayStatus]);

  const pauseReplay = useCallback(() => {
    setReplayStatus('paused');
  }, [setReplayStatus]);

  const resetReplayCursor = useCallback(() => {
    if (!historyDetail) return;
    setReplayStatus('paused');
    setReplayCursor(0);
  }, [historyDetail, setReplayCursor, setReplayStatus]);

  const exitReplay = useCallback(() => {
    setReplayStatus('idle');
    setReplayCursor(Math.max(0, replayableMessages.length - 1));
  }, [replayableMessages.length, setReplayCursor, setReplayStatus]);

  // ── Stage props helper ───────────────────────────────────────────────────

  const stageAgents = stageParticipants.map((agent) => ({
    id: agent.id,
    displayName: agent.displayName,
    color: agent.color,
    accentGlow: agent.accentGlow,
    sprite: agent.sprite,
    message: isRunning ? agentMessages.get(agent.id) : replayStageData.map.get(agent.id),
  }));

  const stageMod = {
    id: stageModerator.id,
    displayName: stageModerator.displayName,
    color: stageModerator.color,
    sprite: stageModerator.sprite,
    accentGlow: stageModerator.accentGlow,
  };

  const historySearchIndex = useCallback(
    (session: SessionRecord) => {
      const presetLabels = Object.values(parsePersonaSelectionMap(session.personaSelections))
        .map((selection) =>
          selection.presetId
            ? personaPresetMap.get(selection.presetId)?.label
            : selection.customNote
              ? 'Custom'
              : undefined
        )
        .filter((label): label is string => Boolean(label));

      return [
        session.topic,
        session.goal,
        session.constraints,
        session.outcomeSummary,
        session.retrospectiveNote,
        session.id,
        session.status,
        session.decisionType,
        session.templateId,
        ...presetLabels,
      ]
        .join(' ')
        .toLowerCase();
    },
    [personaPresetMap]
  );

  const filteredSessions = useMemo(() => {
    const query = historyQuery.trim().toLowerCase();
    const now = Date.now();
    return sessions.filter((session) => {
      const statusMatches =
        historyStatusFilter === 'all' || session.status === historyStatusFilter;
      if (!statusMatches) return false;
      const templateMatches =
        historyTemplateFilter === 'all' ||
        (session.templateId ?? 'none') === historyTemplateFilter;
      if (!templateMatches) return false;
      if (historyTimeRange !== 'all') {
        const createdAt = new Date(session.createdAt).getTime();
        const days =
          historyTimeRange === '7d' ? 7 : historyTimeRange === '30d' ? 30 : 90;
        if (now - createdAt > days * 24 * 60 * 60 * 1000) return false;
      }
      if (!query) return true;
      return historySearchIndex(session).includes(query);
    });
  }, [
    historyQuery,
    historySearchIndex,
    historyStatusFilter,
    historyTemplateFilter,
    historyTimeRange,
    sessions,
  ]);

  const historyStatusOptions = useMemo(
    () =>
      Array.from(new Set(sessions.map((session) => session.status))).sort() as Array<
        SessionRecord['status']
      >,
    [sessions]
  );

  const historyTemplateOptions = useMemo(
    () =>
      Array.from(
        new Set(
          sessions
            .map((session) => session.templateId)
            .filter((templateId): templateId is string => Boolean(templateId))
        )
      ).sort(),
    [sessions]
  );

  const similarSessions = useMemo(() => {
    if (!historyDetail) return [] as SessionRecord[];
    return sessions
      .filter((session) => session.id !== historyDetail.session.id)
      .filter(
        (session) =>
          (historyDetail.session.templateId &&
            session.templateId === historyDetail.session.templateId) ||
          session.decisionType === historyDetail.session.decisionType
      )
      .slice(0, 3);
  }, [historyDetail, sessions]);

  const liveTranscriptMessages = useMemo<TranscriptMessage[]>(
    () =>
      feedMessages.map((message) => ({
        role: message.role,
        phase: message.phase,
        content: message.content,
        displayName: message.displayName,
      })),
    [feedMessages]
  );

  const handleExportLiveTranscript = useCallback(() => {
    const exportedTopic = brief.topic.trim() || 'Live discussion';
    downloadMarkdown(
      `transcript-${sessionId ?? 'live'}.md`,
      buildTranscriptMarkdown({
        topic: exportedTopic,
        status: isRunning ? phase || 'running' : 'idle',
        messages: liveTranscriptMessages,
      })
    );
  }, [brief.topic, isRunning, liveTranscriptMessages, phase, sessionId]);

  const handleExportLiveDecisionCard = useCallback(() => {
    if (!decisionSummary) return;
    downloadMarkdown(
      `decision-${sessionId ?? 'current'}.md`,
      buildDecisionSummaryMarkdown({
        topic: brief.topic.trim() || 'Live discussion',
        status: isRunning ? phase || 'running' : 'completed',
        decisionSummary,
      })
    );
  }, [brief.topic, decisionSummary, isRunning, phase, sessionId]);

  const handleExportLiveChecklist = useCallback(() => {
    if (actionItems.length === 0) return;
    downloadMarkdown(
      `checklist-${sessionId ?? 'current'}.md`,
      buildExecutionChecklistMarkdown({
        topic: brief.topic.trim() || 'Live discussion',
        status: isRunning ? phase || 'running' : 'completed',
        actionItems,
      })
    );
  }, [actionItems, brief.topic, isRunning, phase, sessionId]);

  const handleExportHistoryTranscript = useCallback(() => {
    if (!historyDetail) return;
    downloadMarkdown(
      `transcript-${historyDetail.session.id}.md`,
      buildTranscriptMarkdown({
        topic: historyDetail.session.topic,
        status: historyDetail.session.status,
        messages: historyDetail.messages.map((message) => ({
          role: message.role,
          phase: message.phase,
          content: message.content,
          displayName: message.displayName ?? message.agentId ?? message.role,
          createdAt: message.createdAt,
        })),
      })
    );
  }, [historyDetail]);

  const handleExportHistoryDecisionCard = useCallback(() => {
    if (!historyDetail?.decisionSummary) return;
    downloadMarkdown(
      `decision-${historyDetail.session.id}.md`,
      buildDecisionSummaryMarkdown({
        topic: historyDetail.session.topic,
        status: historyDetail.session.decisionStatus,
        decisionSummary: historyDetail.decisionSummary,
      })
    );
  }, [historyDetail]);

  const handleExportHistoryChecklist = useCallback(() => {
    if (!historyDetail || historyDetail.actionItems.length === 0) return;
    downloadMarkdown(
      `checklist-${historyDetail.session.id}.md`,
      buildExecutionChecklistMarkdown({
        topic: historyDetail.session.topic,
        status: historyDetail.session.decisionStatus,
        actionItems: historyDetail.actionItems,
      })
    );
  }, [historyDetail]);

  const handleReuseHistorySetup = useCallback(() => {
    if (!historyDetail) return;

    const availableAgentIds = new Set(
      agents.filter((agent) => agent.available).map((agent) => agent.id)
    );
    const requestedAgentIds = parseAgentList(historyDetail.session.selectedAgentIds);
    const reusableAgentIds = requestedAgentIds.filter((agentId) =>
      availableAgentIds.has(agentId)
    );
    const missingAgentIds = requestedAgentIds.filter(
      (agentId) => !availableAgentIds.has(agentId)
    );

    const nextModeratorId = availableAgentIds.has(historyDetail.session.moderatorAgentId)
      ? historyDetail.session.moderatorAgentId
      : moderatorAgentId;
    const nextSelectedAgents = new Set(reusableAgentIds);
    nextSelectedAgents.add(nextModeratorId);

    setBrief(
      normalizeDecisionBrief({
        topic: historyDetail.session.topic,
        goal: historyDetail.session.goal,
        background: historyDetail.session.background,
        constraints: historyDetail.session.constraints,
        decisionType: historyDetail.session.decisionType as DecisionBrief['decisionType'],
        desiredOutput: historyDetail.session.desiredOutput as DecisionBrief['desiredOutput'],
        templateId: historyDetail.session.templateId ?? null,
      })
    );
    setAgenda(parseAgendaConfig(historyDetail.session.agendaConfig));
    setResearchConfig(
      historyDetail.researchRun?.searchConfig ??
        parseResearchConfig(historyDetail.session.researchConfig)
    );
    setModeratorAgentId(nextModeratorId);
    setMaxDebateRounds(historyDetail.session.maxDebateRounds ?? 2);
    setSelectedAgents(nextSelectedAgents);
    setModelSelections((prev) => ({ ...prev, ...historyModelSelections }));
    setPersonaSelections((prev) => ({ ...prev, ...historyPersonaSelections }));
    setRightTab('context');
    setActiveHistoryId(null);
    setHistoryDetail(null);
    setFollowUpParentSession({
      id: historyDetail.session.id,
      topic: historyDetail.session.topic,
    });
    resetReplay();
    setAutoScroll('follow');

    if (missingAgentIds.length > 0) {
      setError(
        `Loaded setup with available agents only. Missing API keys for: ${missingAgentIds.join(', ')}`
      );
      return;
    }

    setError(null);
  }, [
    agents,
    historyDetail,
    historyModelSelections,
    historyPersonaSelections,
    moderatorAgentId,
    resetReplay,
    setAutoScroll,
    setError,
  ]);

  const updateLocalActionItems = useCallback(
    (
      items: ActionItem[],
      itemId: string,
      patch: Partial<Pick<ActionItem, 'status' | 'note'>>
    ) =>
      items.map((item) =>
        item.id === itemId
          ? {
              ...item,
              ...patch,
            }
          : item
      ),
    []
  );

  const handleActionItemUpdate = useCallback(
    async (
      sessionIdToUpdate: string,
      itemId: string,
      patch: { status?: ActionItemStatus; note?: string }
    ) => {
      const response = await fetch(
        `/api/sessions/${sessionIdToUpdate}/action-items/${itemId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        }
      );
      if (!response.ok) {
        throw new Error(`Failed to update action item (${response.status})`);
      }

      const updated = (await response.json()) as ActionItem;

      setHistoryDetail((prev) =>
        prev && prev.session.id === sessionIdToUpdate
          ? {
              ...prev,
              actionItems: prev.actionItems.map((item) =>
                item.id === itemId ? updated : item
              ),
            }
          : prev
      );

      if (sessionId === sessionIdToUpdate) {
        setActionItems(
          useDiscussionStore
            .getState()
            .actionItems.map((item) => (item.id === itemId ? updated : item))
        );
      }

      await refreshSessions();
      return updated;
    },
    [refreshSessions, sessionId, setActionItems]
  );

  const handleSessionReviewUpdate = useCallback(
    async (
      sessionIdToUpdate: string,
      patch: {
        decisionStatus?: DecisionStatus;
        retrospectiveNote?: string;
        outcomeSummary?: string;
      }
    ) => {
      const response = await fetch(`/api/sessions/${sessionIdToUpdate}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!response.ok) {
        throw new Error(`Failed to update session review (${response.status})`);
      }

      setHistoryDetail((prev) =>
        prev && prev.session.id === sessionIdToUpdate
          ? {
              ...prev,
              session: {
                ...prev.session,
                ...(patch.decisionStatus
                  ? { decisionStatus: patch.decisionStatus }
                  : {}),
                ...(patch.retrospectiveNote !== undefined
                  ? { retrospectiveNote: patch.retrospectiveNote }
                  : {}),
                ...(patch.outcomeSummary !== undefined
                  ? { outcomeSummary: patch.outcomeSummary }
                  : {}),
              },
            }
          : prev
      );

      if (sessionId === sessionIdToUpdate) {
        setReview({
          retrospectiveNote: patch.retrospectiveNote,
          outcomeSummary: patch.outcomeSummary,
        });
      }

      await refreshSessions();
    },
    [refreshSessions, sessionId, setReview]
  );

  const handleResearchRerun = useCallback(
    async (sessionIdToUpdate: string, config?: ResearchConfig) => {
      setResearchBusySessionId(sessionIdToUpdate);
      if (sessionId === sessionIdToUpdate) {
        setResearchStatus('running');
      }

      try {
        const response = await fetch(`/api/sessions/${sessionIdToUpdate}/research`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            config ? { researchConfig: config } : {}
          ),
        });

        if (!response.ok) {
          throw new Error(`Failed to rerun research (${response.status})`);
        }

        const nextRun = (await response.json()) as ResearchRunDetail | null;

        setHistoryDetail((prev) =>
          prev && prev.session.id === sessionIdToUpdate
            ? {
                ...prev,
                researchRun: nextRun,
              }
            : prev
        );

        if (sessionId === sessionIdToUpdate) {
          setResearchRun(nextRun);
        }

        await refreshSessions();
      } finally {
        setResearchBusySessionId(null);
      }
    },
    [refreshSessions, sessionId, setResearchRun, setResearchStatus]
  );

  const handleResearchSourceSelection = useCallback(
    async (sessionIdToUpdate: string, sourceId: string, selected: boolean) => {
      const response = await fetch(
        `/api/sessions/${sessionIdToUpdate}/research/sources/${sourceId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ selected }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to update research source (${response.status})`);
      }

      const updated = (await response.json()) as ResearchRunDetail['sources'][number];

      setHistoryDetail((prev) =>
        prev && prev.session.id === sessionIdToUpdate && prev.researchRun
          ? {
              ...prev,
              researchRun: {
                ...prev.researchRun,
                sources: prev.researchRun.sources.map((source) =>
                  source.id === sourceId ? updated : source
                ),
              },
            }
          : prev
      );

      if (sessionId === sessionIdToUpdate) {
        const currentRun = useDiscussionStore.getState().research.run;
        if (currentRun) {
          setResearchRun({
            ...currentRun,
            sources: currentRun.sources.map((source) =>
              source.id === sourceId ? updated : source
            ),
          });
        }
      }
    },
    [sessionId, setResearchRun]
  );

  const handleDecisionStatusChange = useCallback(
    async (sessionIdToUpdate: string, nextStatus: DecisionStatus) => {
      await handleSessionReviewUpdate(sessionIdToUpdate, {
        decisionStatus: nextStatus,
      });
    },
    [handleSessionReviewUpdate]
  );

  const toggleCompareSession = useCallback((sessionIdToToggle: string) => {
    setCompareSessionIds((prev) => {
      if (prev.includes(sessionIdToToggle)) {
        return prev.filter((id) => id !== sessionIdToToggle);
      }
      if (prev.length >= 2) {
        return [prev[1], sessionIdToToggle];
      }
      return [...prev, sessionIdToToggle];
    });
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-dvh flex-col overflow-hidden rt-shell">
      {/* ── Header ── */}
      <header className="shrink-0 border-b rt-surface-glass px-4 py-2.5 md:px-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-black tracking-tight rt-text-strong md:text-2xl">
              Round Table
            </h1>
            <p className="hidden text-xs rt-text-muted sm:block">
              Multi-agent council · strategy, investment &amp; life planning
            </p>
          </div>
          <PhaseIndicator
            phase={phase}
            round={round}
            isRunning={isRunning}
            moderator={stageModerator.displayName}
          />
        </div>
      </header>

      {/* ── 3-column main grid ── */}
      <main className="flex-1 overflow-hidden grid gap-3 p-3 xl:grid-cols-[280px_1fr_340px] lg:grid-cols-[260px_1fr]">

        {/* ─────────────────────────────────────────────────────────────────
            LEFT PANEL: Session Setup + Compact Agent Config
        ───────────────────────────────────────────────────────────────── */}
        <aside className="flex min-h-0 flex-col gap-2 overflow-hidden">
          {/* Scrollable config area */}
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-0.5">

            {/* Decision brief */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.2em] rt-text-muted">
                  Template
                </label>
                <Select
                  value={brief.templateId ?? 'none'}
                  onValueChange={(value) => {
                    if (!value || value === 'none') {
                      updateBrief('templateId', null);
                      return;
                    }
                    applyTemplate(value);
                  }}
                  disabled={isRunning}
                >
                  <SelectTrigger className="rt-input h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" className="text-xs">
                      Custom
                    </SelectItem>
                    {DECISION_TEMPLATES.map((template) => (
                      <SelectItem key={template.id} value={template.id} className="text-xs">
                        {template.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.2em] rt-text-muted">
                  Decision Type
                </label>
                <Select
                  value={brief.decisionType}
                  onValueChange={(value) => {
                    if (!value) return;
                    updateBrief(
                      'decisionType',
                      value as DecisionBrief['decisionType']
                    );
                  }}
                  disabled={isRunning}
                >
                  <SelectTrigger className="rt-input h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[
                      ['general', 'General'],
                      ['investment', 'Investment'],
                      ['product', 'Product'],
                      ['career', 'Career'],
                      ['life', 'Life'],
                      ['risk', 'Risk'],
                    ].map(([value, label]) => (
                      <SelectItem key={value} value={value} className="text-xs">
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.2em] rt-text-muted">
                Topic
              </label>
              <Textarea
                placeholder="输入要讨论的议题"
                value={brief.topic}
                onChange={(e) => updateBrief('topic', e.target.value)}
                disabled={isRunning}
                className="rt-input min-h-[80px] text-sm"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.2em] rt-text-muted">
                Goal
              </label>
              <Textarea
                placeholder="这次讨论要帮你做出什么判断？"
                value={brief.goal}
                onChange={(e) => updateBrief('goal', e.target.value)}
                disabled={isRunning}
                className="rt-input min-h-[56px] text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.2em] rt-text-muted">
                  Desired Output
                </label>
                <Select
                  value={brief.desiredOutput}
                  onValueChange={(value) => {
                    if (!value) return;
                    updateBrief(
                      'desiredOutput',
                      value as DecisionBrief['desiredOutput']
                    );
                  }}
                  disabled={isRunning}
                >
                  <SelectTrigger className="rt-input h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[
                      ['recommendation', 'Recommendation'],
                      ['comparison', 'Comparison'],
                      ['risk_assessment', 'Risk Assessment'],
                      ['action_plan', 'Action Plan'],
                      ['consensus', 'Consensus'],
                    ].map(([value, label]) => (
                      <SelectItem key={value} value={value} className="text-xs">
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
                <div className="rounded-xl border rt-border-soft px-3 py-2 text-[11px] rt-text-dim">
                {activeTemplate
                  ? activeTemplate.description
                  : 'Use a template to prefill a repeatable decision workflow.'}
                </div>
              </div>

            {activeTemplate && (
              <div className="rounded-xl border rt-surface p-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] rt-text-muted">
                  Template Guide
                </p>
                <div className="mt-2 space-y-1.5 text-[11px] leading-relaxed rt-text-dim">
                  <p>Goal hint: {activeTemplate.goal}</p>
                  <p>Background hint: {activeTemplate.background}</p>
                  <p>Constraint hint: {activeTemplate.constraints}</p>
                </div>
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.2em] rt-text-muted">
                Background
              </label>
              <Textarea
                placeholder="背景、上下文、你已知的情况"
                value={brief.background}
                onChange={(e) => updateBrief('background', e.target.value)}
                disabled={isRunning}
                className="rt-input min-h-[72px] text-sm"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.2em] rt-text-muted">
                Constraints
              </label>
              <Textarea
                placeholder="预算、时间、风险边界、不可接受后果"
                value={brief.constraints}
                onChange={(e) => updateBrief('constraints', e.target.value)}
                disabled={isRunning}
                className="rt-input min-h-[72px] text-sm"
              />
            </div>

            <div className="rounded-xl border rt-surface p-2.5">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] rt-text-muted">
                Agenda
              </p>
              <div className="space-y-2">
                <Textarea
                  placeholder="重点问题"
                  value={agenda.focalQuestions}
                  onChange={(e) => updateAgenda('focalQuestions', e.target.value)}
                  disabled={isRunning}
                  className="rt-input min-h-[52px] text-xs"
                />
                <Textarea
                  placeholder="必须覆盖的维度"
                  value={agenda.requiredDimensions}
                  onChange={(e) => updateAgenda('requiredDimensions', e.target.value)}
                  disabled={isRunning}
                  className="rt-input min-h-[52px] text-xs"
                />
                <label className="flex items-center gap-2 text-xs rt-text-strong">
                  <Checkbox
                    checked={agenda.requireResearch}
                    onCheckedChange={(checked) =>
                      updateAgenda('requireResearch', Boolean(checked))
                    }
                    disabled={isRunning}
                  />
                  Require research
                </label>
                <label className="flex items-center gap-2 text-xs rt-text-strong">
                  <Checkbox
                    checked={agenda.requestRecommendation}
                    onCheckedChange={(checked) =>
                      updateAgenda('requestRecommendation', Boolean(checked))
                    }
                    disabled={isRunning}
                  />
                  Request final recommendation
                </label>
              </div>
            </div>

            <div className="rounded-xl border rt-surface p-2.5">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] rt-text-muted">
                Research
              </p>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs rt-text-strong">
                  <Checkbox
                    checked={researchConfig.enabled}
                    onCheckedChange={(checked) =>
                      updateResearchConfig('enabled', Boolean(checked))
                    }
                    disabled={isRunning}
                  />
                  Enable research pipeline
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <Select
                    value={researchConfig.mode}
                    onValueChange={(value) => {
                      if (!value) return;
                      updateResearchConfig(
                        'mode',
                        value as ResearchConfig['mode']
                      );
                    }}
                    disabled={isRunning || !researchConfig.enabled}
                  >
                    <SelectTrigger className="rt-input h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto" className="text-xs">
                        Auto queries
                      </SelectItem>
                      <SelectItem value="guided" className="text-xs">
                        Guided queries
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={String(researchConfig.maxSources)}
                    onValueChange={(value) => {
                      if (!value) return;
                      updateResearchConfig('maxSources', Number(value));
                    }}
                    disabled={isRunning || !researchConfig.enabled}
                  >
                    <SelectTrigger className="rt-input h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[4, 6, 8].map((value) => (
                        <SelectItem key={value} value={String(value)} className="text-xs">
                          {value} sources
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Textarea
                  placeholder="Additional queries (one per line)"
                  value={researchConfig.userQueries.join('\n')}
                  onChange={(event) =>
                    updateResearchConfig(
                      'userQueries',
                      event.target.value
                        .split('\n')
                        .map((item) => item.trim())
                        .filter(Boolean)
                    )
                  }
                  disabled={
                    isRunning ||
                    !researchConfig.enabled ||
                    researchConfig.mode !== 'guided'
                  }
                  className="rt-input min-h-[60px] text-xs"
                />
                <Textarea
                  placeholder="Preferred domains, comma separated"
                  value={researchConfig.preferredDomains.join(', ')}
                  onChange={(event) =>
                    updateResearchConfig(
                      'preferredDomains',
                      event.target.value
                        .split(',')
                        .map((item) => item.trim())
                        .filter(Boolean)
                    )
                  }
                  disabled={isRunning || !researchConfig.enabled}
                  className="rt-input min-h-[52px] text-xs"
                />
                <p className="text-[10px] leading-relaxed rt-text-dim">
                  Auto mode will generate topic, risk, and verification queries.
                  Guided mode keeps those and appends your custom queries.
                </p>
              </div>
            </div>

            {followUpParentSession && (
              <div className="rounded-xl border bg-[color-mix(in_srgb,var(--rt-live-state)_10%,transparent)] px-3 py-2 text-xs">
                <p className="font-semibold rt-text-strong">Follow-up session</p>
                <p className="mt-1 rt-text-muted">
                  Continuing from {followUpParentSession.topic}
                </p>
                <button
                  type="button"
                  className="mt-1 rt-text-dim underline"
                  onClick={() => setFollowUpParentSession(null)}
                  disabled={isRunning}
                >
                  Clear link
                </button>
              </div>
            )}

            {/* Moderator + Debate Rounds (2-column) */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.2em] rt-text-muted">
                  Moderator
                </label>
                <Select
                  value={moderatorAgentId}
                  onValueChange={(value) => {
                    if (!value) return;
                    setModeratorAgentId(value);
                    setSelectedAgents((prev) => new Set([...prev, value]));
                  }}
                  disabled={isRunning}
                >
                  <SelectTrigger className="rt-input h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {agents
                      .filter((agent) => agent.available)
                      .map((agent) => (
                        <SelectItem key={agent.id} value={agent.id} className="text-sm">
                          {agent.displayName}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.2em] rt-text-muted">
                  Rounds
                </label>
                <Select
                  value={String(maxDebateRounds)}
                  onValueChange={(value) => {
                    if (!value) return;
                    setMaxDebateRounds(Number(value));
                  }}
                  disabled={isRunning}
                >
                  <SelectTrigger className="rt-input h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3].map((n) => (
                      <SelectItem key={n} value={String(n)} className="text-sm">
                        {n} rounds
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Council heading */}
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] rt-text-muted">
                Council
              </p>
              <span className="text-[11px] rt-text-dim">{selectedAgents.size} selected</span>
            </div>

            {/* Compact agent cards — no accordion, config always visible */}
            {loadingAgents ? (
              <p className="text-sm rt-text-muted">Loading agents…</p>
            ) : (
              <div className="space-y-1.5">
                {agents.map((agent) => {
                  const isModerator = agent.id === moderatorAgentId;
                  const isSelected = selectedAgents.has(agent.id);
                  const isDisabled = !agent.available || isRunning;
                  const personaSelection = personaSelections[agent.id] ?? {};
                  const recommendedPresetIds = (agent.recommendedPersonaPresetIds ?? [])
                    .filter((id) => personaPresetMap.has(id))
                    .slice(0, 3);

                  return (
                    <div
                      key={agent.id}
                      className={`rounded-xl border p-2.5 transition-all duration-200 ${
                        isSelected
                          ? 'rt-surface-live shadow-[0_0_16px_color-mix(in_srgb,var(--rt-stage-glow-primary)_18%,transparent)]'
                          : 'rt-surface-faint opacity-55'
                      } ${!agent.available ? 'opacity-40' : ''}`}
                    >
                      {/* Row 1: checkbox + color dot + name + badges */}
                      <div className="flex items-center gap-1.5">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleAgent(agent.id)}
                          disabled={isDisabled || isModerator}
                        />
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: agent.color }}
                        />
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold rt-text-strong">
                          {agent.displayName}
                        </span>
                        {isModerator && (
                          <Badge
                            variant="secondary"
                            className="shrink-0 border border-[color-mix(in_srgb,var(--rt-stage-glow-secondary)_35%,transparent)] bg-[color-mix(in_srgb,var(--rt-stage-glow-secondary)_18%,transparent)] px-1.5 py-0 text-[9px] rt-text-strong"
                          >
                            MC
                          </Badge>
                        )}
                        {!agent.available && (
                          <span className="shrink-0 text-[10px] rt-error">No key</span>
                        )}
                      </div>

                      {/* Inline config — visible when selected, no expand needed */}
                      {isSelected && agent.available && (
                        <div className="mt-2 space-y-1.5 pl-[22px]">
                          {/* Model select */}
                          {agent.availableModels.length > 0 && (
                            <Select
                              value={modelSelections[agent.id] ?? agent.modelId}
                              onValueChange={(v) => v && handleModelChange(agent.id, v)}
                              disabled={isRunning}
                            >
                              <SelectTrigger className="rt-input h-7 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {agent.availableModels.map((m) => (
                                  <SelectItem key={m.id} value={m.id} className="text-xs">
                                    {m.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}

                          {/* Persona preset chips */}
                          {recommendedPresetIds.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {recommendedPresetIds.map((presetId) => {
                                const preset = personaPresetMap.get(presetId);
                                if (!preset) return null;
                                const active = presetId === personaSelection.presetId;
                                return (
                                  <button
                                    key={presetId}
                                    type="button"
                                    disabled={isRunning}
                                    onClick={() =>
                                      handlePersonaPresetChange(
                                        agent.id,
                                        active ? undefined : presetId
                                      )
                                    }
                                    className={`rounded-full border px-2 py-0.5 text-[10px] transition-all ${
                                      active
                                        ? 'rt-border-strong bg-[color-mix(in_srgb,var(--rt-live-state)_22%,transparent)] rt-text-strong'
                                        : 'rt-surface rt-text-dim hover:rt-text-muted'
                                    }`}
                                  >
                                    {preset.label}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}

                      {!agent.available && (
                        <p className="mt-2 text-xs rt-error">Missing key: {agent.missingKey}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Sticky bottom: Start / Stop + Interjection */}
          <div className="shrink-0 space-y-2">
            <div className="flex gap-2">
              <Button
                onClick={handleStart}
                disabled={isRunning || !brief.topic.trim() || selectedAgents.size < 2}
                className="h-10 flex-1 text-sm"
              >
                Start Session
              </Button>
              {isRunning && (
                <Button variant="destructive" className="h-10" onClick={stopDiscussion}>
                  Stop
                </Button>
              )}
            </div>

            {/* Interjection — only visible while running */}
            {isRunning && (
              <div className="rt-surface space-y-1.5 rounded-xl border p-2.5">
                <label className="text-[11px] font-semibold uppercase tracking-[0.18em] rt-text-muted">
                  Runtime Control
                </label>
                <Select
                  value={interjectionControlType}
                  onValueChange={(value) => {
                    if (!value) return;
                    setInterjectionControlType(value as DecisionControlType);
                  }}
                >
                  <SelectTrigger className="rt-input h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(DECISION_CONTROL_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value} className="text-xs">
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Textarea
                  placeholder="每轮开始前注入新要求…"
                  value={interjection}
                  onChange={(e) => setInterjection(e.target.value)}
                  className="rt-input min-h-[56px] text-xs"
                />
                <div className="flex items-center justify-between">
                  <Button
                    size="sm"
                    className="h-7 text-xs"
                    onClick={handleInterjection}
                    disabled={!interjection.trim()}
                  >
                    Send
                  </Button>
                  <span className="text-xs rt-text-dim">
                    Queued: {interjections.length}
                  </span>
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* ─────────────────────────────────────────────────────────────────
            CENTER PANEL: Unified Discussion Feed
        ───────────────────────────────────────────────────────────────── */}
        <div className="flex min-h-0 flex-col gap-2 overflow-hidden">
          {/* Feed header */}
          <div className="shrink-0 space-y-1.5">
            <div className="flex items-center gap-2 px-0.5">
              <h2 className="min-w-0 flex-1 truncate text-sm font-semibold rt-text-strong">
                {historyDetail
                  ? historyDetail.session.topic
                  : isRunning
                    ? 'Live Discussion'
                    : 'Discussion Feed'}
              </h2>

              {!historyDetail && feedMessages.length > 0 && (
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 shrink-0 text-xs"
                    onClick={handleExportLiveTranscript}
                  >
                    Export Transcript
                  </Button>
                  {decisionSummary && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 shrink-0 text-xs"
                      onClick={handleExportLiveDecisionCard}
                    >
                      Export Decision
                    </Button>
                  )}
                  {actionItems.length > 0 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 shrink-0 text-xs"
                      onClick={handleExportLiveChecklist}
                    >
                      Export Checklist
                    </Button>
                  )}
                </div>
              )}

              {/* Follow-latest button when auto-scroll is paused */}
              {ui.autoScroll === 'paused' && !historyDetail && (
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-6 shrink-0 text-[11px]"
                  onClick={() => setAutoScroll('follow')}
                >
                  ↓ Follow
                </Button>
              )}

              {/* Replay controls */}
              {historyDetail && (
                <div className="flex shrink-0 items-center gap-1">
                  {replay.status === 'playing' ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-7 gap-1 text-xs"
                      onClick={pauseReplay}
                    >
                      <Pause className="h-3 w-3" />
                    </Button>
                  ) : (
                    <Button size="sm" className="h-7 gap-1 text-xs" onClick={startReplay}>
                      <Play className="h-3 w-3" />
                      {replay.status === 'idle' ? 'Replay' : 'Resume'}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs"
                    onClick={resetReplayCursor}
                  >
                    <RotateCcw className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs"
                    onClick={exitReplay}
                    title="Show full timeline"
                  >
                    <FastForward className="h-3 w-3" />
                  </Button>
                  <span className="rt-chip-live rounded-full border px-2 py-0.5 text-[10px]">
                    {replay.status === 'idle'
                      ? `${replayableMessages.length} msgs`
                      : `${Math.min(replay.cursor + 1, replayableMessages.length)} / ${replayableMessages.length}`}
                  </span>
                </div>
              )}
            </div>

            {/* Replay timeline scrubber */}
            {historyDetail && replayableMessages.length > 0 && (
              <input
                type="range"
                min={0}
                max={Math.max(0, replayableMessages.length - 1)}
                value={
                  replay.status === 'idle'
                    ? Math.max(0, replayableMessages.length - 1)
                    : Math.min(
                        replay.cursor,
                        Math.max(0, replayableMessages.length - 1)
                      )
                }
                onChange={(e) => {
                  setReplayStatus('paused');
                  setReplayCursor(Number(e.currentTarget.value));
                }}
                className="h-1.5 w-full accent-[var(--rt-live-state)]"
              />
            )}
          </div>

          {/* Discussion Feed */}
          <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border rt-surface">
            <DiscussionFeed
              messages={feedMessages}
              autoScroll={ui.autoScroll === 'follow'}
              onScrolledUp={() => setAutoScroll('paused')}
              onScrolledToBottom={() => setAutoScroll('follow')}
              className="h-full"
              emptyLabel={
                isRunning ? '会议进行中，等待发言…' : '选择话题并开始会议，对话将显示在这里'
              }
            />
          </div>

          {/* Error banner */}
          {error && (
            <div className="shrink-0 rounded-xl border bg-[color-mix(in_srgb,var(--rt-stage-glow-secondary)_12%,transparent)] px-3 py-2 text-sm rt-error">
              {error}
            </div>
          )}

          {/* Stage + Research fallback at lg (non-xl screens without right panel) */}
          <div className="xl:hidden shrink-0 space-y-3">
            <RoundTableStage
              moderator={stageMod}
              moderatorMessage={stageModeratorMessage}
              agents={stageAgents}
              activeSpeakerId={stageActiveSpeakerId}
              phase={stagePhase}
              isRunning={isRunning}
              stageMode="mobile-hybrid"
            />
            {research.status !== 'idle' && (
              <ResearchPanel
                status={research.status}
                sources={research.sources}
                researchRun={research.run}
                busy={researchBusySessionId === sessionId}
                onRerun={
                  sessionId
                    ? () =>
                        void handleResearchRerun(
                          sessionId,
                          research.run?.searchConfig ?? researchConfig
                        ).catch((error) =>
                          setError(
                            error instanceof Error ? error.message : String(error)
                          )
                        )
                    : null
                }
                onToggleSourceSelection={
                  sessionId
                    ? (sourceId, selected) =>
                        void handleResearchSourceSelection(
                          sessionId,
                          sourceId,
                          selected
                        ).catch((error) =>
                          setError(
                            error instanceof Error ? error.message : String(error)
                          )
                        )
                    : null
                }
              />
            )}
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────────
            RIGHT PANEL: Context | History (xl+ only)
        ───────────────────────────────────────────────────────────────── */}
        <div className="hidden xl:flex min-h-0 flex-col gap-2 overflow-hidden">
          {/* Tab switcher */}
          <div className="shrink-0 flex gap-1 rounded-xl border rt-surface p-1">
            {(['context', 'history'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setRightTab(tab)}
                className={`flex-1 rounded-lg py-1.5 text-xs font-semibold capitalize transition-all ${
                  rightTab === tab
                    ? 'bg-[color-mix(in_srgb,var(--rt-live-state)_18%,transparent)] rt-text-strong'
                    : 'rt-text-dim hover:rt-text-muted'
                }`}
              >
                {tab === 'context' ? 'Context' : 'History'}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="min-h-0 flex-1 overflow-y-auto space-y-3 pr-0.5">

            {/* ── Context Tab ── */}
            {rightTab === 'context' && (
              <>
                {/* Visual stage (compact mobile-hybrid mode) */}
                <RoundTableStage
                  moderator={stageMod}
                  moderatorMessage={stageModeratorMessage}
                  agents={stageAgents}
                  activeSpeakerId={stageActiveSpeakerId}
                  phase={stagePhase}
                  isRunning={isRunning}
                  stageMode="mobile-hybrid"
                />

                {/* Web Research */}
                {research.status !== 'idle' && (
                  <ResearchPanel
                    status={research.status}
                    sources={research.sources}
                    researchRun={research.run}
                    busy={researchBusySessionId === sessionId}
                    onRerun={
                      sessionId
                        ? () =>
                            void handleResearchRerun(
                              sessionId,
                              research.run?.searchConfig ?? researchConfig
                            ).catch((error) =>
                              setError(
                                error instanceof Error
                                  ? error.message
                                  : String(error)
                              )
                            )
                        : null
                    }
                    onToggleSourceSelection={
                      sessionId
                        ? (sourceId, selected) =>
                            void handleResearchSourceSelection(
                              sessionId,
                              sourceId,
                              selected
                            ).catch((error) =>
                              setError(
                                error instanceof Error
                                  ? error.message
                                  : String(error)
                              )
                            )
                        : null
                    }
                  />
                )}

                {/* Current minutes */}
                {currentSummary && (
                  <Card className="rt-surface-minutes">
                    <CardHeader className="px-3 pb-1.5 pt-3">
                      <CardTitle className="text-sm rt-text-strong">Meeting Minutes</CardTitle>
                    </CardHeader>
                    <CardContent className="px-3 pb-3">
                      <div className="rt-surface-glass mb-2 max-h-[200px] overflow-auto rounded-xl border p-3 text-sm">
                        <MarkdownContent content={currentSummary} />
                      </div>
                      <Button
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() =>
                          downloadMarkdown(
                            `minutes-${sessionId ?? 'current'}.md`,
                            currentSummary
                          )
                        }
                      >
                        Export .md
                      </Button>
                    </CardContent>
                  </Card>
                )}

                {decisionSummary && (
                  <DecisionSummaryCard
                    title="Current Decision Card"
                    decisionSummary={decisionSummary}
                    researchSources={research.run?.sources ?? research.sources}
                    researchEvaluation={research.run?.evaluation ?? null}
                    footer={
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="h-7 text-xs"
                          onClick={handleExportLiveDecisionCard}
                        >
                          Export decision
                        </Button>
                      </div>
                    }
                  />
                )}

                {sessionId && actionItems.length > 0 && (
                  <Card className="rt-surface">
                    <CardHeader className="px-3 pb-1.5 pt-3">
                      <CardTitle className="text-sm rt-text-strong">
                        Execution Plan
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 px-3 pb-3">
                      {actionItems.map((item) => (
                        <div
                          key={item.id}
                          className="rounded-xl border rt-border-soft p-2.5"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="space-y-1">
                              <p className="text-sm font-medium rt-text-strong">
                                {item.content}
                              </p>
                              <div className="flex flex-wrap gap-1">
                                <span className="rounded-full border rt-border-soft px-2 py-0.5 text-[10px] rt-text-muted">
                                  {item.source === 'carried_forward'
                                    ? 'Carried forward'
                                    : 'Generated'}
                                </span>
                                {item.carriedFromSessionId && (
                                  <span className="rounded-full border rt-border-soft px-2 py-0.5 text-[10px] rt-text-muted">
                                    {item.carriedFromSessionId.slice(0, 8)}
                                  </span>
                                )}
                              </div>
                            </div>
                            <Select
                              value={item.status}
                              onValueChange={(value) => {
                                const nextStatus = value as ActionItemStatus;
                                setActionItems(
                                  updateLocalActionItems(actionItems, item.id, {
                                    status: nextStatus,
                                  })
                                );
                                void handleActionItemUpdate(sessionId, item.id, {
                                  status: nextStatus,
                                }).catch((error) =>
                                  setError(
                                    error instanceof Error
                                      ? error.message
                                      : String(error)
                                  )
                                );
                              }}
                              disabled={isRunning}
                            >
                              <SelectTrigger className="rt-input h-8 w-[150px] text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {ACTION_ITEM_STATUS_OPTIONS.map((status) => (
                                  <SelectItem
                                    key={status}
                                    value={status}
                                    className="text-xs"
                                  >
                                    {ACTION_ITEM_STATUS_LABELS[status]}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <Textarea
                            value={item.note ?? ''}
                            onChange={(event) =>
                              setActionItems(
                                updateLocalActionItems(actionItems, item.id, {
                                  note: event.target.value,
                                })
                              )
                            }
                            onBlur={() =>
                              void handleActionItemUpdate(sessionId, item.id, {
                                note:
                                  useDiscussionStore
                                    .getState()
                                    .actionItems.find((entry) => entry.id === item.id)
                                    ?.note ?? '',
                              }).catch((error) =>
                                setError(
                                  error instanceof Error
                                    ? error.message
                                    : String(error)
                                )
                              )
                            }
                            disabled={isRunning}
                            placeholder="Execution note, owner, or outcome signal"
                            className="rt-input mt-2 min-h-[74px] text-xs"
                          />
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {sessionId && !isRunning && (
                  <Card className="rt-surface">
                    <CardHeader className="px-3 pb-1.5 pt-3">
                      <CardTitle className="text-sm rt-text-strong">
                        Outcome Review
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 px-3 pb-3">
                      <Textarea
                        value={review.outcomeSummary}
                        onChange={(event) =>
                          setReview({ outcomeSummary: event.target.value })
                        }
                        placeholder="What happened after this decision?"
                        className="rt-input min-h-[74px] text-xs"
                      />
                      <Textarea
                        value={review.retrospectiveNote}
                        onChange={(event) =>
                          setReview({ retrospectiveNote: event.target.value })
                        }
                        placeholder="What would you adjust in the next round?"
                        className="rt-input min-h-[90px] text-xs"
                      />
                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() =>
                            void handleSessionReviewUpdate(sessionId, {
                              outcomeSummary: useDiscussionStore.getState().review.outcomeSummary,
                              retrospectiveNote:
                                useDiscussionStore.getState().review.retrospectiveNote,
                            }).catch((error) =>
                              setError(
                                error instanceof Error
                                  ? error.message
                                  : String(error)
                              )
                            )
                          }
                        >
                          Save review
                        </Button>
                        {actionItems.length > 0 && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="ml-2 h-7 text-xs"
                            onClick={handleExportLiveChecklist}
                          >
                            Export checklist
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Token usage */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="rt-surface rounded-xl border p-2.5">
                    <div className="mb-1 flex items-center gap-1.5 rt-text-muted">
                      <Cpu className="h-3.5 w-3.5" />
                      <p className="text-xs font-semibold">Input</p>
                    </div>
                    <p className="font-mono text-xl font-semibold rt-text-strong">
                      {usageInputTokens.toLocaleString()}
                    </p>
                    <p className="text-[10px] uppercase tracking-[0.18em] rt-text-muted">
                      tokens
                    </p>
                  </div>
                  <div className="rt-surface rounded-xl border p-2.5">
                    <div className="mb-1 flex items-center gap-1.5 rt-text-muted">
                      <Activity className="h-3.5 w-3.5" />
                      <p className="text-xs font-semibold">Output</p>
                    </div>
                    <p className="font-mono text-xl font-semibold rt-text-strong">
                      {usageOutputTokens.toLocaleString()}
                    </p>
                    <p className="text-[10px] uppercase tracking-[0.18em] rt-text-muted">
                      tokens
                    </p>
                  </div>
                </div>

                {sessionId && (
                  <p className="truncate text-[11px] rt-text-dim">Session: {sessionId}</p>
                )}
              </>
            )}

            {/* ── History Tab ── */}
            {rightTab === 'history' && (
              <>
                {/* Session list */}
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <History className="h-3.5 w-3.5 rt-text-muted" />
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] rt-text-muted">
                      Sessions
                    </p>
                  </div>
                  <div className="mb-2 space-y-2">
                    <Input
                      value={historyQuery}
                      onChange={(event) => setHistoryQuery(event.target.value)}
                      placeholder="Search topic, goal, status, template…"
                      className="rt-input h-8 text-xs"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <Select
                        value={historyStatusFilter}
                        onValueChange={(value) => {
                          if (!value) return;
                          setHistoryStatusFilter(value as typeof historyStatusFilter);
                        }}
                      >
                        <SelectTrigger className="rt-input h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all" className="text-xs">
                            All statuses
                          </SelectItem>
                          {historyStatusOptions.map((status) => (
                            <SelectItem key={status} value={status} className="text-xs">
                              {status}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={historyTemplateFilter}
                        onValueChange={(value) => {
                          setHistoryTemplateFilter(value ?? 'all');
                        }}
                      >
                        <SelectTrigger className="rt-input h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all" className="text-xs">
                            All templates
                          </SelectItem>
                          {historyTemplateOptions.map((templateId) => (
                            <SelectItem key={templateId} value={templateId} className="text-xs">
                              {DECISION_TEMPLATES.find((template) => template.id === templateId)
                                ?.label ?? templateId}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2">
                      <Select
                        value={historyTimeRange}
                        onValueChange={(value) => {
                          if (!value) return;
                          setHistoryTimeRange(value as typeof historyTimeRange);
                        }}
                      >
                        <SelectTrigger className="rt-input h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all" className="text-xs">
                            All time
                          </SelectItem>
                          <SelectItem value="7d" className="text-xs">
                            Last 7 days
                          </SelectItem>
                          <SelectItem value="30d" className="text-xs">
                            Last 30 days
                          </SelectItem>
                          <SelectItem value="90d" className="text-xs">
                            Last 90 days
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <span className="text-[11px] rt-text-dim">
                        {filteredSessions.length} / {sessions.length}
                      </span>
                    </div>
                  </div>
                  {sessions.length === 0 ? (
                    <p className="text-sm rt-text-muted">No sessions yet.</p>
                  ) : filteredSessions.length === 0 ? (
                    <p className="text-sm rt-text-muted">
                      No sessions match the current filters.
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {filteredSessions.map((session) => {
                        const active = session.id === activeHistoryId;
                        const presetLabels = Object.values(
                          parsePersonaSelectionMap(session.personaSelections)
                        )
                          .map((sel) =>
                            sel.presetId
                              ? personaPresetMap.get(sel.presetId)?.label
                              : sel.customNote
                                ? 'Custom'
                                : undefined
                          )
                          .filter((l): l is string => Boolean(l));
                        const uniquePresetLabels = [...new Set(presetLabels)].slice(0, 2);

                        return (
                          <div
                            key={session.id}
                            className={`rounded-xl border p-2.5 ${active ? 'rt-surface-live' : 'rt-surface'}`}
                          >
                            <button
                              className="w-full text-left"
                              onClick={() => void loadHistory(session.id)}
                            >
                              <p className="line-clamp-2 text-sm font-semibold rt-text-strong">
                                {session.topic}
                              </p>
                              <p className="mt-0.5 text-[11px] rt-text-muted">
                                {new Date(session.createdAt).toLocaleString()} · {session.status}
                              </p>
                              <p className="mt-0.5 text-[10px] rt-text-dim">
                                {(DECISION_TEMPLATES.find(
                                  (template) => template.id === session.templateId
                                )?.label ?? session.decisionType) || 'General'}
                                {' · '}
                                {session.decisionStatus}
                              </p>
                              {uniquePresetLabels.length > 0 && (
                                <p className="mt-0.5 text-[10px] rt-text-dim">
                                  {uniquePresetLabels.join(', ')}
                                </p>
                              )}
                            </button>
                            <div className="mt-1.5 flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] rt-text-dim">
                                  {session.id.slice(0, 8)}
                                </span>
                                <button
                                  type="button"
                                  className={`rounded-full border px-2 py-0.5 text-[10px] ${
                                    compareSessionIds.includes(session.id)
                                      ? 'rt-border-strong rt-text-strong'
                                      : 'rt-text-dim'
                                  }`}
                                  onClick={() => toggleCompareSession(session.id)}
                                >
                                  Compare
                                </button>
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 px-2 text-[10px] rt-error hover:bg-[color-mix(in_srgb,var(--rt-stage-glow-secondary)_18%,transparent)]"
                                onClick={() => void deleteHistory(session.id)}
                              >
                                Delete
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Loading indicator */}
                {loadingHistory && (
                  <p className="text-sm rt-text-muted">Loading session…</p>
                )}

                {/* Session detail when loaded */}
                {historyDetail && !loadingHistory && (
                  <div className="space-y-2">
                    {/* Meta info */}
                    <div className="rt-surface rounded-xl border p-2.5">
                      <p className="line-clamp-2 text-sm font-semibold rt-text-strong">
                        {historyDetail.session.topic}
                      </p>
                      <p className="mt-0.5 text-xs rt-text-muted">
                        {historyDetail.session.status} ·{' '}
                        {historyDetail.session.usageInputTokens.toLocaleString()} in ·{' '}
                        {historyDetail.session.usageOutputTokens.toLocaleString()} out
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        <span className="rounded-full border rt-border-soft px-2 py-0.5 text-[10px] rt-text-muted">
                          {(DECISION_TEMPLATES.find(
                            (template) => template.id === historyDetail.session.templateId
                          )?.label ?? historyDetail.session.decisionType) || 'General'}
                        </span>
                        <span className="rounded-full border rt-border-soft px-2 py-0.5 text-[10px] rt-text-muted">
                          {historyDetail.session.desiredOutput}
                        </span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {historySelectedAgentIds.map((agentId) => {
                          const sel = historyPersonaSelections[agentId];
                          const preset = sel?.presetId
                            ? personaPresetMap.get(sel.presetId)
                            : undefined;
                          const label = preset
                            ? preset.label
                            : sel?.customNote
                              ? 'Custom'
                              : 'Default';
                          return (
                            <span
                              key={`${historyDetail.session.id}-${agentId}`}
                              className="rounded-full border rt-border-soft bg-[color-mix(in_srgb,var(--rt-live-state)_10%,transparent)] px-2 py-0.5 text-[10px] rt-text-muted"
                            >
                              {agentId}: {label}
                            </span>
                          );
                        })}
                      </div>
                      <div className="mt-2">
                        <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.18em] rt-text-muted">
                          Decision status
                        </label>
                        <Select
                          value={historyDetail.session.decisionStatus}
                          onValueChange={(value) => {
                            if (!value) return;
                            void handleDecisionStatusChange(
                              historyDetail.session.id,
                              value as DecisionStatus
                            ).catch((error) =>
                              setError(error instanceof Error ? error.message : String(error))
                            );
                          }}
                        >
                          <SelectTrigger className="rt-input h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {DECISION_STATUS_OPTIONS.map((status) => (
                              <SelectItem key={status} value={status} className="text-xs">
                                {status}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="mt-2 space-y-1.5 text-xs">
                        {historyDetail.session.goal && (
                          <p className="rt-text-muted">Goal: {historyDetail.session.goal}</p>
                        )}
                        {historyDetail.session.constraints && (
                          <p className="rt-text-muted">
                            Constraints: {historyDetail.session.constraints}
                          </p>
                        )}
                      </div>
                      {historyDetail.parentSession && (
                        <button
                          type="button"
                          className="mt-2 block text-left text-[11px] underline rt-text-dim"
                          onClick={() => void loadHistory(historyDetail.parentSession!.id)}
                        >
                          Parent session: {historyDetail.parentSession.topic}
                        </button>
                      )}
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <Button
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={handleReuseHistorySetup}
                        >
                          Use setup
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs"
                          onClick={handleExportHistoryTranscript}
                        >
                          Export transcript
                        </Button>
                        {historyDetail.decisionSummary && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs"
                            onClick={handleExportHistoryDecisionCard}
                          >
                            Export decision
                          </Button>
                        )}
                        {historyDetail.actionItems.length > 0 && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs"
                            onClick={handleExportHistoryChecklist}
                          >
                            Export checklist
                          </Button>
                        )}
                      </div>
                    </div>

                    {historyDetail.decisionSummary && (
                      <DecisionSummaryCard
                        title="Decision Card"
                        decisionSummary={historyDetail.decisionSummary}
                        researchSources={historyDetail.researchRun?.sources ?? []}
                        researchEvaluation={historyDetail.researchRun?.evaluation ?? null}
                      />
                    )}

                    {historyDetail.researchRun && (
                      <ResearchPanel
                        status={historyDetail.researchRun.status}
                        sources={historyDetail.researchRun.sources}
                        researchRun={historyDetail.researchRun}
                        busy={researchBusySessionId === historyDetail.session.id}
                        onRerun={() =>
                          void handleResearchRerun(historyDetail.session.id).catch(
                            (error) =>
                              setError(
                                error instanceof Error
                                  ? error.message
                                  : String(error)
                              )
                          )
                        }
                        onToggleSourceSelection={(sourceId, selected) =>
                          void handleResearchSourceSelection(
                            historyDetail.session.id,
                            sourceId,
                            selected
                          ).catch((error) =>
                            setError(
                              error instanceof Error
                                ? error.message
                                : String(error)
                            )
                          )
                        }
                      />
                    )}

                    {historyDetail.actionItems.length > 0 && (
                      <div className="rounded-xl border rt-surface p-2.5">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] rt-text-muted">
                            Execution Plan
                          </p>
                          <span className="text-[10px] rt-text-dim">
                            {historyDetail.actionItems.length} items
                          </span>
                        </div>
                        <div className="space-y-2">
                          {historyDetail.actionItems.map((item) => (
                            <div
                              key={item.id}
                              className="rounded-xl border rt-border-soft p-2.5"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="space-y-1">
                                  <p className="text-sm font-medium rt-text-strong">
                                    {item.content}
                                  </p>
                                  <div className="flex flex-wrap gap-1">
                                    <span className="rounded-full border rt-border-soft px-2 py-0.5 text-[10px] rt-text-muted">
                                      {item.source === 'carried_forward'
                                        ? 'Carried forward'
                                        : 'Generated'}
                                    </span>
                                    {item.carriedFromSessionId && (
                                      <button
                                        type="button"
                                        className="rounded-full border rt-border-soft px-2 py-0.5 text-[10px] underline rt-text-dim"
                                        onClick={() =>
                                          void loadHistory(item.carriedFromSessionId!)
                                        }
                                      >
                                        From {item.carriedFromSessionId.slice(0, 8)}
                                      </button>
                                    )}
                                  </div>
                                </div>
                                <Select
                                  value={item.status}
                                  onValueChange={(value) => {
                                    const nextStatus = value as ActionItemStatus;
                                    setHistoryDetail((prev) =>
                                      prev && prev.session.id === historyDetail.session.id
                                        ? {
                                            ...prev,
                                            actionItems: updateLocalActionItems(
                                              prev.actionItems,
                                              item.id,
                                              { status: nextStatus }
                                            ),
                                          }
                                        : prev
                                    );
                                    void handleActionItemUpdate(
                                      historyDetail.session.id,
                                      item.id,
                                      { status: nextStatus }
                                    ).catch((error) =>
                                      setError(
                                        error instanceof Error
                                          ? error.message
                                          : String(error)
                                      )
                                    );
                                  }}
                                >
                                  <SelectTrigger className="rt-input h-8 w-[150px] text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {ACTION_ITEM_STATUS_OPTIONS.map((status) => (
                                      <SelectItem
                                        key={status}
                                        value={status}
                                        className="text-xs"
                                      >
                                        {ACTION_ITEM_STATUS_LABELS[status]}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <Textarea
                                value={item.note ?? ''}
                                onChange={(event) =>
                                  setHistoryDetail((prev) =>
                                    prev && prev.session.id === historyDetail.session.id
                                      ? {
                                          ...prev,
                                          actionItems: updateLocalActionItems(
                                            prev.actionItems,
                                            item.id,
                                            { note: event.target.value }
                                          ),
                                        }
                                      : prev
                                  )
                                }
                                onBlur={(event) =>
                                  void handleActionItemUpdate(
                                    historyDetail.session.id,
                                    item.id,
                                    { note: event.target.value }
                                  ).catch((error) =>
                                    setError(
                                      error instanceof Error
                                        ? error.message
                                        : String(error)
                                    )
                                  )
                                }
                                placeholder="Execution note, result, or owner"
                                className="rt-input mt-2 min-h-[74px] text-xs"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="rounded-xl border rt-surface p-2.5">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] rt-text-muted">
                        Outcome Review
                      </p>
                      <div className="mt-2 space-y-2">
                        <Textarea
                          value={historyDetail.session.outcomeSummary ?? ''}
                          onChange={(event) =>
                            setHistoryDetail((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    session: {
                                      ...prev.session,
                                      outcomeSummary: event.target.value,
                                    },
                                  }
                                : prev
                            )
                          }
                          placeholder="What happened after this decision?"
                          className="rt-input min-h-[74px] text-xs"
                        />
                        <Textarea
                          value={historyDetail.session.retrospectiveNote ?? ''}
                          onChange={(event) =>
                            setHistoryDetail((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    session: {
                                      ...prev.session,
                                      retrospectiveNote: event.target.value,
                                    },
                                  }
                                : prev
                            )
                          }
                          placeholder="What would you change in the next follow-up?"
                          className="rt-input min-h-[90px] text-xs"
                        />
                        <div className="flex justify-end">
                          <Button
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() =>
                              void handleSessionReviewUpdate(historyDetail.session.id, {
                                outcomeSummary:
                                  historyDetail.session.outcomeSummary ?? '',
                                retrospectiveNote:
                                  historyDetail.session.retrospectiveNote ?? '',
                              }).catch((error) =>
                                setError(
                                  error instanceof Error
                                    ? error.message
                                    : String(error)
                                )
                              )
                            }
                          >
                            Save review
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Session minutes */}
                    {historyDetail.minutes?.content && (
                      <div className="rt-surface-minutes rounded-xl border p-2.5">
                        <div className="mb-1.5 flex items-center justify-between">
                          <span className="text-[11px] font-semibold uppercase tracking-wide rt-text-strong">
                            Minutes
                          </span>
                          <Button
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={() =>
                              downloadMarkdown(
                                `minutes-${historyDetail.session.id}.md`,
                                historyDetail.minutes?.content ?? ''
                              )
                            }
                          >
                            Export
                          </Button>
                        </div>
                        <div className="max-h-[200px] overflow-auto text-sm">
                          <MarkdownContent content={historyDetail.minutes.content} />
                        </div>
                      </div>
                    )}

                    {historyDetail.childSessions.length > 0 && (
                      <div className="rounded-xl border rt-surface p-2.5">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] rt-text-muted">
                          Follow-up Sessions
                        </p>
                        <div className="mt-2 space-y-1.5">
                          {historyDetail.childSessions.map((session) => (
                            <button
                              key={session.id}
                              type="button"
                              className="block w-full rounded-lg border rt-border-soft px-2 py-1.5 text-left text-xs rt-text-strong"
                              onClick={() => void loadHistory(session.id)}
                            >
                              {session.topic}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {similarSessions.length > 0 && (
                      <div className="rounded-xl border rt-surface p-2.5">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] rt-text-muted">
                          Similar Sessions
                        </p>
                        <div className="mt-2 space-y-1.5">
                          {similarSessions.map((session) => (
                            <button
                              key={session.id}
                              type="button"
                              className="block w-full rounded-lg border rt-border-soft px-2 py-1.5 text-left text-xs rt-text-strong"
                              onClick={() => void loadHistory(session.id)}
                            >
                              {session.topic}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {compareDetails.length === 2 && (
                  <div className="rounded-xl border rt-surface p-2.5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] rt-text-muted">
                      Compare Sessions
                    </p>
                    <div className="mt-2 grid gap-2">
                      {compareDetails.map((detail) => (
                        <div
                          key={detail.session.id}
                          className="rounded-lg border rt-border-soft p-2"
                        >
                          <p className="text-sm font-semibold rt-text-strong">
                            {detail.session.topic}
                          </p>
                          <p className="mt-1 text-[11px] rt-text-muted">
                            {detail.session.decisionStatus} · {detail.session.decisionType}
                          </p>
                          <div className="mt-2 space-y-2">
                            <div>
                              <p className="text-[10px] uppercase tracking-[0.18em] rt-text-muted">
                                Recommendation
                              </p>
                              <p className="mt-1 text-xs rt-text-dim">
                                {detail.decisionSummary?.recommendedOption ??
                                  'No decision card'}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] uppercase tracking-[0.18em] rt-text-muted">
                                Risks
                              </p>
                              <p className="mt-1 text-xs rt-text-dim">
                                {detail.decisionSummary?.risks.join(' · ') || 'None'}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] uppercase tracking-[0.18em] rt-text-muted">
                                Research gaps
                              </p>
                              <p className="mt-1 text-xs rt-text-dim">
                                {detail.researchRun?.evaluation?.gaps.join(' · ') || 'None'}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] uppercase tracking-[0.18em] rt-text-muted">
                                Action items
                              </p>
                              <p className="mt-1 text-xs rt-text-dim">
                                {detail.actionItems.map((item) => item.content).join(' · ') ||
                                  'None'}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
