import type { IChatProvider } from './provider';
import type { ChatRequest, ChatResponse } from './types';

export type MockResponder = (request: ChatRequest) => ChatResponse;

export interface MockRule {
  /** Предикат по запросу. */
  match: (request: ChatRequest) => boolean;
  /** Генератор ответа. Вызывается только если match === true. */
  respond: MockResponder;
}

/**
 * Конфигурируемый mock. Правила перебираются по порядку, побеждает первое
 * подошедшее. Если ни одно не подошло — вызывается fallback.
 *
 * Используется:
 *   1) в юнит-тестах других слоёв — с кастомными правилами;
 *   2) в dev/CI при OLLAMA_MODE=mock — со сценариями из mock-scenarios.ts
 *      (добавим на шаге factory).
 */
export class MockChatProvider implements IChatProvider {
  constructor(
    private readonly rules: MockRule[],
    private readonly fallback: MockResponder,
  ) {}

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const rule = this.rules.find((r) => r.match(request));
    return (rule?.respond ?? this.fallback)(request);
  }
}