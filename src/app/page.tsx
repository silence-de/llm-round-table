'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Activity,
  Cpu,
  FastForward,
  FileText,
  History,
  Pause,
  Play,
  RotateCcw,
  Search,
  Send,
  Users,
  Zap,
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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useDiscussionStore } from '@/stores/discussion-store';
import { useDiscussionStream } from '@/hooks/use-discussion-stream';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { PhaseIndicator } from '@/components/discussion/phase-indicator';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { RoundTableStage } from '@/components/discussion/round-table-stage';
import { ResearchPanel } from '@/components/discussion/research-panel';
import { MarkdownContent } from '@/components/ui/markdown-content';
import { DiscussionFeed } from '@/components/discussion/discussion-feed';
import { DecisionSummaryCard } from '@/components/discussion/decision-summary-card';
import { OpsSummaryCard } from '@/components/discussion/ops-summary-card';
import { ActionItemsBoard } from '@/components/discussion/action-items-board';
import { CalibrationPanel } from '@/components/workspace/calibration-panel';
import { HistoryPanel } from '@/components/workspace/history-panel';
import { LiveSessionPanel } from '@/components/workspace/live-session-panel';
import { SetupPanel } from '@/components/workspace/setup-panel';
import { WorkspaceShell } from '@/components/workspace/workspace-shell';
import type { FeedMessage } from '@/components/discussion/discussion-feed';
import type { PersonaSelection } from '@/lib/agents/types';
import {
  DECISION_TEMPLATES,
} from '@/lib/decision/templates';
import type {
  ActionStats,
  ActionItem,
  DecisionBrief,
  DecisionControlType,
  DecisionStatus,
  DiscussionAgenda,
} from '@/lib/decision/types';
import {
  buildDecisionConfidenceMeta,
  DECISION_CONTROL_LABELS,
  DECISION_STATUS_OPTIONS,
  DEFAULT_DECISION_BRIEF,
  DEFAULT_DISCUSSION_AGENDA,
  normalizeDecisionBrief,
  normalizeDiscussionAgenda,
} from '@/lib/decision/utils';
import {
  buildDecisionDossierMarkdown,
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
import type { DiscussionResumeSnapshot } from '@/lib/orchestrator/types';
import type {
  AgentInfo,
  OpsSummary,
  SessionDetail,
  SessionRecord,
} from '@/lib/session/types';
import { useArtifactExports } from '@/hooks/use-artifact-exports';
import { useCalibrationData } from '@/hooks/use-calibration-data';
import { useSessionHistory } from '@/hooks/use-session-history';
import { useWorkspaceBootstrap } from '@/hooks/use-workspace-bootstrap';

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function summarizeActionStats(items: ActionItem[]): ActionStats {
  const now = Date.now();
  return {
    total: items.length,
    pending: items.filter((item) => item.status === 'pending').length,
    inProgress: items.filter((item) => item.status === 'in_progress').length,
    verified: items.filter((item) => item.status === 'verified').length,
    discarded: items.filter((item) => item.status === 'discarded').length,
    overdue: items.filter((item) => {
      if (item.status === 'verified' || item.status === 'discarded') return false;
      if (!item.dueAt) return false;
      const dueDate = new Date(item.dueAt);
      return !Number.isNaN(dueDate.getTime()) && dueDate.getTime() < now;
    }).length,
  };
}

// ─── Filename helpers ─────────────────────────────────────────────────────────

/** Convert a session topic into a safe filename segment.
 *  Preserves Unicode (CJK) characters; strips only chars that are forbidden
 *  in filenames on macOS / Windows / Linux. */
function toFilenameSlug(topic: string, maxLength = 60): string {
  return topic
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .trim()
    .slice(0, maxLength)
    .replace(/-$/g, '');
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
  const [maxDebateRounds, setMaxDebateRounds] = useState<number>(2);

  const [leftTab, setLeftTab] = useState<'brief' | 'council' | 'research'>('brief');
  const [rightTab, setRightTab] = useState<'context' | 'history' | 'calibration'>(
    'context'
  );
  const [historyQuery, setHistoryQuery] = useState('');
  const [historyStatusFilter, setHistoryStatusFilter] = useState<'all' | SessionRecord['status']>('all');
  const [historyTemplateFilter, setHistoryTemplateFilter] = useState<string>('all');
  const [historyTimeRange, setHistoryTimeRange] = useState<'all' | '7d' | '30d' | '90d'>('all');
  const [followUpParentSession, setFollowUpParentSession] = useState<{
    id: string;
    topic: string;
    mode: 'follow_up' | 'resume';
  } | null>(null);
  const [resumePreview, setResumePreview] = useState<DiscussionResumeSnapshot | null>(
    null
  );
  const [carryForwardMode, setCarryForwardMode] = useState<
    'all_open' | 'high_priority_only'
  >('high_priority_only');
  const [followUpCarryPreview, setFollowUpCarryPreview] = useState<{
    inheritedActionCount: number;
    skippedReason: string[];
    parentReviewComparison?: SessionDetail['parentReviewComparison'];
  } | null>(null);
  const [opsSummary, setOpsSummary] = useState<OpsSummary | null>(null);
  const [researchBusySessionId, setResearchBusySessionId] = useState<string | null>(
    null
  );

  const {
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
  } = useWorkspaceBootstrap();
  const {
    calibrationWindow,
    setCalibrationWindow,
    calibrationTemplateFilter,
    setCalibrationTemplateFilter,
    calibrationDecisionTypeFilter,
    setCalibrationDecisionTypeFilter,
    calibrationData,
    calibrationLoading,
    refreshCalibration,
  } = useCalibrationData();

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
    resumeSnapshot,
    degradedAgents,
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
  const { downloadMarkdown, downloadFromUrl } = useArtifactExports();
  const {
    sessions,
    refreshSessions,
    activeHistoryId,
    setActiveHistoryId,
    historyDetail,
    setHistoryDetail,
    loadingHistory,
    loadHistory,
    deleteHistory,
    compareSessionIds,
    setCompareSessionIds,
    compareDetails,
  } = useSessionHistory({
    onError: (message) => setError(message),
    onLoadStart: () => {
      setAutoScroll('follow');
      resetReplay();
    },
    onLoaded: () => {
      setRightTab('history');
    },
  });

  // ── Data fetching ────────────────────────────────────────────────────────

  const refreshOpsSummary = useCallback(async () => {
    const res = await fetch('/api/sessions/ops?limit=20');
    if (!res.ok) return;
    const data = (await res.json()) as OpsSummary;
    setOpsSummary(data);
  }, []);

  // ── Bootstrap ────────────────────────────────────────────────────────────

  useEffect(() => {
    void refreshSessions();
    void refreshOpsSummary();
  }, [refreshOpsSummary, refreshSessions]);

  useEffect(() => {
    if (!isRunning) {
      void refreshSessions();
      void refreshOpsSummary();
      void refreshCalibration();
    }
  }, [isRunning, refreshCalibration, refreshOpsSummary, refreshSessions]);

  // ── Right-panel tab auto-switching ───────────────────────────────────────

  useEffect(() => {
    if (historyDetail) setRightTab('history');
  }, [historyDetail]);

  useEffect(() => {
    if (isRunning) setRightTab('context');
  }, [isRunning]);

  useEffect(() => {
    if (!followUpParentSession || followUpParentSession.mode !== 'follow_up') {
      setFollowUpCarryPreview(null);
      return;
    }

    let cancelled = false;
    void fetch(`/api/sessions/${followUpParentSession.id}/follow-up`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ carryForwardMode }),
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Failed to preview carry-forward (${response.status})`);
        }
        return (await response.json()) as {
          inheritedActionCount: number;
          skippedReason: string[];
          parentReviewComparison?: SessionDetail['parentReviewComparison'];
        };
      })
      .then((preview) => {
        if (!cancelled) {
          setFollowUpCarryPreview(preview);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setError(error instanceof Error ? error.message : String(error));
          setFollowUpCarryPreview(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [carryForwardMode, followUpParentSession, setError]);

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
      goal:
        prev.templateId && prev.templateId !== template.id
          ? template.goal
          : prev.goal || template.goal,
      background:
        prev.templateId && prev.templateId !== template.id
          ? template.background
          : prev.background || template.background,
      constraints:
        prev.templateId && prev.templateId !== template.id
          ? template.constraints
          : prev.constraints || template.constraints,
      decisionType: template.decisionType,
      desiredOutput: template.desiredOutput,
      reviewAt:
        prev.reviewAt && prev.templateId === template.id
          ? prev.reviewAt
          : template.reviewWindowSuggestion,
    }));
    setAgenda((prev) => ({
      ...prev,
      focalQuestions: template.focalQuestions,
      requiredDimensions: template.requiredDimensions,
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
    [agents, moderatorAgentId, setSelectedAgents]
  );

  const handleModelChange = useCallback((agentId: string, modelId: string) => {
    setModelSelections((prev) => ({ ...prev, [agentId]: modelId }));
  }, [setModelSelections]);

  const handlePersonaPresetChange = useCallback(
    (agentId: string, presetId?: string) => {
      setPersonaSelections((prev) => ({
        ...prev,
        [agentId]: { ...prev[agentId], presetId },
      }));
    },
    [setPersonaSelections]
  );

  // ── Session actions ──────────────────────────────────────────────────────

  const handleStart = useCallback(() => {
    if (!brief.topic.trim() || selectedAgents.size < 2) return;
    setHistoryDetail(null);
    setActiveHistoryId(null);
    setResumePreview(null);
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
      resumeFromSessionId:
        followUpParentSession?.mode === 'resume'
          ? followUpParentSession.id
          : null,
      carryForwardMode,
    });
  }, [
    agenda,
    brief,
    carryForwardMode,
    followUpParentSession,
    maxDebateRounds,
    modelSelections,
    moderatorAgentId,
    personaSelections,
    researchConfig,
    resetReplay,
    setActiveHistoryId,
    setHistoryDetail,
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
  const templateMap = useMemo(
    () => new Map(DECISION_TEMPLATES.map((template) => [template.id, template])),
    []
  );
  const groupedTemplates = useMemo(() => {
    const families: Array<{
      id: 'career' | 'life' | 'money';
      label: string;
    }> = [
      { id: 'career', label: 'Career' },
      { id: 'life', label: 'Life' },
      { id: 'money', label: 'Money' },
    ];
    return families.map((family) => ({
      ...family,
      templates: DECISION_TEMPLATES.filter((template) => template.family === family.id),
    }));
  }, []);

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

  const handleEscape = useCallback(() => {
    (document.activeElement as HTMLElement | null)?.blur();
  }, []);

  const handleSpacePause = useCallback(() => {
    if (isRunning) {
      stopDiscussion();
    } else if (replay.status === 'playing') {
      pauseReplay();
    } else if (historyDetail) {
      startReplay();
    }
  }, [isRunning, stopDiscussion, replay.status, pauseReplay, startReplay, historyDetail]);

  useKeyboardShortcuts(
    { onTogglePause: handleSpacePause, onEscape: handleEscape },
    true
  );

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
  const calibrationDecisionTypeOptions = useMemo(
    () =>
      Array.from(
        new Set(
          sessions
            .map((session) => session.decisionType)
            .filter((decisionType): decisionType is string => Boolean(decisionType))
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
      `${toFilenameSlug(exportedTopic)}-transcript.md`,
      buildTranscriptMarkdown({
        topic: exportedTopic,
        status: isRunning ? phase || 'running' : 'idle',
        messages: liveTranscriptMessages,
      })
    );
  }, [brief.topic, downloadMarkdown, isRunning, liveTranscriptMessages, phase, sessionId]);

  const handleExportLiveDecisionCard = useCallback(() => {
    if (!decisionSummary) return;
    downloadMarkdown(
      `${toFilenameSlug(brief.topic.trim() || 'Live discussion')}-decision.md`,
      buildDecisionSummaryMarkdown({
        topic: brief.topic.trim() || 'Live discussion',
        status: isRunning ? phase || 'running' : 'completed',
        decisionSummary,
      })
    );
  }, [brief.topic, decisionSummary, downloadMarkdown, isRunning, phase, sessionId]);

  const handleExportLiveDossier = useCallback(() => {
    if (!decisionSummary) return;
    downloadMarkdown(
      `${toFilenameSlug(brief.topic.trim() || 'Live discussion')}-dossier.md`,
      buildDecisionDossierMarkdown({
        topic: brief.topic.trim() || 'Live discussion',
        status: isRunning ? phase || 'running' : 'completed',
        brief,
        decisionSummary,
        actionItems,
        researchEvaluation: research.run?.evaluation ?? null,
        review: {
          outcomeSummary: review.outcomeSummary,
          retrospectiveNote: review.retrospectiveNote,
        },
        parentReviewComparison: followUpCarryPreview?.parentReviewComparison ?? null,
      })
    );
  }, [
    actionItems,
    brief,
    decisionSummary,
    followUpCarryPreview?.parentReviewComparison,
    isRunning,
    phase,
    research.run?.evaluation,
    review.outcomeSummary,
    review.retrospectiveNote,
    sessionId,
    downloadMarkdown,
  ]);

  const handleExportLiveChecklist = useCallback(() => {
    if (actionItems.length === 0) return;
    downloadMarkdown(
      `${toFilenameSlug(brief.topic.trim() || 'Live discussion')}-checklist.md`,
      buildExecutionChecklistMarkdown({
        topic: brief.topic.trim() || 'Live discussion',
        status: isRunning ? phase || 'running' : 'completed',
        actionItems,
      })
    );
  }, [actionItems, brief.topic, downloadMarkdown, isRunning, phase, sessionId]);

  const handleExportLivePdf = useCallback(() => {
    if (!sessionId || !decisionSummary) return;
    downloadFromUrl(`/api/sessions/${sessionId}/artifact-file`);
  }, [decisionSummary, downloadFromUrl, sessionId]);

  const handleExportHistoryTranscript = useCallback(() => {
    if (!historyDetail) return;
    downloadMarkdown(
      `${toFilenameSlug(historyDetail.session.topic)}-transcript.md`,
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
  }, [downloadMarkdown, historyDetail]);

  const handleExportHistoryDecisionCard = useCallback(() => {
    if (!historyDetail?.decisionSummary) return;
    downloadMarkdown(
      `${toFilenameSlug(historyDetail.session.topic)}-decision.md`,
      buildDecisionSummaryMarkdown({
        topic: historyDetail.session.topic,
        status: historyDetail.session.decisionStatus,
        decisionSummary: historyDetail.decisionSummary,
      })
    );
  }, [downloadMarkdown, historyDetail]);

  const handleExportHistoryDossier = useCallback(() => {
    if (!historyDetail?.decisionSummary) return;
    downloadMarkdown(
      `${toFilenameSlug(historyDetail.session.topic)}-dossier.md`,
      buildDecisionDossierMarkdown({
        topic: historyDetail.session.topic,
        status: historyDetail.session.decisionStatus,
        brief: {
          goal: historyDetail.session.goal,
          constraints: historyDetail.session.constraints,
          timeHorizon: historyDetail.session.timeHorizon,
          nonNegotiables: historyDetail.session.nonNegotiables,
          acceptableDownside: historyDetail.session.acceptableDownside,
          reviewAt: historyDetail.session.reviewAt ?? '',
        },
        decisionSummary: historyDetail.decisionSummary,
        actionItems: historyDetail.actionItems,
        researchEvaluation: historyDetail.researchRun?.evaluation ?? null,
        parentReviewComparison: historyDetail.parentReviewComparison ?? null,
        review: {
          outcomeSummary: historyDetail.session.outcomeSummary ?? '',
          actualOutcome: historyDetail.session.actualOutcome ?? '',
          outcomeConfidence: historyDetail.session.outcomeConfidence ?? 0,
          retrospectiveNote: historyDetail.session.retrospectiveNote ?? '',
        },
      })
    );
  }, [downloadMarkdown, historyDetail]);

  const handleExportHistoryChecklist = useCallback(() => {
    if (!historyDetail || historyDetail.actionItems.length === 0) return;
    downloadMarkdown(
      `${toFilenameSlug(historyDetail.session.topic)}-checklist.md`,
      buildExecutionChecklistMarkdown({
        topic: historyDetail.session.topic,
        status: historyDetail.session.decisionStatus,
        actionItems: historyDetail.actionItems,
      })
    );
  }, [downloadMarkdown, historyDetail]);

  const handleExportHistoryPdf = useCallback(() => {
    if (!historyDetail?.decisionSummary) return;
    downloadFromUrl(`/api/sessions/${historyDetail.session.id}/artifact-file`);
  }, [downloadFromUrl, historyDetail]);

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
        timeHorizon: historyDetail.session.timeHorizon,
        nonNegotiables: historyDetail.session.nonNegotiables,
        acceptableDownside: historyDetail.session.acceptableDownside,
        reviewAt: historyDetail.session.reviewAt ?? '',
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
      mode: 'follow_up',
    });
    setCarryForwardMode('high_priority_only');
    setResumePreview(null);
    setFollowUpCarryPreview(null);
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
    setActiveHistoryId,
    setAutoScroll,
    setError,
    setHistoryDetail,
    setModelSelections,
    setModeratorAgentId,
    setPersonaSelections,
    setSelectedAgents,
  ]);

  const handleResumeHistorySession = useCallback(async () => {
    if (!historyDetail) return;

    handleReuseHistorySetup();
    setFollowUpParentSession({
      id: historyDetail.session.id,
      topic: historyDetail.session.topic,
      mode: 'resume',
    });
    setFollowUpCarryPreview(null);
    setError(null);

    try {
      const previewTargetId = sessionId ?? 'preview';
      const response = await fetch(
        `/api/sessions/${previewTargetId}/resume-preview`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resumeFromSessionId: historyDetail.session.id }),
        }
      );
      if (!response.ok) {
        throw new Error(`Failed to preview resume (${response.status})`);
      }
      const payload = (await response.json()) as {
        resumeSnapshot?: DiscussionResumeSnapshot;
      };
      setResumePreview(payload.resumeSnapshot ?? null);
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    }
  }, [handleReuseHistorySetup, historyDetail, sessionId, setError]);

  const handleActionItemUpdate = useCallback(
    async (
      sessionIdToUpdate: string,
      itemId: string,
      patch: {
        status?: ActionItem['status'];
        note?: string;
        owner?: string;
        dueAt?: number | string | null;
        verifiedAt?: number | string | null;
        verificationNote?: string;
        priority?: ActionItem['priority'];
      }
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
          ? (() => {
              const nextItems = prev.actionItems.map((item) =>
                item.id === itemId ? updated : item
              );
              return {
                ...prev,
                actionItems: nextItems,
                actionStats: summarizeActionStats(nextItems),
              };
            })()
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
    [refreshSessions, sessionId, setActionItems, setHistoryDetail]
  );

  const handleSessionReviewUpdate = useCallback(
    async (
      sessionIdToUpdate: string,
      patch: {
        decisionStatus?: DecisionStatus;
        retrospectiveNote?: string;
        outcomeSummary?: string;
        actualOutcome?: string;
        outcomeConfidence?: number;
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
                ...(patch.actualOutcome !== undefined
                  ? { actualOutcome: patch.actualOutcome }
                  : {}),
                ...(patch.outcomeConfidence !== undefined
                  ? { outcomeConfidence: patch.outcomeConfidence }
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
      await refreshCalibration();
    },
    [refreshCalibration, refreshSessions, sessionId, setHistoryDetail, setReview]
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
    [refreshSessions, sessionId, setHistoryDetail, setResearchRun, setResearchStatus]
  );

  const handleResearchSourceUpdate = useCallback(
    async (
      sessionIdToUpdate: string,
      sourceId: string,
      patch: {
        selected?: boolean;
        pinned?: boolean;
        excludedReason?: string;
        rank?: number;
      }
    ) => {
      const response = await fetch(
        `/api/sessions/${sessionIdToUpdate}/research/sources/${sourceId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
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
                sources: prev.researchRun.sources
                  .map((source) => (source.id === sourceId ? updated : source))
                  .sort((left, right) => left.rank - right.rank),
              },
            }
          : prev
      );

      if (sessionId === sessionIdToUpdate) {
        const currentRun = useDiscussionStore.getState().research.run;
        if (currentRun) {
          setResearchRun({
            ...currentRun,
            sources: currentRun.sources
              .map((source) => (source.id === sourceId ? updated : source))
              .sort((left, right) => left.rank - right.rank),
          });
        }
      }
    },
    [sessionId, setHistoryDetail, setResearchRun]
  );

  const handleResearchVerify = useCallback(
    async (
      sessionIdToUpdate: string,
      input: {
        url: string;
        profileId?: string;
        claimHint?: string;
        note?: string;
      }
    ) => {
      setResearchBusySessionId(sessionIdToUpdate);
      try {
        const response = await fetch(
          `/api/sessions/${sessionIdToUpdate}/research/verify`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input),
          }
        );
        if (!response.ok) {
          throw new Error(`Failed to verify url (${response.status})`);
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
      } finally {
        setResearchBusySessionId(null);
      }
    },
    [sessionId, setHistoryDetail, setResearchRun]
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
  }, [setCompareSessionIds]);

  const handleDeleteHistory = useCallback(
    async (sessionIdToDelete: string) => {
      const deleted = await deleteHistory(sessionIdToDelete);
      if (deleted && sessionIdToDelete === activeHistoryId) {
        resetReplay();
      }
    },
    [activeHistoryId, deleteHistory, resetReplay]
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <WorkspaceShell
      header={
        <header className="shrink-0 border-b rt-surface-glass px-4 py-2.5 md:px-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-lg font-bold tracking-tight rt-text-strong">
                Round Table
              </h1>
              <p className="hidden text-xs rt-text-dim sm:block font-normal">
                Multi-agent council · strategy &amp; decisions
              </p>
            </div>
            <div className="flex min-w-0 items-center gap-2">
              <PhaseIndicator
                phase={phase}
                round={round}
                isRunning={isRunning}
                moderator={stageModerator.displayName}
              />
              <ThemeToggle />
            </div>
          </div>
        </header>
      }
    >
      <main className="flex-1 overflow-hidden grid gap-2 p-3 lg:grid-cols-[minmax(240px,260px)_minmax(0,1fr)] xl:grid-cols-[minmax(260px,280px)_minmax(0,1fr)_minmax(300px,340px)]">

        {/* ─────────────────────────────────────────────────────────────────
            LEFT PANEL: Session Setup + Compact Agent Config
        ───────────────────────────────────────────────────────────────── */}
        <SetupPanel
          tabs={[
            { id: 'brief', label: 'Brief', icon: <FileText className="h-3.5 w-3.5 shrink-0" /> },
            { id: 'council', label: 'Council', icon: <Users className="h-3.5 w-3.5 shrink-0" /> },
            { id: 'research', label: 'Research', icon: <Search className="h-3.5 w-3.5 shrink-0" /> },
          ]}
          activeTab={leftTab}
          onChangeTab={(tabId) => setLeftTab(tabId as typeof leftTab)}
          footer={
            <>
              <div className="flex gap-2">
                <Button
                  onClick={handleStart}
                  disabled={isRunning || !brief.topic.trim() || selectedAgents.size < 2}
                  className="h-10 flex-1 rounded-2xl text-sm"
                >
                  <Play className="h-4 w-4" />
                  Start Session
                </Button>
                {isRunning && (
                  <Button variant="destructive" className="h-10" onClick={stopDiscussion}>
                    Stop
                  </Button>
                )}
              </div>

              {isRunning && interjections.length > 0 && (
                <div className="flex items-center gap-1.5 rounded-lg border rt-surface px-2.5 py-1.5 text-xs rt-text-dim">
                  <Zap className="h-3 w-3 text-[var(--rt-live-state)]" />
                  <span>{interjections.length} queued</span>
                </div>
              )}
              {isRunning && degradedAgents.length > 0 && (
                <div className="flex items-center gap-1.5 rounded-lg border rt-surface px-2.5 py-1.5 text-xs rt-text-dim">
                  <Activity className="h-3 w-3 text-[var(--rt-warning-state)]" />
                  <span>Degraded agents: {degradedAgents.join(', ')}</span>
                </div>
              )}
            </>
          }
        >

            {/* ── Brief Tab ── */}
            {leftTab === 'brief' && <>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block rt-eyebrow">
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
                    {groupedTemplates.map((group) => (
                      <SelectGroup key={group.id}>
                        <SelectLabel>{group.label}</SelectLabel>
                        {group.templates.map((template) => (
                          <SelectItem
                            key={template.id}
                            value={template.id}
                            className="text-xs"
                          >
                            {template.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1 block rt-eyebrow">
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
            {activeTemplate && (
              <div className="rounded-xl border rt-border-soft p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold rt-text-strong">
                      {activeTemplate.label}
                    </p>
                    <p className="mt-0.5 text-xs rt-text-dim">
                      {activeTemplate.description}
                    </p>
                  </div>
                  <span className="rounded-full border rt-border-soft px-2 py-0.5 text-[10px] rt-text-dim">
                    {activeTemplate.family} / {activeTemplate.verificationProfileId}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {activeTemplate.evidenceExpectations.map((item) => (
                    <span
                      key={`${activeTemplate.id}-${item}`}
                      className="rounded-full border rt-border-soft px-2 py-0.5 text-[10px] rt-text-dim"
                    >
                      {item}
                    </span>
                  ))}
                </div>
                <div className="mt-2 grid gap-2 md:grid-cols-2">
                  <div className="rounded-lg border rt-border-soft p-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] rt-text-muted">
                      Default red lines
                    </p>
                    <div className="mt-1 space-y-1">
                      {activeTemplate.defaultRedLines.map((item) => (
                        <p key={`${activeTemplate.id}-red-${item}`} className="text-[11px] rt-text-dim">
                          - {item}
                        </p>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-lg border rt-border-soft p-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] rt-text-muted">
                      Revisit defaults
                    </p>
                    <div className="mt-1 space-y-1">
                      <p className="text-[11px] rt-text-dim">
                        {activeTemplate.reviewWindowSuggestion}
                      </p>
                      {activeTemplate.defaultRevisitTriggers.map((item) => (
                        <p
                          key={`${activeTemplate.id}-trigger-${item}`}
                          className="text-[11px] rt-text-dim"
                        >
                          - {item}
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="mb-1.5 block rt-eyebrow">
                Topic
              </label>
              <Textarea
                placeholder="输入要讨论的议题"
                value={brief.topic}
                onChange={(e) => updateBrief('topic', e.target.value)}
                disabled={isRunning}
                className="rt-input min-h-[56px] text-sm"
              />
            </div>

            <div>
              <label className="mb-1.5 block rt-eyebrow">
                Goal
              </label>
              <Textarea
                placeholder="这次讨论要帮你做出什么判断？"
                value={brief.goal}
                onChange={(e) => updateBrief('goal', e.target.value)}
                disabled={isRunning}
                className="rt-input min-h-[44px] text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block rt-eyebrow">
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
                <p className="rt-eyebrow">
                  Template Guide
                </p>
                <div className="mt-2 space-y-1.5 text-[11px] leading-relaxed rt-text-dim">
                  <p>Goal hint: {activeTemplate.goal}</p>
                  <p>Background hint: {activeTemplate.background}</p>
                  <p>Constraint hint: {activeTemplate.constraints}</p>
                  <p>Framework: {activeTemplate.analysisChecklist.join(' · ')}</p>
                </div>
              </div>
            )}

            <div>
              <label className="mb-1.5 block rt-eyebrow">
                Background
              </label>
              <Textarea
                placeholder="背景、上下文、你已知的情况"
                value={brief.background}
                onChange={(e) => updateBrief('background', e.target.value)}
                disabled={isRunning}
                className="rt-input min-h-[52px] text-sm"
              />
            </div>

            <div>
              <label className="mb-1.5 block rt-eyebrow">
                Constraints
              </label>
              <Textarea
                placeholder="预算、时间、风险边界、不可接受后果"
                value={brief.constraints}
                onChange={(e) => updateBrief('constraints', e.target.value)}
                disabled={isRunning}
                className="rt-input min-h-[52px] text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block rt-eyebrow">
                  Time Horizon
                </label>
                <Input
                  placeholder="例如：3个月 / 2年"
                  value={brief.timeHorizon}
                  onChange={(e) => updateBrief('timeHorizon', e.target.value)}
                  disabled={isRunning}
                  className="rt-input h-9 text-xs"
                />
              </div>
              <div>
                <label className="mb-1 block rt-eyebrow">
                  Review At
                </label>
                <Input
                  type="date"
                  value={brief.reviewAt}
                  onChange={(e) => updateBrief('reviewAt', e.target.value)}
                  disabled={isRunning}
                  className="rt-input h-9 text-xs"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block rt-eyebrow">
                Non-Negotiables
              </label>
              <Textarea
                placeholder="哪些条件不能退让"
                value={brief.nonNegotiables}
                onChange={(e) => updateBrief('nonNegotiables', e.target.value)}
                disabled={isRunning}
                className="rt-input min-h-[52px] text-sm"
              />
            </div>

            <div>
              <label className="mb-1.5 block rt-eyebrow">
                Acceptable Downside
              </label>
              <Textarea
                placeholder="你能接受的最坏情况 / 最大损失"
                value={brief.acceptableDownside}
                onChange={(e) => updateBrief('acceptableDownside', e.target.value)}
                disabled={isRunning}
                className="rt-input min-h-[52px] text-sm"
              />
            </div>
            </>}

            {/* ── Research Tab ── */}
            {leftTab === 'research' && <>
            <div className="rounded-xl border rt-surface p-2.5">
              <p className="mb-2 rt-eyebrow">
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
              <p className="mb-2 rt-eyebrow">
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
                <div className="grid grid-cols-2 gap-2">
                  <Select
                    value={researchConfig.domainPolicy}
                    onValueChange={(value) => {
                      if (!value) return;
                      updateResearchConfig(
                        'domainPolicy',
                        value as ResearchConfig['domainPolicy']
                      );
                    }}
                    disabled={isRunning || !researchConfig.enabled}
                  >
                    <SelectTrigger className="rt-input h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any" className="text-xs">
                        Any domain
                      </SelectItem>
                      <SelectItem value="prefer" className="text-xs">
                        Prefer domains
                      </SelectItem>
                      <SelectItem value="strict" className="text-xs">
                        Strict domains
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={String(researchConfig.maxReruns)}
                    onValueChange={(value) => {
                      if (!value) return;
                      updateResearchConfig('maxReruns', Number(value));
                    }}
                    disabled={isRunning || !researchConfig.enabled}
                  >
                    <SelectTrigger className="rt-input h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[0, 1, 2, 3].map((value) => (
                        <SelectItem key={value} value={String(value)} className="text-xs">
                          reruns {value}
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
            </>}

            {/* ── Council Tab ── */}
            {leftTab === 'council' && <>
            {followUpParentSession && (
              <div className="rounded-xl border bg-[color-mix(in_srgb,var(--rt-live-state)_10%,transparent)] px-3 py-2 text-xs">
                <p className="font-semibold rt-text-strong">
                  {followUpParentSession.mode === 'resume'
                    ? 'Safe resume'
                    : 'Follow-up session'}
                </p>
                <p className="mt-1 rt-text-muted">
                  {followUpParentSession.mode === 'resume'
                    ? `Resuming from ${followUpParentSession.topic}`
                    : `Continuing from ${followUpParentSession.topic}`}
                </p>
                <button
                  type="button"
                  className="mt-1 rt-text-dim underline transition-[color,opacity] duration-150 ease-out hover:rt-text-muted active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--rt-live-state)] focus-visible:rounded-sm"
                  onClick={() => {
                    setFollowUpParentSession(null);
                    setResumePreview(null);
                    setFollowUpCarryPreview(null);
                  }}
                  disabled={isRunning}
                >
                  Clear link
                </button>
                {followUpParentSession.mode === 'follow_up' && (
                  <div className="mt-2">
                    <label className="mb-1 block rt-eyebrow">Carry-forward</label>
                    <Select
                      value={carryForwardMode}
                      onValueChange={(value) =>
                        setCarryForwardMode(
                          value as 'all_open' | 'high_priority_only'
                        )
                      }
                      disabled={isRunning}
                    >
                      <SelectTrigger className="rt-input h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all_open" className="text-xs">
                          All unfinished items
                        </SelectItem>
                        <SelectItem value="high_priority_only" className="text-xs">
                          High-priority only
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    {followUpCarryPreview && (
                      <p className="mt-1 text-[11px] rt-text-muted">
                        {followUpCarryPreview.inheritedActionCount} items will be inherited
                        {followUpCarryPreview.skippedReason.length > 0
                          ? ` · skipped ${followUpCarryPreview.skippedReason.length}`
                          : ''}
                      </p>
                    )}
                    {followUpCarryPreview?.parentReviewComparison && (
                      <div className="mt-2 rounded-lg border rt-border-soft p-2 text-[11px] rt-text-muted">
                        <p className="font-semibold rt-text-strong">
                          Previous prediction vs reality
                        </p>
                        <p className="mt-1">
                          Recommendation:{' '}
                          {followUpCarryPreview.parentReviewComparison.recommendedOption}
                        </p>
                        <p className="mt-1">
                          Predicted {followUpCarryPreview.parentReviewComparison.predictedConfidence}% ·
                          Outcome {followUpCarryPreview.parentReviewComparison.outcomeConfidence ?? 0}%
                        </p>
                        {followUpCarryPreview.parentReviewComparison.outcomeSummary && (
                          <p className="mt-1">
                            Outcome: {followUpCarryPreview.parentReviewComparison.outcomeSummary}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
                {followUpParentSession.mode === 'resume' &&
                  (resumePreview || resumeSnapshot) && (
                    <div className="mt-2 rounded-lg border rt-border-soft p-2 text-[11px] rt-text-muted">
                      {(() => {
                        const snapshot = resumePreview ?? resumeSnapshot;
                        if (!snapshot) return null;
                        return (
                          <>
                            <p className="font-semibold rt-text-strong">
                              Resume plan: {snapshot.nextPhase} (round {snapshot.nextRound})
                            </p>
                            <p className="mt-1">
                              Inherit: {snapshot.inherited.join(', ') || 'none'}
                            </p>
                            <p className="mt-1">
                              Discard: {snapshot.discarded.join(', ') || 'none'}
                            </p>
                            <p className="mt-1">Reason: {snapshot.reason}</p>
                          </>
                        );
                      })()}
                    </div>
                  )}
              </div>
            )}

            {/* Moderator + Debate Rounds (2-column) */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block rt-eyebrow">
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
                <label className="mb-1 block rt-eyebrow">
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
              <p className="rt-eyebrow">
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
                      className={`border-l-2 pl-2.5 pr-3 py-3 rt-surface rounded-xl transition-all duration-200 ${
                        isSelected
                          ? 'border-[var(--rt-live-state)]'
                          : 'border-transparent opacity-55'
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
                                    className={`rounded-full border px-2 py-0.5 text-[10px] transition-[color,border-color,background-color,transform,box-shadow] duration-150 ease-out active:scale-[0.95] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--rt-live-state)] ${
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
            </>}
        </SetupPanel>

        {/* ─────────────────────────────────────────────────────────────────
            CENTER PANEL: Unified Discussion Feed
        ───────────────────────────────────────────────────────────────── */}
        <LiveSessionPanel>
          {/* Feed header */}
          <div className="shrink-0 space-y-1.5">
            <div className="flex h-10 items-center gap-2 border-b rt-border-soft px-1">
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
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 shrink-0 text-xs"
                        onClick={handleExportLiveDecisionCard}
                      >
                        Export Decision
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 shrink-0 text-xs"
                        onClick={handleExportLiveDossier}
                      >
                        Export Dossier
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 shrink-0 text-xs"
                        onClick={handleExportLivePdf}
                      >
                        Export PDF
                      </Button>
                    </>
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

              {historyDetail && !loadingHistory && (
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 shrink-0 text-xs"
                    onClick={handleExportHistoryTranscript}
                  >
                    Export Transcript
                  </Button>
                  {historyDetail.decisionSummary && (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 shrink-0 text-xs"
                        onClick={handleExportHistoryDecisionCard}
                      >
                        Export Decision
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 shrink-0 text-xs"
                        onClick={handleExportHistoryDossier}
                      >
                        Export Dossier
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 shrink-0 text-xs"
                        onClick={handleExportHistoryPdf}
                      >
                        Export PDF
                      </Button>
                    </>
                  )}
                  {historyDetail.actionItems.length > 0 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 shrink-0 text-xs"
                      onClick={handleExportHistoryChecklist}
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

          {/* Phase Progress Bar */}
          {(isRunning || feedMessages.length > 0) && (() => {
            const phaseOrder: Record<string, number> = { research: 0, opening: 1, round: 2, summary: 3 };
            const curStep: string =
              phase === 'research' ? 'research'
              : phase === 'opening' ? 'opening'
              : (phase === 'summary' || phase === 'completed' || phase === 'closing') ? 'summary'
              : 'round';
            return (
              <div className="shrink-0 flex items-center px-1 py-1.5">
                {(['research', 'opening', 'round', 'summary'] as const).map((step, i) => {
                  const isDone = phaseOrder[step] < (phaseOrder[curStep] ?? 0);
                  const isActive = step === curStep;
                  const label =
                    step === 'round' ? `第${round + 1}轮`
                    : step === 'research' ? '检索'
                    : step === 'opening' ? '开场'
                    : '总结';
                  return (
                    <React.Fragment key={step}>
                      {i > 0 && (
                        <div
                          className={`h-px flex-1 transition-colors duration-500 ${
                            isDone || isActive ? 'bg-[var(--rt-live-state)]' : 'bg-[var(--rt-border-soft)]'
                          }`}
                        />
                      )}
                      <div
                        className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-medium transition-all duration-300 ${
                          isActive
                            ? 'bg-[color-mix(in_srgb,var(--rt-live-state)_18%,transparent)] text-[var(--rt-live-state)] border border-[color-mix(in_srgb,var(--rt-live-state)_40%,transparent)]'
                            : isDone
                            ? 'rt-text-dim'
                            : 'rt-text-dim opacity-40'
                        }`}
                      >
                        {label}
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
            );
          })()}

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

          {/* ── Interjection bar — visible during live discussion ── */}
          {isRunning && !historyDetail && (
            <div className="shrink-0 rounded-2xl border rt-surface p-2.5 space-y-2">
              {/* Control-type dropdown */}
              <div className="flex items-center gap-2">
                <span className="rt-eyebrow shrink-0">Mode</span>
                <Select
                  value={interjectionControlType}
                  onValueChange={(v) => setInterjectionControlType(v as DecisionControlType)}
                >
                  <SelectTrigger className="h-7 w-40 text-xs rt-input border rounded-lg px-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.entries(DECISION_CONTROL_LABELS) as [DecisionControlType, string][]).map(([value, label]) => (
                      <SelectItem key={value} value={value} className="text-xs">
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {interjections.length > 0 && (
                  <span className="ml-auto text-[10px] rt-text-dim">
                    {interjections.length} queued
                  </span>
                )}
              </div>
              {/* Message input row */}
              <div className="flex items-end gap-2">
                <Textarea
                  placeholder="每轮开始前注入新要求…"
                  value={interjection}
                  onChange={(e) => setInterjection(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && interjection.trim()) {
                      handleInterjection();
                    }
                  }}
                  className="rt-input min-h-[52px] flex-1 resize-none text-sm"
                  rows={2}
                />
                <Button
                  size="sm"
                  className="h-[44px] w-[44px] shrink-0 p-0"
                  onClick={handleInterjection}
                  disabled={!interjection.trim()}
                  title="Send (⌘↵)"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
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
                key={`left-${sessionId ?? 'draft'}-${activeTemplate?.verificationProfileId ?? 'default'}`}
                sessionId={sessionId}
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
                        void handleResearchSourceUpdate(sessionId, sourceId, {
                          selected,
                          excludedReason: selected ? '' : 'manual_exclude',
                        }).catch((error) =>
                          setError(
                            error instanceof Error ? error.message : String(error)
                          )
                        )
                    : null
                }
                onPatchSource={
                  sessionId
                    ? (sourceId, patch) =>
                        void handleResearchSourceUpdate(sessionId, sourceId, patch).catch(
                          (error) =>
                            setError(
                              error instanceof Error ? error.message : String(error)
                            )
                        )
                    : null
                }
                onVerifyUrl={
                  sessionId
                    ? (input) =>
                        void handleResearchVerify(sessionId, input).catch((error) =>
                          setError(
                            error instanceof Error ? error.message : String(error)
                          )
                        )
                    : null
                }
                defaultVerificationProfileId={activeTemplate?.verificationProfileId ?? null}
              />
            )}
          </div>
        </LiveSessionPanel>

        {/* ─────────────────────────────────────────────────────────────────
            RIGHT PANEL: Context | History | Calibration (xl+ only)
        ───────────────────────────────────────────────────────────────── */}
        <HistoryPanel
          tabs={[
            { id: 'context', label: 'Context' },
            { id: 'history', label: 'History' },
            { id: 'calibration', label: 'Calibration' },
          ]}
          activeTab={rightTab}
          onChangeTab={setRightTab}
        >

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
                    key={`context-${sessionId ?? 'draft'}-${activeTemplate?.verificationProfileId ?? 'default'}`}
                    sessionId={sessionId}
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
                            void handleResearchSourceUpdate(sessionId, sourceId, {
                              selected,
                              excludedReason: selected ? '' : 'manual_exclude',
                            }).catch((error) =>
                              setError(
                                error instanceof Error
                                  ? error.message
                                  : String(error)
                              )
                            )
                        : null
                    }
                    onPatchSource={
                      sessionId
                        ? (sourceId, patch) =>
                            void handleResearchSourceUpdate(
                              sessionId,
                              sourceId,
                              patch
                            ).catch((error) =>
                              setError(
                                error instanceof Error
                                  ? error.message
                                  : String(error)
                              )
                            )
                        : null
                    }
                    onVerifyUrl={
                      sessionId
                        ? (input) =>
                            void handleResearchVerify(sessionId, input).catch((error) =>
                              setError(
                                error instanceof Error
                                  ? error.message
                                  : String(error)
                              )
                            )
                        : null
                    }
                    defaultVerificationProfileId={activeTemplate?.verificationProfileId ?? null}
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
                            `${toFilenameSlug(brief.topic.trim() || 'Live discussion')}-minutes.md`,
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
                    confidenceMeta={buildDecisionConfidenceMeta(
                      decisionSummary.rawConfidence ?? decisionSummary.confidence,
                      decisionSummary.evidence,
                      research.run?.sources ?? research.sources
                    )}
                    researchStatus={research.run?.status ?? research.status}
                    footer={
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="h-7 text-xs"
                          onClick={handleExportLiveDecisionCard}
                        >
                          Export decision
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                          onClick={handleExportLiveDossier}
                        >
                          Export dossier
                        </Button>
                        {sessionId && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs"
                            onClick={handleExportLivePdf}
                          >
                            PDF
                          </Button>
                        )}
                      </div>
                    }
                  />
                )}

                {sessionId && actionItems.length > 0 && (
                  <ActionItemsBoard
                    title="Execution Plan"
                    items={actionItems}
                    disabled={isRunning}
                    onItemsChange={setActionItems}
                    onPatch={(itemId, patch) =>
                      handleActionItemUpdate(sessionId, itemId, patch)
                    }
                    onError={setError}
                  />
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
                    <p className="rt-eyebrow">
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
                    <p className="rt-eyebrow">
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
                    <p className="rt-eyebrow">
                      Sessions
                    </p>
                  </div>
                  <div className="mb-2">
                    <OpsSummaryCard summary={opsSummary} />
                  </div>
                  <div className="mb-2 space-y-2">
                    <Input
                      value={historyQuery}
                      onChange={(event) => setHistoryQuery(event.target.value)}
                      placeholder="Search topic, goal, status, template…"
                      className="rt-input h-8 text-xs"
                    />
                    <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                      <span className="rt-eyebrow pl-0.5">Status</span>
                      <span className="rt-eyebrow pl-0.5">Template</span>
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
                    <div className="flex items-end gap-2">
                      <div className="flex flex-col gap-0.5 flex-1">
                        <span className="rt-eyebrow pl-0.5">Time Range</span>
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
                      </div>
                      <span className="text-[11px] rt-text-dim pb-1.5">
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
                              className="w-full text-left transition-opacity duration-150 ease-out hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--rt-live-state)] focus-visible:rounded-md"
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
                                  className={`rounded-full border px-2 py-0.5 text-[10px] transition-[color,border-color,background-color,transform,box-shadow] duration-150 ease-out active:scale-[0.95] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--rt-live-state)] ${
                                    compareSessionIds.includes(session.id)
                                      ? 'rt-border-strong rt-text-strong bg-[color-mix(in_srgb,var(--rt-hh6-primary)_8%,transparent)]'
                                      : 'rt-text-dim hover:rt-text-muted'
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
                                onClick={() => void handleDeleteHistory(session.id)}
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
                        <label className="mb-1 block rt-eyebrow">
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
                        {historyDetail.session.timeHorizon && (
                          <p className="rt-text-muted">
                            Time horizon: {historyDetail.session.timeHorizon}
                          </p>
                        )}
                        {historyDetail.session.nonNegotiables && (
                          <p className="rt-text-muted">
                            Non-negotiables: {historyDetail.session.nonNegotiables}
                          </p>
                        )}
                        {historyDetail.session.acceptableDownside && (
                          <p className="rt-text-muted">
                            Acceptable downside: {historyDetail.session.acceptableDownside}
                          </p>
                        )}
                        {historyDetail.session.reviewAt && (
                          <p className="rt-text-muted">
                            Review at: {historyDetail.session.reviewAt}
                          </p>
                        )}
                      </div>
                      {historyDetail.parentSession && (
                        <button
                          type="button"
                          className="mt-2 block text-left text-[11px] underline rt-text-dim transition-[color,opacity] duration-150 hover:rt-text-muted focus-visible:outline-none focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-[color:var(--rt-live-state)]"
                          onClick={() => void loadHistory(historyDetail.parentSession!.id)}
                        >
                          Parent session: {historyDetail.parentSession.topic}
                        </button>
                      )}
                      {historyDetail.resumeMeta?.resumedFromSessionId && (
                        <button
                          type="button"
                          className="mt-1 block text-left text-[11px] underline rt-text-dim transition-[color,opacity] duration-150 hover:rt-text-muted focus-visible:outline-none focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-[color:var(--rt-live-state)]"
                          onClick={() =>
                            void loadHistory(historyDetail.resumeMeta!.resumedFromSessionId!)
                          }
                        >
                          Resumed from: {historyDetail.resumeMeta.resumedFromSessionId}
                        </button>
                      )}
                      {historyDetail.resumeMeta?.snapshot && (
                        <div className="mt-2 rounded-lg border rt-border-soft p-2 text-[11px] rt-text-muted">
                          <p className="font-semibold rt-text-strong">
                            Resume decision: {historyDetail.resumeMeta.snapshot.nextPhase} / round{' '}
                            {historyDetail.resumeMeta.snapshot.nextRound}
                          </p>
                          <p className="mt-1">
                            Inherit:{' '}
                            {historyDetail.resumeMeta.snapshot.inherited.join(', ') ||
                              'none'}
                          </p>
                          <p className="mt-1">
                            Discard:{' '}
                            {historyDetail.resumeMeta.snapshot.discarded.join(', ') ||
                              'none'}
                          </p>
                          <p className="mt-1">
                            Reason: {historyDetail.resumeMeta.snapshot.reason}
                          </p>
                        </div>
                      )}
                      {historyDetail.degradeEvents.length > 0 && (
                        <div className="mt-2 rounded-lg border rt-border-soft p-2 text-[11px] rt-text-muted">
                          <p className="font-semibold rt-text-strong">
                            Degrade events ({historyDetail.degradeEvents.length})
                          </p>
                          {historyDetail.degradeEvents.slice(-3).map((event) => (
                            <p key={event.id} className="mt-1">
                              {event.agentId ?? 'agent'} · {event.phase ?? 'unknown phase'} ·{' '}
                              {event.timeoutType ?? 'error'}
                            </p>
                          ))}
                        </div>
                      )}
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <Button
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={handleReuseHistorySetup}
                        >
                          Use setup
                        </Button>
                        {['failed', 'stopped'].includes(historyDetail.session.status) && (
                          <Button
                            size="sm"
                            variant="secondary"
                            className="h-7 px-2 text-xs"
                            onClick={() => void handleResumeHistorySession()}
                          >
                            Resume safely
                          </Button>
                        )}
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
                        {historyDetail.decisionSummary && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs"
                            onClick={handleExportHistoryDossier}
                          >
                            Export dossier
                          </Button>
                        )}
                        {historyDetail.decisionSummary && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs"
                            onClick={handleExportHistoryPdf}
                          >
                            Export PDF
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
                        confidenceMeta={historyDetail.confidenceMeta}
                        researchStatus={historyDetail.researchRun?.status ?? 'idle'}
                      />
                    )}
                    {historyDetail.calibrationContext.reviewedSessions > 0 && (
                      <div className="rounded-xl border rt-surface p-2.5">
                        <p className="rt-eyebrow">Confidence Calibration</p>
                        <div className="mt-2 space-y-1 text-xs rt-text-muted">
                          <p>
                            Based on {historyDetail.calibrationContext.reviewedSessions} reviewed
                            session(s) by {historyDetail.calibrationContext.basedOn}.
                          </p>
                          <p>
                            Average overconfidence:{' '}
                            {historyDetail.calibrationContext.averageOverconfidence}pt
                          </p>
                          <p>
                            Historical hit rate:{' '}
                            {historyDetail.calibrationContext.templateHitRate}%
                          </p>
                          <p>
                            Suggested confidence penalty:{' '}
                            {historyDetail.calibrationContext.penalty}pt
                          </p>
                        </div>
                      </div>
                    )}
                    {historyDetail.parentReviewComparison && (
                      <div className="rounded-xl border rt-surface p-2.5">
                        <p className="rt-eyebrow">Previous Prediction Vs Reality</p>
                        <div className="mt-2 space-y-1 text-xs rt-text-muted">
                          <p>
                            Prior recommendation:{' '}
                            {historyDetail.parentReviewComparison.recommendedOption}
                          </p>
                          <p>
                            Predicted {historyDetail.parentReviewComparison.predictedConfidence}% ·
                            Outcome {historyDetail.parentReviewComparison.outcomeConfidence ?? 0}%
                          </p>
                          {historyDetail.parentReviewComparison.outcomeSummary && (
                            <p>
                              Outcome summary:{' '}
                              {historyDetail.parentReviewComparison.outcomeSummary}
                            </p>
                          )}
                          {historyDetail.parentReviewComparison.actualOutcome && (
                            <p>
                              Actual outcome:{' '}
                              {historyDetail.parentReviewComparison.actualOutcome}
                            </p>
                          )}
                          {historyDetail.parentReviewComparison.retrospectiveNote && (
                            <p>
                              Retrospective:{' '}
                              {historyDetail.parentReviewComparison.retrospectiveNote}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                    {historyDetail.decisionClaims.length > 0 && (
                      <div className="rounded-xl border rt-surface p-2.5">
                        <p className="rt-eyebrow">Claim Evidence Map</p>
                        <div className="mt-2 space-y-1.5">
                          {historyDetail.decisionClaims.map((claim) => (
                            <div key={claim.id} className="rounded-lg border rt-border-soft p-2">
                              <p className="text-xs font-medium rt-text-strong">{claim.claim}</p>
                              <p className="mt-1 text-[11px] rt-text-dim">
                                Citations: {claim.sourceIds.join(', ') || 'none'}
                              </p>
                              {claim.gapReason && (
                                <p className="mt-1 text-[11px] rt-text-dim">
                                  Gap: {claim.gapReason}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {(historyDetail.unresolvedEvidence?.length ?? 0) > 0 && (
                      <div className="rounded-xl border rt-surface p-2.5">
                        <p className="rt-eyebrow">Unresolved Evidence</p>
                        <div className="mt-2 space-y-1.5">
                          {historyDetail.unresolvedEvidence!.map((item, index) => (
                            <div
                              key={`${item.claim}-${index}`}
                              className="rounded-lg border rt-border-soft p-2"
                            >
                              <p className="text-xs font-medium rt-text-strong">{item.claim}</p>
                              <p className="mt-1 text-[11px] rt-text-dim">
                                Citations: {item.sourceIds.join(', ') || 'none'}
                              </p>
                              <p className="mt-1 text-[11px] rt-text-dim">
                                {item.gapReason || 'Evidence could not be resolved to persisted sources.'}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {historyDetail.researchRun && (
                      <ResearchPanel
                        key={`history-${historyDetail.session.id}-${historyDetail.session.templateId ?? 'custom'}`}
                        sessionId={historyDetail.session.id}
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
                          void handleResearchSourceUpdate(
                            historyDetail.session.id,
                            sourceId,
                            {
                              selected,
                              excludedReason: selected ? '' : 'manual_exclude',
                            }
                          ).catch((error) =>
                            setError(
                              error instanceof Error
                                ? error.message
                                : String(error)
                            )
                          )
                        }
                        onPatchSource={(sourceId, patch) =>
                          void handleResearchSourceUpdate(
                            historyDetail.session.id,
                            sourceId,
                            patch
                          ).catch((error) =>
                            setError(
                              error instanceof Error
                                ? error.message
                                : String(error)
                              )
                          )
                        }
                        onVerifyUrl={(input) =>
                          void handleResearchVerify(historyDetail.session.id, input).catch(
                            (error) =>
                              setError(
                                error instanceof Error
                                  ? error.message
                                  : String(error)
                              )
                          )
                        }
                        defaultVerificationProfileId={
                          (historyDetail.session.templateId
                            ? templateMap.get(historyDetail.session.templateId)?.verificationProfileId
                            : null) ?? null
                        }
                      />
                    )}

                    {historyDetail.actionItems.length > 0 && (
                      <ActionItemsBoard
                        title="Execution Plan"
                        items={historyDetail.actionItems}
                        actionStats={historyDetail.actionStats ?? null}
                        onItemsChange={(items) =>
                          setHistoryDetail((prev) =>
                            prev && prev.session.id === historyDetail.session.id
                              ? {
                                  ...prev,
                                  actionItems: items,
                                  actionStats: summarizeActionStats(items),
                                }
                              : prev
                          )
                        }
                        onPatch={(itemId, patch) =>
                          handleActionItemUpdate(historyDetail.session.id, itemId, patch)
                        }
                        onError={setError}
                      />
                    )}

                    <div className="rounded-xl border rt-surface p-2.5">
                      <p className="rt-eyebrow">
                        Outcome Review
                      </p>
                      <div className="mt-2 space-y-2">
                        <Textarea
                          value={historyDetail.session.actualOutcome ?? ''}
                          onChange={(event) =>
                            setHistoryDetail((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    session: {
                                      ...prev.session,
                                      actualOutcome: event.target.value,
                                    },
                                  }
                                : prev
                            )
                          }
                          placeholder="What actual outcome was observed?"
                          className="rt-input min-h-[64px] text-xs"
                        />
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={historyDetail.session.outcomeConfidence ?? 0}
                          onChange={(event) =>
                            setHistoryDetail((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    session: {
                                      ...prev.session,
                                      outcomeConfidence: Math.max(
                                        0,
                                        Math.min(100, Number(event.target.value) || 0)
                                      ),
                                    },
                                  }
                                : prev
                            )
                          }
                          className="rt-input h-8 text-xs"
                          placeholder="Outcome confidence (0-100)"
                        />
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
                                actualOutcome: historyDetail.session.actualOutcome ?? '',
                                outcomeConfidence:
                                  historyDetail.session.outcomeConfidence ?? 0,
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
                          <span className="rt-eyebrow">
                            Minutes
                          </span>
                          <Button
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={() =>
                              downloadMarkdown(
                                `${toFilenameSlug(historyDetail.session.topic)}-minutes.md`,
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
                        <p className="rt-eyebrow">
                          Follow-up Sessions
                        </p>
                        <div className="mt-2 space-y-1.5">
                          {historyDetail.childSessions.map((session) => (
                            <button
                              key={session.id}
                              type="button"
                              className="block w-full rounded-lg border rt-border-soft px-2 py-1.5 text-left text-xs rt-text-strong transition-[background-color,box-shadow] duration-150 ease-out hover:bg-[color-mix(in_srgb,currentColor_5%,transparent)] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--rt-live-state)]"
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
                        <p className="rt-eyebrow">
                          Similar Sessions
                        </p>
                        <div className="mt-2 space-y-1.5">
                          {similarSessions.map((session) => (
                            <button
                              key={session.id}
                              type="button"
                              className="block w-full rounded-lg border rt-border-soft px-2 py-1.5 text-left text-xs rt-text-strong transition-[background-color,box-shadow] duration-150 ease-out hover:bg-[color-mix(in_srgb,currentColor_5%,transparent)] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--rt-live-state)]"
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
                    <p className="rt-eyebrow">
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
                              <p className="rt-eyebrow">
                                Recommendation
                              </p>
                              <p className="mt-1 text-xs rt-text-dim">
                                {detail.decisionSummary?.recommendedOption ??
                                  'No decision card'}
                              </p>
                            </div>
                            <div>
                              <p className="rt-eyebrow">
                                Risks
                              </p>
                              <p className="mt-1 text-xs rt-text-dim">
                                {detail.decisionSummary?.risks.join(' · ') || 'None'}
                              </p>
                            </div>
                            <div>
                              <p className="rt-eyebrow">
                                Research gaps
                              </p>
                              <p className="mt-1 text-xs rt-text-dim">
                                {detail.researchRun?.evaluation?.gaps.join(' · ') || 'None'}
                              </p>
                            </div>
                            <div>
                              <p className="rt-eyebrow">
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

            {rightTab === 'calibration' && (
              <CalibrationPanel
                calibrationWindow={calibrationWindow}
                onChangeWindow={setCalibrationWindow}
                calibrationDecisionTypeFilter={calibrationDecisionTypeFilter}
                onChangeDecisionTypeFilter={setCalibrationDecisionTypeFilter}
                calibrationDecisionTypeOptions={calibrationDecisionTypeOptions}
                calibrationTemplateFilter={calibrationTemplateFilter}
                onChangeTemplateFilter={setCalibrationTemplateFilter}
                historyTemplateOptions={historyTemplateOptions}
                calibrationLoading={calibrationLoading}
                calibrationData={calibrationData}
                historyDetail={historyDetail}
                templateLabelFor={(templateId) =>
                  templateMap.get(templateId)?.label ?? templateId
                }
              />
            )}
        </HistoryPanel>
      </main>
    </WorkspaceShell>
  );
}
