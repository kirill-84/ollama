import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const validEnv = {
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
    OLLAMA_MODEL: 'qwen3.5:cloud',
    OLLAMA_MODE: 'mock',
    TRAVELPAYOUTS_TOKEN: 'token',
    TRAVELPAYOUTS_MARKER: 'marker',
    TRAVELPAYOUTS_MODE: 'mock',
};

describe('lib/env', () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
        vi.resetModules();
        process.env = { ...validEnv };
    });

    afterEach(() => {
        process.env = { ...originalEnv };
    });

    it('парсит валидные значения', async () => {
        const { env } = await import('@/lib/env');
        expect(env.DATABASE_URL).toBe(validEnv.DATABASE_URL);
        expect(env.OLLAMA_MODEL).toBe('qwen3.5:cloud');
        expect(env.OLLAMA_MODE).toBe('mock');
    });

    it('кидает ошибку при невалидном DATABASE_URL', async () => {
        process.env.DATABASE_URL = 'not-a-url';
        await expect(import('@/lib/env')).rejects.toThrow();
    });

    it('использует NODE_ENV=development по умолчанию', async () => {
        delete process.env.NODE_ENV;
        const { env } = await import('@/lib/env');
        expect(env.NODE_ENV).toBe('development');
    });
});