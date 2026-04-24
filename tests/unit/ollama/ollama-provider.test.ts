import { describe, it, expect, vi, type Mock } from 'vitest';
import { OllamaChatProvider, type OllamaClient } from '@/lib/ollama/ollama-provider';

type ChatFn = OllamaClient['chat'];
type AbortFn = OllamaClient['abort'];

interface OllamaStub extends OllamaClient {
    chat: Mock<ChatFn>;
    abort: Mock<AbortFn>;
}

function makeStub(chatImpl?: ChatFn): OllamaStub {
    const chat = vi.fn<ChatFn>();
    if (chatImpl) {
        chat.mockImplementation(chatImpl);
    } else {
        chat.mockResolvedValue({ message: { role: 'assistant', content: 'ok' } });
    }
    return { chat, abort: vi.fn<AbortFn>() };
}

describe('OllamaChatProvider', () => {
    it('создаёт shared-клиент в конструкторе и переиспользует его для запросов без signal', async () => {
        const stubs: OllamaStub[] = [];
        const factory = vi.fn((_host: string) => {
            const stub = makeStub();
            stubs.push(stub);
            return stub;
        });

        const provider = new OllamaChatProvider({
            host: 'http://localhost:11434',
            model: 'qwen3.5:cloud',
            clientFactory: factory,
        });

        expect(factory).toHaveBeenCalledTimes(1);

        await provider.chat({ messages: [{ role: 'user', content: '1' }] });
        await provider.chat({ messages: [{ role: 'user', content: '2' }] });

        expect(factory).toHaveBeenCalledTimes(1);
        expect(stubs[0].chat).toHaveBeenCalledTimes(2);
    });

    it('создаёт отдельный клиент для запроса с signal', async () => {
        const stubs: OllamaStub[] = [];
        const factory = vi.fn((_host: string) => {
            const stub = makeStub();
            stubs.push(stub);
            return stub;
        });

        const provider = new OllamaChatProvider({
            host: 'http://localhost:11434',
            model: 'qwen3.5:cloud',
            clientFactory: factory,
        });

        const controller = new AbortController();
        await provider.chat({
            messages: [{ role: 'user', content: 'x' }],
            signal: controller.signal,
        });

        expect(factory).toHaveBeenCalledTimes(2);
        expect(stubs[0].chat).not.toHaveBeenCalled();
        expect(stubs[1].chat).toHaveBeenCalledOnce();
    });

    it('передаёт host из конфига в фабрику клиента', () => {
        const factory = vi.fn((_host: string) => makeStub());

        new OllamaChatProvider({
            host: 'http://remote:11434',
            model: 'qwen3.5:cloud',
            clientFactory: factory,
        });

        expect(factory).toHaveBeenCalledWith('http://remote:11434');
    });

    it('вызывает chat с корректной моделью и замапленными сообщениями', async () => {
        const stub = makeStub();
        const provider = new OllamaChatProvider({
            host: 'http://localhost:11434',
            model: 'qwen3.5:cloud',
            clientFactory: () => stub,
        });

        await provider.chat({
            messages: [
                { role: 'system', content: 'sys' },
                { role: 'user', content: 'hi' },
            ],
        });

        expect(stub.chat).toHaveBeenCalledWith(
            expect.objectContaining({
                model: 'qwen3.5:cloud',
                messages: [
                    { role: 'system', content: 'sys' },
                    { role: 'user', content: 'hi' },
                ],
                stream: false,
            }),
        );
    });

    it('пробрасывает tools в замапленном формате', async () => {
        const stub = makeStub();
        const provider = new OllamaChatProvider({
            host: 'http://localhost:11434',
            model: 'qwen3.5:cloud',
            clientFactory: () => stub,
        });

        await provider.chat({
            messages: [{ role: 'user', content: 'найди билеты' }],
            tools: [
                {
                    name: 'search_flights',
                    description: 'Search',
                    parameters: { type: 'object' },
                },
            ],
        });

        expect(stub.chat).toHaveBeenCalledWith(
            expect.objectContaining({
                tools: [
                    {
                        type: 'function',
                        function: {
                            name: 'search_flights',
                            description: 'Search',
                            parameters: { type: 'object' },
                        },
                    },
                ],
            }),
        );
    });

    it('передаёт temperature через options', async () => {
        const stub = makeStub();
        const provider = new OllamaChatProvider({
            host: 'http://localhost:11434',
            model: 'qwen3.5:cloud',
            clientFactory: () => stub,
        });

        await provider.chat({
            messages: [{ role: 'user', content: 'x' }],
            temperature: 0.3,
        });

        expect(stub.chat).toHaveBeenCalledWith(
            expect.objectContaining({ options: { temperature: 0.3 } }),
        );
    });

    it('не добавляет options, если temperature не указан', async () => {
        const stub = makeStub();
        const provider = new OllamaChatProvider({
            host: 'http://localhost:11434',
            model: 'qwen3.5:cloud',
            clientFactory: () => stub,
        });

        await provider.chat({ messages: [{ role: 'user', content: 'x' }] });

        const callArg = stub.chat.mock.calls[0][0];
        expect(callArg.options).toBeUndefined();
    });

    it('маппит ответ в ChatResponse', async () => {
        const stub = makeStub();
        stub.chat.mockResolvedValue({
            message: {
                role: 'assistant',
                content: '',
                tool_calls: [
                    { function: { name: 'search_flights', arguments: { origin: 'MOW' } } },
                ],
            },
        });
        const provider = new OllamaChatProvider({
            host: 'http://localhost:11434',
            model: 'qwen3.5:cloud',
            clientFactory: () => stub,
        });

        const result = await provider.chat({
            messages: [{ role: 'user', content: 'x' }],
        });

        expect(result.message).toEqual({
            role: 'assistant',
            content: '',
            toolCalls: [
                { id: 'call_0', name: 'search_flights', arguments: { origin: 'MOW' } },
            ],
        });
    });

    it('пробрасывает ошибки от клиента', async () => {
        const stub = makeStub();
        stub.chat.mockRejectedValue(new Error('connection refused'));
        const provider = new OllamaChatProvider({
            host: 'http://localhost:11434',
            model: 'qwen3.5:cloud',
            clientFactory: () => stub,
        });

        await expect(
            provider.chat({ messages: [{ role: 'user', content: 'x' }] }),
        ).rejects.toThrow('connection refused');
    });

    it('сразу бросает AbortError, если signal уже aborted', async () => {
        const stub = makeStub();
        const provider = new OllamaChatProvider({
            host: 'http://localhost:11434',
            model: 'qwen3.5:cloud',
            clientFactory: () => stub,
        });
        const controller = new AbortController();
        controller.abort();

        await expect(
            provider.chat({
                messages: [{ role: 'user', content: 'x' }],
                signal: controller.signal,
            }),
        ).rejects.toThrow('Aborted');
        expect(stub.chat).not.toHaveBeenCalled();
    });

    it('вызывает abort() только на изолированном клиенте, не на shared', async () => {
        const stubs: Array<OllamaStub & { resolve: (v: { message: { role: string; content: string } }) => void }> = [];
        const factory = vi.fn((_host: string) => {
            let resolveChat: (v: { message: { role: string; content: string } }) => void = () => {};
            const chatPromise = new Promise<{ message: { role: string; content: string } }>(
                (resolve) => {
                    resolveChat = resolve;
                },
            );
            const chat = vi.fn<ChatFn>().mockReturnValue(chatPromise);
            const entry = { chat, abort: vi.fn<AbortFn>(), resolve: resolveChat };
            stubs.push(entry);
            return entry;
        });

        const provider = new OllamaChatProvider({
            host: 'http://localhost:11434',
            model: 'qwen3.5:cloud',
            clientFactory: factory,
        });

        const controller = new AbortController();
        const resultPromise = provider.chat({
            messages: [{ role: 'user', content: 'x' }],
            signal: controller.signal,
        });

        controller.abort();

        expect(stubs[0].abort).not.toHaveBeenCalled();
        expect(stubs[1].abort).toHaveBeenCalledOnce();

        stubs[1].resolve({ message: { role: 'assistant', content: 'ok' } });
        await resultPromise;
    });
});