import 'server-only';
import { z } from 'zod';

const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    DATABASE_URL: z.string().url(),
    OLLAMA_MODEL: z.string().min(1),
    OLLAMA_MODE: z.enum(['real', 'mock']),
    TRAVELPAYOUTS_TOKEN: z.string().min(1),
    TRAVELPAYOUTS_MARKER: z.string().min(1),
    TRAVELPAYOUTS_MODE: z.enum(['real', 'mock']),
});

export type Env = z.infer<typeof envSchema>;

export const env: Env = envSchema.parse(process.env);