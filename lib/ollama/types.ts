/**
 * Доменные типы чат-провайдера.
 * Сознательно не зависят от конкретного SDK (ollama-js/openai/etc).
 */

export type ChatRole = 'system' | 'user' | 'assistant' | 'tool';

/**
 * Вызов инструмента (функции), запрошенный моделью.
 */
export interface ToolCall {
  /** Уникальный id вызова в рамках одного сообщения ассистента. */
  id: string;
  /** Имя инструмента, должно совпадать с ToolDefinition.name из запроса. */
  name: string;
  /** Распарсенные аргументы. Провайдер отвечает за JSON.parse исходной строки. */
  arguments: Record<string, unknown>;
}

export interface ChatMessage {
  role: ChatRole;
  /** Текст. Допускается пустая строка (ассистент с одними tool_calls). */
  content: string;
  /** Запрошенные ассистентом вызовы инструментов. Только для role === 'assistant'. */
  toolCalls?: ToolCall[];
  /** id вызова, на который отвечает это сообщение. Только для role === 'tool'. */
  toolCallId?: string;
  /** Имя инструмента, на который отвечает это сообщение. Только для role === 'tool'. */
  toolName?: string;
}

/**
 * Инструмент, доступный модели.
 * `parameters` — валидный JSON Schema, описывающий аргументы.
 */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ChatRequest {
  messages: ChatMessage[];
  tools?: ToolDefinition[];
  /** Sampling temperature. Дефолт выбирает провайдер. */
  temperature?: number;
  /** Сигнал отмены запроса. */
  signal?: AbortSignal;
}

export interface ChatResponse {
  message: ChatMessage;
}