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
import { useDiscussionStore } from '@/stores/discussion-store';
import { useDiscussionStream } from '@/hooks/use-discussion-stream';
import { PhaseIndicator } from '@/components/discussion/phase-indicator';
import { RoundTableStage } from '@/components/discussion/round-table-stage';
import { ResearchPanel } from '@/components/discussion/research-panel';
import { MarkdownContent } from '@/components/ui/markdown-content';
import { DiscussionFeed } from '@/components/discussion/discussion-feed';
import type { FeedMessage } from '@/components/discussion/discussion-feed';
import type { PersonaPreset, PersonaSelection } from '@/lib/agents/types';
import { buildTranscriptMarkdown, type TranscriptMessage } from '@/lib/session-artifacts';

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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HomePage() {
  // ── Local state ──────────────────────────────────────────────────────────
  const [topic, setTopic] = useState('');
  const [interjection, setInterjection] = useState('');
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

  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);
  const [historyDetail, setHistoryDetail] = useState<SessionDetail | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

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
    error,
    research,
    ui,
    replay,
    setError,
    setAutoScroll,
    setReplayStatus,
    setReplayCursor,
    advanceReplayCursor,
    resetReplay,
  } = useDiscussionStore();

  const { startDiscussion, stopDiscussion, sendInterjection } = useDiscussionStream();

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

  // ── Agent config callbacks ───────────────────────────────────────────────

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

      return [session.topic, session.id, session.status, ...presetLabels].join(' ').toLowerCase();
    },
    [personaPresetMap]
  );

  const filteredSessions = useMemo(() => {
    const query = historyQuery.trim().toLowerCase();
    return sessions.filter((session) => {
      const statusMatches =
        historyStatusFilter === 'all' || session.status === historyStatusFilter;
      if (!statusMatches) return false;
      if (!query) return true;
      return historySearchIndex(session).includes(query);
    });
  }, [historyQuery, historySearchIndex, historyStatusFilter, sessions]);

  const historyStatusOptions = useMemo(
    () =>
      Array.from(new Set(sessions.map((session) => session.status))).sort() as Array<
        SessionRecord['status']
      >,
    [sessions]
  );

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
    const exportedTopic = topic.trim() || 'Live discussion';
    downloadMarkdown(
      `transcript-${sessionId ?? 'live'}.md`,
      buildTranscriptMarkdown({
        topic: exportedTopic,
        status: isRunning ? phase || 'running' : 'idle',
        messages: liveTranscriptMessages,
      })
    );
  }, [isRunning, liveTranscriptMessages, phase, sessionId, topic]);

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

    setTopic(historyDetail.session.topic);
    setModeratorAgentId(nextModeratorId);
    setMaxDebateRounds(historyDetail.session.maxDebateRounds ?? 2);
    setSelectedAgents(nextSelectedAgents);
    setModelSelections((prev) => ({ ...prev, ...historyModelSelections }));
    setPersonaSelections((prev) => ({ ...prev, ...historyPersonaSelections }));
    setRightTab('context');
    setActiveHistoryId(null);
    setHistoryDetail(null);
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

            {/* Topic */}
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.2em] rt-text-muted">
                Topic
              </label>
              <Textarea
                placeholder="输入要讨论的议题"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                disabled={isRunning}
                className="rt-input min-h-[80px] text-sm"
              />
            </div>

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
                  onValueChange={(value) => setMaxDebateRounds(Number(value))}
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
                disabled={isRunning || !topic.trim() || selectedAgents.size < 2}
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
                  Interjection
                </label>
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
                  <span className="text-xs rt-text-dim">Queued: {interjections.length}</span>
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
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 shrink-0 text-xs"
                  onClick={handleExportLiveTranscript}
                >
                  Export Transcript
                </Button>
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
              <ResearchPanel status={research.status} sources={research.sources} />
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
                  <ResearchPanel status={research.status} sources={research.sources} />
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
                      placeholder="Search topic, status, preset…"
                      className="rt-input h-8 text-xs"
                    />
                    <div className="flex items-center gap-2">
                      <Select
                        value={historyStatusFilter}
                        onValueChange={(value) =>
                          setHistoryStatusFilter(value as typeof historyStatusFilter)
                        }
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
                              {uniquePresetLabels.length > 0 && (
                                <p className="mt-0.5 text-[10px] rt-text-dim">
                                  {uniquePresetLabels.join(', ')}
                                </p>
                              )}
                            </button>
                            <div className="mt-1.5 flex items-center justify-between">
                              <span className="text-[10px] rt-text-dim">
                                {session.id.slice(0, 8)}
                              </span>
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
