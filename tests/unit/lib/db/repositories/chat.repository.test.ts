import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import { chatRepository } from '@/lib/db/repositories/chat.repository';
import { userRepository } from '@/lib/db/repositories/user.repository';
import { prisma } from '@/lib/db/client';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('ChatRepository', () => {
    let userId: string;

    beforeEach(async () => {
        const user = await userRepository.create({ email: 'test@example.com' });
        userId = user.id;
    });

    afterEach(async () => {
        await prisma.user.deleteMany({});
    });

    afterAll(async () => {
        await prisma.$disconnect();
    });

    it('create создаёт чат с минимальными полями', async () => {
        const chat = await chatRepository.create({
            userId,
            model: 'qwen3.5:cloud',
        });

        expect(chat.id).toBeTruthy();
        expect(chat.userId).toBe(userId);
        expect(chat.model).toBe('qwen3.5:cloud');
        expect(chat.title).toBeNull();
        expect(chat.createdAt).toBeInstanceOf(Date);
        expect(chat.updatedAt).toBeInstanceOf(Date);
    });

    it('create создаёт чат с title', async () => {
        const chat = await chatRepository.create({
            userId,
            model: 'qwen3.5:cloud',
            title: 'Поездка на Шри-Ланку',
        });

        expect(chat.title).toBe('Поездка на Шри-Ланку');
    });

    it('findById возвращает существующий чат', async () => {
        const created = await chatRepository.create({
            userId,
            model: 'qwen3.5:cloud',
        });

        const found = await chatRepository.findById(created.id);

        expect(found).not.toBeNull();
        expect(found?.id).toBe(created.id);
    });

    it('findById возвращает null, если чат не существует', async () => {
        const result = await chatRepository.findById(
            '00000000-0000-0000-0000-000000000000',
        );
        expect(result).toBeNull();
    });

    it('listByUserId возвращает чаты в порядке updatedAt DESC', async () => {
        const a = await chatRepository.create({ userId, model: 'qwen3.5:cloud' });
        await wait(10);
        const b = await chatRepository.create({ userId, model: 'qwen3.5:cloud' });
        await wait(10);
        const c = await chatRepository.create({ userId, model: 'qwen3.5:cloud' });

        const chats = await chatRepository.listByUserId(userId);

        expect(chats).toHaveLength(3);
        expect(chats[0].id).toBe(c.id);
        expect(chats[1].id).toBe(b.id);
        expect(chats[2].id).toBe(a.id);
    });

    it('touchUpdatedAt обновляет updatedAt', async () => {
        const chat = await chatRepository.create({
            userId,
            model: 'qwen3.5:cloud',
        });
        const originalUpdatedAt = chat.updatedAt;

        await wait(10);

        const updated = await chatRepository.touchUpdatedAt(chat.id);

        expect(updated.updatedAt.getTime()).toBeGreaterThan(
            originalUpdatedAt.getTime(),
        );
    });
});