export { buildSystemPrompt } from './system-prompt';
export type {
    BuildSystemPromptConfig,
    DestinationConfig,
} from './system-prompt';

export {
    SEARCH_FLIGHTS_TOOL_NAME,
    searchFlightsTool,
    parseSearchFlightsArguments,
    executeSearchFlights,
} from './search-flights-tool';
export type {
    FlightSearchToolArgs,
    ParseResult,
    ExecuteSearchFlightsDeps,
} from './search-flights-tool';

export { MVP_DESTINATIONS } from './destinations';

export { MAX_TOOL_ITERATIONS, runChatTurn } from './orchestrator';
export type { RunChatTurnInput } from './orchestrator';