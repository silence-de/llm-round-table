export interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
  published_date?: string;
}

export interface ResearchSource {
  title: string;
  url: string;
  snippet: string;
  score: number;
  publishedDate?: string;
}

export interface ResearchBrief {
  query: string;
  sources: ResearchSource[];
  briefText: string;
  searchedAt: number;
}
