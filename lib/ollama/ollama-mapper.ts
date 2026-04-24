import type { Message as OllamaMessage, Tool as OllamaTool, ToolCall as OllamaToolCall } from 'ollama';
import type { ChatMessage, ToolCall, ToolDefinition } from './types';

/**
 * Маппинг доменных типов в формат ollama-js и обратно.
 * Чистые функции, без зависимостей от клиента.
 */

export function toOllamaMessage(message: ChatMessage): OllamaMessage {
    const base: OllamaMessage = {
        role: message.role,
        content: message.content,
    };

    if (message.toolCalls && message.toolCalls.length > 0) {
        base.tool_calls = message.toolCalls.map(toOllamaToolCall);
    }

    // Ollama использует tool_name для tool-сообщений.
    if (message.role === 'tool' && message.toolName) {
        base.tool_name = message.toolName;
    }

    return base;
}

export function toOllamaToolCall(call: ToolCall): OllamaToolCall {
    return {
        function: {
            name: call.name,
            // ollama-js ожидает объект, не строку (в отличие от OpenAI).
            arguments: call.arguments,
        },
    };
}

export function toOllamaTool(tool: ToolDefinition): OllamaTool {
    return {
        type: 'function',
        function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters as OllamaTool['function']['parameters'],
        },
    };
}

export function fromOllamaMessage(message: OllamaMessage): ChatMessage {
    const result: ChatMessage = {
        role: message.role as ChatMessage['role'],
        content: message.content ?? '',
    };

    if (message.tool_calls && message.tool_calls.length > 0) {
        result.toolCalls = message.tool_calls.map((call, i) => fromOllamaToolCall(call, i));
    }

    return result;
}

export function fromOllamaToolCall(call: OllamaToolCall, index = 0): ToolCall {
    return {
        // ollama-js не отдаёт id для tool_calls — генерируем детерминированно по индексу.
        // Консьюмер (API-роут/UI) перед отправкой tool-ответа должен использовать этот id.
        id: `call_${index}`,
        name: call.function.name,
        arguments: call.function.arguments as Record<string, unknown>,
    };
}