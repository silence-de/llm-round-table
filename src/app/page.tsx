'use client';

import { useState, useCallback, useEffect, useMemo, useRef, type UIEvent } from 'react';
import {
  Activity,
  ChevronDown,
  Cpu,
  FastForward,
  History,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Separator } from '@/components/ui/separator';
import { useDiscussionStore } from '@/stores/discussion-store';
import { useDiscussionStream } from '@/hooks/use-discussion-stream';
import { PhaseIndicator } from '@/components/discussion/phase-indicator';
import { AgentCard } from '@/components/discussion/agent-card';
import { ModeratorPanel } from '@/components/discussion/moderator-panel';
import { RoundTableStage } from '@/components/discussion/round-table-stage';
import { ResearchPanel } from '@/components/discussion/research-panel';
import { MarkdownContent } from '@/components/ui/markdown-content';
import type { PersonaPreset, PersonaSelection } from '@/lib/agents/types';

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
  createdAt: number | string;
  moderatorAgentId: string;
  selectedAgentIds?: string;
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
}

interface DetailMessage {
  id: string;
  role: string;
  phase: string;
  content: string;
  displayName?: string | null;
  createdAt?: number | string;
}

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

export default function HomePage() {
  const [topic, setTopic] = useState('');
  const [interjection, setInterjection] = useState('');
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [selectedAgents, setSelectedAgents] = useState<Set<string>>(new Set());
  const [expandedAgents, setExpandedAgents] = useState<Set<string>>(new Set());
  const [modelSelections, setModelSelections] = useState<Record<string, string>>({});
  const [personaSelections, setPersonaSelections] = useState<Record<string, PersonaSelection>>({});
  const [personaPresets, setPersonaPresets] = useState<PersonaPreset[]>([]);
  const [moderatorAgentId, setModeratorAgentId] = useState<string>('claude');
  const [maxDebateRounds, setMaxDebateRounds] = useState<number>(2);
  const [loadingAgents, setLoadingAgents] = useState(true);

  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);
  const [historyDetail, setHistoryDetail] = useState<SessionDetail | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const detailViewportRef = useRef<HTMLDivElement | null>(null);

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
    error,
    research,
    ui,
    replay,
    setError,
    setStageMode,
    setAutoScroll,
    setReplayStatus,
    setReplayCursor,
    advanceReplayCursor,
    resetReplay,
  } = useDiscussionStore();

  const { startDiscussion, stopDiscussion, sendInterjection } = useDiscussionStream();

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

  useEffect(() => {
    const syncMode = () => {
      setStageMode(window.innerWidth < 1024 ? 'mobile-hybrid' : 'desktop-roundtable');
    };

    syncMode();
    window.addEventListener('resize', syncMode);
    return () => window.removeEventListener('resize', syncMode);
  }, [setStageMode]);

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
        const presets = Array.isArray(payload)
          ? []
          : (payload.personaPresets ?? []);
        setAgents(data);
        setPersonaPresets(presets);
        const available = data.filter((a) => a.available);
        const defaultSelected = new Set(available.map((a) => a.id));
        setSelectedAgents(defaultSelected);
        setExpandedAgents(new Set(available.slice(0, 3).map((a) => a.id)));

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
      })
      .catch(() => setLoadingAgents(false));

    void refreshSessions();
  }, [refreshSessions]);

  useEffect(() => {
    if (!isRunning) {
      void refreshSessions();
    }
  }, [isRunning, refreshSessions]);

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
          setExpandedAgents((expanded) => {
            const updated = new Set(expanded);
            updated.delete(agentId);
            return updated;
          });
        } else {
          next.add(agentId);
          setExpandedAgents((expanded) => new Set(expanded).add(agentId));
        }
        return next;
      });
    },
    [agents, moderatorAgentId]
  );

  const toggleExpanded = useCallback((agentId: string) => {
    setExpandedAgents((prev) => {
      const next = new Set(prev);
      if (next.has(agentId)) {
        next.delete(agentId);
      } else {
        next.add(agentId);
      }
      return next;
    });
  }, []);

  const handleModelChange = useCallback((agentId: string, modelId: string) => {
    setModelSelections((prev) => ({ ...prev, [agentId]: modelId }));
  }, []);

  const handlePersonaPresetChange = useCallback(
    (agentId: string, presetId?: string) => {
      setPersonaSelections((prev) => ({
        ...prev,
        [agentId]: {
          ...prev[agentId],
          presetId,
        },
      }));
    },
    []
  );

  const handlePersonaNoteChange = useCallback((agentId: string, note: string) => {
    setPersonaSelections((prev) => ({
      ...prev,
      [agentId]: {
        ...prev[agentId],
        customNote: note,
      },
    }));
  }, []);

  const handleStart = useCallback(() => {
    if (!topic.trim() || selectedAgents.size < 2) return;
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
      topic: topic.trim(),
      agentIds: Array.from(selectedAgents),
      modelSelections,
      personaSelections,
      personas: legacyPersonas,
      moderatorAgentId,
      maxDebateRounds,
    });
  }, [
    maxDebateRounds,
    modelSelections,
    moderatorAgentId,
    personaSelections,
    resetReplay,
    selectedAgents,
    startDiscussion,
    topic,
  ]);

  const handleInterjection = useCallback(async () => {
    if (!interjection.trim() || !isRunning) return;
    try {
      await sendInterjection(interjection.trim());
      setInterjection('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [interjection, isRunning, sendInterjection, setError]);

  const currentSummary = useMemo(
    () => [...moderatorMessages].reverse().find((message) => message.phase === 'summary')?.content,
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

  const historyPersonaSelections = useMemo(
    () => parsePersonaSelectionMap(historyDetail?.session.personaSelections),
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
    return replayableMessages.slice(0, Math.min(replay.cursor + 1, replayableMessages.length));
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

  const replayStageData = useMemo(() => {
    const map = new Map<string, { agentId: string; content: string; isStreaming: boolean; phase: string }>();
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

    return {
      map,
      moderatorMessage,
      activeSpeakerId,
      phase: phaseLabel,
    };
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

  const liveDetailMessages = useMemo<DetailMessage[]>(() => {
    const messages: DetailMessage[] = [];

    moderatorMessages.forEach((message, index) => {
      if (!message.content.trim()) return;
      messages.push({
        id: `live-moderator-${index}`,
        role: 'moderator',
        phase: message.phase,
        content: message.content,
        displayName: moderatorAgent.displayName,
      });
    });

    participants.forEach((agent, index) => {
      const message = agentMessages.get(agent.id);
      if (!message?.content.trim()) return;
      messages.push({
        id: `live-agent-${agent.id}-${index}`,
        role: 'agent',
        phase: message.phase,
        content: message.content,
        displayName: agent.displayName,
      });
    });

    return messages;
  }, [agentMessages, moderatorAgent.displayName, moderatorMessages, participants]);

  const detailMessages = historyDetail ? replayVisibleMessages : liveDetailMessages;

  useEffect(() => {
    if (ui.autoScroll !== 'follow') return;
    if (!detailViewportRef.current) return;
    detailViewportRef.current.scrollTo({
      top: detailViewportRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [detailMessages, replay.cursor, replay.status, ui.autoScroll]);

  const handleDetailScroll = useCallback(
    (event: UIEvent<HTMLDivElement>) => {
      const element = event.currentTarget;
      const distanceToBottom = element.scrollHeight - element.scrollTop - element.clientHeight;

      if (distanceToBottom > 52 && ui.autoScroll === 'follow') {
        setAutoScroll('paused');
      }

      if (distanceToBottom <= 20 && ui.autoScroll === 'paused') {
        setAutoScroll('follow');
      }
    },
    [setAutoScroll, ui.autoScroll]
  );

  const startReplay = useCallback(() => {
    if (!historyDetail || replayableMessages.length === 0) return;
    if (replay.status === 'idle') {
      setReplayCursor(0);
    }
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

  return (
    <div className="min-h-screen rt-shell">
      <header className="rt-surface-glass border-b px-4 py-4 md:px-6">
        <div className="mx-auto flex max-w-[1620px] flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black tracking-tight rt-text-strong md:text-4xl">
              Round Table Command Deck
            </h1>
            <p className="mt-1 text-sm rt-text-muted md:text-base">
              Multi-agent council for strategy, investment, and life planning
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

      <main className="mx-auto grid max-w-[1620px] gap-4 p-4 xl:grid-cols-[390px_minmax(0,1fr)] xl:gap-5 xl:p-5">
        <aside className="order-1 space-y-4 xl:order-1">
          <Card className="rt-panel xl:sticky xl:top-5">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg rt-text-strong">
                <Sparkles className="h-4 w-4 rt-text-muted" />
                Session Setup
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0">
              <div className="flex flex-col gap-3 overflow-hidden md:h-[calc(100vh-9.5rem)] md:min-h-[680px]">
                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold uppercase tracking-[0.18em] rt-text-muted">
                      Topic
                    </label>
                    <Textarea
                      placeholder="输入要讨论的议题"
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      disabled={isRunning}
                      className="rt-input min-h-[96px] text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1.5 block text-sm font-semibold uppercase tracking-[0.18em] rt-text-muted">
                        Moderator
                      </label>
                      <Select
                        value={moderatorAgentId}
                        onValueChange={(value) => {
                          if (!value) return;
                          setModeratorAgentId(value);
                          setSelectedAgents((prev) => new Set([...prev, value]));
                          setExpandedAgents((prev) => new Set([...prev, value]));
                        }}
                        disabled={isRunning}
                      >
                        <SelectTrigger className="rt-input h-10 text-sm">
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
                      <label className="mb-1.5 block text-sm font-semibold uppercase tracking-[0.18em] rt-text-muted">
                        Debate Rounds
                      </label>
                      <Select
                        value={String(maxDebateRounds)}
                        onValueChange={(value) => setMaxDebateRounds(Number(value))}
                        disabled={isRunning}
                      >
                        <SelectTrigger className="rt-input h-10 text-sm">
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

                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-sm font-semibold uppercase tracking-[0.18em] rt-text-muted">
                        Council Members
                      </p>
                      <span className="text-xs rt-text-dim">
                        {selectedAgents.size} selected
                      </span>
                    </div>

                    {loadingAgents ? (
                      <p className="text-sm rt-text-muted">Loading agents...</p>
                    ) : (
                      <div className="space-y-2">
                        {agents.map((agent) => {
                          const isModerator = agent.id === moderatorAgentId;
                          const isSelected = selectedAgents.has(agent.id);
                          const isExpanded = expandedAgents.has(agent.id);
                          const isDisabled = !agent.available || isRunning;
                          const personaSelection = personaSelections[agent.id] ?? {};
                          const selectedPreset = personaSelection.presetId
                            ? personaPresetMap.get(personaSelection.presetId)
                            : undefined;
                          const recommendedPresetIds = (
                            agent.recommendedPersonaPresetIds ?? []
                          )
                            .filter((presetId) => personaPresetMap.has(presetId))
                            .slice(0, 4);

                          return (
                            <div
                              key={agent.id}
                              className={`rounded-2xl border p-3 transition-all duration-300 ${
                                isSelected
                                  ? 'rt-surface-live shadow-[0_0_20px_color-mix(in_srgb,var(--rt-stage-glow-primary)_24%,transparent)]'
                                  : 'rt-surface-faint opacity-50'
                              } ${!agent.available ? 'opacity-45' : ''}`}
                            >
                              <div className="flex items-center gap-2">
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={() => toggleAgent(agent.id)}
                                  disabled={isDisabled || isModerator}
                                  onClick={(event) => event.stopPropagation()}
                                />
                                <button
                                  type="button"
                                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                                  onClick={() => toggleExpanded(agent.id)}
                                >
                                  <span
                                    className="inline-block h-3 w-3 rounded-full shadow-[0_0_14px_color-mix(in_srgb,var(--rt-text-strong)_8%,transparent)]"
                                    style={{ backgroundColor: agent.color }}
                                  />
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className="rt-text-strong truncate text-sm font-semibold md:text-base">
                                        {agent.displayName}
                                      </span>
                                      {isModerator && (
                                        <Badge
                                          variant="secondary"
                                          className="border border-[color-mix(in_srgb,var(--rt-stage-glow-secondary)_35%,transparent)] bg-[color-mix(in_srgb,var(--rt-stage-glow-secondary)_20%,transparent)] text-[10px] rt-text-strong"
                                        >
                                          MC
                                        </Badge>
                                      )}
                                    </div>
                                    <p className="truncate text-[11px] uppercase tracking-[0.18em] rt-text-dim">
                                      {agent.provider}
                                    </p>
                                    {selectedPreset && (
                                      <p className="mt-0.5 truncate text-[11px] rt-text-muted">
                                        Persona: {selectedPreset.label}
                                      </p>
                                    )}
                                  </div>
                                  <ChevronDown
                                    className={`h-4 w-4 rt-text-muted transition-transform ${
                                      isExpanded ? 'rotate-180' : ''
                                    }`}
                                  />
                                </button>
                              </div>

                              {!agent.available ? (
                                <p className="mt-3 text-sm rt-error">Missing key: {agent.missingKey}</p>
                              ) : isSelected && isExpanded ? (
                                <div className="mt-3 space-y-3 border-t rt-border-soft pt-3">
                                  {agent.availableModels.length > 0 ? (
                                    <Select
                                      value={modelSelections[agent.id] ?? agent.modelId}
                                      onValueChange={(value) => value && handleModelChange(agent.id, value)}
                                      disabled={isRunning}
                                    >
                                      <SelectTrigger className="rt-input h-9 text-sm">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {agent.availableModels.map((model) => (
                                          <SelectItem key={model.id} value={model.id} className="text-sm">
                                            {model.label}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  ) : (
                                    <p className="text-sm rt-text-dim">No model options available for this seat.</p>
                                  )}

                                  <div className="rt-surface space-y-2 rounded-xl border p-2.5">
                                    <label className="text-xs font-semibold uppercase tracking-[0.16em] rt-text-muted">
                                      Persona Preset
                                    </label>
                                    <Select
                                      value={personaSelection.presetId ?? '__none__'}
                                      onValueChange={(value) => {
                                        const normalizedPresetId =
                                          typeof value === 'string' && value !== '__none__'
                                            ? value
                                            : undefined;
                                        handlePersonaPresetChange(agent.id, normalizedPresetId);
                                      }}
                                      disabled={isRunning}
                                    >
                                      <SelectTrigger className="rt-input h-9 text-sm">
                                        <SelectValue placeholder="Choose a preset">
                                          {personaSelection.presetId
                                            ? (personaPresetMap.get(personaSelection.presetId)?.label ?? personaSelection.presetId)
                                            : 'Custom Only'}
                                        </SelectValue>
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="__none__" className="text-sm">
                                          Custom Only
                                        </SelectItem>
                                        {personaPresets.map((preset) => (
                                          <SelectItem
                                            key={preset.id}
                                            value={preset.id}
                                            className="text-sm"
                                          >
                                            {preset.label}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>

                                    {recommendedPresetIds.length > 0 && (
                                      <div className="flex flex-wrap gap-1.5">
                                        {recommendedPresetIds.map((presetId) => {
                                          const preset = personaPresetMap.get(presetId);
                                          if (!preset) return null;
                                          const active = presetId === personaSelection.presetId;
                                          return (
                                            <button
                                              key={presetId}
                                              type="button"
                                              onClick={() =>
                                                handlePersonaPresetChange(agent.id, presetId)
                                              }
                                              className={`rounded-full border px-2 py-1 text-[11px] transition ${
                                                active
                                                  ? 'rt-border-strong bg-[color-mix(in_srgb,var(--rt-live-state)_20%,transparent)] rt-text-strong'
                                                  : 'rt-surface-strong rt-text-muted'
                                              }`}
                                            >
                                              {preset.label}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    )}

                                    <Input
                                      placeholder="Micro note (optional)"
                                      value={personaSelection.customNote ?? ''}
                                      onChange={(event) =>
                                        handlePersonaNoteChange(
                                          agent.id,
                                          event.target.value
                                        )
                                      }
                                      disabled={isRunning}
                                      className="rt-input h-9 text-sm"
                                    />

                                    <p className="text-xs leading-relaxed rt-text-muted">
                                      {selectedPreset
                                        ? selectedPreset.description
                                        : 'No preset selected. You can run with only a micro note.'}
                                    </p>
                                  </div>
                                </div>
                              ) : (
                                <p className="mt-3 text-sm rt-text-dim">
                                  {isSelected
                                    ? 'Expand to edit model and persona preset.'
                                    : 'Select this agent to configure model and persona preset.'}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                <div className="rt-surface-deck sticky bottom-0 space-y-3 rounded-2xl border p-3">
                  <div className="flex gap-2">
                    <Button
                      onClick={handleStart}
                      disabled={isRunning || !topic.trim() || selectedAgents.size < 2}
                      className="h-11 flex-1 bg-primary text-base text-primary-foreground hover:bg-primary/85"
                    >
                      Start Session
                    </Button>
                    {isRunning && (
                      <Button variant="destructive" className="h-11" onClick={stopDiscussion}>
                        Stop
                      </Button>
                    )}
                  </div>

                  <div className="rt-surface space-y-2 rounded-2xl border p-3">
                    <label className="text-sm font-semibold uppercase tracking-[0.18em] rt-text-muted">
                      Interjection
                    </label>
                    <Textarea
                      placeholder="每轮开始前可注入新要求"
                      value={interjection}
                      onChange={(e) => setInterjection(e.target.value)}
                      disabled={!isRunning}
                      className="rt-input min-h-[70px] text-sm"
                    />
                    <div className="flex items-center justify-between">
                      <Button size="sm" onClick={handleInterjection} disabled={!isRunning || !interjection.trim()}>
                        Send
                      </Button>
                      <span className="text-sm rt-text-muted">Queued: {interjections.length}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rt-surface rounded-2xl border p-3">
                      <div className="mb-1 flex items-center gap-2 rt-text-muted">
                        <Cpu className="h-4 w-4" />
                        <p className="text-sm font-semibold">Input</p>
                      </div>
                      <p className="font-mono text-2xl font-semibold rt-text-strong">
                        {usageInputTokens.toLocaleString()}
                      </p>
                      <p className="text-xs uppercase tracking-[0.18em] rt-text-muted">tokens</p>
                    </div>

                    <div className="rt-surface rounded-2xl border p-3">
                      <div className="mb-1 flex items-center gap-2 rt-text-muted">
                        <Activity className="h-4 w-4" />
                        <p className="text-sm font-semibold">Output</p>
                      </div>
                      <p className="font-mono text-2xl font-semibold rt-text-strong">
                        {usageOutputTokens.toLocaleString()}
                      </p>
                      <p className="text-xs uppercase tracking-[0.18em] rt-text-muted">tokens</p>
                    </div>
                  </div>

                  {sessionId && (
                    <p className="truncate text-xs rt-text-dim">Session ID: {sessionId}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rt-panel">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg rt-text-strong">
                <History className="h-4 w-4 rt-text-muted" />
                History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {sessions.length === 0 ? (
                <p className="text-sm rt-text-muted">No sessions yet.</p>
              ) : (
                <div className="max-h-[300px] space-y-2 overflow-y-auto pr-1">
                  {sessions.map((session) => {
                    const active = session.id === activeHistoryId;
                    const presetLabels = Object.values(
                      parsePersonaSelectionMap(session.personaSelections)
                    )
                      .map((selection) =>
                        selection.presetId
                          ? personaPresetMap.get(selection.presetId)?.label
                          : selection.customNote
                            ? 'Custom persona'
                            : undefined
                      )
                      .filter((label): label is string => Boolean(label));
                    const uniquePresetLabels = Array.from(new Set(presetLabels)).slice(0, 3);
                    return (
                      <div
                        key={session.id}
                        className={`rounded-2xl border p-3 ${
                          active
                            ? 'rt-surface-live'
                            : 'rt-surface'
                        }`}
                      >
                        <button className="w-full text-left" onClick={() => void loadHistory(session.id)}>
                          <p className="line-clamp-2 text-sm font-semibold rt-text-strong">{session.topic}</p>
                          <p className="mt-1 text-xs rt-text-muted">
                            {new Date(session.createdAt).toLocaleString()} · {session.status}
                          </p>
                          {uniquePresetLabels.length > 0 && (
                            <p className="mt-1 line-clamp-1 text-[11px] rt-text-dim">
                              Presets: {uniquePresetLabels.join(', ')}
                            </p>
                          )}
                        </button>
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-xs rt-text-dim">{session.id.slice(0, 8)}</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs rt-error hover:bg-[color-mix(in_srgb,var(--rt-stage-glow-secondary)_20%,transparent)]"
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
            </CardContent>
          </Card>
        </aside>

        <section className="order-2 space-y-4 xl:order-2">
          <RoundTableStage
            moderator={{
              id: stageModerator.id,
              displayName: stageModerator.displayName,
              color: stageModerator.color,
              sprite: stageModerator.sprite,
              accentGlow: stageModerator.accentGlow,
            }}
            moderatorMessage={stageModeratorMessage}
            agents={stageParticipants.map((agent) => ({
              id: agent.id,
              displayName: agent.displayName,
              color: agent.color,
              accentGlow: agent.accentGlow,
              sprite: agent.sprite,
              message: isRunning
                ? agentMessages.get(agent.id)
                : replayStageData.map.get(agent.id),
            }))}
            activeSpeakerId={stageActiveSpeakerId}
            phase={stagePhase}
            isRunning={isRunning}
            stageMode={ui.stageMode}
          />

          {research.status !== 'idle' && (
            <ResearchPanel status={research.status} sources={research.sources} />
          )}

          {error && (
            <Card className="rt-panel-strong bg-[color-mix(in_srgb,var(--rt-stage-glow-secondary)_15%,transparent)]">
              <CardContent className="py-3">
                <p className="text-sm rt-error">{error}</p>
              </CardContent>
            </Card>
          )}

          {moderatorMessages.length > 0 && !historyDetail && <ModeratorPanel messages={moderatorMessages} />}

          {participants.length > 0 && agentMessages.size > 0 && (
            <div>
              <h2 className="mb-2 text-lg font-semibold rt-text-strong md:text-xl">Agent Transcript</h2>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {participants.map((agent) => (
                  <AgentCard
                    key={agent.id}
                    agentId={agent.id}
                    displayName={agent.displayName}
                    color={agent.color}
                    sprite={agent.sprite}
                    accentGlow={agent.accentGlow}
                    message={agentMessages.get(agent.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {currentSummary && (
            <Card className="rt-surface-minutes">
              <CardHeader className="pb-2">
                <CardTitle className="rt-text-strong text-base">Current Minutes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rt-surface-glass mb-3 max-h-[200px] overflow-auto rounded-md border p-3 text-sm">
                  <MarkdownContent content={currentSummary} />
                </div>
                <Button
                  size="sm"
                  onClick={() =>
                    downloadMarkdown(`minutes-${sessionId ?? 'current'}.md`, currentSummary)
                  }
                >
                  Export Markdown
                </Button>
              </CardContent>
            </Card>
          )}

          <Separator className="bg-[var(--rt-border-soft)]" />

          <Card className="rt-panel">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg rt-text-strong">Session Detail Viewer</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingHistory ? (
                <p className="text-sm rt-text-muted">Loading...</p>
              ) : historyDetail ? (
                <div className="space-y-3">
                  <div className="rt-surface rounded-md border p-3">
                    <p className="text-base font-semibold rt-text-strong">{historyDetail.session.topic}</p>
                    <p className="mt-1 text-sm rt-text-muted">
                      status: {historyDetail.session.status} · input:{' '}
                      {historyDetail.session.usageInputTokens.toLocaleString()} · output:{' '}
                      {historyDetail.session.usageOutputTokens.toLocaleString()}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {historySelectedAgentIds.map((agentId) => {
                        const selection = historyPersonaSelections[agentId];
                        const preset = selection?.presetId
                          ? personaPresetMap.get(selection.presetId)
                          : undefined;
                        const label = preset
                          ? preset.label
                          : selection?.customNote
                            ? 'Custom persona'
                            : 'Default persona';
                        return (
                          <span
                            key={`${historyDetail.session.id}-${agentId}`}
                            className="rounded-full border rt-border-soft bg-[color-mix(in_srgb,var(--rt-live-state)_10%,transparent)] px-2 py-1 text-[11px] rt-text-muted"
                          >
                            {agentId}: {label}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {replay.status === 'playing' ? (
                      <Button size="sm" onClick={pauseReplay} className="gap-1">
                        <Pause className="h-3.5 w-3.5" />
                        Pause Replay
                      </Button>
                    ) : (
                      <Button size="sm" onClick={startReplay} className="gap-1">
                        <Play className="h-3.5 w-3.5" />
                        {replay.status === 'idle' ? 'Play Replay' : 'Resume Replay'}
                      </Button>
                    )}
                    <Button size="sm" variant="secondary" onClick={resetReplayCursor} className="gap-1">
                      <RotateCcw className="h-3.5 w-3.5" />
                      Reset
                    </Button>
                    <Button size="sm" variant="ghost" onClick={exitReplay} className="gap-1">
                      <FastForward className="h-3.5 w-3.5" />
                      Full Timeline
                    </Button>
                    <span className="rt-chip-live rounded-full border px-2 py-1 text-xs">
                      {replay.status === 'idle'
                        ? `Replay idle · ${replayableMessages.length} msgs`
                        : `Replay ${replay.status} · ${Math.min(
                            replay.cursor + 1,
                            replayableMessages.length
                          )}/${replayableMessages.length}`}
                    </span>
                  </div>

                  {replayableMessages.length > 0 && (
                    <div className="rt-surface rounded-md border p-2">
                      <div className="mb-1 flex items-center justify-between text-xs rt-text-muted">
                        <span>Jump</span>
                        <span>
                          {Math.min(
                            replay.status === 'idle'
                              ? replayableMessages.length
                              : replay.cursor + 1,
                            replayableMessages.length
                          )}{' '}
                          / {replayableMessages.length}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={Math.max(0, replayableMessages.length - 1)}
                        value={
                          replay.status === 'idle'
                            ? Math.max(0, replayableMessages.length - 1)
                            : Math.min(replay.cursor, Math.max(0, replayableMessages.length - 1))
                        }
                        onChange={(event) => {
                          setReplayStatus('paused');
                          setReplayCursor(Number(event.currentTarget.value));
                        }}
                        className="h-1.5 w-full accent-[var(--rt-live-state)]"
                      />
                    </div>
                  )}

                  {historyDetail.minutes?.content && (
                    <div className="rt-surface-minutes rounded-md border p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="rt-text-strong text-xs font-semibold uppercase tracking-wide">
                          Minutes
                        </span>
                        <Button
                          size="sm"
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
                      <div className="max-h-[180px] overflow-auto text-sm">
                        <MarkdownContent content={historyDetail.minutes.content} />
                      </div>
                    </div>
                  )}

                  {ui.autoScroll === 'paused' && (
                    <div className="flex justify-end">
                      <Button size="sm" variant="secondary" onClick={() => setAutoScroll('follow')}>
                        Follow latest
                      </Button>
                    </div>
                  )}

                  <div
                    ref={detailViewportRef}
                    onScroll={handleDetailScroll}
                    className="max-h-[360px] space-y-2 overflow-auto pr-1"
                  >
                    {detailMessages.length === 0 ? (
                      <p className="text-sm rt-text-muted">No messages in this session yet.</p>
                    ) : (
                      detailMessages.map((message) => (
                        <div
                          key={message.id}
                          className="rt-surface rounded-md border p-3"
                        >
                          <p className="text-[11px] uppercase tracking-wide rt-text-dim">
                            {message.phase} · {message.displayName || message.role}
                          </p>
                          <MarkdownContent content={message.content} className="mt-1 text-sm" />
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm rt-text-muted">
                    Choose a session from history to inspect replay and minutes.
                  </p>
                  {liveDetailMessages.length > 0 && (
                    <div className="max-h-[280px] space-y-2 overflow-auto pr-1">
                      {liveDetailMessages.map((message) => (
                        <div
                          key={message.id}
                          className="rt-surface rounded-md border p-3"
                        >
                          <p className="text-[11px] uppercase tracking-wide rt-text-dim">
                            {message.phase} · {message.displayName || message.role}
                          </p>
                          <MarkdownContent content={message.content} className="mt-1 text-sm" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}
