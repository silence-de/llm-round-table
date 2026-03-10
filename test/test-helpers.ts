import fs from 'node:fs';
import type { SSEEvent } from '@/lib/sse/types';
import { sqliteDb } from '@/lib/db/client';
import {
  resetProviderOverridesForTests,
  setProviderOverrideForTests,
} from '@/lib/llm/provider-registry';
import type { ChatParams, ChatResponse, LLMProvider, StreamChunk } from '@/lib/llm/types';

export function resetTestDatabase() {
  sqliteDb.exec(`
    DELETE FROM interjections;
    DELETE FROM messages;
    DELETE FROM minutes;
    DELETE FROM sessions;
  `);
}

export function resetTestEnvironment() {
  resetProviderOverridesForTests();
  resetTestDatabase();
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.OPENAI_API_KEY;
  delete process.env.SILICONFLOW_API_KEY;
  delete process.env.TAVILY_API_KEY;
}

export function cleanupTestDatabaseFile() {
  const dbPath = process.env.ROUND_TABLE_DB_PATH;
  if (dbPath && fs.existsSync(dbPath)) {
    fs.rmSync(dbPath, { force: true });
  }
}

export async function readSSEEvents(response: Response): Promise<SSEEvent[]> {
  const text = await response.text();

  return text
    .split('\n\n')
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      const payload = chunk.startsWith('data: ') ? chunk.slice(6) : chunk;
      return JSON.parse(payload) as SSEEvent;
    });
}

export class FakeProvider implements LLMProvider {
  readonly providerId = 'fake';

  constructor(
    private readonly handlers: {
      streamChat?: (params: ChatParams) => AsyncIterable<StreamChunk>;
      chat?: (params: ChatParams) => Promise<ChatResponse>;
    } = {}
  ) {}

  streamChat(params: ChatParams): AsyncIterable<StreamChunk> {
    if (this.handlers.streamChat) {
      return this.handlers.streamChat(params);
    }

    return streamText('default');
  }

  async chat(params: ChatParams): Promise<ChatResponse> {
    if (this.handlers.chat) {
      return this.handlers.chat(params);
    }

    return { content: 'default', usage: { inputTokens: 1, outputTokens: 1 } };
  }
}

export function installFakeProviders(provider: LLMProvider) {
  setProviderOverrideForTests('anthropic', provider);
  setProviderOverrideForTests('openai', provider);
  setProviderOverrideForTests('siliconflow', provider);
}

export async function* streamText(text: string): AsyncIterable<StreamChunk> {
  for (const token of text.split(' ')) {
    yield { type: 'text_delta', content: token ? `${token} ` : '' };
  }

  yield { type: 'done', content: '' };
}
