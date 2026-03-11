import type { AgentDefinition } from './types';

export const AGENT_CATALOG: AgentDefinition[] = [
  {
    id: 'claude',
    displayName: 'Claude',
    provider: 'anthropic',
    modelId: 'claude-sonnet-4-20250514',
    envKeyName: 'ANTHROPIC_API_KEY',
    envOverride: 'CLAUDE_MODEL_ID',
    defaultTemperature: 0.7,
    maxTokens: 4096,
    color: '#E45858',
    sprite: '/sprites/claude.svg',
    accentGlow: '#F18B8B',
    recommendedPersonaPresetIds: [
      'strategy-architect',
      'first-principles-analyst',
      'systems-thinker',
      'life-planner',
    ],
    availableModels: [
      { id: 'claude-opus-4-6', label: 'Claude Opus 4.6' },
      { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
      { id: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
      { id: 'claude-opus-4-20250514', label: 'Claude Opus 4' },
      { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
    ],
  },
  {
    id: 'gpt',
    displayName: 'GPT',
    provider: 'openai',
    modelId: 'gpt-4o',
    envKeyName: 'OPENAI_API_KEY',
    envOverride: 'GPT_MODEL_ID',
    defaultTemperature: 0.7,
    maxTokens: 4096,
    color: '#7F5AF0',
    sprite: '/sprites/gpt.svg',
    accentGlow: '#A58BFF',
    recommendedPersonaPresetIds: [
      'product-operator',
      'execution-coach',
      'strategy-architect',
      'systems-thinker',
    ],
    availableModels: [
      { id: 'gpt-4o', label: 'GPT-4o' },
      { id: 'gpt-4o-mini', label: 'GPT-4o mini' },
      { id: 'gpt-4.1', label: 'GPT-4.1' },
      { id: 'gpt-4.1-mini', label: 'GPT-4.1 mini' },
      { id: 'gpt-4.5-preview', label: 'GPT-4.5 Preview' },
      { id: 'o3', label: 'o3' },
      { id: 'o4-mini', label: 'o4-mini' },
    ],
  },
  {
    id: 'deepseek',
    displayName: 'DeepSeek',
    provider: 'deepseek',
    modelId: 'deepseek-chat',
    envKeyName: 'DEEPSEEK_API_KEY',
    envOverride: 'DEEPSEEK_MODEL_ID',
    defaultTemperature: 0.7,
    maxTokens: 4096,
    color: '#6246EA',
    sprite: '/sprites/deepseek.svg',
    accentGlow: '#8E78F3',
    recommendedPersonaPresetIds: [
      'first-principles-analyst',
      'skeptical-critic',
      'risk-manager',
      'contrarian',
    ],
    availableModels: [
      { id: 'deepseek-chat', label: 'DeepSeek Chat' },
      { id: 'deepseek-reasoner', label: 'DeepSeek Reasoner' },
    ],
  },
  {
    id: 'minimax',
    displayName: 'MiniMax',
    provider: 'siliconflow',
    modelId: 'Pro/MiniMaxAI/MiniMax-M2.5',
    envKeyName: 'SILICONFLOW_API_KEY',
    envOverride: 'MINIMAX_MODEL_ID',
    defaultTemperature: 0.7,
    maxTokens: 4096,
    color: '#8A6FF0',
    sprite: '/sprites/minimax.svg',
    accentGlow: '#B9A7FF',
    recommendedPersonaPresetIds: [
      'execution-coach',
      'product-operator',
      'strategy-architect',
      'life-planner',
    ],
    availableModels: [
      { id: 'Pro/MiniMaxAI/MiniMax-M2.5', label: 'MiniMax-M2.5 (Pro)' },
      { id: 'MiniMaxAI/MiniMax-M2.5', label: 'MiniMax-M2.5' },
      { id: 'MiniMaxAI/MiniMax-Text-01', label: 'MiniMax-Text-01' },
    ],
  },
  {
    id: 'kimi',
    displayName: 'Kimi',
    provider: 'moonshot',
    modelId: 'kimi-k2.5',
    envKeyName: 'MOONSHOT_API_KEY',
    envOverride: 'KIMI_MODEL_ID',
    defaultTemperature: 0.7,
    maxTokens: 4096,
    color: '#D66BA5',
    sprite: '/sprites/kimi.svg',
    accentGlow: '#E79AC4',
    recommendedPersonaPresetIds: [
      'life-planner',
      'systems-thinker',
      'strategy-architect',
      'execution-coach',
    ],
    availableModels: [
      { id: 'kimi-k2.5', label: 'Kimi K2.5' },
    ],
  },
  {
    id: 'glm',
    displayName: 'GLM',
    provider: 'siliconflow',
    modelId: 'Pro/zai-org/GLM-5',
    envKeyName: 'SILICONFLOW_API_KEY',
    envOverride: 'GLM_MODEL_ID',
    defaultTemperature: 0.7,
    maxTokens: 4096,
    color: '#C85757',
    sprite: '/sprites/glm.svg',
    accentGlow: '#E08E8E',
    recommendedPersonaPresetIds: [
      'risk-manager',
      'skeptical-critic',
      'long-term-investor',
      'contrarian',
    ],
    availableModels: [
      { id: 'Pro/zai-org/GLM-5', label: 'GLM-5 (Pro)' },
      { id: 'zai-org/GLM-5', label: 'GLM-5' },
      { id: 'THUDM/GLM-Z1-32B', label: 'GLM-Z1-32B' },
    ],
  },
  {
    id: 'qwen',
    displayName: 'Qwen',
    provider: 'siliconflow',
    modelId: 'Qwen/Qwen3.5-397B-A17B',
    envKeyName: 'SILICONFLOW_API_KEY',
    envOverride: 'QWEN_MODEL_ID',
    defaultTemperature: 0.7,
    maxTokens: 4096,
    color: '#9C89F5',
    sprite: '/sprites/qwen.svg',
    accentGlow: '#BEB2FF',
    recommendedPersonaPresetIds: [
      'first-principles-analyst',
      'systems-thinker',
      'skeptical-critic',
      'risk-manager',
    ],
    availableModels: [
      { id: 'Qwen/Qwen3.5-397B-A17B', label: 'Qwen3.5-397B' },
      { id: 'Qwen/Qwen3-235B-A22B', label: 'Qwen3-235B' },
      { id: 'Qwen/Qwen3-30B-A3B', label: 'Qwen3-30B' },
      { id: 'Qwen/Qwen2.5-72B-Instruct', label: 'Qwen2.5-72B' },
      { id: 'Qwen/QwQ-32B', label: 'QwQ-32B (Reasoning)' },
    ],
  },
];

export function getAgentDefinition(agentId: string): AgentDefinition | undefined {
  return AGENT_CATALOG.find((a) => a.id === agentId);
}

export function getModelId(agent: AgentDefinition, selectedModelId?: string): string {
  // Validate stored model IDs against current availableModels — silently falls back
  // to the agent default when a session was created with an old/migrated model ID
  // (e.g. SiliconFlow-style "Pro/moonshotai/Kimi-K2.5" after Kimi moved to native API).
  if (selectedModelId && agent.availableModels.some((m) => m.id === selectedModelId)) {
    return selectedModelId;
  }
  if (agent.envOverride && process.env[agent.envOverride]) {
    return process.env[agent.envOverride]!;
  }
  return agent.modelId;
}
