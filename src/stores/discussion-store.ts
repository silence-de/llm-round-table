import { create } from 'zustand';

export interface AgentMessage {
  agentId: string;
  content: string;
  isStreaming: boolean;
  phase: string;
}

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
  error: string | null;

  // Actions
  setSessionId: (sessionId: string | null) => void;
  setUsage: (usage: { inputTokens: number; outputTokens: number }) => void;
  setPhase: (phase: string) => void;
  setRound: (round: number) => void;
  setRunning: (running: boolean) => void;
  setError: (error: string | null) => void;
  startAgent: (agentId: string, phase: string) => void;
  appendAgentToken: (agentId: string, token: string) => void;
  finalizeAgent: (agentId: string) => void;
  startModerator: (phase: string) => void;
  appendModeratorToken: (token: string) => void;
  finalizeModerator: () => void;
  addInterjection: (interjection: { content: string; phase?: string; round?: number }) => void;
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
  error: null,

  setSessionId: (sessionId) => set({ sessionId }),
  setUsage: (usage) =>
    set({
      usageInputTokens: usage.inputTokens,
      usageOutputTokens: usage.outputTokens,
    }),
  setPhase: (phase) => set({ phase }),
  setRound: (round) => set({ round }),
  setRunning: (running) => set({ isRunning: running }),
  setError: (error) => set({ error }),

  startAgent: (agentId, phase) => {
    const messages = new Map(get().agentMessages);
    const existing = messages.get(agentId);
    // In debate phase, append to existing; in initial phase, create new
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
    set({ agentMessages: messages });
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
    if (msg) {
      messages.set(agentId, { ...msg, isStreaming: false });
      set({ agentMessages: messages });
    }
  },

  startModerator: (phase) => {
    set((state) => ({
      moderatorMessages: [
        ...state.moderatorMessages,
        { content: '', phase },
      ],
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
    // No-op for now, moderator message is already in the array
  },

  addInterjection: (interjection) => {
    set((state) => ({
      interjections: [...state.interjections, interjection],
    }));
  },

  reset: () =>
    set({
      sessionId: null,
      phase: '',
      round: 0,
      isRunning: false,
      usageInputTokens: 0,
      usageOutputTokens: 0,
      agentMessages: new Map(),
      moderatorMessages: [],
      interjections: [],
      error: null,
    }),
}));
