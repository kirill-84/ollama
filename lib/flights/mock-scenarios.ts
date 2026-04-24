import type { FlightOfferGenerator } from './mock-provider';
import {
    FLIGHT_SEARCH_DEFAULTS,
    type FlightOffer,
    type FlightSegment,
} from './types';

/**
 * Набор авиакомпаний, на базе которого строятся моковые офферы.
 */
const AIRLINES: Record<string, { code: string; name: string }> = {
    SU: { code: 'SU', name: 'Aeroflot' },
    S7: { code: 'S7', name: 'S7 Airlines' },
    EK: { code: 'EK', name: 'Emirates' },
    QR: { code: 'QR', name: 'Qatar Airways' },
    TK: { code: 'TK', name: 'Turkish Airlines' },
};

/**
 * Человекочитаемые названия городов по IATA-коду.
 * Для моковых данных хватает справочника на несколько популярных точек;
 * для неизвестных IATA возвращаем сам код.
 */
const CITY_NAMES: Record<string, string> = {
    MOW: 'Москва',
    LED: 'Санкт-Петербург',
    AER: 'Сочи',
    KZN: 'Казань',
    CMB: 'Коломбо',
};

const cityName = (iata: string): string => CITY_NAMES[iata] ?? iata;

/**
 * Шаблон рейса: база, из которой генерится конкретный FlightOffer.
 * basePrice — цена на одного пассажира в RUB за one-way.
 */
interface FlightTemplate {
    airline: keyof typeof AIRLINES;
    basePrice: number;
    stops: number;
    durationMinutes: number;
    flightNumber: string;
    transferAirports?: string[];
}

const TEMPLATES: FlightTemplate[] = [
    { airline: 'SU', basePrice: 65000, stops: 0, durationMinutes: 580, flightNumber: 'SU 289' },
    { airline: 'TK', basePrice: 42000, stops: 1, durationMinutes: 1320, flightNumber: 'TK 724', transferAirports: ['IST'] },
    { airline: 'QR', basePrice: 48000, stops: 1, durationMinutes: 1080, flightNumber: 'QR 218', transferAirports: ['DOH'] },
    { airline: 'EK', basePrice: 72000, stops: 1, durationMinutes: 780, flightNumber: 'EK 132', transferAirports: ['DXB'] },
    { airline: 'S7', basePrice: 58000, stops: 1, durationMinutes: 920, flightNumber: 'S7 7651', transferAirports: ['DXB'] },
    { airline: 'EK', basePrice: 55000, stops: 2, durationMinutes: 1620, flightNumber: 'EK 514', transferAirports: ['DXB', 'SIN'] },
];

const DAY_MS = 24 * 60 * 60 * 1000;

const shiftDays = (iso: string, delta: number): Date =>
    new Date(new Date(`${iso}T00:00:00.000Z`).getTime() + delta * DAY_MS);

const datesAround = (isoDate: string, flexDays: number): Date[] => {
    const result: Date[] = [];
    for (let d = -flexDays; d <= flexDays; d++) {
        result.push(shiftDays(isoDate, d));
    }
    return result;
};

const buildSegment = (
    tmpl: FlightTemplate,
    departureAt: Date,
): FlightSegment => {
    const arrivalAt = new Date(departureAt.getTime() + tmpl.durationMinutes * 60_000);
    const segment: FlightSegment = {
        departureAt: departureAt.toISOString(),
        arrivalAt: arrivalAt.toISOString(),
        durationMinutes: tmpl.durationMinutes,
        stops: tmpl.stops,
        flightNumber: tmpl.flightNumber,
    };
    if (tmpl.transferAirports) segment.transferAirports = tmpl.transferAirports;
    return segment;
};

/**
 * Дефолтный генератор моковых офферов для dev/CI-режима.
 *
 * Генерит «сырые» варианты по всем шаблонам на все даты в пределах flexDays.
 * Фильтрацию по maxPrice, сортировку по цене и limit применяет сам
 * MockFlightsProvider — генератор их не знает.
 */
export const defaultMockGenerator: FlightOfferGenerator = (params) => {
    const passengers = params.passengers ?? FLIGHT_SEARCH_DEFAULTS.passengers;
    const currency = params.currency ?? FLIGHT_SEARCH_DEFAULTS.currency;

    const departureDates = datesAround(
        params.departureDate.date,
        params.departureDate.flexDays ?? 0,
    );
    const returnDates = params.returnDate
        ? datesAround(params.returnDate.date, params.returnDate.flexDays ?? 0)
        : [undefined];

    const offers: FlightOffer[] = [];

    for (const tmpl of TEMPLATES) {
        for (const depDate of departureDates) {
            const depAt = new Date(depDate);
            depAt.setUTCHours(10, 0, 0, 0);
            const outbound = buildSegment(tmpl, depAt);

            for (const retDate of returnDates) {
                let retSegment: FlightSegment | undefined;
                if (retDate) {
                    const retAt = new Date(retDate);
                    retAt.setUTCHours(14, 0, 0, 0);
                    retSegment = buildSegment(tmpl, retAt);
                }

                const legs = retSegment ? 2 : 1;
                offers.push({
                    price: tmpl.basePrice * passengers * legs,
                    currency,
                    airline: AIRLINES[tmpl.airline],
                    origin: { code: params.origin, city: cityName(params.origin) },
                    destination: { code: params.destination, city: cityName(params.destination) },
                    outbound,
                    return: retSegment,
                    deepLink: `https://example.com/mock/${tmpl.airline}/${tmpl.flightNumber.replace(' ', '')}`,
                    baggageIncluded: tmpl.stops === 0,
                });
            }
        }
    }

    return offers;
};