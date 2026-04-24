import type { FlightOffer, FlightSearchParams } from './types';

/**
 * Абстрактный провайдер поиска авиабилетов.
 * Реализации: TravelpayoutsFlightsProvider (появится, когда будет ключ),
 *             MockFlightsProvider (тесты/dev/CI).
 *
 * Инварианты контракта, которые обязаны соблюдать ВСЕ реализации:
 *   1. Результат отсортирован по price ASC.
 *   2. Если задан maxPrice — офферы дороже отсекаются.
 *   3. Размер результата не превышает params.limit (дефолт 5).
 *   4. При отменённом signal — Promise отклоняется с AbortError,
 *      никаких HTTP/вычислений не выполняется.
 */
export interface IFlightsProvider {
    search(params: FlightSearchParams, signal?: AbortSignal): Promise<FlightOffer[]>;
}