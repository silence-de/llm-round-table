import OpenAI from 'openai';
import type { LLMProvider, ChatParams, ChatResponse, StreamChunk } from './types';

export class SiliconFlowProvider implements LLMProvider {
  readonly providerId = 'siliconflow';
  private client: OpenAI;
  private readonly maxConcurrent: number;
  private activeCount = 0;
  private waitQueue: Array<() => void> = [];

  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.SILICONFLOW_API_KEY,
      baseURL: 'https://api.siliconflow.cn/v1',
      timeout: Number(process.env.SILICONFLOW_CLIENT_TIMEOUT_MS ?? 240_000),
      maxRetries: 1,
    });
    this.maxConcurrent = Number(process.env.SILICONFLOW_MAX_CONCURRENCY ?? 1);
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
      await this.acquireSlot();

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
      } finally {
        this.releaseSlot();
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

    await this.acquireSlot();

    let response: OpenAI.Chat.ChatCompletion;
    try {
      response = await this.client.chat.completions.create(
        {
          model: params.model,
          messages,
          temperature: params.temperature,
          max_tokens: params.maxTokens,
        },
        { timeout: params.timeoutMs ?? this.getTimeoutMs(params.model) }
      );
    } finally {
      this.releaseSlot();
    }

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

  private getTimeoutMs(modelId: string): number {
    if (/qwen/i.test(modelId)) {
      return Number(process.env.SILICONFLOW_QWEN_TIMEOUT_MS ?? 240_000);
    }
    return Number(process.env.SILICONFLOW_TIMEOUT_MS ?? 180_000);
  }

  private async acquireSlot() {
    if (this.activeCount < this.maxConcurrent) {
      this.activeCount += 1;
      return;
    }

    await new Promise<void>((resolve) => {
      this.waitQueue.push(resolve);
    });
    this.activeCount += 1;
  }

  private releaseSlot() {
    this.activeCount = Math.max(0, this.activeCount - 1);
    const next = this.waitQueue.shift();
    if (next) next();
  }
}
