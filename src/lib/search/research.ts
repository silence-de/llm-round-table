import type { DecisionBrief } from '../decision/types';
import { nanoid } from 'nanoid';
import { tavilySearch } from './tavily';
import type {
  ResearchConfig,
  ResearchExecutionResult,
  ResearchSource,
} from './types';
import {
  buildResearchQueryPlan,
  buildSourceQualityFlags,
  evaluateResearchQuality,
} from './utils';

const MAX_SNIPPET_LENGTH = 280;

export async function conductResearch(input: {
  brief: DecisionBrief;
  config: ResearchConfig;
}): Promise<ResearchExecutionResult> {
  const queryPlan = buildResearchQueryPlan(input.brief, input.config);

  const results = await Promise.allSettled(
    queryPlan.map((query) =>
      tavilySearch({
        query,
        maxResults: Math.max(4, input.config.maxSources),
        searchDepth: 'basic',
        includeDomains: input.config.preferredDomains,
      })
    )
  );

  const successfulResults = results.filter(
    (result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof tavilySearch>>> =>
      result.status === 'fulfilled'
  );

  if (successfulResults.length === 0) {
    return {
      status: 'failed',
      queryPlan,
      searchConfig: input.config,
      summary: '',
      evaluation: {
        coverageScore: 0,
        recencyScore: 0,
        diversityScore: 0,
        overallConfidence: 0,
        gaps: ['research 查询全部失败，未获取到有效来源。'],
      },
      sources: [],
    };
  }

  const seen = new Set<string>();
  const rawSources: ResearchSource[] = [];

  for (const result of successfulResults) {
    for (const item of result.value.results) {
      if (seen.has(item.url)) continue;
      seen.add(item.url);
      rawSources.push({
        id: nanoid(8),
        title: item.title,
        url: item.url,
        domain: extractDomain(item.url),
        snippet: item.content.slice(0, MAX_SNIPPET_LENGTH).trim(),
        score: item.score,
        selected: true,
        qualityFlags: [],
        publishedDate: item.published_date,
      });
    }
  }

  rawSources.sort((left, right) => bScore(right) - bScore(left));
  const selectedSources = rawSources
    .slice(0, input.config.maxSources)
    .map((source, index, list) => {
      const duplicateDomainCount = list.filter(
        (candidate) => candidate.domain === source.domain
      ).length;
      return {
        ...source,
        id: `R${index + 1}`,
        qualityFlags: buildSourceQualityFlags(source, duplicateDomainCount),
      };
    });

  const summary = formatBriefText(selectedSources, input.brief.topic);
  const evaluation = evaluateResearchQuality({
    brief: input.brief,
    queryPlan,
    sources: selectedSources,
  });

  return {
    status:
      successfulResults.length === results.length ? 'completed' : 'partial',
    queryPlan,
    searchConfig: input.config,
    summary,
    evaluation,
    sources: selectedSources,
  };
}

function formatBriefText(sources: ResearchSource[], topic: string) {
  if (sources.length === 0) return '';

  const lines = [
    `【Research Intelligence】关于「${topic}」的研究来源：`,
    '',
    ...sources.map((source) => {
      const date = source.publishedDate
        ? ` (${source.publishedDate.slice(0, 10)})`
        : '';
      return `${source.id}. ${source.title}${date}\n   ${source.snippet}`;
    }),
    '',
    '请参考以上来源进行讨论，并明确区分结论、风险和仍待验证的问题。',
  ];

  return lines.join('\n');
}

function extractDomain(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function bScore(source: ResearchSource) {
  return source.score + (source.publishedDate ? 0.05 : 0);
}
