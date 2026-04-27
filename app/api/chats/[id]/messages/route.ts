import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { withApiHandler } from '@/lib/api/with-handler';
import { NotFoundError } from '@/lib/api/errors';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { chatRepository } from '@/lib/db/repositories/chat.repository';
import {
    messageRepository,
    type Message,
} from '@/lib/db/repositories/message.repository';
import { MessageRole } from '@/app/generated/prisma/enums';
import {
    buildSystemPrompt,
    MVP_DESTINATIONS,
    searchFlightsTool,
    runChatTurn,
} from '@/lib/chat';
import type { ChatMessage, ToolCall } from '@/lib/ollama';
import { getChatProvider } from '@/lib/ollama';
import { getFlightsProvider } from '@/lib/flights/factory';
import { sendMessageSchema } from './schema';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Маркер в колонке `tool_name` для assistant-строк, у которых `content`
 * хранит сериализованные `toolCalls`. Позволяет фильтру GET и
 * десериализации ключеваться на колонке, а не на форме content.
 */
const TOOL_CALLS_SENTINEL = '__tool_calls__';

async function ensureOwnedChat(
    chatId: string,
    userId: string,
): Promise<void> {
    const chat = await chatRepository.findById(chatId);
    if (!chat || chat.userId !== userId) {
        throw new NotFoundError('chat not found');
    }
}

function dbToChatMessage(msg: Message): ChatMessage {
    if (msg.role === MessageRole.assistant && msg.toolName === TOOL_CALLS_SENTINEL) {
        const toolCalls = JSON.parse(msg.content) as ToolCall[];
        return { role: 'assistant', content: '', toolCalls };
    }
    if (msg.role === MessageRole.tool) {
        return {
            role: 'tool',
            content: msg.content,
            toolCallId: msg.toolCallId ?? undefined,
            toolName: msg.toolName ?? undefined,
        };
    }
    return { role: msg.role, content: msg.content };
}

async function persistTurnMessage(
    chatId: string,
    msg: ChatMessage,
): Promise<void> {
    if (msg.role === 'assistant' && msg.toolCalls && msg.toolCalls.length > 0) {
        await messageRepository.create({
            chatId,
            role: MessageRole.assistant,
            content: JSON.stringify(msg.toolCalls),
            toolName: TOOL_CALLS_SENTINEL,
        });
        return;
    }
    if (msg.role === 'tool') {
        await messageRepository.create({
            chatId,
            role: MessageRole.tool,
            content: msg.content,
            toolCallId: msg.toolCallId ?? null,
            toolName: msg.toolName ?? null,
        });
        return;
    }
    if (msg.role === 'assistant') {
        await messageRepository.create({
            chatId,
            role: MessageRole.assistant,
            content: msg.content,
        });
        return;
    }
    throw new Error(`Не сохраняем сообщение с ролью ${msg.role}`);
}

export const POST = withApiHandler<RouteContext>(
    async (request: NextRequest, { params }) => {
        const { id: chatId } = await params;
        const raw = await request.json().catch(() => ({}));
        const { content } = sendMessageSchema.parse(raw);

        const user = await getCurrentUser();
        await ensureOwnedChat(chatId, user.id);

        await messageRepository.create({
            chatId,
            role: MessageRole.user,
            content,
        });

        const stored = await messageRepository.listByChatId(chatId);
        const history = stored.map(dbToChatMessage);

        const messages: ChatMessage[] = [
            {
                role: 'system',
                content: buildSystemPrompt({ destinations: MVP_DESTINATIONS }),
            },
            ...history,
        ];

        const newMessages = await runChatTurn({
            messages,
            chatProvider: getChatProvider(),
            flightsProvider: getFlightsProvider(),
            tools: [searchFlightsTool],
            signal: request.signal,
        });

        for (const msg of newMessages) {
            await persistTurnMessage(chatId, msg);
        }
        await chatRepository.touchUpdatedAt(chatId);

        const final = newMessages.at(-1);
        if (!final || final.role !== 'assistant' || final.toolCalls?.length) {
            throw new Error(
                'runChatTurn должен завершаться assistant-сообщением без tool_calls',
            );
        }
        return NextResponse.json({
            message: { role: 'assistant', content: final.content },
        });
    },
);

export const GET = withApiHandler<RouteContext>(
    async (_request, { params }) => {
        const { id: chatId } = await params;
        const user = await getCurrentUser();
        await ensureOwnedChat(chatId, user.id);

        const stored = await messageRepository.listByChatId(chatId);
        const visible = stored.filter(
            (m) =>
                m.role !== MessageRole.tool &&
                !(
                    m.role === MessageRole.assistant &&
                    m.toolName === TOOL_CALLS_SENTINEL
                ),
        );
        return NextResponse.json({
            messages: visible.map((m) => ({
                id: m.id,
                role: m.role,
                content: m.content,
                createdAt: m.createdAt,
            })),
        });
    },
);
