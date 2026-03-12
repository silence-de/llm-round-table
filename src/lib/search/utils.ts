import type { DecisionBrief } from '../decision/types';
import type {
  ResearchConfig,
  ResearchEvaluation,
  ResearchSource,
} from './types';

export const DEFAULT_RESEARCH_CONFIG: ResearchConfig = {
  enabled: true,
  mode: 'auto',
  userQueries: [],
  preferredDomains: [],
  domainPolicy: 'prefer',
  maxSources: 6,
  maxReruns: 2,
};

export function getResearchSourceCitationLabel(
  source: Pick<ResearchSource, 'rank'>
) {
  const rank = Number.isFinite(source.rank) ? Math.max(1, Math.round(source.rank)) : 1;
  return `R${rank}`;
}

export function findResearchSourceByCitation(
  reference: string,
  researchSources: ResearchSource[]
) {
  const normalized = reference.trim();
  if (!normalized) return null;
  return (
    researchSources.find((source) => getResearchSourceCitationLabel(source) === normalized) ??
    researchSources.find((source) => source.id === normalized) ??
    null
  );
}

export function attachCitationLabels<T extends ResearchSource>(sources: T[]) {
  return sources.map((source) => ({
    ...source,
    citationLabel: getResearchSourceCitationLabel(source),
  }));
}

export function normalizeResearchConfig(
  value?: Partial<ResearchConfig> | null
): ResearchConfig {
  return {
    enabled: value?.enabled ?? true,
    mode: value?.mode === 'guided' ? 'guided' : 'auto',
    userQueries: normalizeStringList(value?.userQueries),
    preferredDomains: normalizeDomainList(value?.preferredDomains),
    domainPolicy: normalizeDomainPolicy(value?.domainPolicy),
    maxSources: normalizeMaxSources(value?.maxSources),
    maxReruns: normalizeMaxReruns(value?.maxReruns),
  };
}

export function buildResearchQueryPlan(
  brief: DecisionBrief,
  config: ResearchConfig
) {
  const topic = brief.topic.trim();
  const baseQueries = [
    topic,
    compactQuery([
      topic,
      brief.goal || '',
      '风险 反例 关键约束',
    ]),
    compactQuery([
      topic,
      brief.desiredOutput === 'comparison' ? '对比 验证 数据' : '验证 数据 最新进展',
      brief.constraints || '',
    ]),
  ].filter(Boolean);

  if (config.mode === 'guided') {
    return dedupeQueries([...baseQueries, ...config.userQueries]);
  }

  return dedupeQueries(baseQueries);
}

export function evaluateResearchQuality(input: {
  brief: DecisionBrief;
  queryPlan: string[];
  sources: ResearchSource[];
}): ResearchEvaluation {
  const { brief, queryPlan, sources } = input;
  const domains = new Set(sources.map((source) => source.domain).filter(Boolean));
  const recentSourceCount = sources.filter((source) =>
    isRecent(source.publishedDate, brief.decisionType)
  ).length;
  const staleSourceCount = sources.filter(
    (source) => !isRecent(source.publishedDate, brief.decisionType)
  ).length;
  const missingPublishedDateCount = sources.filter(
    (source) => !source.publishedDate
  ).length;
  const coverageSignals = [
    queryPlan.some((query) => includesAny(query, [brief.topic])),
    brief.goal
      ? queryPlan.some((query) =>
          includesAny(query, extractMeaningfulTerms(brief.goal))
        )
      : true,
    brief.constraints
      ? queryPlan.some((query) =>
          includesAny(query, [
            ...extractMeaningfulTerms(brief.constraints),
            '风险',
            '约束',
            '限制',
            '预算',
            '成本',
            '时间',
          ])
        )
      : true,
    brief.desiredOutput === 'comparison'
      ? queryPlan.some((query) => includesAny(query, ['对比', '比较', 'vs']))
      : queryPlan.some((query) => includesAny(query, ['验证', '数据', '进展'])),
  ];
  const coverageScore = toScore(
    coverageSignals.filter(Boolean).length / coverageSignals.length
  );
  const recencyScore =
    sources.length === 0 ? 0 : toScore(recentSourceCount / Math.max(1, sources.length));
  const diversityScore =
    sources.length === 0 ? 0 : toScore(domains.size / Math.max(1, Math.min(sources.length, 4)));
  const overallConfidence = Math.round(
    coverageScore * 0.4 + recencyScore * 0.3 + diversityScore * 0.3
  );

  const gaps: string[] = [];
  const staleFlags: string[] = [];
  if (sources.length < 3) {
    gaps.push('可用来源数量偏少，结论证据厚度不足。');
  }
  if (brief.constraints && coverageScore < 75) {
    gaps.push('约束条件没有被 research query 明确覆盖。');
  }
  if (brief.desiredOutput === 'comparison' && !queryPlan.some((query) => /对比|比较|vs/i.test(query))) {
    gaps.push('缺少明确的方案比较类检索。');
  }
  if (recencyScore < 50) {
    gaps.push('近期来源不足，时效性信号偏弱。');
  }
  if (diversityScore < 50) {
    gaps.push('来源域名过于集中，证据多样性不足。');
  }
  if (sources.length > 0) {
    const staleRatio = staleSourceCount / sources.length;
    const missingDateRatio = missingPublishedDateCount / sources.length;
    if (recentSourceCount === 0) {
      staleFlags.push('no_recent_sources');
    }
    if (staleRatio >= 0.6) {
      staleFlags.push('stale_majority');
      gaps.push('多数来源时效性不足，建议补充更新证据。');
    }
    if (missingDateRatio >= 0.5) {
      staleFlags.push('missing_publish_dates');
      gaps.push('来源发布时间缺失较多，时效判断可靠性受限。');
    }
  } else {
    staleFlags.push('no_sources');
  }

  return {
    coverageScore,
    recencyScore,
    diversityScore,
    overallConfidence,
    gaps,
    staleFlags,
  };
}

