import { describe, it, expect, vi } from 'vitest';
import { runChatTurn, MAX_TOOL_ITERATIONS } from '@/lib/chat/orchestrator';
import { searchFlightsTool } from '@/lib/chat/search-flights-tool';
import type { ChatMessage, ChatResponse, IChatProvider } from '@/lib/ollama';
import type { IFlightsProvider } from '@/lib/flights/provider';
import type { FlightOffer } from '@/lib/flights/types';

const userMessage: ChatMessage = {
    role: 'user',
    content: 'Билет Москва — Коломбо на завтра',
};

const sampleOffer: FlightOffer = {
    price: 50000,
    currency: 'RUB',
    airline: { code: 'SU', name: 'Aeroflot' },
    origin: { code: 'MOW', city: 'Москва' },
    destination: { code: 'CMB', city: 'Коломбо' },
    outbound: {
        departureAt: '2026-05-15T10:00:00Z',
        arrivalAt: '2026-05-15T20:00:00Z',
        durationMinutes: 600,
        stops: 0,
        flightNumber: 'SU123',
    },
    deepLink: 'https://example.com/book/1',
};

const mkChatProvider = (responses: ChatResponse[]): IChatProvider => {
    const chat = vi.fn();
    for (const r of responses) chat.mockResolvedValueOnce(r);
    return { chat };
};

const mkFlightsProvider = (
    overrides?: Partial<IFlightsProvider>,
): IFlightsProvider => ({
    search: vi.fn().mockResolvedValue([sampleOffer]),
    ...overrides,
});

