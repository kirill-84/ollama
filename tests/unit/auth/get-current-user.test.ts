import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { prisma } from '@/lib/db/client';
import { env } from '@/lib/env';

describe('getCurrentUser', () => {
    beforeEach(async () => {
        await prisma.user.deleteMany({});
    });

    afterAll(async () => {
        await prisma.user.deleteMany({});
        await prisma.$disconnect();
    });

    it('создаёт MVP-пользователя при первом вызове', async () => {
        const user = await getCurrentUser();
        expect(user.email).toBe(env.MVP_USER_EMAIL);
        expect(user.id).toBeTruthy();
    });

    it('возвращает существующего пользователя при повторном вызове', async () => {
        const first = await getCurrentUser();
        const second = await getCurrentUser();
        expect(second.id).toBe(first.id);
    });

    it('не создаёт дубликаты при параллельных первых вызовах', async () => {
        await getCurrentUser();
        const count = await prisma.user.count({
            where: { email: env.MVP_USER_EMAIL },
        });
        expect(count).toBe(1);
    });
});
