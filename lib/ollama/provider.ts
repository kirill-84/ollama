import type { ChatRequest, ChatResponse } from './types';

/**
 * Абстрактный чат-провайдер.
 * Реализации: OllamaChatProvider (реальный), MockChatProvider (тесты/dev/CI).
 */
export interface IChatProvider {
  chat(request: ChatRequest): Promise<ChatResponse>;
}