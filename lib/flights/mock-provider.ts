import type { IFlightsProvider } from './provider';
import {
    FLIGHT_SEARCH_DEFAULTS,
    type FlightOffer,
    type FlightSearchParams,
} from './types';

/** Генератор «сырых» офферов. Сортировка/фильтрация/лимит — ответственность класса. */
export type FlightOfferGenerator = (params: FlightSearchParams) => FlightOffer[];

/**
 * Конфигурируемый мок. Генератор отвечает за форму офферов,
 * класс — за инварианты контракта IFlightsProvider.
 *
 * Используется:
 *   1) в юнит-тестах других слоёв — с детерминированным генератором;
 *   2) в dev/CI при TRAVELPAYOUTS_MODE=mock — с генератором из mock-scenarios.ts
 *      (добавим на подшаге 2).
 */
export class MockFlightsProvider implements IFlightsProvider {
    constructor(private readonly generator: FlightOfferGenerator) {}

    async search(
        params: FlightSearchParams,
        signal?: AbortSignal,
    ): Promise<FlightOffer[]> {
        if (signal?.aborted) {
            throw new DOMException('Aborted', 'AbortError');
        }

        const limit = params.limit ?? FLIGHT_SEARCH_DEFAULTS.limit;
        const maxPrice = params.maxPrice;

        const raw = this.generator(params);
        const filtered = maxPrice === undefined
            ? raw
            : raw.filter((o) => o.price <= maxPrice);

        return [...filtered].sort((a, b) => a.price - b.price).slice(0, limit);
    }
}