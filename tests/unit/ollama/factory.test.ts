import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setEnv, unsetEnv } from '@/tests/utils/env';
import { createChatProvider } from '@/lib/ollama/factory';
import { MockChatProvider } from '@/lib/ollama/mock-provider';
import { OllamaChatProvider } from '@/lib/ollama/ollama-provider';

describe('createChatProvider', () => {
    it('возвращает OllamaChatProvider для mode=real', () => {
        const provider = createChatProvider({
            mode: 'real',
            host: 'http://localhost:11434',
            model: 'qwen3.5:cloud',
        });
        expect(provider).toBeInstanceOf(OllamaChatProvider);
    });

    it('возвращает MockChatProvider для mode=mock', () => {
        const provider = createChatProvider({
            mode: 'mock',
            host: 'http://localhost:11434',
            model: 'qwen3.5:cloud',
        });
        expect(provider).toBeInstanceOf(MockChatProvider);
    });
});

describe('getChatProvider', () => {
    beforeEach(() => {
        vi.resetModules();
    });

    it('возвращает один и тот же инстанс при повторных вызовах', async () => {
        setEnv('OLLAMA_MODE', 'mock');
        try {
            const { getChatProvider } = await import('@/lib/ollama/factory');
            expect(getChatProvider()).toBe(getChatProvider());
        } finally {
            unsetEnv('OLLAMA_MODE');
        }
    });

    it('строит MockChatProvider при OLLAMA_MODE=mock', async () => {
        setEnv('OLLAMA_MODE', 'mock');
        try {
            const { getChatProvider } = await import('@/lib/ollama/factory');
            const { MockChatProvider: FreshMock } = await import(
                '@/lib/ollama/mock-provider'
                );
            expect(getChatProvider()).toBeInstanceOf(FreshMock);
        } finally {
            unsetEnv('OLLAMA_MODE');
        }
    });

    it('строит OllamaChatProvider при OLLAMA_MODE=real', async () => {
        setEnv('OLLAMA_MODE', 'real');
        try {
            const { getChatProvider } = await import('@/lib/ollama/factory');
            const { OllamaChatProvider: FreshOllama } = await import(
                '@/lib/ollama/ollama-provider'
                );
            expect(getChatProvider()).toBeInstanceOf(FreshOllama);
        } finally {
            unsetEnv('OLLAMA_MODE');
        }
    });

    it('после resetModules перечитывает env и строит нового провайдера', async () => {
        setEnv('OLLAMA_MODE', 'mock');
        {
            const { getChatProvider } = await import('@/lib/ollama/factory');
            const { MockChatProvider: FreshMock } = await import(
                '@/lib/ollama/mock-provider'
                );
            expect(getChatProvider()).toBeInstanceOf(FreshMock);
        }

        vi.resetModules();
        setEnv('OLLAMA_MODE', 'real');
        try {
            const { getChatProvider } = await import('@/lib/ollama/factory');
            const { OllamaChatProvider: FreshOllama } = await import(
                '@/lib/ollama/ollama-provider'
                );
            expect(getChatProvider()).toBeInstanceOf(FreshOllama);
        } finally {
            unsetEnv('OLLAMA_MODE');
        }
    });
});