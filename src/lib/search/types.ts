export interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
  published_date?: string;
}

export type ResearchMode = 'auto' | 'guided';
export type ResearchRunStatus =
  | 'running'
  | 'completed'
  | 'partial'
  | 'skipped'
  | 'failed';

export interface ResearchConfig {
  enabled: boolean;
  mode: ResearchMode;
  userQueries: string[];
  preferredDomains: string[];
  maxSources: number;
}

export interface ResearchEvaluation {
  coverageScore: number;
  recencyScore: number;
  diversityScore: number;
  overallConfidence: number;
  gaps: string[];
}

export interface ResearchSource {
  id: string;
  title: string;
  url: string;
  domain: string;
  snippet: string;
  score: number;
  selected: boolean;
  qualityFlags: string[];
  publishedDate?: string;
}

export interface ResearchRunDetail {
  id: string;
  sessionId: string;
  status: ResearchRunStatus;
  queryPlan: string[];
  searchConfig: ResearchConfig;
  summary: string;
  evaluation: ResearchEvaluation | null;
  sources: ResearchSource[];
  createdAt?: number | string;
  updatedAt?: number | string;
}

export interface ResearchExecutionResult {
  status: ResearchRunStatus;
  queryPlan: string[];
  searchConfig: ResearchConfig;
  summary: string;
  evaluation: ResearchEvaluation | null;
  sources: ResearchSource[];
}
