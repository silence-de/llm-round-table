import type { TaskLedger, LedgerRiskEntry } from './types';

export interface ExtractedEvidence {
  claim: string;
  sourcePhase: string;
  agentId: string;
  hasSource: boolean;
  gapReason: string | null;
}

/**
 * 从 allMessages 中提取 evidence 条目
 * 扫描每条消息中的 ---STRUCTURED--- 块，提取 claims 作为 evidence
 */
export function extractEvidenceFromMessages(
  allMessages: Array<{ agentId: string; displayName: string; content: string; phase: string }>
): ExtractedEvidence[] {
  const evidence: ExtractedEvidence[] = [];
  for (const msg of allMessages) {
    const separator = '---STRUCTURED---';
    const idx = msg.content.indexOf(separator);
    if (idx === -1) continue;
    const jsonPart = msg.content.slice(idx + separator.length).trim();
    try {
      const parsed = JSON.parse(jsonPart) as Record<string, unknown>;
      const claims = Array.isArray(parsed.claims) ? parsed.claims : [];
      for (const c of claims) {
        if (typeof c?.claim !== 'string') continue;
        const citationLabels = Array.isArray(c.citationLabels) ? c.citationLabels : [];
        evidence.push({
          claim: c.claim,
          sourcePhase: msg.phase,
          agentId: msg.agentId,
          hasSource: citationLabels.length > 0,
          gapReason: typeof c.gapReason === 'string' ? c.gapReason : null,
        });
      }
    } catch {
      // skip malformed JSON
    }
  }
  return evidence;
}

/**
 * 从 allMessages 中提取风险条目
 * 扫描 moderator analysis 消息中的 risks 字段
 */
export function extractRisksFromMessages(
  allMessages: Array<{ agentId: string; displayName: string; content: string; phase: string }>
): LedgerRiskEntry[] {
  const risks: LedgerRiskEntry[] = [];
  let riskCounter = 0;
  for (const msg of allMessages) {
    if (msg.agentId !== 'moderator' && msg.phase !== 'analysis') continue;
    // Try to parse JSON from moderator analysis messages
    const braceMatch = msg.content.match(/\{[\s\S]*\}/);
    if (!braceMatch) continue;
    try {
      const parsed = JSON.parse(braceMatch[0]) as Record<string, unknown>;
      // Extract from disagreements as implicit risks
      const disagreements = Array.isArray(parsed.disagreements) ? parsed.disagreements : [];
      for (const d of disagreements) {
        if (typeof d?.point !== 'string') continue;
        riskCounter++;
        risks.push({
          riskId: `risk_${riskCounter}`,
          description: d.point,
          severity: 'medium',
        });
      }
    } catch {
      // skip
    }
  }
  return risks;
}

/**
 * 用提取结果更新 ledger 的 riskRegister
 */
export function applyExtractedRisksToLedger(
  ledger: TaskLedger,
  risks: LedgerRiskEntry[]
): TaskLedger {
  // Merge: avoid duplicates by riskId
  const existingIds = new Set(ledger.riskRegister.map((r) => r.riskId));
  const newRisks = risks.filter((r) => !existingIds.has(r.riskId));
  return { ...ledger, riskRegister: [...ledger.riskRegister, ...newRisks] };
}
