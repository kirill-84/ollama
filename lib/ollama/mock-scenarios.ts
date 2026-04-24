import type { MockRule, MockResponder } from './mock-provider';

/**
 * Сценарии по умолчанию для MockChatProvider в dev/CI (OLLAMA_MODE=mock).
 * Порядок имеет значение: первое правило побеждает.
 *
 * Сценарии нарочно простые — это "умная заглушка" для разработки UI без
 * живой Ollama, не замена реальной модели. Когда будет системный промпт и
 * tool calling для search_flights — добавим сюда правило, возвращающее
 * tool_call при наличии tools в запросе.
 */

const lastUserText = (messages: { role: string; content: string }[]): string => {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    return lastUser?.content.toLowerCase() ?? '';
};

const greeting: MockRule = {
    match: (req) => {
        const text = lastUserText(req.messages);
        return /\b(привет|здравствуй|hi|hello)\b/.test(text);
    },
    respond: () => ({
        message: {
            role: 'assistant',
            content:
                'Здравствуйте! Я помогу найти дешёвые авиабилеты на Шри-Ланку. ' +
                'Откуда планируете вылетать и на какие даты?',
        },
    }),
};

const offTopic: MockRule = {
    match: (req) => {
        const text = lastUserText(req.messages);
        return /\b(погода|новости|курс|рецепт|анекдот)\b/.test(text);
    },
    respond: () => ({
        message: {
            role: 'assistant',
            content:
                'Я могу помочь только с поиском авиабилетов на Шри-Ланку. ' +
                'Расскажите, откуда хотите вылететь?',
        },
    }),
};

export const defaultMockRules: MockRule[] = [greeting, offTopic];

export const defaultMockFallback: MockResponder = () => ({
    message: {
        role: 'assistant',
        content:
            '[mock] Уточните, пожалуйста: из какого города вылет, ' +
            'на какие даты и бюджет?',
    },
});