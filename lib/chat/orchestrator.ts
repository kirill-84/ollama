import 'server-only';
import type {
    ChatMessage,
    IChatProvider,
    ToolDefinition,
} from '@/lib/ollama';
import type { IFlightsProvider } from '@/lib/flights/provider';
import { executeSearchFlights } from './search-flights-tool';

export const MAX_TOOL_ITERATIONS = 5;

const FALLBACK_CONTENT =
    'Извините, не получилось обработать запрос. Попробуйте сформулировать иначе.';

export interface RunChatTurnInput {
    messages: ChatMessage[];
    chatProvider: IChatProvider;
    flightsProvider: IFlightsProvider;
    tools?: ToolDefinition[];
    signal?: AbortSignal;
    maxIterations?: number;
    defaultCurrency?: string;
}

/**
 * Прокручивает tool-loop до финального assistant-ответа.
 * Возвращает все новые сообщения turn-а (assistant с tool_calls, tool-results,
 * финальный assistant) — БЕЗ исходного user-сообщения, оно уже во входных messages.
 *
 * При превышении maxIterations возвращает накопленные сообщения + assistant-fallback.
 * AbortError из chatProvider/flightsProvider пробрасывается наверх.
 */
export async function runChatTurn(
    input: RunChatTurnInput,
): Promise<ChatMessage[]> {
    const {
        messages,
        chatProvider,
        flightsProvider,
        tools,
        signal,
        defaultCurrency,
    } = input;
    const max = input.maxIterations ?? MAX_TOOL_ITERATIONS;

    const newMessages: ChatMessage[] = [];
    const conversation: ChatMessage[] = [...messages];

    for (let i = 0; i < max; i++) {
        const { message } = await chatProvider.chat({
            messages: [...conversation],
            tools,
            signal,
        });

        conversation.push(message);
        newMessages.push(message);

        const toolCalls = message.toolCalls ?? [];
        if (toolCalls.length === 0) {
            return newMessages;
        }

        for (const toolCall of toolCalls) {
            const toolMessage = await executeSearchFlights(toolCall, {
                flightsProvider,
                signal,
                defaultCurrency,
            });
            conversation.push(toolMessage);
            newMessages.push(toolMessage);
        }
    }

    newMessages.push({
        role: 'assistant',
        content: FALLBACK_CONTENT,
    });
    return newMessages;
}
