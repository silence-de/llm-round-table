export type ProviderType = 'anthropic' | 'openai' | 'siliconflow';

export interface ModelOption {
  id: string;
  label: string;
}

export interface AgentDefinition {
  id: string;
  displayName: string;
  provider: ProviderType;
  modelId: string;
  availableModels: ModelOption[];
  envKeyName: string; // env var name for the API key (used for availability check)
  envOverride?: string;
  defaultTemperature: number;
  maxTokens: number;
  color: string;
}

export interface AgentRole {
  agentId: string;
  persona?: string;
}

export interface SessionAgent {
  definition: AgentDefinition;
  selectedModelId?: string; // override model for this session
  persona?: string;
}
