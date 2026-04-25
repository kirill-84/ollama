import 'server-only';
import { z } from 'zod';

import type { ChatMessage, ToolCall, ToolDefinition } from '@/lib/ollama';
import type { IFlightsProvider } from '@/lib/flights/provider';
import type { FlightOffer, FlightSearchParams } from '@/lib/flights/types';

const flightSearchToolArgsSchema = z.object({
    origin: z
        .string()
        .regex(/^[A-Z]{3}$/, 'IATA-код вылета: 3 заглавные латинские буквы'),
    destination: z
        .string()
        .regex(/^[A-Z]{3}$/, 'IATA-код назначения: 3 заглавные латинские буквы'),
    departureDate: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'формат YYYY-MM-DD'),
    departureFlexDays: z.number().int().min(0).max(7).optional(),
    returnDate: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'формат YYYY-MM-DD')
        .optional(),
    returnFlexDays: z.number().int().min(0).max(7).optional(),
    maxPrice: z.number().positive().optional(),
    passengers: z.number().int().min(1).max(9).optional(),
});

export type FlightSearchToolArgs = z.infer<typeof flightSearchToolArgsSchema>;

export const SEARCH_FLIGHTS_TOOL_NAME = 'search_flights';

export const searchFlightsTool: ToolDefinition = {
    name: SEARCH_FLIGHTS_TOOL_NAME,
    description:
        'Поиск авиабилетов по заданным параметрам. Возвращает список предложений, отсортированный по возрастанию цены.',
    parameters: z.toJSONSchema(flightSearchToolArgsSchema, {
        target: 'openapi-3.0',
    }) as Record<string, unknown>,
};

export type ParseResult<T> =
    | { success: true; data: T }
    | { success: false; error: string };

export function parseSearchFlightsArguments(
    raw: unknown,
): ParseResult<FlightSearchToolArgs> {
    const result = flightSearchToolArgsSchema.safeParse(raw);
    if (result.success) {
        return { success: true, data: result.data };
    }
    const message = result.error.issues
        .map((issue) => {
            const path = issue.path.length > 0 ? issue.path.join('.') : '<root>';
            return `${path}: ${issue.message}`;
        })
        .join('; ');
    return { success: false, error: message };
}

export type ExecuteSearchFlightsDeps = {
    flightsProvider: IFlightsProvider;
    defaultCurrency?: string;
    defaultLimit?: number;
    signal?: AbortSignal;
};

export async function executeSearchFlights(
    toolCall: ToolCall,
    deps: ExecuteSearchFlightsDeps,
): Promise<ChatMessage> {
    const toToolMessage = (payload: unknown): ChatMessage => ({
        role: 'tool',
        content: JSON.stringify(payload),
        toolCallId: toolCall.id,
        toolName: toolCall.name,
    });

    const parsed = parseSearchFlightsArguments(toolCall.arguments);
    if (!parsed.success) {
        return toToolMessage({ error: 'validation', message: parsed.error });
    }

    const args = parsed.data;
    const params: FlightSearchParams = {
        origin: args.origin,
        destination: args.destination,
        departureDate: {
            date: args.departureDate,
            flexDays: args.departureFlexDays,
        },
        returnDate: args.returnDate
            ? { date: args.returnDate, flexDays: args.returnFlexDays }
            : undefined,
        maxPrice: args.maxPrice,
        passengers: args.passengers,
        currency: deps.defaultCurrency,
        limit: deps.defaultLimit,
    };

    let offers: FlightOffer[];
    try {
        offers = await deps.flightsProvider.search(params, deps.signal);
    } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
            throw error;
        }
        const message =
            error instanceof Error ? error.message : 'неизвестная ошибка провайдера';
        return toToolMessage({ error: 'provider', message });
    }

    const prices = offers.map((o) => o.price);
    const priceRange =
        prices.length > 0
            ? ([Math.min(...prices), Math.max(...prices)] as const)
            : null;
    const currency = offers[0]?.currency ?? deps.defaultCurrency ?? null;

    return toToolMessage({
        count: offers.length,
        currency,
        priceRange,
        offers,
    });
}