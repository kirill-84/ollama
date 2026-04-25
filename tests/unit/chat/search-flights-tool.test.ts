import { describe, it, expect, vi } from 'vitest';
import {
    parseSearchFlightsArguments,
    searchFlightsTool,
    SEARCH_FLIGHTS_TOOL_NAME,
    executeSearchFlights,
} from '@/lib/chat/search-flights-tool';
import type { IFlightsProvider } from '@/lib/flights/provider';
import type { FlightOffer } from '@/lib/flights/types';
import type { ToolCall } from '@/lib/ollama';

describe('searchFlightsTool', () => {
    it('имеет имя search_flights', () => {
        expect(searchFlightsTool.name).toBe('search_flights');
        expect(SEARCH_FLIGHTS_TOOL_NAME).toBe('search_flights');
    });

    it('имеет JSON Schema объект-параметров', () => {
        const params = searchFlightsTool.parameters as Record<string, unknown>;
        expect(params.type).toBe('object');
        expect(params).toHaveProperty('properties');
    });

    it('требует origin, destination, departureDate', () => {
        const params = searchFlightsTool.parameters as { required?: string[] };
        expect(params.required).toEqual(
            expect.arrayContaining(['origin', 'destination', 'departureDate']),
        );
    });

    it('делает passengers, maxPrice, returnDate опциональными', () => {
        const params = searchFlightsTool.parameters as { required?: string[] };
        expect(params.required ?? []).not.toContain('passengers');
        expect(params.required ?? []).not.toContain('maxPrice');
        expect(params.required ?? []).not.toContain('returnDate');
    });

    it('не содержит $schema', () => {
        const params = searchFlightsTool.parameters as Record<string, unknown>;
        expect(params).not.toHaveProperty('$schema');
    });
});

describe('parseSearchFlightsArguments', () => {
    it('возвращает success на валидных аргументах', () => {
        const result = parseSearchFlightsArguments({
            origin: 'MOW',
            destination: 'CMB',
            departureDate: '2026-05-15',
        });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.origin).toBe('MOW');
            expect(result.data.departureDate).toBe('2026-05-15');
        }
    });

    it('возвращает failure при отсутствующем required-поле', () => {
        const result = parseSearchFlightsArguments({
            origin: 'MOW',
            destination: 'CMB',
        });
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error).toContain('departureDate');
        }
    });

    it('отвергает IATA-код в нижнем регистре', () => {
        const result = parseSearchFlightsArguments({
            origin: 'mow',
            destination: 'CMB',
            departureDate: '2026-05-15',
        });
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error).toContain('origin');
        }
    });

    it('отвергает IATA-код некорректной длины', () => {
        const result = parseSearchFlightsArguments({
            origin: 'MOSCOW',
            destination: 'CMB',
            departureDate: '2026-05-15',
        });
        expect(result.success).toBe(false);
    });

    it('отвергает дату в формате DD.MM.YYYY', () => {
        const result = parseSearchFlightsArguments({
            origin: 'MOW',
            destination: 'CMB',
            departureDate: '15.05.2026',
        });
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error).toContain('departureDate');
        }
    });

    it('отвергает отрицательный maxPrice', () => {
        const result = parseSearchFlightsArguments({
            origin: 'MOW',
            destination: 'CMB',
            departureDate: '2026-05-15',
            maxPrice: -100,
        });
        expect(result.success).toBe(false);
    });

    it('отвергает дробное число пассажиров', () => {
        const result = parseSearchFlightsArguments({
            origin: 'MOW',
            destination: 'CMB',
            departureDate: '2026-05-15',
            passengers: 1.5,
        });
        expect(result.success).toBe(false);
    });

    it('отвергает 0 пассажиров', () => {
        const result = parseSearchFlightsArguments({
            origin: 'MOW',
            destination: 'CMB',
            departureDate: '2026-05-15',
            passengers: 0,
        });
        expect(result.success).toBe(false);
    });

    it('принимает round-trip с returnDate и flexDays', () => {
        const result = parseSearchFlightsArguments({
            origin: 'MOW',
            destination: 'CMB',
            departureDate: '2026-05-15',
            departureFlexDays: 3,
            returnDate: '2026-05-25',
            returnFlexDays: 2,
        });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.departureFlexDays).toBe(3);
            expect(result.data.returnFlexDays).toBe(2);
        }
    });

    it('игнорирует неизвестные поля (lenient)', () => {
        const result = parseSearchFlightsArguments({
            origin: 'MOW',
            destination: 'CMB',
            departureDate: '2026-05-15',
            class: 'economy',
        });
        expect(result.success).toBe(true);
    });

    it('отвергает не-объект', () => {
        expect(parseSearchFlightsArguments('not an object').success).toBe(false);
        expect(parseSearchFlightsArguments(null).success).toBe(false);
    });
});

