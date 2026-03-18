import type { CursorWaitingOn, LedgerCursor } from './types';
import { DiscussionPhase } from './types';

/**
 * 每个 phase 进入时的默认 waitingOn 状态
 */
export const PHASE_ENTRY_WAITING_ON: Record<DiscussionPhase, CursorWaitingOn> = {
  [DiscussionPhase.CREATED]: 'none',
  [DiscussionPhase.RESEARCH]: 'agent_processing',
  [DiscussionPhase.OPENING]: 'moderator_review',
  [DiscussionPhase.INITIAL_RESPONSES]: 'agent_processing',
  [DiscussionPhase.ANALYSIS]: 'moderator_review',
  [DiscussionPhase.DEBATE]: 'agent_processing',
  [DiscussionPhase.CONVERGENCE]: 'moderator_review',
  [DiscussionPhase.SUMMARY]: 'moderator_review',
  [DiscussionPhase.COMPLETED]: 'none',
};

/**
 * 合法的状态转移表
 * key: 当前 waitingOn，value: 可以转移到的 waitingOn 列表
 */
export const CURSOR_TRANSITIONS: Record<CursorWaitingOn, CursorWaitingOn[]> = {
  none: ['human_input', 'moderator_review', 'agent_processing'],
  human_input: ['none', 'moderator_review'],
  moderator_review: ['none', 'agent_processing', 'human_input'],
  agent_processing: ['none', 'moderator_review', 'human_input'],
};

/**
 * 校验状态转移是否合法
 */
export function isValidTransition(from: CursorWaitingOn, to: CursorWaitingOn): boolean {
  return CURSOR_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * 根据 phase 获取进入时的默认 cursor
 */
export function getCursorForPhaseEntry(phase: DiscussionPhase): LedgerCursor {
  return {
    nextTaskId: null,
    waitingOn: PHASE_ENTRY_WAITING_ON[phase] ?? 'none',
    stallSignal: { stalled: false, reason: '' },
  };
}

/**
 * 判断当前 cursor 是否处于阻塞状态（需要外部输入才能继续）
 */
export function isCursorBlocked(cursor: LedgerCursor): boolean {
  return cursor.waitingOn === 'human_input' || cursor.stallSignal.stalled;
}

/**
 * 判断 resume 时是否需要等待外部输入
 */
export function resumeNeedsExternalInput(cursor: LedgerCursor): boolean {
  return cursor.waitingOn === 'human_input';
}
