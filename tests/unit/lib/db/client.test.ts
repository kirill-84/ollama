import { describe, it, expect, afterAll } from 'vitest';
import { prisma } from '@/lib/db/client';

describe('lib/db/client', () => {
    afterAll(async () => {
        await prisma.$disconnect();
    });

    it('подключается к БД', async () => {
        const result = await prisma.$queryRaw<{ ok: number }[]>`SELECT 1 as ok`;
        expect(result).toEqual([{ ok: 1 }]);
    });
});