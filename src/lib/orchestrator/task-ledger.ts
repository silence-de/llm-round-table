import type { DecisionBrief, DiscussionAgenda } from '../decision/types';
import type { ModeratorAnalysis, TaskLedger } from './types';

/**
 * 从 brief + agenda 初始化一个空 TaskLedger
 */
export function initTaskLedger(brief: DecisionBrief, agenda: DiscussionAgenda): TaskLedger {
  // 构建 briefSummary：拼接 topic + goal + constraints，不超过 200 字
  const parts = [
    brief.topic ? `议题：${brief.topic}` : '',
    brief.goal ? `目标：${brief.goal}` : '',
    brief.constraints ? `约束：${brief.constraints}` : '',
  ].filter(Boolean);
  const briefSummary = parts.join('；').slice(0, 200);

  // 将 nonNegotiables 按中文分号/逗号切分
  const nonNegotiables = brief.nonNegotiables
    ? brief.nonNegotiables
        .split(/[；;，,]/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
    : [];

  return {
    briefSummary,
    nonNegotiables,
    acceptedClaims: [],
    rejectedClaims: [],
    unresolvedDisagreements: [],
    evidenceGaps: [],
    currentQuestions: agenda.focalQuestions
      ? agenda.focalQuestions
          .split(/[？?；;\n]/)
          .map((s) => s.trim())
          .filter((s) => s.length > 0)
      : [],
    convergenceReached: false,
    lastUpdatedRound: -1,
  };
}

/**
 * 用 moderator 的 Analysis 结果更新 TaskLedger（不 mutate 原 ledger，返回新对象）
 */
export function updateLedgerFromAnalysis(
  ledger: TaskLedger,
  analysis: ModeratorAnalysis,
  round: number
): TaskLedger {
  // 将 agreements 追加到 acceptedClaims，用 claim 文本去重
  const existingClaims = new Set(ledger.acceptedClaims.map((c) => c.claim));
  const newAcceptedClaims = [...ledger.acceptedClaims];
  for (const agreement of analysis.agreements) {
    if (!existingClaims.has(agreement.point)) {
      newAcceptedClaims.push({
        claim: agreement.point,
        supportedBy: agreement.supporters,
        round,
      });
      existingClaims.add(agreement.point);
    }
  }

  // 将 disagreements 替换 unresolvedDisagreements（最新一轮的分歧）
  const unresolvedDisagreements = analysis.disagreements.map((d) => ({
    point: d.point,
    positions: d.positions,
  }));

  // 从 disagreements 提取 followUpQuestion 作为 currentQuestions
  const currentQuestions = analysis.disagreements
    .map((d) => d.followUpQuestion)
    .filter((q) => q && q.trim().length > 0);

  return {
    ...ledger,
    acceptedClaims: newAcceptedClaims,
    unresolvedDisagreements,
    currentQuestions,
    convergenceReached: analysis.shouldConverge,
    lastUpdatedRound: round,
  };
}

/**
 * 将 TaskLedger 序列化为可嵌入 prompt 的紧凑文本块
 */
export function ledgerToPromptBlock(ledger: TaskLedger): string {
  const lines: string[] = [];

  lines.push(`【决策概要】${ledger.briefSummary}`);

  if (ledger.nonNegotiables.length > 0) {
    lines.push(`【不可妥协】${ledger.nonNegotiables.join('、')}`);
  }

  if (ledger.acceptedClaims.length > 0) {
    const claimsText = ledger.acceptedClaims
      .map((c) => `${c.claim}（支持者：${c.supportedBy.join(', ')}）`)
      .join('；');
    lines.push(`【已达共识】${claimsText}`);
  }

  if (ledger.unresolvedDisagreements.length > 0) {
    const disagreementsText = ledger.unresolvedDisagreements
      .map((d) => {
        const posText = Object.entries(d.positions)
          .map(([agent, pos]) => `${agent}认为${pos}`)
          .join('，');
        return `${d.point}：${posText}`;
      })
      .join('；');
    lines.push(`【待解决分歧】${disagreementsText}`);
  }

  if (ledger.evidenceGaps.length > 0) {
    lines.push(`【证据空白】${ledger.evidenceGaps.join('、')}`);
  }

  if (ledger.currentQuestions.length > 0) {
    lines.push(`【当前问题】${ledger.currentQuestions.join('、')}`);
  }

  return lines.join('\n');
}

/**
 * 序列化 TaskLedger 为 JSON 字符串（用于持久化）
 */
export function serializeLedger(ledger: TaskLedger): string {
  return JSON.stringify(ledger);
}

/**
 * 从 JSON 字符串反序列化 TaskLedger（用于读取持久化数据）
 */
export function deserializeLedger(json: string): TaskLedger | null {
  try {
    const parsed = JSON.parse(json) as Partial<TaskLedger>;
    if (
      typeof parsed.briefSummary !== 'string' ||
      !Array.isArray(parsed.acceptedClaims) ||
      !Array.isArray(parsed.unresolvedDisagreements)
    ) {
      return null;
    }
    return {
      briefSummary: parsed.briefSummary,
      nonNegotiables: Array.isArray(parsed.nonNegotiables) ? parsed.nonNegotiables : [],
      acceptedClaims: parsed.acceptedClaims,
      rejectedClaims: Array.isArray(parsed.rejectedClaims) ? parsed.rejectedClaims : [],
      unresolvedDisagreements: parsed.unresolvedDisagreements,
      evidenceGaps: Array.isArray(parsed.evidenceGaps) ? parsed.evidenceGaps : [],
      currentQuestions: Array.isArray(parsed.currentQuestions) ? parsed.currentQuestions : [],
      convergenceReached: parsed.convergenceReached === true,
      lastUpdatedRound: typeof parsed.lastUpdatedRound === 'number' ? parsed.lastUpdatedRound : -1,
    };
  } catch {
    return null;
  }
}
