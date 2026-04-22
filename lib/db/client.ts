import 'server-only';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/app/generated/prisma/client';
import { env } from '@/lib/env';

const createPrismaClient = () => {
    const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
    return new PrismaClient({ adapter });
};

const globalForPrisma = globalThis as unknown as {
    prisma: ReturnType<typeof createPrismaClient> | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma;
}