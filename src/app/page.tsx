'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
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
    createdAt: number | string;
  }>;
  minutes: { content: string } | null;
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

export default function HomePage() {
  const [topic, setTopic] = useState('');
  const [interjection, setInterjection] = useState('');
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [selectedAgents, setSelectedAgents] = useState<Set<string>>(new Set());
  const [modelSelections, setModelSelections] = useState<Record<string, string>>({});
  const [personas, setPersonas] = useState<Record<string, string>>({});
  const [moderatorAgentId, setModeratorAgentId] = useState<string>('claude');
  const [maxDebateRounds, setMaxDebateRounds] = useState<number>(2);
  const [loadingAgents, setLoadingAgents] = useState(true);

  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);
  const [historyDetail, setHistoryDetail] = useState<SessionDetail | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

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
    setError,
  } = useDiscussionStore();

  const { startDiscussion, stopDiscussion, sendInterjection } = useDiscussionStream();

  const refreshSessions = useCallback(async () => {
    const res = await fetch('/api/sessions');
    if (!res.ok) return;
    const data = (await res.json()) as SessionRecord[];
    setSessions([...data].reverse());
  }, []);

  const loadHistory = useCallback(async (id: string) => {
    setLoadingHistory(true);
    setActiveHistoryId(id);
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
  }, [setError]);

  const deleteHistory = useCallback(async (id: string) => {
    const res = await fetch(`/api/sessions/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      setError(`Delete failed: ${res.status}`);
      return;
    }
    if (activeHistoryId === id) {
      setActiveHistoryId(null);
      setHistoryDetail(null);
    }
    await refreshSessions();
  }, [activeHistoryId, refreshSessions, setError]);

  // Load agents and existing sessions
  useEffect(() => {
    fetch('/api/agents')
      .then((r) => r.json())
      .then((data: AgentInfo[]) => {
        setAgents(data);
        const available = data.filter((a) => a.available);
        setSelectedAgents(new Set(available.map((a) => a.id)));
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

  const handlePersonaChange = useCallback((agentId: string, content: string) => {
    setPersonas((prev) => ({ ...prev, [agentId]: content }));
  }, []);

  const handleStart = useCallback(() => {
    if (!topic.trim() || selectedAgents.size < 2) return;
    setHistoryDetail(null);
    setActiveHistoryId(null);

    void startDiscussion({
      topic: topic.trim(),
      agentIds: Array.from(selectedAgents),
      modelSelections,
      personas,
      moderatorAgentId,
      maxDebateRounds,
    });
  }, [
    topic,
    selectedAgents,
    modelSelections,
    personas,
    moderatorAgentId,
    maxDebateRounds,
    startDiscussion,
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
    () => [...moderatorMessages].reverse().find((m) => m.phase === 'summary')?.content,
    [moderatorMessages]
  );

  const participants = agents.filter(
    (a) => selectedAgents.has(a.id) && a.id !== moderatorAgentId
  );

  const moderatorAgent =
    agents.find((a) => a.id === moderatorAgentId) ?? {
      id: 'moderator',
      displayName: 'Moderator',
      color: '#F59E0B',
    };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_8%_5%,#173756_0%,transparent_30%),radial-gradient(circle_at_95%_95%,#482e62_0%,transparent_35%),linear-gradient(140deg,#030712,#08172a)] text-slate-100">
      <header className="border-b border-cyan-200/20 bg-black/20 px-5 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-[1480px] items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-cyan-100">Round Table Command Deck</h1>
            <p className="text-xs text-cyan-200/80">Multi-agent council for strategy, investment, and life planning</p>
          </div>
          <PhaseIndicator
            phase={phase}
            round={round}
            isRunning={isRunning}
            moderator={moderatorAgent.displayName}
          />
        </div>
      </header>

      <main className="mx-auto grid max-w-[1480px] gap-5 p-5 lg:grid-cols-[380px_1fr]">
        <aside className="space-y-4">
          <Card className="border-cyan-200/30 bg-slate-950/70">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-cyan-100">Session Setup</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-cyan-200/80">Topic</label>
                <Textarea
                  placeholder="输入要讨论的议题"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  disabled={isRunning}
                  className="min-h-[72px] border-cyan-400/30 bg-slate-900/80 text-slate-50"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-cyan-200/80">Moderator</label>
                  <Select
                    value={moderatorAgentId}
                    onValueChange={(v) => {
                      if (!v) return;
                      setModeratorAgentId(v);
                      setSelectedAgents((prev) => new Set([...prev, v]));
                    }}
                    disabled={isRunning}
                  >
                    <SelectTrigger className="h-8 border-cyan-400/30 bg-slate-900/80 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {agents
                        .filter((a) => a.available)
                        .map((a) => (
                          <SelectItem key={a.id} value={a.id} className="text-xs">
                            {a.displayName}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-cyan-200/80">Debate Rounds</label>
                  <Select
                    value={String(maxDebateRounds)}
                    onValueChange={(v) => setMaxDebateRounds(Number(v))}
                    disabled={isRunning}
                  >
                    <SelectTrigger className="h-8 border-cyan-400/30 bg-slate-900/80 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3].map((n) => (
                        <SelectItem key={n} value={String(n)} className="text-xs">
                          {n} rounds
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {loadingAgents ? (
                <p className="text-sm text-cyan-200/70">Loading agents...</p>
              ) : (
                <div className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
                  {agents.map((agent) => {
                    const isModerator = agent.id === moderatorAgentId;
                    const isSelected = selectedAgents.has(agent.id);
                    const isDisabled = !agent.available || isRunning;

                    return (
                      <div key={agent.id} className="rounded-lg border border-cyan-300/20 bg-slate-900/65 p-2">
                        <div className="mb-2 flex items-center gap-2">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleAgent(agent.id)}
                            disabled={isDisabled || isModerator}
                          />
                          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: agent.color }} />
                          <span className="text-sm font-semibold">{agent.displayName}</span>
                          {isModerator && (
                            <Badge variant="secondary" className="ml-auto bg-amber-500/20 text-[10px] text-amber-200">
                              MC
                            </Badge>
                          )}
                        </div>

                        {agent.available ? (
                          <>
                            <Select
                              value={modelSelections[agent.id] ?? agent.modelId}
                              onValueChange={(v) => v && handleModelChange(agent.id, v)}
                              disabled={isRunning}
                            >
                              <SelectTrigger className="mb-2 h-7 border-cyan-400/30 bg-slate-950 text-xs">
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
                            <Textarea
                              placeholder="角色人格（可选）"
                              value={personas[agent.id] ?? ''}
                              onChange={(e) => handlePersonaChange(agent.id, e.target.value)}
                              disabled={isRunning}
                              className="min-h-[52px] border-cyan-400/20 bg-slate-950 text-xs"
                            />
                          </>
                        ) : (
                          <p className="text-xs text-rose-300">Missing key: {agent.missingKey}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={handleStart}
                  disabled={isRunning || !topic.trim() || selectedAgents.size < 2}
                  className="flex-1 bg-cyan-600 text-white hover:bg-cyan-500"
                >
                  Start Session
                </Button>
                {isRunning && (
                  <Button variant="destructive" onClick={stopDiscussion}>
                    Stop
                  </Button>
                )}
              </div>

              <div className="space-y-2 rounded-lg border border-cyan-300/20 bg-slate-900/65 p-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-cyan-200/80">Interjection</label>
                <Textarea
                  placeholder="每轮开始前可注入新要求"
                  value={interjection}
                  onChange={(e) => setInterjection(e.target.value)}
                  disabled={!isRunning}
                  className="min-h-[56px] border-cyan-400/20 bg-slate-950 text-xs"
                />
                <div className="flex items-center justify-between">
                  <Button
                    size="sm"
                    onClick={handleInterjection}
                    disabled={!isRunning || !interjection.trim()}
                  >
                    Send
                  </Button>
                  <span className="text-[11px] text-cyan-200/80">Queued: {interjections.length}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-md border border-cyan-300/20 bg-slate-900/65 p-2">
                  <p className="text-cyan-200/80">Input Tokens</p>
                  <p className="font-mono text-base font-semibold">{usageInputTokens.toLocaleString()}</p>
                </div>
                <div className="rounded-md border border-cyan-300/20 bg-slate-900/65 p-2">
                  <p className="text-cyan-200/80">Output Tokens</p>
                  <p className="font-mono text-base font-semibold">{usageOutputTokens.toLocaleString()}</p>
                </div>
              </div>

              {sessionId && (
                <p className="truncate text-[10px] text-cyan-300/70">Session ID: {sessionId}</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-cyan-200/30 bg-slate-950/70">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-cyan-100">History</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {sessions.length === 0 ? (
                <p className="text-xs text-cyan-200/70">No sessions yet.</p>
              ) : (
                <div className="max-h-[340px] space-y-2 overflow-y-auto pr-1">
                  {sessions.map((s) => {
                    const active = s.id === activeHistoryId;
                    return (
                      <div
                        key={s.id}
                        className={`rounded-lg border p-2 ${
                          active
                            ? 'border-cyan-300/70 bg-cyan-500/15'
                            : 'border-cyan-300/20 bg-slate-900/60'
                        }`}
                      >
                        <button
                          className="w-full text-left"
                          onClick={() => void loadHistory(s.id)}
                        >
                          <p className="line-clamp-2 text-xs font-semibold text-cyan-100">{s.topic}</p>
                          <p className="mt-1 text-[10px] text-cyan-300/80">
                            {new Date(s.createdAt).toLocaleString()} · {s.status}
                          </p>
                        </button>
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-[10px] text-cyan-300/70">{s.id.slice(0, 8)}</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 text-[10px] text-rose-200 hover:bg-rose-900/40"
                            onClick={() => void deleteHistory(s.id)}
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

        <section className="space-y-4">
          <RoundTableStage
            moderator={{
              id: moderatorAgent.id,
              displayName: moderatorAgent.displayName,
              color: moderatorAgent.color,
            }}
            moderatorMessage={moderatorMessages.at(-1)?.content}
            agents={participants.map((a) => ({
              id: a.id,
              displayName: a.displayName,
              color: a.color,
              message: agentMessages.get(a.id),
            }))}
          />

          {error && (
            <Card className="border-rose-400/40 bg-rose-900/20">
              <CardContent className="py-3">
                <p className="text-sm text-rose-200">{error}</p>
              </CardContent>
            </Card>
          )}

          {moderatorMessages.length > 0 && <ModeratorPanel messages={moderatorMessages} />}

          {participants.length > 0 && agentMessages.size > 0 && (
            <div>
              <h2 className="mb-2 text-lg font-bold text-cyan-100">Agent Transcript</h2>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {participants.map((agent) => (
                  <AgentCard
                    key={agent.id}
                    agentId={agent.id}
                    displayName={agent.displayName}
                    color={agent.color}
                    message={agentMessages.get(agent.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {currentSummary && (
            <Card className="border-emerald-300/35 bg-emerald-900/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-emerald-100">Current Minutes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-3 max-h-[180px] overflow-auto whitespace-pre-wrap rounded-md border border-emerald-300/20 bg-black/20 p-3 text-xs leading-relaxed text-emerald-50">
                  {currentSummary}
                </div>
                <Button
                  size="sm"
                  onClick={() => downloadMarkdown(`minutes-${sessionId ?? 'current'}.md`, currentSummary)}
                >
                  Export Markdown
                </Button>
              </CardContent>
            </Card>
          )}

          <Separator className="bg-cyan-300/20" />

          <Card className="border-cyan-200/30 bg-slate-950/70">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-cyan-100">Session Detail Viewer</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingHistory ? (
                <p className="text-sm text-cyan-200/80">Loading...</p>
              ) : historyDetail ? (
                <div className="space-y-3">
                  <div className="rounded-md border border-cyan-300/20 bg-slate-900/70 p-3">
                    <p className="text-sm font-semibold text-cyan-100">{historyDetail.session.topic}</p>
                    <p className="mt-1 text-xs text-cyan-300/80">
                      status: {historyDetail.session.status} · input: {historyDetail.session.usageInputTokens.toLocaleString()} · output: {historyDetail.session.usageOutputTokens.toLocaleString()}
                    </p>
                  </div>

                  {historyDetail.minutes?.content && (
                    <div className="rounded-md border border-emerald-300/30 bg-emerald-900/20 p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wide text-emerald-100">Minutes</span>
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
                      <div className="max-h-[180px] overflow-auto whitespace-pre-wrap text-xs leading-relaxed text-emerald-50">
                        {historyDetail.minutes.content}
                      </div>
                    </div>
                  )}

                  <div className="max-h-[320px] space-y-2 overflow-auto">
                    {historyDetail.messages.map((m) => (
                      <div key={m.id} className="rounded-md border border-cyan-300/15 bg-slate-900/60 p-2">
                        <p className="text-[10px] uppercase tracking-wide text-cyan-300/70">
                          {m.phase} · {m.displayName || m.role}
                        </p>
                        <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-slate-100">{m.content}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-cyan-200/80">Choose a session from history to inspect replay and minutes.</p>
              )}
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}
