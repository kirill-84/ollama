import 'server-only';
import type { MessageModel } from '@/app/generated/prisma/models';
import { MessageRole } from '@/app/generated/prisma/enums';
import { prisma } from '@/lib/db/client';

export type Message = MessageModel;
export { MessageRole };

export interface IMessageRepository {
    create(data: {
        chatId: string;
        role: MessageRole;
        content: string;
    }): Promise<Message>;

    listByChatId(chatId: string): Promise<Message[]>;

    countByChatId(chatId: string): Promise<number>;
}

export class MessageRepository implements IMessageRepository {
    async create(data: {
        chatId: string;
        role: MessageRole;
        content: string;
    }): Promise<Message> {
        return prisma.message.create({ data });
    }

    async listByChatId(chatId: string): Promise<Message[]> {
        return prisma.message.findMany({
            where: { chatId },
            orderBy: { createdAt: 'asc' },
        });
    }

    async countByChatId(chatId: string): Promise<number> {
        return prisma.message.count({ where: { chatId } });
    }
}

export const messageRepository = new MessageRepository();