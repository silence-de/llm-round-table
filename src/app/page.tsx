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

interface AgentInfo {
  id: string;
  displayName: string;
  provider: string;
  modelId: string;
  color: string;
  sprite: string;
  accentGlow?: string;
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

export default function HomePage() {
  const [topic, setTopic] = useState('');
  const [interjection, setInterjection] = useState('');
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [selectedAgents, setSelectedAgents] = useState<Set<string>>(new Set());
  const [expandedAgents, setExpandedAgents] = useState<Set<string>>(new Set());
  const [modelSelections, setModelSelections] = useState<Record<string, string>>({});
  const [personas, setPersonas] = useState<Record<string, string>>({});
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
      .then((data: AgentInfo[]) => {
        setAgents(data);
        const available = data.filter((a) => a.available);
        const defaultSelected = new Set(available.map((a) => a.id));
        setSelectedAgents(defaultSelected);
        setExpandedAgents(new Set(available.slice(0, 3).map((a) => a.id)));

        const preferredMod = available.find((a) => a.id === 'claude') ?? available[0];
        if (preferredMod) setModeratorAgentId(preferredMod.id);

        const defaults: Record<string, string> = {};
        const defaultPersonas: Record<string, string> = {};
        for (const a of data) {
          defaults[a.id] = a.modelId;
          defaultPersonas[a.id] = '';
        }

        setModelSelections(defaults);
        setPersonas(defaultPersonas);
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

  const handlePersonaChange = useCallback((agentId: string, content: string) => {
    setPersonas((prev) => ({ ...prev, [agentId]: content }));
  }, []);

  const handleStart = useCallback(() => {
    if (!topic.trim() || selectedAgents.size < 2) return;
    setHistoryDetail(null);
    setActiveHistoryId(null);
    resetReplay();

    void startDiscussion({
      topic: topic.trim(),
      agentIds: Array.from(selectedAgents),
      modelSelections,
      personas,
      moderatorAgentId,
      maxDebateRounds,
    });
  }, [
    maxDebateRounds,
    modelSelections,
    moderatorAgentId,
    personas,
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
        color: '#F59E0B',
        sprite: '/sprites/fallback.svg',
        accentGlow: '#F59E0B',
      },
    [agents, moderatorAgentId]
  );

  const participants = agents.filter(
    (agent) => selectedAgents.has(agent.id) && agent.id !== moderatorAgentId
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
        color: '#F59E0B',
        sprite: '/sprites/fallback.svg',
        accentGlow: '#F59E0B',
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
          color: '#38BDF8',
          sprite: '/sprites/fallback.svg',
          accentGlow: '#38BDF8',
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
    <div className="min-h-screen bg-[radial-gradient(circle_at_10%_5%,#2a2067_0%,transparent_34%),radial-gradient(circle_at_92%_92%,#6e2a49_0%,transparent_36%),linear-gradient(145deg,#0f1020,#1b1d3a)] text-slate-100">
      <header className="border-b border-indigo-200/20 bg-black/20 px-4 py-4 backdrop-blur md:px-6">
        <div className="mx-auto flex max-w-[1620px] flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-indigo-100 md:text-4xl">
              Round Table Command Deck
            </h1>
            <p className="mt-1 text-sm text-indigo-200/80 md:text-base">
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
          <Card className="border-indigo-200/30 bg-slate-950/70 xl:sticky xl:top-5">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg text-indigo-100">
                <Sparkles className="h-4 w-4 text-indigo-200" />
                Session Setup
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0">
              <div className="flex flex-col gap-3 overflow-hidden md:h-[calc(100vh-9.5rem)] md:min-h-[680px]">
                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold uppercase tracking-[0.18em] text-indigo-200/80">
                      Topic
                    </label>
                    <Textarea
                      placeholder="输入要讨论的议题"
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      disabled={isRunning}
                      className="min-h-[96px] border-indigo-400/30 bg-slate-900/80 text-sm text-slate-50"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1.5 block text-sm font-semibold uppercase tracking-[0.18em] text-indigo-200/80">
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
                        <SelectTrigger className="h-10 border-indigo-400/30 bg-slate-900/80 text-sm">
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
                      <label className="mb-1.5 block text-sm font-semibold uppercase tracking-[0.18em] text-indigo-200/80">
                        Debate Rounds
                      </label>
                      <Select
                        value={String(maxDebateRounds)}
                        onValueChange={(value) => setMaxDebateRounds(Number(value))}
                        disabled={isRunning}
                      >
                        <SelectTrigger className="h-10 border-indigo-400/30 bg-slate-900/80 text-sm">
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
                      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-200/80">
                        Council Members
                      </p>
                      <span className="text-xs text-indigo-100/55">
                        {selectedAgents.size} selected
                      </span>
                    </div>

                    {loadingAgents ? (
                      <p className="text-sm text-indigo-200/70">Loading agents...</p>
                    ) : (
                      <div className="space-y-2">
                        {agents.map((agent) => {
                          const isModerator = agent.id === moderatorAgentId;
                          const isSelected = selectedAgents.has(agent.id);
                          const isExpanded = expandedAgents.has(agent.id);
                          const isDisabled = !agent.available || isRunning;

                          return (
                            <div
                              key={agent.id}
                              className={`rounded-2xl border p-3 transition-all duration-300 ${
                                isSelected
                                  ? 'border-indigo-300/45 bg-slate-900/92 shadow-[0_0_20px_rgba(98,70,234,0.2)]'
                                  : 'border-indigo-300/12 bg-slate-900/45 opacity-50'
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
                                    className="inline-block h-3 w-3 rounded-full shadow-[0_0_14px_rgba(255,255,255,0.08)]"
                                    style={{ backgroundColor: agent.color }}
                                  />
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className="truncate text-sm font-semibold text-slate-100 md:text-base">
                                        {agent.displayName}
                                      </span>
                                      {isModerator && (
                                        <Badge
                                          variant="secondary"
                                          className="border border-rose-400/20 bg-rose-500/20 text-[10px] text-rose-100"
                                        >
                                          MC
                                        </Badge>
                                      )}
                                    </div>
                                    <p className="truncate text-[11px] uppercase tracking-[0.18em] text-indigo-100/45">
                                      {agent.provider}
                                    </p>
                                  </div>
                                  <ChevronDown
                                    className={`h-4 w-4 text-indigo-200/60 transition-transform ${
                                      isExpanded ? 'rotate-180' : ''
                                    }`}
                                  />
                                </button>
                              </div>

                              {!agent.available ? (
                                <p className="mt-3 text-sm text-rose-300">Missing key: {agent.missingKey}</p>
                              ) : isSelected && isExpanded ? (
                                <div className="mt-3 space-y-3 border-t border-indigo-300/15 pt-3">
                                  {agent.availableModels.length > 0 ? (
                                    <Select
                                      value={modelSelections[agent.id] ?? agent.modelId}
                                      onValueChange={(value) => value && handleModelChange(agent.id, value)}
                                      disabled={isRunning}
                                    >
                                      <SelectTrigger className="h-9 border-indigo-400/30 bg-slate-950 text-sm">
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
                                    <p className="text-sm text-indigo-100/50">No model options available for this seat.</p>
                                  )}

                                  <Textarea
                                    placeholder="角色人格（可选）"
                                    value={personas[agent.id] ?? ''}
                                    onChange={(e) => handlePersonaChange(agent.id, e.target.value)}
                                    disabled={isRunning}
                                    className="min-h-[70px] border-indigo-400/20 bg-slate-950 text-sm"
                                  />
                                </div>
                              ) : (
                                <p className="mt-3 text-sm text-indigo-100/45">
                                  {isSelected
                                    ? 'Expand to edit model and persona.'
                                    : 'Select this agent to configure model and persona.'}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                <div className="sticky bottom-0 space-y-3 rounded-2xl border border-indigo-300/20 bg-slate-950/95 p-3 backdrop-blur">
                  <div className="flex gap-2">
                    <Button
                      onClick={handleStart}
                      disabled={isRunning || !topic.trim() || selectedAgents.size < 2}
                      className="h-11 flex-1 bg-indigo-600 text-base text-white hover:bg-indigo-500"
                    >
                      Start Session
                    </Button>
                    {isRunning && (
                      <Button variant="destructive" className="h-11" onClick={stopDiscussion}>
                        Stop
                      </Button>
                    )}
                  </div>

                  <div className="space-y-2 rounded-2xl border border-indigo-300/20 bg-slate-900/72 p-3">
                    <label className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-200/80">
                      Interjection
                    </label>
                    <Textarea
                      placeholder="每轮开始前可注入新要求"
                      value={interjection}
                      onChange={(e) => setInterjection(e.target.value)}
                      disabled={!isRunning}
                      className="min-h-[70px] border-indigo-400/20 bg-slate-950 text-sm"
                    />
                    <div className="flex items-center justify-between">
                      <Button size="sm" onClick={handleInterjection} disabled={!isRunning || !interjection.trim()}>
                        Send
                      </Button>
                      <span className="text-sm text-indigo-200/80">Queued: {interjections.length}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-indigo-300/20 bg-slate-900/65 p-3">
                      <div className="mb-1 flex items-center gap-2 text-indigo-200/80">
                        <Cpu className="h-4 w-4" />
                        <p className="text-sm font-semibold">Input</p>
                      </div>
                      <p className="font-mono text-2xl font-semibold text-indigo-50">
                        {usageInputTokens.toLocaleString()}
                      </p>
                      <p className="text-xs uppercase tracking-[0.18em] text-indigo-200/60">tokens</p>
                    </div>

                    <div className="rounded-2xl border border-indigo-300/20 bg-slate-900/65 p-3">
                      <div className="mb-1 flex items-center gap-2 text-indigo-200/80">
                        <Activity className="h-4 w-4" />
                        <p className="text-sm font-semibold">Output</p>
                      </div>
                      <p className="font-mono text-2xl font-semibold text-indigo-50">
                        {usageOutputTokens.toLocaleString()}
                      </p>
                      <p className="text-xs uppercase tracking-[0.18em] text-indigo-200/60">tokens</p>
                    </div>
                  </div>

                  {sessionId && (
                    <p className="truncate text-xs text-indigo-300/70">Session ID: {sessionId}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-indigo-200/30 bg-slate-950/70">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg text-indigo-100">
                <History className="h-4 w-4 text-indigo-200" />
                History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {sessions.length === 0 ? (
                <p className="text-sm text-indigo-200/70">No sessions yet.</p>
              ) : (
                <div className="max-h-[300px] space-y-2 overflow-y-auto pr-1">
                  {sessions.map((session) => {
                    const active = session.id === activeHistoryId;
                    return (
                      <div
                        key={session.id}
                        className={`rounded-2xl border p-3 ${
                          active
                            ? 'border-indigo-300/70 bg-indigo-500/15'
                            : 'border-indigo-300/20 bg-slate-900/60'
                        }`}
                      >
                        <button className="w-full text-left" onClick={() => void loadHistory(session.id)}>
                          <p className="line-clamp-2 text-sm font-semibold text-indigo-100">{session.topic}</p>
                          <p className="mt-1 text-xs text-indigo-300/80">
                            {new Date(session.createdAt).toLocaleString()} · {session.status}
                          </p>
                        </button>
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-xs text-indigo-300/70">{session.id.slice(0, 8)}</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs text-rose-200 hover:bg-rose-900/40"
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

          {error && (
            <Card className="border-rose-400/40 bg-rose-900/20">
              <CardContent className="py-3">
                <p className="text-sm text-rose-200">{error}</p>
              </CardContent>
            </Card>
          )}

          {moderatorMessages.length > 0 && !historyDetail && <ModeratorPanel messages={moderatorMessages} />}

          {participants.length > 0 && agentMessages.size > 0 && (
            <div>
              <h2 className="mb-2 text-lg font-semibold text-indigo-100 md:text-xl">Agent Transcript</h2>
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
            <Card className="border-emerald-300/35 bg-emerald-900/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-emerald-100">Current Minutes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-3 max-h-[200px] overflow-auto whitespace-pre-wrap rounded-md border border-emerald-300/20 bg-black/20 p-3 text-sm leading-relaxed text-emerald-50">
                  {currentSummary}
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

          <Separator className="bg-indigo-300/20" />

          <Card className="border-indigo-200/30 bg-slate-950/70">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg text-indigo-100">Session Detail Viewer</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingHistory ? (
                <p className="text-sm text-indigo-200/80">Loading...</p>
              ) : historyDetail ? (
                <div className="space-y-3">
                  <div className="rounded-md border border-indigo-300/20 bg-slate-900/70 p-3">
                    <p className="text-base font-semibold text-indigo-100">{historyDetail.session.topic}</p>
                    <p className="mt-1 text-sm text-indigo-300/80">
                      status: {historyDetail.session.status} · input:{' '}
                      {historyDetail.session.usageInputTokens.toLocaleString()} · output:{' '}
                      {historyDetail.session.usageOutputTokens.toLocaleString()}
                    </p>
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
                    <span className="rounded-full border border-indigo-300/25 bg-indigo-300/10 px-2 py-1 text-xs text-indigo-100/90">
                      {replay.status === 'idle'
                        ? `Replay idle · ${replayableMessages.length} msgs`
                        : `Replay ${replay.status} · ${Math.min(
                            replay.cursor + 1,
                            replayableMessages.length
                          )}/${replayableMessages.length}`}
                    </span>
                  </div>

                  {replayableMessages.length > 0 && (
                    <div className="rounded-md border border-indigo-300/20 bg-slate-900/55 p-2">
                      <div className="mb-1 flex items-center justify-between text-xs text-indigo-200/80">
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
                        className="h-1.5 w-full accent-indigo-400"
                      />
                    </div>
                  )}

                  {historyDetail.minutes?.content && (
                    <div className="rounded-md border border-emerald-300/30 bg-emerald-900/20 p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wide text-emerald-100">
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
                      <div className="max-h-[180px] overflow-auto whitespace-pre-wrap text-sm leading-relaxed text-emerald-50">
                        {historyDetail.minutes.content}
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
                      <p className="text-sm text-indigo-200/80">No messages in this session yet.</p>
                    ) : (
                      detailMessages.map((message) => (
                        <div
                          key={message.id}
                          className="rounded-md border border-indigo-300/15 bg-slate-900/60 p-3"
                        >
                          <p className="text-[11px] uppercase tracking-wide text-indigo-300/70">
                            {message.phase} · {message.displayName || message.role}
                          </p>
                          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-100">
                            {message.content}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-indigo-200/80">
                    Choose a session from history to inspect replay and minutes.
                  </p>
                  {liveDetailMessages.length > 0 && (
                    <div className="max-h-[280px] space-y-2 overflow-auto pr-1">
                      {liveDetailMessages.map((message) => (
                        <div
                          key={message.id}
                          className="rounded-md border border-indigo-300/15 bg-slate-900/60 p-3"
                        >
                          <p className="text-[11px] uppercase tracking-wide text-indigo-300/70">
                            {message.phase} · {message.displayName || message.role}
                          </p>
                          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-100">
                            {message.content}
                          </p>
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
