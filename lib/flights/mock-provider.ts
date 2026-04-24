import type { IFlightsProvider } from './provider';
import {
    FLIGHT_SEARCH_DEFAULTS,
    type FlightOffer,
    type FlightSearchParams,
} from './types';

export type FlightOfferGenerator = (params: FlightSearchParams) => FlightOffer[];

export interface MockFlightsProviderOptions {
    /**
     * Дефолтная валюта. Подставляется в params.currency, если запрос её не задал.
     * Если options не передан — дефолт берётся из FLIGHT_SEARCH_DEFAULTS в генераторе.
     */
    defaultCurrency?: string;
}

export class MockFlightsProvider implements IFlightsProvider {
    constructor(
        private readonly generator: FlightOfferGenerator,
        private readonly options: MockFlightsProviderOptions = {},
    ) {}

    async search(
        params: FlightSearchParams,
        signal?: AbortSignal,
    ): Promise<FlightOffer[]> {
        if (signal?.aborted) {
            throw new DOMException('Aborted', 'AbortError');
        }

        const effective: FlightSearchParams = {
            ...params,
            currency: params.currency ?? this.options.defaultCurrency,
        };

        const limit = effective.limit ?? FLIGHT_SEARCH_DEFAULTS.limit;
        const maxPrice = effective.maxPrice;

        const raw = this.generator(effective);
        const filtered =
            maxPrice === undefined ? raw : raw.filter((o) => o.price <= maxPrice);

        return [...filtered].sort((a, b) => a.price - b.price).slice(0, limit);
    }
}