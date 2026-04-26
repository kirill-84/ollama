import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setEnv, unsetEnv } from '../../utils/env';

const ENV_KEYS = [
    'NODE_ENV',
    'DATABASE_URL',
    'OLLAMA_MODEL',
    'OLLAMA_MODE',
    'TRAVELPAYOUTS_TOKEN',
    'TRAVELPAYOUTS_MARKER',
    'TRAVELPAYOUTS_MODE',
    'MVP_USER_EMAIL',
] as const;

const validEnv: Record<(typeof ENV_KEYS)[number], string> = {
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
    OLLAMA_MODEL: 'qwen3.5:cloud',
    OLLAMA_MODE: 'mock',
    TRAVELPAYOUTS_TOKEN: 'token',
    TRAVELPAYOUTS_MARKER: 'marker',
    TRAVELPAYOUTS_MODE: 'mock',
    MVP_USER_EMAIL: 'mvp@example.com',
};

describe('lib/env', () => {
    const originalValues = new Map<string, string | undefined>();

    beforeEach(() => {
        vi.resetModules();
        for (const key of ENV_KEYS) {
            originalValues.set(key, process.env[key]);
            setEnv(key, validEnv[key]);
        }
    });

    afterEach(() => {
        for (const [key, value] of originalValues) {
            if (value === undefined) {
                unsetEnv(key);
            } else {
                setEnv(key, value);
            }
        }
        originalValues.clear();
    });

    it('парсит валидные значения', async () => {
        const { env } = await import('@/lib/env');
        expect(env.DATABASE_URL).toBe(validEnv.DATABASE_URL);
        expect(env.OLLAMA_MODEL).toBe('qwen3.5:cloud');
        expect(env.OLLAMA_MODE).toBe('mock');
    });

    it('кидает ошибку при невалидном DATABASE_URL', async () => {
        setEnv('DATABASE_URL', 'not-a-url');
        await expect(import('@/lib/env')).rejects.toThrow();
    });

    it('использует NODE_ENV=development по умолчанию', async () => {
        unsetEnv('NODE_ENV');
        const { env } = await import('@/lib/env');
        expect(env.NODE_ENV).toBe('development');
    });

    it('требует MVP_USER_EMAIL', async () => {
        unsetEnv('MVP_USER_EMAIL');
        await expect(import('@/lib/env')).rejects.toThrow();
    });

    it('кидает ошибку при невалидном MVP_USER_EMAIL', async () => {
        setEnv('MVP_USER_EMAIL', 'not-an-email');
        await expect(import('@/lib/env')).rejects.toThrow();
    });
});