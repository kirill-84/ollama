import { describe, it, expect } from 'vitest';
import {
    toOllamaMessage,
    toOllamaTool,
    fromOllamaMessage,
    fromOllamaToolCall,
} from '@/lib/ollama/ollama-mapper';

describe('ollama-mapper', () => {
    describe('toOllamaMessage', () => {
        it('маппит простое user-сообщение', () => {
            const result = toOllamaMessage({ role: 'user', content: 'привет' });
            expect(result).toEqual({ role: 'user', content: 'привет' });
        });

        it('маппит assistant с tool_calls', () => {
            const result = toOllamaMessage({
                role: 'assistant',
                content: '',
                toolCalls: [
                    { id: 'call_0', name: 'search_flights', arguments: { origin: 'MOW' } },
                ],
            });

            expect(result).toEqual({
                role: 'assistant',
                content: '',
                tool_calls: [
                    { function: { name: 'search_flights', arguments: { origin: 'MOW' } } },
                ],
            });
        });

        it('маппит tool-сообщение с toolName', () => {
            const result = toOllamaMessage({
                role: 'tool',
                content: '{"price": 45000}',
                toolCallId: 'call_0',
                toolName: 'search_flights',
            });

            expect(result).toEqual({
                role: 'tool',
                content: '{"price": 45000}',
                tool_name: 'search_flights',
            });
        });
    });

    describe('toOllamaTool', () => {
        it('оборачивает ToolDefinition в function-формат', () => {
            const result = toOllamaTool({
                name: 'search_flights',
                description: 'Search flights to Sri Lanka',
                parameters: { type: 'object', properties: {} },
            });

            expect(result).toEqual({
                type: 'function',
                function: {
                    name: 'search_flights',
                    description: 'Search flights to Sri Lanka',
                    parameters: { type: 'object', properties: {} },
                },
            });
        });
    });

    describe('fromOllamaMessage', () => {
        it('маппит простой ответ ассистента', () => {
            const result = fromOllamaMessage({
                role: 'assistant',
                content: 'Здравствуйте!',
            });

            expect(result).toEqual({ role: 'assistant', content: 'Здравствуйте!' });
        });

        it('подставляет пустой content, если его нет в ответе', () => {
            const result = fromOllamaMessage({
                role: 'assistant',
                content: undefined as unknown as string,
            });

            expect(result.content).toBe('');
        });

        it('маппит tool_calls с синтетическими id', () => {
            const result = fromOllamaMessage({
                role: 'assistant',
                content: '',
                tool_calls: [
                    { function: { name: 'search_flights', arguments: { origin: 'MOW' } } },
                    { function: { name: 'search_flights', arguments: { origin: 'LED' } } },
                ],
            });

            expect(result.toolCalls).toEqual([
                { id: 'call_0', name: 'search_flights', arguments: { origin: 'MOW' } },
                { id: 'call_1', name: 'search_flights', arguments: { origin: 'LED' } },
            ]);
        });
    });

    describe('fromOllamaToolCall', () => {
        it('использует переданный индекс для id', () => {
            const result = fromOllamaToolCall(
                { function: { name: 'search_flights', arguments: {} } },
                3,
            );
            expect(result.id).toBe('call_3');
        });
    });
});