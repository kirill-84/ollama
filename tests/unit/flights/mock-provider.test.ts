import { describe, it, expect, vi } from 'vitest';
import { MockFlightsProvider } from '@/lib/flights/mock-provider';
import type { FlightOffer, FlightSearchParams } from '@/lib/flights/types';

const segment = {
    departureAt: '2026-05-15T10:00:00Z',
    arrivalAt: '2026-05-16T02:00:00Z',
    durationMinutes: 960,
    stops: 0,
    flightNumber: 'SU 1234',
};

const offer = (price: number, overrides: Partial<FlightOffer> = {}): FlightOffer => ({
    price,
    currency: 'RUB',
    airline: { code: 'SU', name: 'Aeroflot' },
    origin: { code: 'MOW', city: 'Москва' },
    destination: { code: 'CMB', city: 'Коломбо' },
    outbound: segment,
    deepLink: 'https://example.com/buy',
    ...overrides,
});

const params: FlightSearchParams = {
    origin: 'MOW',
    destination: 'CMB',
    departureDate: { date: '2026-05-15' },
};

describe('MockFlightsProvider', () => {
    it('возвращает офферы из генератора', async () => {
        const provider = new MockFlightsProvider(() => [offer(50000)]);
        const result = await provider.search(params);
        expect(result).toHaveLength(1);
        expect(result[0].price).toBe(50000);
    });

    it('передаёт параметры в генератор без изменений', async () => {
        const generator = vi.fn(() => [offer(50000)]);
        const provider = new MockFlightsProvider(generator);
        await provider.search(params);
        expect(generator).toHaveBeenCalledWith(params);
    });

    it('сортирует результат по цене возрастанию', async () => {
        const provider = new MockFlightsProvider(() => [
            offer(70000),
            offer(30000),
            offer(50000),
        ]);
        const result = await provider.search(params);
        expect(result.map((o) => o.price)).toEqual([30000, 50000, 70000]);
    });

    it('отсекает офферы дороже maxPrice', async () => {
        const provider = new MockFlightsProvider(() => [
            offer(30000),
            offer(50000),
            offer(80000),
        ]);
        const result = await provider.search({ ...params, maxPrice: 55000 });
        expect(result.map((o) => o.price)).toEqual([30000, 50000]);
    });

    it('применяет дефолтный limit = 5', async () => {
        const prices = [10000, 20000, 30000, 40000, 50000, 60000, 70000];
        const provider = new MockFlightsProvider(() => prices.map((p) => offer(p)));
        const result = await provider.search(params);
        expect(result).toHaveLength(5);
        expect(result[4].price).toBe(50000);
    });

    it('уважает явный limit', async () => {
        const provider = new MockFlightsProvider(() => [
            offer(10000),
            offer(20000),
            offer(30000),
        ]);
        const result = await provider.search({ ...params, limit: 2 });
        expect(result.map((o) => o.price)).toEqual([10000, 20000]);
    });

    it('применяет limit после сортировки — возвращает самые дешёвые', async () => {
        const provider = new MockFlightsProvider(() => [
            offer(90000),
            offer(10000),
            offer(50000),
            offer(30000),
        ]);
        const result = await provider.search({ ...params, limit: 2 });
        expect(result.map((o) => o.price)).toEqual([10000, 30000]);
    });

    it('не мутирует массив, возвращённый генератором', async () => {
        const raw = [offer(70000), offer(30000), offer(50000)];
        const provider = new MockFlightsProvider(() => raw);
        await provider.search(params);
        expect(raw.map((o) => o.price)).toEqual([70000, 30000, 50000]);
    });

    it('сразу бросает AbortError при уже отменённом signal', async () => {
        const generator = vi.fn(() => [offer(50000)]);
        const provider = new MockFlightsProvider(generator);
        const controller = new AbortController();
        controller.abort();

        await expect(provider.search(params, controller.signal)).rejects.toThrow(
            'Aborted',
        );
        expect(generator).not.toHaveBeenCalled();
    });

    it('возвращает пустой массив, если maxPrice отсёк всё', async () => {
        const provider = new MockFlightsProvider(() => [offer(50000), offer(70000)]);
        const result = await provider.search({ ...params, maxPrice: 10000 });
        expect(result).toEqual([]);
    });
});