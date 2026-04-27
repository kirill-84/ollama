import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/client';
import { env } from '@/lib/env';
import { MessageRole } from '@/app/generated/prisma/enums';

const { mockChat, mockSearch } = vi.hoisted(() => ({
    mockChat: vi.fn(),
    mockSearch: vi.fn(),
}));

vi.mock('@/lib/ollama', async () => {
    const actual =
        await vi.importActual<typeof import('@/lib/ollama')>('@/lib/ollama');
    return {
        ...actual,
        getChatProvider: () => ({ chat: mockChat }),
    };
});

vi.mock('@/lib/flights/factory', async () => {
    const actual =
        await vi.importActual<typeof import('@/lib/flights/factory')>(
            '@/lib/flights/factory',
        );
    return {
        ...actual,
        getFlightsProvider: () => ({ search: mockSearch }),
    };
});

const { POST, GET } = await import('@/app/api/chats/[id]/messages/route');

const mkPostRequest = (chatId: string, body: unknown) =>
    new NextRequest(`http://localhost/api/chats/${chatId}/messages`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
    });

const mkGetRequest = (chatId: string) =>
    new NextRequest(`http://localhost/api/chats/${chatId}/messages`, {
        method: 'GET',
    });

const ctx = (chatId: string) => ({ params: Promise.resolve({ id: chatId }) });

const TOOL_CALLS_SENTINEL = '__tool_calls__';

async function createMvpChat(): Promise<string> {
    const user = await prisma.user.upsert({
        where: { email: env.MVP_USER_EMAIL },
        update: {},
        create: { email: env.MVP_USER_EMAIL },
    });
    const chat = await prisma.chat.create({
        data: { userId: user.id, model: env.OLLAMA_MODEL, title: 'тест' },
    });
    return chat.id;
}

