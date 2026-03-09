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
    color: '#D97706',
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
    color: '#10B981',
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
    provider: 'siliconflow',
    modelId: 'Pro/deepseek-ai/DeepSeek-V3.2',
    envKeyName: 'SILICONFLOW_API_KEY',
    envOverride: 'DEEPSEEK_MODEL_ID',
    defaultTemperature: 0.7,
    maxTokens: 4096,
    color: '#3B82F6',
    availableModels: [
      { id: 'Pro/deepseek-ai/DeepSeek-V3.2', label: 'DeepSeek-V3.2 (Pro)' },
      { id: 'deepseek-ai/DeepSeek-V3.2', label: 'DeepSeek-V3.2' },
      { id: 'Pro/deepseek-ai/DeepSeek-R1.2', label: 'DeepSeek-R1.2 (Pro)' },
      { id: 'deepseek-ai/DeepSeek-R1.2', label: 'DeepSeek-R1.2' },
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
    color: '#8B5CF6',
    availableModels: [
      { id: 'Pro/MiniMaxAI/MiniMax-M2.5', label: 'MiniMax-M2.5 (Pro)' },
      { id: 'MiniMaxAI/MiniMax-M2.5', label: 'MiniMax-M2.5' },
      { id: 'MiniMaxAI/MiniMax-Text-01', label: 'MiniMax-Text-01' },
    ],
  },
  {
    id: 'kimi',
    displayName: 'Kimi',
    provider: 'siliconflow',
    modelId: 'Pro/moonshotai/Kimi-K2.5',
    envKeyName: 'SILICONFLOW_API_KEY',
    envOverride: 'KIMI_MODEL_ID',
    defaultTemperature: 0.7,
    maxTokens: 4096,
    color: '#EC4899',
    availableModels: [
      { id: 'Pro/moonshotai/Kimi-K2.5', label: 'Kimi-K2.5 (Pro)' },
      { id: 'moonshotai/Kimi-K2.5', label: 'Kimi-K2.5' },
      { id: 'Pro/moonshotai/Kimi-K1.5-Thinking', label: 'Kimi-K1.5-Thinking (Pro)' },
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
    color: '#EF4444',
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
    color: '#06B6D4',
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
  if (selectedModelId) return selectedModelId;
  if (agent.envOverride && process.env[agent.envOverride]) {
    return process.env[agent.envOverride]!;
  }
  return agent.modelId;
}
