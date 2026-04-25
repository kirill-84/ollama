import { describe, it, expect } from 'vitest';
import { buildSystemPrompt } from '@/lib/chat/system-prompt';

describe('buildSystemPrompt', () => {
    const fixedNow = new Date('2026-04-25T00:00:00Z');

    it('включает форматированную сегодняшнюю дату на русском', () => {
        const prompt = buildSystemPrompt({
            destinations: [{ code: 'CMB', city: 'Коломбо' }],
            now: fixedNow,
        });

        expect(prompt).toContain('Сегодня: 25 апреля 2026 года.');
    });

    it('перечисляет направления в формате "Город (CODE)"', () => {
        const prompt = buildSystemPrompt({
            destinations: [{ code: 'CMB', city: 'Коломбо' }],
            now: fixedNow,
        });

        expect(prompt).toContain('Коломбо (CMB)');
    });

    it('поддерживает несколько направлений через запятую', () => {
        const prompt = buildSystemPrompt({
            destinations: [
                { code: 'CMB', city: 'Коломбо' },
                { code: 'BKK', city: 'Бангкок' },
            ],
            now: fixedNow,
        });

        expect(prompt).toContain('Коломбо (CMB), Бангкок (BKK)');
    });

    it('содержит инструкции про off-topic фильтр', () => {
        const prompt = buildSystemPrompt({
            destinations: [{ code: 'CMB', city: 'Коломбо' }],
            now: fixedNow,
        });

        expect(prompt).toMatch(/только поиск и подбор авиабилетов/i);
    });

    it('инструктирует вызывать search_flights и не выдумывать данные', () => {
        const prompt = buildSystemPrompt({
            destinations: [{ code: 'CMB', city: 'Коломбо' }],
            now: fixedNow,
        });

        expect(prompt).toContain('search_flights');
        expect(prompt).toMatch(/не выдумывай/i);
    });

    it('инструктирует не дублировать сырой JSON в ответе пользователю', () => {
        const prompt = buildSystemPrompt({
            destinations: [{ code: 'CMB', city: 'Коломбо' }],
            now: fixedNow,
        });

        expect(prompt).toMatch(/не дублируй сырой JSON/i);
    });

    it('бросает ошибку при пустом списке направлений', () => {
        expect(() =>
            buildSystemPrompt({ destinations: [], now: fixedNow }),
        ).toThrow(/destinations/);
    });

    it('использует переданный now вместо текущего времени', () => {
        const prompt = buildSystemPrompt({
            destinations: [{ code: 'CMB', city: 'Коломбо' }],
            now: new Date('2026-01-01T00:00:00Z'),
        });

        expect(prompt).toContain('1 января 2026 года');
        expect(prompt).not.toContain('25 апреля');
    });

    it('использует new Date() по умолчанию, если now не передан', () => {
        const prompt = buildSystemPrompt({
            destinations: [{ code: 'CMB', city: 'Коломбо' }],
        });

        expect(prompt).toMatch(/Сегодня: \d{1,2} \S+ \d{4} года\./);
    });
});