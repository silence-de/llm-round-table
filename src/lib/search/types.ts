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
  domainPolicy: 'any' | 'prefer' | 'strict';
  maxSources: number;
  maxReruns: number;
}

export interface ResearchEvaluation {
  coverageScore: number;
  recencyScore: number;
  diversityScore: number;
  overallConfidence: number;
  gaps: string[];
  staleFlags: string[];
}

export interface ResearchSource {
  id: string;
  citationLabel?: string;
  sourceType?: 'research' | 'browser_verification';
  verificationProfile?: string;
  title: string;
  url: string;
  domain: string;
  snippet: string;
  score: number;
  selected: boolean;
  pinned: boolean;
  rank: number;
  excludedReason?: string;
  stale: boolean;
  qualityFlags: string[];
  publishedDate?: string;
  capturedAt?: number | string;
  snapshotPath?: string;
  claimHint?: string;
  note?: string;
  verificationNotes?: string[];
  verifiedFields?: Array<{
    label: string;
    value: string;
    confidence: 'high' | 'medium' | 'low';
  }>;
  extractionMethod?: 'playwright_dom' | 'fetch_html_fallback';
  extractionQuality?: 'high' | 'medium' | 'low';
  captureStatus?: 'screenshot' | 'snapshot_fallback';
}

export interface ResearchRunDetail {
  id: string;
  sessionId: string;
  status: ResearchRunStatus;
  queryPlan: string[];
  searchConfig: ResearchConfig;
  summary: string;
  rerunCount?: number;
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
