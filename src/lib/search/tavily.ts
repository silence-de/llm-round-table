import type { TavilySearchResult } from './types';

const TAVILY_API_URL = 'https://api.tavily.com/search';

export interface TavilySearchOptions {
  query: string;
  maxResults?: number;
  searchDepth?: 'basic' | 'advanced';
}

export interface TavilySearchResponse {
  query: string;
  results: TavilySearchResult[];
  answer?: string;
}

export async function tavilySearch(
  options: TavilySearchOptions
): Promise<TavilySearchResponse> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    throw new Error('TAVILY_API_KEY not set');
  }

  const response = await fetch(TAVILY_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      query: options.query,
      max_results: options.maxResults ?? 5,
      search_depth: options.searchDepth ?? 'basic',
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Tavily API error ${response.status}: ${text}`);
  }

  return response.json() as Promise<TavilySearchResponse>;
}
