import { env } from '@/lib/env';
import type { IChatProvider } from './provider';
import { MockChatProvider } from './mock-provider';
import { OllamaChatProvider } from './ollama-provider';
import { defaultMockRules, defaultMockFallback } from './mock-scenarios';

export type ChatProviderMode = 'real' | 'mock';

export interface ChatProviderConfig {
    mode: ChatProviderMode;
    host: string;
    model: string;
}

/**
 * Чистая фабрика. От env не зависит — удобно тестировать изолированно.
 */
export function createChatProvider(config: ChatProviderConfig): IChatProvider {
    switch (config.mode) {
        case 'real':
            return new OllamaChatProvider({ host: config.host, model: config.model });
        case 'mock':
            return new MockChatProvider(defaultMockRules, defaultMockFallback);
    }
}

let cached: IChatProvider | null = null;

/**
 * Singleton-аксессор. Читает env при первом вызове, дальше отдаёт кеш.
 * В тестах сбрасывается через vi.resetModules() — пересоздание модуля
 * сбрасывает `cached` и заново читает env через пересоздание @/lib/env.
 */
export function getChatProvider(): IChatProvider {
    if (cached) return cached;
    cached = createChatProvider({
        mode: env.OLLAMA_MODE,
        host: env.OLLAMA_HOST,
        model: env.OLLAMA_MODEL,
    });
    return cached;
}