describe('runChatTurn', () => {
    it('возвращает один assistant без tool_calls', async () => {
        const chatProvider = mkChatProvider([
            { message: { role: 'assistant', content: 'Готово' } },
        ]);
        const flightsProvider = mkFlightsProvider();

        const result = await runChatTurn({
            messages: [userMessage],
            chatProvider,
            flightsProvider,
        });

        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({ role: 'assistant', content: 'Готово' });
        expect(flightsProvider.search).not.toHaveBeenCalled();
    });

    it('обрабатывает один tool_call и возвращает 3 сообщения', async () => {
        const chatProvider = mkChatProvider([
            {
                message: {
                    role: 'assistant',
                    content: '',
                    toolCalls: [
                        {
                            id: 'call_0',
                            name: 'search_flights',
                            arguments: {
                                origin: 'MOW',
                                destination: 'CMB',
                                departureDate: '2026-05-15',
                            },
                        },
                    ],
                },
            },
            { message: { role: 'assistant', content: 'Нашёл 1 вариант' } },
        ]);
        const flightsProvider = mkFlightsProvider();

        const result = await runChatTurn({
            messages: [userMessage],
            chatProvider,
            flightsProvider,
            tools: [searchFlightsTool],
        });

        expect(result).toHaveLength(3);
        expect(result[0].role).toBe('assistant');
        expect(result[0].toolCalls).toHaveLength(1);
        expect(result[1].role).toBe('tool');
        expect(result[1].toolCallId).toBe('call_0');
        expect(result[2]).toEqual({
            role: 'assistant',
            content: 'Нашёл 1 вариант',
        });
        expect(flightsProvider.search).toHaveBeenCalledTimes(1);
    });

    it('подаёт tool-результат обратно модели в следующем вызове', async () => {
        const chat = vi
            .fn()
            .mockResolvedValueOnce({
                message: {
                    role: 'assistant',
                    content: '',
                    toolCalls: [
                        {
                            id: 'call_0',
                            name: 'search_flights',
                            arguments: {
                                origin: 'MOW',
                                destination: 'CMB',
                                departureDate: '2026-05-15',
                            },
                        },
                    ],
                },
            })
            .mockResolvedValueOnce({
                message: { role: 'assistant', content: 'Ответ' },
            });
        const chatProvider: IChatProvider = { chat };

        await runChatTurn({
            messages: [userMessage],
            chatProvider,
            flightsProvider: mkFlightsProvider(),
        });

        const secondCallMessages = chat.mock.calls[1][0].messages;
        expect(secondCallMessages).toHaveLength(3);
        expect(secondCallMessages[2].role).toBe('tool');
    });

    it('обрабатывает несколько tool_calls в одном assistant-сообщении', async () => {
        const chatProvider = mkChatProvider([
            {
                message: {
                    role: 'assistant',
                    content: '',
                    toolCalls: [
                        {
                            id: 'call_0',
                            name: 'search_flights',
                            arguments: {
                                origin: 'MOW',
                                destination: 'CMB',
                                departureDate: '2026-05-15',
                            },
                        },
                        {
                            id: 'call_1',
                            name: 'search_flights',
                            arguments: {
                                origin: 'LED',
                                destination: 'CMB',
                                departureDate: '2026-05-16',
                            },
                        },
                    ],
                },
            },
            { message: { role: 'assistant', content: 'Сравнил два рейса' } },
        ]);
        const flightsProvider = mkFlightsProvider();

        const result = await runChatTurn({
            messages: [userMessage],
            chatProvider,
            flightsProvider,
        });

        expect(result).toHaveLength(4);
        expect(result[1].toolCallId).toBe('call_0');
        expect(result[2].toolCallId).toBe('call_1');
        expect(flightsProvider.search).toHaveBeenCalledTimes(2);
    });

    it('возвращает fallback при превышении maxIterations', async () => {
        const toolCallResponse = {
            message: {
                role: 'assistant' as const,
                content: '',
                toolCalls: [
                    {
                        id: 'call_x',
                        name: 'search_flights',
                        arguments: {
                            origin: 'MOW',
                            destination: 'CMB',
                            departureDate: '2026-05-15',
                        },
                    },
                ],
            },
        };

        const chat = vi.fn().mockResolvedValue(toolCallResponse);
        const chatProvider: IChatProvider = { chat };

        const result = await runChatTurn({
            messages: [userMessage],
            chatProvider,
            flightsProvider: mkFlightsProvider(),
            maxIterations: 2,
        });

        expect(chat).toHaveBeenCalledTimes(2);
        const last = result[result.length - 1];
        expect(last.role).toBe('assistant');
        expect(last.content).toMatch(/не получилось/i);
        expect(last.toolCalls).toBeUndefined();
    });

    it('использует MAX_TOOL_ITERATIONS=5 по умолчанию', () => {
        expect(MAX_TOOL_ITERATIONS).toBe(5);
    });

    it('пробрасывает AbortError из flightsProvider', async () => {
        const abortError = Object.assign(new Error('aborted'), {
            name: 'AbortError',
        });
        const chatProvider = mkChatProvider([
            {
                message: {
                    role: 'assistant',
                    content: '',
                    toolCalls: [
                        {
                            id: 'call_0',
                            name: 'search_flights',
                            arguments: {
                                origin: 'MOW',
                                destination: 'CMB',
                                departureDate: '2026-05-15',
                            },
                        },
                    ],
                },
            },
        ]);
        const flightsProvider: IFlightsProvider = {
            search: vi.fn().mockRejectedValue(abortError),
        };

        await expect(
            runChatTurn({
                messages: [userMessage],
                chatProvider,
                flightsProvider,
            }),
        ).rejects.toBe(abortError);
    });

    it('пробрасывает AbortError из chatProvider', async () => {
        const abortError = Object.assign(new Error('aborted'), {
            name: 'AbortError',
        });
        const chatProvider: IChatProvider = {
            chat: vi.fn().mockRejectedValue(abortError),
        };

        await expect(
            runChatTurn({
                messages: [userMessage],
                chatProvider,
                flightsProvider: mkFlightsProvider(),
            }),
        ).rejects.toBe(abortError);
    });

    it('пробрасывает signal в chatProvider.chat', async () => {
        const chat = vi.fn().mockResolvedValue({
            message: { role: 'assistant', content: 'ok' },
        });
        const chatProvider: IChatProvider = { chat };
        const controller = new AbortController();

        await runChatTurn({
            messages: [userMessage],
            chatProvider,
            flightsProvider: mkFlightsProvider(),
            signal: controller.signal,
        });

        expect(chat).toHaveBeenCalledWith(
            expect.objectContaining({ signal: controller.signal }),
        );
    });

    it('пробрасывает signal в flightsProvider.search через executeSearchFlights', async () => {
        const chatProvider = mkChatProvider([
            {
                message: {
                    role: 'assistant',
                    content: '',
                    toolCalls: [
                        {
                            id: 'call_0',
                            name: 'search_flights',
                            arguments: {
                                origin: 'MOW',
                                destination: 'CMB',
                                departureDate: '2026-05-15',
                            },
                        },
                    ],
                },
            },
            { message: { role: 'assistant', content: 'ok' } },
        ]);
        const search = vi.fn().mockResolvedValue([]);
        const flightsProvider: IFlightsProvider = { search };
        const controller = new AbortController();

        await runChatTurn({
            messages: [userMessage],
            chatProvider,
            flightsProvider,
            signal: controller.signal,
        });

        expect(search).toHaveBeenCalledWith(
            expect.anything(),
            controller.signal,
        );
    });

    it('пробрасывает defaultCurrency в executeSearchFlights', async () => {
        const chatProvider = mkChatProvider([
            {
                message: {
                    role: 'assistant',
                    content: '',
                    toolCalls: [
                        {
                            id: 'call_0',
                            name: 'search_flights',
                            arguments: {
                                origin: 'MOW',
                                destination: 'CMB',
                                departureDate: '2026-05-15',
                            },
                        },
                    ],
                },
            },
            { message: { role: 'assistant', content: 'ok' } },
        ]);
        const search = vi.fn().mockResolvedValue([]);
        const flightsProvider: IFlightsProvider = { search };

        await runChatTurn({
            messages: [userMessage],
            chatProvider,
            flightsProvider,
            defaultCurrency: 'USD',
        });

        expect(search).toHaveBeenCalledWith(
            expect.objectContaining({ currency: 'USD' }),
            undefined,
        );
    });
});
