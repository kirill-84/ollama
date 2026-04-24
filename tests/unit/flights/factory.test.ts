import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setEnv, unsetEnv } from '@/tests/utils/env';
import { createFlightsProvider } from '@/lib/flights/factory';
import { MockFlightsProvider } from '@/lib/flights/mock-provider';

describe('createFlightsProvider', () => {
    it('возвращает MockFlightsProvider при mode=mock', () => {
        const provider = createFlightsProvider({ mode: 'mock' });
        expect(provider).toBeInstanceOf(MockFlightsProvider);
    });

    it('кидает понятную ошибку при mode=real', () => {
        expect(() =>
            createFlightsProvider({ mode: 'real', token: 't', marker: 'm' }),
        ).toThrow(/не реализован/);
    });

    it('прокидывает defaultCurrency в офферы', async () => {
        const provider = createFlightsProvider({
            mode: 'mock',
            defaultCurrency: 'USD',
        });
        const offers = await provider.search({
            origin: 'MOW',
            destination: 'CMB',
            departureDate: { date: '2026-05-15' },
        });
        expect(offers.length).toBeGreaterThan(0);
        expect(offers.every((o) => o.currency === 'USD')).toBe(true);
    });
});

describe('getFlightsProvider', () => {
    beforeEach(() => {
        vi.resetModules();
    });

    it('возвращает один и тот же инстанс при повторных вызовах', async () => {
        setEnv('TRAVELPAYOUTS_MODE', 'mock');
        try {
            const { getFlightsProvider } = await import('@/lib/flights/factory');
            expect(getFlightsProvider()).toBe(getFlightsProvider());
        } finally {
            unsetEnv('TRAVELPAYOUTS_MODE');
        }
    });

    it('строит MockFlightsProvider при TRAVELPAYOUTS_MODE=mock', async () => {
        setEnv('TRAVELPAYOUTS_MODE', 'mock');
        try {
            const { getFlightsProvider } = await import('@/lib/flights/factory');
            const { MockFlightsProvider: FreshMock } = await import(
                '@/lib/flights/mock-provider'
                );
            expect(getFlightsProvider()).toBeInstanceOf(FreshMock);
        } finally {
            unsetEnv('TRAVELPAYOUTS_MODE');
        }
    });

    it('кидает ошибку при TRAVELPAYOUTS_MODE=real', async () => {
        setEnv('TRAVELPAYOUTS_MODE', 'real');
        try {
            const { getFlightsProvider } = await import('@/lib/flights/factory');
            expect(() => getFlightsProvider()).toThrow(/не реализован/);
        } finally {
            unsetEnv('TRAVELPAYOUTS_MODE');
        }
    });

    it('использует TRAVELPAYOUTS_CURRENCY из env', async () => {
        setEnv('TRAVELPAYOUTS_MODE', 'mock');
        setEnv('TRAVELPAYOUTS_CURRENCY', 'USD');
        try {
            const { getFlightsProvider } = await import('@/lib/flights/factory');
            const provider = getFlightsProvider();
            const offers = await provider.search({
                origin: 'MOW',
                destination: 'CMB',
                departureDate: { date: '2026-05-15' },
            });
            expect(offers.every((o) => o.currency === 'USD')).toBe(true);
        } finally {
            unsetEnv('TRAVELPAYOUTS_MODE');
            unsetEnv('TRAVELPAYOUTS_CURRENCY');
        }
    });
});