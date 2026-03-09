import OpenAI from 'openai';
import type { LLMProvider, ChatParams, ChatResponse, StreamChunk } from './types';

export class OpenAIProvider implements LLMProvider {
  readonly providerId = 'openai';
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI();
  }

  async *streamChat(params: ChatParams): AsyncIterable<StreamChunk> {
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

    if (params.systemPrompt) {
      messages.push({ role: 'system', content: params.systemPrompt });
    }

    for (const msg of params.messages) {
      messages.push({ role: msg.role, content: msg.content });
    }

    try {
      const stream = await this.client.chat.completions.create({
        model: params.model,
        messages,
        stream: true,
        temperature: params.temperature,
        max_tokens: params.maxTokens,
      });

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) {
          yield { type: 'text_delta', content: delta };
        }
      }
      yield { type: 'done', content: '' };
    } catch (error) {
      yield {
        type: 'error',
        content: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async chat(params: ChatParams): Promise<ChatResponse> {
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

    if (params.systemPrompt) {
      messages.push({ role: 'system', content: params.systemPrompt });
    }

    for (const msg of params.messages) {
      messages.push({ role: msg.role, content: msg.content });
    }

    const response = await this.client.chat.completions.create({
      model: params.model,
      messages,
      temperature: params.temperature,
      max_tokens: params.maxTokens,
    });

    return {
      content: response.choices[0]?.message?.content ?? '',
      usage: response.usage
        ? {
            inputTokens: response.usage.prompt_tokens,
            outputTokens: response.usage.completion_tokens,
          }
        : undefined,
    };
  }
}
