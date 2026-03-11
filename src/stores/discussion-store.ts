import { create } from 'zustand';
import type { ResearchRunDetail, ResearchSource } from '@/lib/search/types';
import type { ActionItem, DecisionSummary } from '@/lib/decision/types';
import type { DiscussionResumeSnapshot } from '@/lib/orchestrator/types';

export interface AgentMessage {
  agentId: string;
  content: string;
  isStreaming: boolean;
  phase: string;
}

export type StageMode = 'desktop-roundtable' | 'mobile-hybrid';
export type AutoScrollMode = 'follow' | 'paused';
export type ReplayStatus = 'idle' | 'playing' | 'paused';
export type ResearchStatus =
  | 'idle'
  | 'running'
  | 'completed'
  | 'partial'
  | 'skipped'
  | 'failed';

interface DiscussionState {
  sessionId: string | null;
  phase: string;
  round: number;
  isRunning: boolean;
  usageInputTokens: number;
  usageOutputTokens: number;
  agentMessages: Map<string, AgentMessage>;
  moderatorMessages: Array<{ content: string; phase: string }>;
  interjections: Array<{ content: string; phase?: string; round?: number }>;
  decisionSummary: DecisionSummary | null;
  actionItems: ActionItem[];
  review: {
    retrospectiveNote: string;
    outcomeSummary: string;
  };
  error: string | null;
  resumeSnapshot: DiscussionResumeSnapshot | null;
  degradedAgents: string[];
  research: {
    status: ResearchStatus;
    sources: ResearchSource[];
    briefText: string;
    run: ResearchRunDetail | null;
  };
  ui: {
    activeSpeakerId: string | null;
    stageMode: StageMode;
    autoScroll: AutoScrollMode;
  };
  replay: {
    status: ReplayStatus;
    cursor: number;
  };

  // Actions
  setSessionId: (sessionId: string | null) => void;
  setUsage: (usage: { inputTokens: number; outputTokens: number }) => void;
  setPhase: (phase: string) => void;
  setRound: (round: number) => void;
  setRunning: (running: boolean) => void;
  setError: (error: string | null) => void;
  setResumeSnapshot: (snapshot: DiscussionResumeSnapshot | null) => void;
  addDegradedAgent: (agentId: string) => void;
  setStageMode: (mode: StageMode) => void;
  setAutoScroll: (mode: AutoScrollMode) => void;
  setActiveSpeakerId: (agentId: string | null) => void;
  setReplayStatus: (status: ReplayStatus) => void;
  setReplayCursor: (cursor: number) => void;
  advanceReplayCursor: (maxCursor: number) => void;
  resetReplay: () => void;
  startAgent: (agentId: string, phase: string) => void;
  appendAgentToken: (agentId: string, token: string) => void;
  finalizeAgent: (agentId: string) => void;
  startModerator: (phase: string) => void;
  appendModeratorToken: (token: string) => void;
  finalizeModerator: () => void;
  addInterjection: (interjection: { content: string; phase?: string; round?: number }) => void;
  setDecisionSummary: (decisionSummary: DecisionSummary | null) => void;
  setActionItems: (actionItems: ActionItem[]) => void;
  setReview: (review: { retrospectiveNote?: string; outcomeSummary?: string }) => void;
  setResearchStatus: (status: ResearchStatus) => void;
  setResearchRun: (run: ResearchRunDetail | null) => void;
  addResearchSources: (sources: ResearchSource[]) => void;
  setResearchBriefText: (text: string) => void;
  reset: () => void;
}

