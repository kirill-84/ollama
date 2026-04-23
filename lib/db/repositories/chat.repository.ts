import 'server-only';
import type { ChatModel } from '@/app/generated/prisma/models';
import { prisma } from '@/lib/db/client';

export type Chat = ChatModel;

export interface IChatRepository {
    create(data: { userId: string; model: string; title?: string }): Promise<Chat>;
    findById(id: string): Promise<Chat | null>;
    listByUserId(userId: string): Promise<Chat[]>;
    touchUpdatedAt(id: string): Promise<Chat>;
}

export class ChatRepository implements IChatRepository {
    async create(data: {
        userId: string;
        model: string;
        title?: string;
    }): Promise<Chat> {
        return prisma.chat.create({ data });
    }

    async findById(id: string): Promise<Chat | null> {
        return prisma.chat.findUnique({ where: { id } });
    }

    async listByUserId(userId: string): Promise<Chat[]> {
        return prisma.chat.findMany({
            where: { userId },
            orderBy: { updatedAt: 'desc' },
        });
    }

    async touchUpdatedAt(id: string): Promise<Chat> {
        return prisma.chat.update({
            where: { id },
            data: { updatedAt: new Date() },
        });
    }
}

export const chatRepository = new ChatRepository();