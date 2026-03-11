export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatParams {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  timeoutMs?: number;
}

export interface ChatResponse {
  content: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

export interface StreamChunk {
  type: 'text_delta' | 'done' | 'error';
  content: string;
  errorCode?: 'provider_error' | 'startup_timeout' | 'idle_timeout' | 'request_timeout';
  timeoutType?: 'startup' | 'idle' | 'request';
}

export interface LLMProvider {
  readonly providerId: string;
  streamChat(params: ChatParams): AsyncIterable<StreamChunk>;
  chat(params: ChatParams): Promise<ChatResponse>;
}