export const useDiscussionStore = create<DiscussionState>((set, get) => ({
  sessionId: null,
  phase: '',
  round: 0,
  isRunning: false,
  usageInputTokens: 0,
  usageOutputTokens: 0,
  agentMessages: new Map(),
  moderatorMessages: [],
  interjections: [],
  decisionSummary: null,
  actionItems: [],
  review: {
    retrospectiveNote: '',
    outcomeSummary: '',
  },
  error: null,
  resumeSnapshot: null,
  degradedAgents: [],
  research: {
    status: 'idle',
    sources: [],
    briefText: '',
    run: null,
  },
  ui: {
    activeSpeakerId: null,
    stageMode: 'desktop-roundtable',
    autoScroll: 'follow',
  },
  replay: {
    status: 'idle',
    cursor: 0,
  },

  setSessionId: (sessionId) => set({ sessionId }),
  setUsage: (usage) =>
    set({
      usageInputTokens: usage.inputTokens,
      usageOutputTokens: usage.outputTokens,
    }),
  setPhase: (phase) => set({ phase }),
  setRound: (round) => set({ round }),
  setRunning: (running) =>
    set((state) => ({
      isRunning: running,
      ui: {
        ...state.ui,
        activeSpeakerId: running ? state.ui.activeSpeakerId : null,
      },
    })),
  setError: (error) => set({ error }),
  setResumeSnapshot: (snapshot) => set({ resumeSnapshot: snapshot }),
  addDegradedAgent: (agentId) =>
    set((state) => ({
      degradedAgents: state.degradedAgents.includes(agentId)
        ? state.degradedAgents
        : [...state.degradedAgents, agentId],
    })),
  setStageMode: (mode) =>
    set((state) => ({
      ui: { ...state.ui, stageMode: mode },
    })),
  setAutoScroll: (mode) =>
    set((state) => ({
      ui: { ...state.ui, autoScroll: mode },
    })),
  setActiveSpeakerId: (agentId) =>
    set((state) => ({
      ui: { ...state.ui, activeSpeakerId: agentId },
    })),
  setReplayStatus: (status) =>
    set((state) => ({
      replay: { ...state.replay, status },
    })),
  setReplayCursor: (cursor) =>
    set((state) => ({
      replay: {
        ...state.replay,
        cursor: Math.max(0, cursor),
      },
    })),
  advanceReplayCursor: (maxCursor) =>
    set((state) => {
      if (state.replay.status !== 'playing') return {};
      if (state.replay.cursor >= maxCursor) {
        return {
          replay: {
            ...state.replay,
            status: 'paused',
          },
        };
      }

      return {
        replay: {
          ...state.replay,
          cursor: state.replay.cursor + 1,
        },
      };
    }),
  resetReplay: () =>
    set({
      replay: {
        status: 'idle',
        cursor: 0,
      },
    }),

  startAgent: (agentId, phase) => {
    const messages = new Map(get().agentMessages);
    const existing = messages.get(agentId);

    if (phase === 'debate' && existing) {
      messages.set(agentId, {
        ...existing,
        content: existing.content + '\n\n---\n\n',
        isStreaming: true,
        phase,
      });
    } else {
      messages.set(agentId, { agentId, content: '', isStreaming: true, phase });
    }

    set((state) => ({
      agentMessages: messages,
      ui: { ...state.ui, activeSpeakerId: agentId },
    }));
  },

  appendAgentToken: (agentId, token) => {
    const messages = new Map(get().agentMessages);
    const msg = messages.get(agentId);
    if (msg) {
      messages.set(agentId, { ...msg, content: msg.content + token });
      set({ agentMessages: messages });
    }
  },

  finalizeAgent: (agentId) => {
    const messages = new Map(get().agentMessages);
    const msg = messages.get(agentId);
    if (!msg) return;

    messages.set(agentId, { ...msg, isStreaming: false });

    const fallbackSpeaker = Array.from(messages.values()).find((item) => item.isStreaming)?.agentId ?? null;

    set((state) => ({
      agentMessages: messages,
      ui: {
        ...state.ui,
        activeSpeakerId:
          state.ui.activeSpeakerId === agentId ? fallbackSpeaker : state.ui.activeSpeakerId,
      },
    }));
  },

  startModerator: (phase) => {
    set((state) => ({
      moderatorMessages: [...state.moderatorMessages, { content: '', phase }],
      ui: { ...state.ui, activeSpeakerId: 'moderator' },
    }));
  },

  appendModeratorToken: (token) => {
    set((state) => {
      const msgs = [...state.moderatorMessages];
      if (msgs.length > 0) {
        const last = msgs[msgs.length - 1];
        msgs[msgs.length - 1] = { ...last, content: last.content + token };
      }
      return { moderatorMessages: msgs };
    });
  },

  finalizeModerator: () => {
    set((state) => ({
      ui: {
        ...state.ui,
        activeSpeakerId: state.ui.activeSpeakerId === 'moderator' ? null : state.ui.activeSpeakerId,
      },
    }));
  },

  addInterjection: (interjection) => {
    set((state) => ({
      interjections: [...state.interjections, interjection],
    }));
  },

  setDecisionSummary: (decisionSummary) => set({ decisionSummary }),
  setActionItems: (actionItems) => set({ actionItems }),
  setReview: (review) =>
    set((state) => ({
      review: {
        retrospectiveNote:
          review.retrospectiveNote ?? state.review.retrospectiveNote,
        outcomeSummary: review.outcomeSummary ?? state.review.outcomeSummary,
      },
    })),

  setResearchStatus: (status) =>
    set((state) => ({
      research: { ...state.research, status },
    })),

  setResearchRun: (run) =>
    set((state) => ({
      research: {
        ...state.research,
        run,
        status: run?.status ?? state.research.status,
        sources: run?.sources ?? state.research.sources,
        briefText: run?.summary ?? state.research.briefText,
      },
    })),

  addResearchSources: (sources) =>
    set((state) => ({
      research: {
        ...state.research,
        sources: [...state.research.sources, ...sources],
      },
    })),

  setResearchBriefText: (text) =>
    set((state) => ({
      research: { ...state.research, briefText: text },
    })),

  reset: () =>
    set((state) => ({
      sessionId: null,
      phase: '',
      round: 0,
      isRunning: false,
      usageInputTokens: 0,
      usageOutputTokens: 0,
      agentMessages: new Map(),
      moderatorMessages: [],
      interjections: [],
      decisionSummary: null,
      actionItems: [],
      review: {
        retrospectiveNote: '',
        outcomeSummary: '',
      },
      error: null,
      resumeSnapshot: null,
      degradedAgents: [],
      research: {
        status: 'idle',
        sources: [],
        briefText: '',
        run: null,
      },
      replay: {
        status: 'idle',
        cursor: 0,
      },
      ui: {
        ...state.ui,
        activeSpeakerId: null,
        autoScroll: 'follow',
      },
    })),
}));
