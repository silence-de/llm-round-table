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
  maxSources: 6,
};

export function normalizeResearchConfig(
  value?: Partial<ResearchConfig> | null
): ResearchConfig {
  return {
    enabled: value?.enabled ?? true,
    mode: value?.mode === 'guided' ? 'guided' : 'auto',
    userQueries: normalizeStringList(value?.userQueries),
    preferredDomains: normalizeDomainList(value?.preferredDomains),
    maxSources: normalizeMaxSources(value?.maxSources),
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
  const recentSourceCount = sources.filter((source) => isRecent(source.publishedDate)).length;
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

  return {
    coverageScore,
    recencyScore,
    diversityScore,
    overallConfidence,
    gaps,
  };
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
    item.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '')
  );
}

function normalizeMaxSources(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_RESEARCH_CONFIG.maxSources;
  return Math.max(3, Math.min(10, Math.round(numeric)));
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

function isRecent(value?: string) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return Date.now() - date.getTime() <= 180 * 24 * 60 * 60 * 1000;
}
