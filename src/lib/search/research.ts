import { tavilySearch } from './tavily';
import type { ResearchBrief, ResearchSource } from './types';

const MAX_SNIPPET_LENGTH = 280;

function formatBriefText(sources: ResearchSource[], topic: string): string {
  if (sources.length === 0) return '';

  const lines = [
    `【最新资讯检索】关于「${topic}」的网络搜索结果：`,
    '',
    ...sources.slice(0, 5).map((src, i) => {
      const date = src.publishedDate ? ` (${src.publishedDate.slice(0, 10)})` : '';
      return `${i + 1}. ${src.title}${date}\n   ${src.snippet}`;
    }),
    '',
    '请参考以上最新资讯进行讨论分析，但不必拘泥于此。',
  ];

  return lines.join('\n');
}

export async function conductResearch(topic: string): Promise<ResearchBrief> {
  const currentYear = new Date().getFullYear();

  // Two parallel searches: direct topic + "latest developments" angle
  const queries = [topic, `${topic} 最新进展 ${currentYear}`];

  const results = await Promise.allSettled(
    queries.map((q) => tavilySearch({ query: q, maxResults: 5, searchDepth: 'basic' }))
  );

  // Collect, deduplicate by URL
  const seen = new Set<string>();
  const sources: ResearchSource[] = [];

  for (const result of results) {
    if (result.status !== 'fulfilled') continue;
    for (const item of result.value.results) {
      if (seen.has(item.url)) continue;
      seen.add(item.url);
      sources.push({
        title: item.title,
        url: item.url,
        snippet: item.content.slice(0, MAX_SNIPPET_LENGTH).trim(),
        score: item.score,
        publishedDate: item.published_date,
      });
    }
  }

  // Sort by relevance score, take top 6
  sources.sort((a, b) => b.score - a.score);
  const topSources = sources.slice(0, 6);

  const briefText = formatBriefText(topSources, topic);

  return {
    query: topic,
    sources: topSources,
    briefText,
    searchedAt: Date.now(),
  };
}
