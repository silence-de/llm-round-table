import Anthropic from '@anthropic-ai/sdk';
import type { LLMProvider, ChatParams, ChatResponse, StreamChunk } from './types';

export class AnthropicProvider implements LLMProvider {
  readonly providerId = 'anthropic';
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic();
  }

  async *streamChat(params: ChatParams): AsyncIterable<StreamChunk> {
    const messages = params.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    try {
      const stream = this.client.messages.stream({
        model: params.model,
        max_tokens: params.maxTokens ?? 4096,
        system: params.systemPrompt,
        messages,
        temperature: params.temperature,
      });

      for await (const event of stream) {
        if (
          event.type === 'content_block_delta' &&
          event.delta.type === 'text_delta'
        ) {
          yield { type: 'text_delta', content: event.delta.text };
        }
      }
      yield { type: 'done', content: '' };
    } catch (error) {
      yield {
        type: 'error',
        content: error instanceof Error ? error.message : String(error),
        errorCode: 'provider_error',
      };
    }
  }

  async chat(params: ChatParams): Promise<ChatResponse> {
    const messages = params.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    const response = await this.client.messages.create({
      model: params.model,
      max_tokens: params.maxTokens ?? 4096,
      system: params.systemPrompt,
      messages,
      temperature: params.temperature,
    });

    const text = response.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('');

    return {
      content: text,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
    };
  }
}
