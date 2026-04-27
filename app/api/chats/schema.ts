import { z } from 'zod';

export const createChatSchema = z.object({
    title: z.string().trim().min(1).max(200).optional(),
});

export type CreateChatInput = z.infer<typeof createChatSchema>;