describe('executeSearchFlights', () => {
    const toolCall: ToolCall = {
        id: 'call_0',
        name: 'search_flights',
        arguments: {
            origin: 'MOW',
            destination: 'CMB',
            departureDate: '2026-05-15',
        },
    };

    const sampleOffer: FlightOffer = {
        price: 50000,
        currency: 'RUB',
        airline: { code: 'SU', name: 'Aeroflot' },
        origin: { code: 'MOW', city: 'Москва' },
        destination: { code: 'CMB', city: 'Коломбо' },
        outbound: {
            departureAt: '2026-05-15T10:00:00Z',
            arrivalAt: '2026-05-15T20:00:00Z',
            durationMinutes: 600,
            stops: 0,
            flightNumber: 'SU123',
        },
        deepLink: 'https://example.com/book/1',
    };

    it('возвращает tool-message с count, currency, priceRange, offers', async () => {
        const flightsProvider: IFlightsProvider = {
            search: vi.fn().mockResolvedValue([sampleOffer]),
        };

        const message = await executeSearchFlights(toolCall, { flightsProvider });

        expect(message.role).toBe('tool');
        expect(message.toolCallId).toBe('call_0');
        expect(message.toolName).toBe('search_flights');

        const payload = JSON.parse(message.content);
        expect(payload.count).toBe(1);
        expect(payload.currency).toBe('RUB');
        expect(payload.priceRange).toEqual([50000, 50000]);
        expect(payload.offers).toHaveLength(1);
    });

    it('передаёт departureDate и returnDate как FlexibleDate', async () => {
        const search = vi.fn().mockResolvedValue([]);
        const flightsProvider: IFlightsProvider = { search };

        await executeSearchFlights(
            {
                id: 'call_0',
                name: 'search_flights',
                arguments: {
                    origin: 'MOW',
                    destination: 'CMB',
                    departureDate: '2026-05-15',
                    departureFlexDays: 3,
                    returnDate: '2026-05-25',
                    returnFlexDays: 2,
                },
            },
            { flightsProvider },
        );

        expect(search).toHaveBeenCalledWith(
            expect.objectContaining({
                departureDate: { date: '2026-05-15', flexDays: 3 },
                returnDate: { date: '2026-05-25', flexDays: 2 },
            }),
            undefined,
        );
    });

    it('не передаёт returnDate, если она не указана', async () => {
        const search = vi.fn().mockResolvedValue([]);
        const flightsProvider: IFlightsProvider = { search };

        await executeSearchFlights(toolCall, { flightsProvider });

        expect(search).toHaveBeenCalledWith(
            expect.objectContaining({ returnDate: undefined }),
            undefined,
        );
    });

    it('подставляет defaultCurrency и defaultLimit в params', async () => {
        const search = vi.fn().mockResolvedValue([]);
        const flightsProvider: IFlightsProvider = { search };

        await executeSearchFlights(toolCall, {
            flightsProvider,
            defaultCurrency: 'USD',
            defaultLimit: 10,
        });

        expect(search).toHaveBeenCalledWith(
            expect.objectContaining({ currency: 'USD', limit: 10 }),
            undefined,
        );
    });

    it('пробрасывает signal в провайдер', async () => {
        const search = vi.fn().mockResolvedValue([]);
        const flightsProvider: IFlightsProvider = { search };
        const controller = new AbortController();

        await executeSearchFlights(toolCall, {
            flightsProvider,
            signal: controller.signal,
        });

        expect(search).toHaveBeenCalledWith(expect.anything(), controller.signal);
    });

    it('возвращает tool-message с error: validation при невалидных аргументах', async () => {
        const search = vi.fn();
        const flightsProvider: IFlightsProvider = { search };

        const message = await executeSearchFlights(
            {
                id: 'call_0',
                name: 'search_flights',
                arguments: { origin: 'MOW' },
            },
            { flightsProvider },
        );

        expect(search).not.toHaveBeenCalled();
        const payload = JSON.parse(message.content);
        expect(payload.error).toBe('validation');
        expect(payload.message).toBeTruthy();
    });

    it('возвращает priceRange null при пустом списке предложений', async () => {
        const flightsProvider: IFlightsProvider = {
            search: vi.fn().mockResolvedValue([]),
        };

        const message = await executeSearchFlights(toolCall, {
            flightsProvider,
            defaultCurrency: 'RUB',
        });

        const payload = JSON.parse(message.content);
        expect(payload.count).toBe(0);
        expect(payload.priceRange).toBeNull();
        expect(payload.currency).toBe('RUB');
        expect(payload.offers).toEqual([]);
    });

    it('возвращает корректный диапазон цен для нескольких предложений', async () => {
        const flightsProvider: IFlightsProvider = {
            search: vi.fn().mockResolvedValue([
                { ...sampleOffer, price: 42000 },
                { ...sampleOffer, price: 67000 },
                { ...sampleOffer, price: 50000 },
            ]),
        };

        const message = await executeSearchFlights(toolCall, { flightsProvider });

        const payload = JSON.parse(message.content);
        expect(payload.priceRange).toEqual([42000, 67000]);
    });

    it('возвращает tool-message с error: provider при ошибке провайдера', async () => {
        const flightsProvider: IFlightsProvider = {
            search: vi.fn().mockRejectedValue(new Error('upstream timeout')),
        };

        const message = await executeSearchFlights(toolCall, { flightsProvider });

        const payload = JSON.parse(message.content);
        expect(payload.error).toBe('provider');
        expect(payload.message).toBe('upstream timeout');
    });

    it('пробрасывает AbortError, не заворачивая в tool-message', async () => {
        const abortError = Object.assign(new Error('aborted'), {
            name: 'AbortError',
        });
        const flightsProvider: IFlightsProvider = {
            search: vi.fn().mockRejectedValue(abortError),
        };

        await expect(
            executeSearchFlights(toolCall, { flightsProvider }),
        ).rejects.toBe(abortError);
    });
});