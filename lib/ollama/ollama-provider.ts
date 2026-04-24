import { Ollama } from 'ollama';
import type {
    ChatRequest as OllamaChatRequest,
    ChatResponse as OllamaChatResponse,
} from 'ollama';
import type { IChatProvider } from './provider';
import type { ChatRequest, ChatResponse } from './types';
import { fromOllamaMessage, toOllamaMessage, toOllamaTool } from './ollama-mapper';

/**
 * Минимальный контракт клиента, нужный провайдеру.
 * Сознательно НЕ Pick<Ollama, 'chat' | 'abort'>:
 *   1. Ollama.chat перегружен (stream: true | false) — перегрузка мешает
 *      типизировать моки в тестах.
 *   2. В ответе нам реально нужен только `message`, остальные поля
 *      (model, created_at, done, eval_count и т.п.) — шум.
 * Real Ollama структурно шире — приводим к интерфейсу в defaultClientFactory.
 */
export interface OllamaClient {
    chat(
        request: OllamaChatRequest & { stream?: false },
    ): Promise<Pick<OllamaChatResponse, 'message'>>;
    abort(): void;
}

export interface OllamaChatProviderConfig {
    host: string;
    model: string;
    clientFactory?: (host: string) => OllamaClient;
}

const defaultClientFactory = (host: string): OllamaClient =>
    new Ollama({ host }) as unknown as OllamaClient;

export class OllamaChatProvider implements IChatProvider {
    private readonly host: string;
    private readonly model: string;
    private readonly clientFactory: (host: string) => OllamaClient;
    private readonly sharedClient: OllamaClient;

    constructor(config: OllamaChatProviderConfig) {
        this.host = config.host;
        this.model = config.model;
        this.clientFactory = config.clientFactory ?? defaultClientFactory;
        this.sharedClient = this.clientFactory(this.host);
    }

    async chat(request: ChatRequest): Promise<ChatResponse> {
        // Запросы без отмены используют shared-клиент — не плодим объекты зря.
        // Запросы с AbortSignal получают изолированный клиент, потому что
        // ollama.abort() прерывает ВСЕ активные запросы клиента, а мы хотим
        // отменять только один конкретный запрос.
        const client = request.signal ? this.clientFactory(this.host) : this.sharedClient;

        if (request.signal?.aborted) {
            throw new DOMException('Aborted', 'AbortError');
        }

        const abortHandler = () => client.abort();
        request.signal?.addEventListener('abort', abortHandler, { once: true });

        try {
            const response = await client.chat({
                model: this.model,
                messages: request.messages.map(toOllamaMessage),
                tools: request.tools?.map(toOllamaTool),
                stream: false,
                options:
                    request.temperature !== undefined
                        ? { temperature: request.temperature }
                        : undefined,
            });

            return { message: fromOllamaMessage(response.message) };
        } finally {
            request.signal?.removeEventListener('abort', abortHandler);
        }
    }
}