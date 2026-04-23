import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import {
    messageRepository,
    MessageRole,
} from '@/lib/db/repositories/message.repository';
import { chatRepository } from '@/lib/db/repositories/chat.repository';
import { userRepository } from '@/lib/db/repositories/user.repository';
import { prisma } from '@/lib/db/client';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('MessageRepository', () => {
    let chatId: string;

    beforeEach(async () => {
        const user = await userRepository.create({ email: 'test@example.com' });
        const chat = await chatRepository.create({
            userId: user.id,
            model: 'qwen3.5:cloud',
        });
        chatId = chat.id;
    });

    afterEach(async () => {
        await prisma.user.deleteMany({});
    });

    afterAll(async () => {
        await prisma.$disconnect();
    });

    it('create добавляет сообщение пользователя', async () => {
        const message = await messageRepository.create({
            chatId,
            role: MessageRole.user,
            content: 'Сколько стоит билет на Шри-Ланку?',
        });

        expect(message.id).toBeTruthy();
        expect(message.chatId).toBe(chatId);
        expect(message.role).toBe(MessageRole.user);
        expect(message.content).toBe('Сколько стоит билет на Шри-Ланку?');
        expect(message.createdAt).toBeInstanceOf(Date);
    });

    it('create поддерживает все роли', async () => {
        const system = await messageRepository.create({
            chatId,
            role: MessageRole.system,
            content: 'Ты помощник по авиабилетам.',
        });
        const assistant = await messageRepository.create({
            chatId,
            role: MessageRole.assistant,
            content: 'Найду для вас билеты.',
        });
        const tool = await messageRepository.create({
            chatId,
            role: MessageRole.tool,
            content: '{"flights":[]}',
        });

        expect(system.role).toBe(MessageRole.system);
        expect(assistant.role).toBe(MessageRole.assistant);
        expect(tool.role).toBe(MessageRole.tool);
    });

    it('listByChatId возвращает сообщения в порядке createdAt ASC', async () => {
        const a = await messageRepository.create({
            chatId,
            role: MessageRole.user,
            content: 'Первое',
        });
        await wait(10);
        const b = await messageRepository.create({
            chatId,
            role: MessageRole.assistant,
            content: 'Второе',
        });
        await wait(10);
        const c = await messageRepository.create({
            chatId,
            role: MessageRole.user,
            content: 'Третье',
        });

        const messages = await messageRepository.listByChatId(chatId);

        expect(messages).toHaveLength(3);
        expect(messages[0].id).toBe(a.id);
        expect(messages[1].id).toBe(b.id);
        expect(messages[2].id).toBe(c.id);
    });

    it('listByChatId возвращает пустой массив для чата без сообщений', async () => {
        const messages = await messageRepository.listByChatId(chatId);
        expect(messages).toEqual([]);
    });

    it('countByChatId возвращает количество сообщений', async () => {
        await messageRepository.create({
            chatId,
            role: MessageRole.user,
            content: 'A',
        });
        await messageRepository.create({
            chatId,
            role: MessageRole.assistant,
            content: 'B',
        });
        await messageRepository.create({
            chatId,
            role: MessageRole.user,
            content: 'C',
        });

        const count = await messageRepository.countByChatId(chatId);
        expect(count).toBe(3);
    });

    it('countByChatId возвращает 0 для чата без сообщений', async () => {
        const count = await messageRepository.countByChatId(chatId);
        expect(count).toBe(0);
    });
});