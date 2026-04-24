/**
 * Доменные типы провайдера поиска авиабилетов.
 * Не зависят ни от конкретного API (Travelpayouts), ни от LLM.
 */

export interface FlexibleDate {
    /** ISO YYYY-MM-DD. */
    date: string;
    /** Искать в пределах ±N дней от date. Отсутствует = точная дата. */
    flexDays?: number;
}

export interface FlightSearchParams {
    /** IATA-код города вылета, например 'MOW'. */
    origin: string;
    /** IATA-код города прилёта, например 'CMB'. */
    destination: string;
    departureDate: FlexibleDate;
    /** Отсутствует = one-way. */
    returnDate?: FlexibleDate;
    /** Максимальная цена в валюте currency. Результаты выше — отсекаются. */
    maxPrice?: number;
    /** Кол-во пассажиров. Дефолт на уровне провайдера: 1. */
    passengers?: number;
    /** ISO-код валюты. Дефолт на уровне провайдера: 'RUB'. */
    currency?: string;
    /** Максимум офферов в ответе. Дефолт на уровне провайдера: 5. */
    limit?: number;
}

export interface FlightSegment {
    /** ISO datetime вылета. */
    departureAt: string;
    /** ISO datetime прилёта. */
    arrivalAt: string;
    durationMinutes: number;
    stops: number;
    /** IATA-коды аэропортов пересадок. Непустой только при stops > 0. */
    transferAirports?: string[];
    /** Например 'SU 1234'. */
    flightNumber: string;
}

export interface FlightOffer {
    /** Цена за всю поездку (туда + обратно для round-trip) в валюте currency. */
    price: number;
    currency: string;
    airline: {
        /** IATA. */
        code: string;
        name: string;
    };
    origin: {
        /** IATA. */
        code: string;
        city: string;
    };
    destination: {
        /** IATA. */
        code: string;
        city: string;
    };
    outbound: FlightSegment;
    /** Рейс обратно. Отсутствует = one-way. */
    return?: FlightSegment;
    /** Ссылка на покупку. */
    deepLink: string;
    /** Багаж включён в цену. undefined = данных нет. */
    baggageIncluded?: boolean;
    /** Токен бронирования, если требуется провайдером. */
    bookingToken?: string;
}

/**
 * Дефолты, применяемые провайдером к опциональным полям FlightSearchParams.
 * Экспортируются отдельно, чтобы тесты и factory ссылались на одно место.
 */
export const FLIGHT_SEARCH_DEFAULTS = {
    passengers: 1,
    currency: 'RUB',
    limit: 5,
} as const;