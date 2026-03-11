export type ProviderType =
  | 'anthropic'
  | 'openai'
  | 'siliconflow'
  | 'deepseek'
  | 'moonshot';

export interface ModelOption {
  id: string;
  label: string;
}

export type PersonaPresetCategory =
  | 'strategy'
  | 'skeptic'
  | 'analysis'
  | 'execution'
  | 'risk'
  | 'investment'
  | 'systems'
  | 'product'
  | 'life';

export interface PersonaPreset {
  id: string;
  label: string;
  description: string;
  category: PersonaPresetCategory;
  instructions: string;
  recommendedFor: string[];
  agentIds?: string[];
}

export interface PersonaSelection {
  presetId?: string;
  customNote?: string;
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
  sprite: string;
  accentGlow?: string;
  recommendedPersonaPresetIds?: string[];
}

export interface AgentRole {
  agentId: string;
  persona?: string;
}

export interface SessionAgent {
  definition: AgentDefinition;
  selectedModelId?: string; // override model for this session
  personaSelection?: PersonaSelection;
  persona?: string;
}
