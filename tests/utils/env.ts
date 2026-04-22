/**
 * Хелперы для безопасной манипуляции process.env в тестах.
 *
 * Next.js 16 типизирует NODE_ENV как readonly literal union,
 * что корректно для прод-кода, но мешает тестам, где мы
 * намеренно подменяем значения. Изоляция `as any` в одном месте.
 */

export const setEnv = (key: string, value: string): void => {
    (process.env as Record<string, string | undefined>)[key] = value;
};

export const unsetEnv = (key: string): void => {
    delete (process.env as Record<string, string | undefined>)[key];
};