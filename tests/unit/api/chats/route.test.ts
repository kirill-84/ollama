import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { POST, GET } from '@/app/api/chats/route';
import { prisma } from '@/lib/db/client';
import { env } from '@/lib/env';

const mkPostRequest = (body: unknown) =>
    new NextRequest('http://localhost/api/chats', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
    });

const mkGetRequest = () =>
    new NextRequest('http://localhost/api/chats', { method: 'GET' });

describe('/api/chats route', () => {
    beforeEach(async () => {
        await prisma.chat.deleteMany({});
        await prisma.user.deleteMany({});
    });

    afterAll(async () => {
        await prisma.chat.deleteMany({});
        await prisma.user.deleteMany({});
        await prisma.$disconnect();
    });

    describe('POST', () => {
        it('создаёт чат без title', async () => {
            const res = await POST(mkPostRequest({}), undefined);
            expect(res.status).toBe(201);
            const body = await res.json();
            expect(body.id).toBeTruthy();
            expect(body.title).toBeNull();

            const stored = await prisma.chat.findUnique({
                where: { id: body.id },
            });
            expect(stored).not.toBeNull();
            expect(stored?.model).toBe(env.OLLAMA_MODEL);
            expect(stored?.title).toBeNull();
        });

        it('создаёт чат с title', async () => {
            const res = await POST(
                mkPostRequest({ title: 'Шри-Ланка в мае' }),
                undefined,
            );
            expect(res.status).toBe(201);
            const body = await res.json();
            expect(body.title).toBe('Шри-Ланка в мае');
        });

        it('лениво создаёт MVP-пользователя при первом запросе', async () => {
            const before = await prisma.user.count();
            expect(before).toBe(0);
            await POST(mkPostRequest({}), undefined);
            const user = await prisma.user.findUnique({
                where: { email: env.MVP_USER_EMAIL },
            });
            expect(user).not.toBeNull();
        });

        it('возвращает 400 при title с одним пробелом (после trim пусто)', async () => {
            const res = await POST(mkPostRequest({ title: '   ' }), undefined);
            expect(res.status).toBe(400);
            const body = await res.json();
            expect(body.error).toBe('validation');
        });

        it('возвращает 400 на title больше 200 символов', async () => {
            const longTitle = 'x'.repeat(201);
            const res = await POST(
                mkPostRequest({ title: longTitle }),
                undefined,
            );
            expect(res.status).toBe(400);
        });
    });

    describe('GET', () => {
        it('возвращает пустой список, если чатов нет', async () => {
            const res = await GET(mkGetRequest(), undefined);
            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body).toEqual({ chats: [] });
        });

        it('возвращает чаты текущего пользователя в порядке updatedAt DESC', async () => {
            await POST(mkPostRequest({ title: 'Старый' }), undefined);
            await new Promise((r) => setTimeout(r, 10));
            await POST(mkPostRequest({ title: 'Средний' }), undefined);
            await new Promise((r) => setTimeout(r, 10));
            await POST(mkPostRequest({ title: 'Новый' }), undefined);

            const res = await GET(mkGetRequest(), undefined);
            const body = await res.json();
            expect(body.chats).toHaveLength(3);
            expect(body.chats.map((c: { title: string }) => c.title)).toEqual([
                'Новый',
                'Средний',
                'Старый',
            ]);
        });

        it('не возвращает чаты других пользователей', async () => {
            await POST(mkPostRequest({ title: 'Мой чат' }), undefined);

            const other = await prisma.user.create({
                data: { email: 'other@example.com' },
            });
            await prisma.chat.create({
                data: {
                    userId: other.id,
                    model: env.OLLAMA_MODEL,
                    title: 'Чужой чат',
                },
            });

            const res = await GET(mkGetRequest(), undefined);
            const body = await res.json();
            expect(body.chats).toHaveLength(1);
            expect(body.chats[0].title).toBe('Мой чат');
        });
    });
});