export function buildResearchSummaryText(sources: ResearchSource[], topic: string) {
  if (sources.length === 0) return '';

  const orderedSources = [...sources].sort((left, right) => left.rank - right.rank);
  const lines = [
    `【Research Intelligence】关于「${topic}」的研究来源：`,
    '',
    ...orderedSources.map((source) => {
      const dateLabel = source.capturedAt
        ? ` (captured ${formatDateLabel(source.capturedAt)})`
        : source.publishedDate
          ? ` (${source.publishedDate.slice(0, 10)})`
          : '';
      const verificationLabel =
        source.sourceType === 'browser_verification'
          ? ` [browser verification${source.verificationProfile ? `:${source.verificationProfile}` : ''}]`
          : '';
      const verifiedFacts =
        source.verifiedFields && source.verifiedFields.length > 0
          ? `\n   Extracted signals (manual review): ${source.verifiedFields
              .slice(0, 4)
              .map((field) => `${field.label}=${field.value}`)
              .join(' | ')}`
          : '';
      const claimHint = source.claimHint ? `\n   Claim hint: ${source.claimHint}` : '';
      return `${getResearchSourceCitationLabel(source)}. ${source.title}${verificationLabel}${dateLabel}\n   ${source.snippet}${verifiedFacts}${claimHint}`;
    }),
    '',
    '请参考以上来源进行讨论，并明确区分结论、风险和仍待验证的问题。',
  ];

  return lines.join('\n');
}

export function buildSourceQualityFlags(
  source: Pick<ResearchSource, 'publishedDate' | 'score'>,
  duplicateDomainCount: number
) {
  const flags: string[] = [];
  if (!source.publishedDate) {
    flags.push('missing_publish_date');
  } else if (!isRecent(source.publishedDate)) {
    flags.push('stale_source');
  }
  if (source.score < 0.55) {
    flags.push('low_relevance');
  }
  if (duplicateDomainCount >= 3) {
    flags.push('domain_concentration');
  }
  return flags;
}

function compactQuery(parts: string[]) {
  return parts
    .map((part) => part.trim())
    .filter(Boolean)
    .join(' ');
}

function dedupeQueries(queries: string[]) {
  return Array.from(new Set(queries.map((query) => query.trim()).filter(Boolean)));
}

function normalizeStringList(value: unknown) {
  return Array.isArray(value)
    ? value
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter(Boolean)
    : [];
}

function normalizeDomainList(value: unknown) {
  return normalizeStringList(value).map((item) =>
    item
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/.*$/, '')
      .toLowerCase()
  );
}

function normalizeMaxSources(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_RESEARCH_CONFIG.maxSources;
  return Math.max(3, Math.min(10, Math.round(numeric)));
}

function normalizeMaxReruns(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_RESEARCH_CONFIG.maxReruns;
  return Math.max(0, Math.min(5, Math.round(numeric)));
}

function normalizeDomainPolicy(value: unknown): ResearchConfig['domainPolicy'] {
  if (value === 'any' || value === 'strict') return value;
  return 'prefer';
}

function toScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value * 100)));
}

function includesAny(text: string, terms: string[]) {
  const haystack = text.toLowerCase();
  return terms.some((term) => term && haystack.includes(term.toLowerCase()));
}

function extractMeaningfulTerms(text: string) {
  return text
    .split(/[\s,，。；;、/]+/)
    .map((term) => term.trim())
    .filter((term) => term.length >= 2)
    .slice(0, 5);
}

function isRecent(value?: string, decisionType: DecisionBrief['decisionType'] = 'general') {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return Date.now() - date.getTime() <= staleWindowMs(decisionType);
}

function formatDateLabel(value: number | string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString().slice(0, 10);
}

function staleWindowMs(decisionType: DecisionBrief['decisionType']) {
  const windowDays =
    decisionType === 'investment'
      ? 45
      : decisionType === 'product' || decisionType === 'risk'
        ? 90
        : decisionType === 'career'
          ? 120
          : 180;
  return windowDays * 24 * 60 * 60 * 1000;
}
