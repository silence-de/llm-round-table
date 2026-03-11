import OpenAI from 'openai';
import type { ChatParams, ChatResponse, LLMProvider, StreamChunk } from './types';

export class MoonshotProvider implements LLMProvider {
  readonly providerId = 'moonshot';
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.MOONSHOT_API_KEY,
      baseURL: process.env.MOONSHOT_BASE_URL ?? 'https://api.moonshot.cn/v1',
      timeout: Number(process.env.MOONSHOT_CLIENT_TIMEOUT_MS ?? 180_000),
      maxRetries: 1,
    });
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
      const stream = await this.client.chat.completions.create(
        {
          model: params.model,
          messages,
          stream: true,
          temperature: params.temperature,
          max_tokens: params.maxTokens,
        },
        { timeout: params.timeoutMs ?? this.getTimeoutMs(params.model) }
      );

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
        errorCode: 'provider_error',
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

    const response = await this.client.chat.completions.create(
      {
        model: params.model,
        messages,
        temperature: params.temperature,
        max_tokens: params.maxTokens,
      },
      { timeout: params.timeoutMs ?? this.getTimeoutMs(params.model) }
    );

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

  private getTimeoutMs(modelId: string) {
    if (/preview|thinking/i.test(modelId)) {
      return Number(process.env.MOONSHOT_PREVIEW_TIMEOUT_MS ?? 180_000);
    }
    return Number(process.env.MOONSHOT_TIMEOUT_MS ?? 120_000);
  }
}
