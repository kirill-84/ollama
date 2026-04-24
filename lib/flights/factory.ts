import { env } from '@/lib/env';
import type { IFlightsProvider } from './provider';
import { MockFlightsProvider } from './mock-provider';
import { defaultMockGenerator } from './mock-scenarios';

export type FlightsProviderMode = 'real' | 'mock';

export interface FlightsProviderConfig {
    mode: FlightsProviderMode;
    /** Для будущего TravelpayoutsFlightsProvider. Не используется в mock-режиме. */
    token?: string;
    /** Для будущего TravelpayoutsFlightsProvider. Не используется в mock-режиме. */
    marker?: string;
    /** ISO-код валюты. Применяется, если запрос её не задал. */
    defaultCurrency?: string;
}

export function createFlightsProvider(config: FlightsProviderConfig): IFlightsProvider {
    switch (config.mode) {
        case 'real':
            throw new Error(
                'TravelpayoutsFlightsProvider не реализован. ' +
                'Установите TRAVELPAYOUTS_MODE=mock до получения API-ключа.',
            );
        case 'mock':
            return new MockFlightsProvider(defaultMockGenerator, {
                defaultCurrency: config.defaultCurrency,
            });
    }
}

let cached: IFlightsProvider | null = null;

export function getFlightsProvider(): IFlightsProvider {
    if (cached) return cached;
    cached = createFlightsProvider({
        mode: env.TRAVELPAYOUTS_MODE,
        token: env.TRAVELPAYOUTS_TOKEN,
        marker: env.TRAVELPAYOUTS_MARKER,
        defaultCurrency: env.TRAVELPAYOUTS_CURRENCY,
    });
    return cached;
}