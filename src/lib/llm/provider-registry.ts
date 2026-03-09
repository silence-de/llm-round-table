import type { LLMProvider } from './types';
import { AnthropicProvider } from './anthropic-provider';
import { OpenAIProvider } from './openai-provider';
import { SiliconFlowProvider } from './siliconflow-provider';

type ProviderType = 'anthropic' | 'openai' | 'siliconflow';

const providers = new Map<ProviderType, LLMProvider>();

export function getProvider(type: ProviderType): LLMProvider {
  let provider = providers.get(type);
  if (!provider) {
    switch (type) {
      case 'anthropic':
        provider = new AnthropicProvider();
        break;
      case 'openai':
        provider = new OpenAIProvider();
        break;
      case 'siliconflow':
        provider = new SiliconFlowProvider();
        break;
    }
    providers.set(type, provider);
  }
  return provider;
}
