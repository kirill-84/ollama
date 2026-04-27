import 'server-only';
import { NextResponse } from 'next/server';
import { withApiHandler } from '@/lib/api/with-handler';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { chatRepository } from '@/lib/db/repositories/chat.repository';
import { env } from '@/lib/env';
import { createChatSchema } from './schema';

export const POST = withApiHandler(async (request) => {
    const raw = await request.json().catch(() => ({}));
    const { title } = createChatSchema.parse(raw);

    const user = await getCurrentUser();
    const chat = await chatRepository.create({
        userId: user.id,
        model: env.OLLAMA_MODEL,
        title,
    });

    return NextResponse.json(
        { id: chat.id, title: chat.title, updatedAt: chat.updatedAt },
        { status: 201 },
    );
});

export const GET = withApiHandler(async () => {
    const user = await getCurrentUser();
    const chats = await chatRepository.listByUserId(user.id);

    return NextResponse.json({
        chats: chats.map((c) => ({
            id: c.id,
            title: c.title,
            updatedAt: c.updatedAt,
        })),
    });
});