describe('/api/chats/[id]/messages', () => {
    beforeEach(async () => {
        await prisma.message.deleteMany({});
        await prisma.chat.deleteMany({});
        await prisma.user.deleteMany({});
        mockChat.mockReset();
        mockSearch.mockReset();
    });

    afterAll(async () => {
        await prisma.message.deleteMany({});
        await prisma.chat.deleteMany({});
        await prisma.user.deleteMany({});
        await prisma.$disconnect();
    });

    describe('POST', () => {
        it('happy-path: записывает user и финальный assistant, возвращает финальный assistant', async () => {
            const chatId = await createMvpChat();
            mockChat.mockResolvedValueOnce({
                message: { role: 'assistant', content: 'Здравствуйте!' },
            });

            const res = await POST(
                mkPostRequest(chatId, { content: 'привет' }),
                ctx(chatId),
            );

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body).toEqual({
                message: { role: 'assistant', content: 'Здравствуйте!' },
            });

            const stored = await prisma.message.findMany({
                where: { chatId },
                orderBy: { createdAt: 'asc' },
            });
            expect(stored).toHaveLength(2);
            expect(stored[0].role).toBe(MessageRole.user);
            expect(stored[0].content).toBe('привет');
            expect(stored[1].role).toBe(MessageRole.assistant);
            expect(stored[1].content).toBe('Здравствуйте!');
            expect(stored[1].toolName).toBeNull();
        });

        it('передаёт system-prompt и историю в chatProvider', async () => {
            const chatId = await createMvpChat();
            mockChat.mockResolvedValueOnce({
                message: { role: 'assistant', content: 'ok' },
            });

            await POST(
                mkPostRequest(chatId, { content: 'Билет в Коломбо' }),
                ctx(chatId),
            );

            expect(mockChat).toHaveBeenCalledTimes(1);
            const sentMessages = mockChat.mock.calls[0][0].messages;
            expect(sentMessages[0].role).toBe('system');
            expect(sentMessages[0].content).toMatch(/Коломбо \(CMB\)/);
            expect(sentMessages[1]).toEqual({
                role: 'user',
                content: 'Билет в Коломбо',
            });
        });

        it('сохраняет след tool-loop: user → assistant(tool_calls) → tool → финальный assistant', async () => {
            const chatId = await createMvpChat();

            mockChat
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
                    message: { role: 'assistant', content: 'Нашёл вариант' },
                });
            mockSearch.mockResolvedValueOnce([]);

            const res = await POST(
                mkPostRequest(chatId, { content: 'Билет MOW-CMB на 2026-05-15' }),
                ctx(chatId),
            );

            expect(res.status).toBe(200);
            expect(await res.json()).toEqual({
                message: { role: 'assistant', content: 'Нашёл вариант' },
            });

            const stored = await prisma.message.findMany({
                where: { chatId },
                orderBy: { createdAt: 'asc' },
            });
            expect(stored).toHaveLength(4);

            expect(stored[0].role).toBe(MessageRole.user);

            expect(stored[1].role).toBe(MessageRole.assistant);
            expect(stored[1].toolName).toBe(TOOL_CALLS_SENTINEL);
            const persistedToolCalls = JSON.parse(stored[1].content);
            expect(persistedToolCalls[0].id).toBe('call_0');
            expect(persistedToolCalls[0].name).toBe('search_flights');

            expect(stored[2].role).toBe(MessageRole.tool);
            expect(stored[2].toolCallId).toBe('call_0');
            expect(stored[2].toolName).toBe('search_flights');

            expect(stored[3].role).toBe(MessageRole.assistant);
            expect(stored[3].toolName).toBeNull();
            expect(stored[3].content).toBe('Нашёл вариант');
        });

        it('обновляет updatedAt чата', async () => {
            const chatId = await createMvpChat();
            const before = await prisma.chat.findUnique({ where: { id: chatId } });
            await new Promise((r) => setTimeout(r, 10));
            mockChat.mockResolvedValueOnce({
                message: { role: 'assistant', content: 'ok' },
            });

            await POST(mkPostRequest(chatId, { content: 'привет' }), ctx(chatId));

            const after = await prisma.chat.findUnique({ where: { id: chatId } });
            expect(after!.updatedAt.getTime()).toBeGreaterThan(
                before!.updatedAt.getTime(),
            );
        });

        it('подаёт обратно сохранённый tool-след при следующем POST', async () => {
            const chatId = await createMvpChat();

            mockChat
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
                    message: { role: 'assistant', content: 'первый ответ' },
                });
            mockSearch.mockResolvedValueOnce([]);

            await POST(
                mkPostRequest(chatId, { content: 'билет' }),
                ctx(chatId),
            );

            mockChat.mockReset();
            mockChat.mockResolvedValueOnce({
                message: { role: 'assistant', content: 'второй ответ' },
            });

            await POST(
                mkPostRequest(chatId, { content: 'и ещё' }),
                ctx(chatId),
            );

            const sentMessages = mockChat.mock.calls[0][0].messages;
            const roles = sentMessages.map((m: { role: string }) => m.role);
            expect(roles).toEqual([
                'system',
                'user',
                'assistant',
                'tool',
                'assistant',
                'user',
            ]);
            const restoredAssistantWithTools = sentMessages[2];
            expect(restoredAssistantWithTools.toolCalls).toBeDefined();
            expect(restoredAssistantWithTools.toolCalls[0].id).toBe('call_0');
            const restoredTool = sentMessages[3];
            expect(restoredTool.toolCallId).toBe('call_0');
            expect(restoredTool.toolName).toBe('search_flights');
        });

        it('возвращает 404 на несуществующий чат', async () => {
            const fakeId = '00000000-0000-0000-0000-000000000000';
            const res = await POST(
                mkPostRequest(fakeId, { content: 'привет' }),
                ctx(fakeId),
            );
            expect(res.status).toBe(404);
        });

        it('возвращает 404 на чужой чат', async () => {
            const other = await prisma.user.create({
                data: { email: 'other@example.com' },
            });
            const otherChat = await prisma.chat.create({
                data: { userId: other.id, model: env.OLLAMA_MODEL },
            });

            const res = await POST(
                mkPostRequest(otherChat.id, { content: 'привет' }),
                ctx(otherChat.id),
            );
            expect(res.status).toBe(404);
        });

        it('возвращает 400 при пустом content', async () => {
            const chatId = await createMvpChat();
            const res = await POST(
                mkPostRequest(chatId, { content: '   ' }),
                ctx(chatId),
            );
            expect(res.status).toBe(400);
        });
    });

    describe('GET', () => {
        it('скрывает tool-сообщения и assistant с tool_calls', async () => {
            const chatId = await createMvpChat();
            await prisma.message.create({
                data: {
                    chatId,
                    role: MessageRole.user,
                    content: 'найди билет',
                },
            });
            await prisma.message.create({
                data: {
                    chatId,
                    role: MessageRole.assistant,
                    content: JSON.stringify([
                        { id: 'call_0', name: 'search_flights', arguments: {} },
                    ]),
                    toolName: TOOL_CALLS_SENTINEL,
                },
            });
            await prisma.message.create({
                data: {
                    chatId,
                    role: MessageRole.tool,
                    content: '{"count":0}',
                    toolCallId: 'call_0',
                    toolName: 'search_flights',
                },
            });
            await prisma.message.create({
                data: {
                    chatId,
                    role: MessageRole.assistant,
                    content: 'ничего не нашлось',
                },
            });

            const res = await GET(mkGetRequest(chatId), ctx(chatId));
            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.messages).toHaveLength(2);
            expect(body.messages[0].role).toBe(MessageRole.user);
            expect(body.messages[0].content).toBe('найди билет');
            expect(body.messages[1].role).toBe(MessageRole.assistant);
            expect(body.messages[1].content).toBe('ничего не нашлось');
        });

        it('возвращает пустой список для нового чата', async () => {
            const chatId = await createMvpChat();
            const res = await GET(mkGetRequest(chatId), ctx(chatId));
            const body = await res.json();
            expect(body.messages).toEqual([]);
        });

        it('возвращает 404 на чужой чат', async () => {
            const other = await prisma.user.create({
                data: { email: 'other@example.com' },
            });
            const otherChat = await prisma.chat.create({
                data: { userId: other.id, model: env.OLLAMA_MODEL },
            });
            const res = await GET(mkGetRequest(otherChat.id), ctx(otherChat.id));
            expect(res.status).toBe(404);
        });
    });
});
