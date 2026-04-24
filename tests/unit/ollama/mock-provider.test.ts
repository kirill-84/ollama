import { describe, it, expect, vi } from 'vitest';
import { MockChatProvider } from '@/lib/ollama/mock-provider';
import type { ChatRequest, ChatMessage, ChatResponse } from '@/lib/ollama/types';

const user = (content: string): ChatMessage => ({ role: 'user', content });
const assistant = (content: string): ChatResponse => ({
  message: { role: 'assistant', content },
});

describe('MockChatProvider', () => {
  it('возвращает ответ первого подошедшего правила', async () => {
    const provider = new MockChatProvider(
      [
        {
          match: (req) => req.messages.at(-1)?.content.includes('привет') ?? false,
          respond: () => assistant('Здравствуйте!'),
        },
      ],
      () => assistant('fallback'),
    );

    const response = await provider.chat({ messages: [user('привет')] });

    expect(response.message.content).toBe('Здравствуйте!');
  });

  it('при нескольких подходящих правилах выигрывает первое', async () => {
    const provider = new MockChatProvider(
      [
        { match: () => true, respond: () => assistant('first') },
        { match: () => true, respond: () => assistant('second') },
      ],
      () => assistant('fallback'),
    );

    const response = await provider.chat({ messages: [user('x')] });

    expect(response.message.content).toBe('first');
  });

  it('передаёт исходный запрос в respond-колбэк', async () => {
    const respond = vi.fn(() => assistant('ok'));
    const provider = new MockChatProvider(
      [{ match: () => true, respond }],
      () => assistant('fallback'),
    );
    const request: ChatRequest = { messages: [user('test')], temperature: 0.5 };

    await provider.chat(request);

    expect(respond).toHaveBeenCalledWith(request);
  });

  it('вызывает fallback, если ни одно правило не подошло', async () => {
    const provider = new MockChatProvider(
      [{ match: () => false, respond: () => assistant('never') }],
      () => assistant('fallback response'),
    );

    const response = await provider.chat({ messages: [user('test')] });

    expect(response.message.content).toBe('fallback response');
  });

  it('поддерживает ответы с tool_calls', async () => {
    const provider = new MockChatProvider(
      [
        {
          match: (req) => req.tools?.some((t) => t.name === 'search_flights') ?? false,
          respond: () => ({
            message: {
              role: 'assistant',
              content: '',
              toolCalls: [
                {
                  id: 'call_1',
                  name: 'search_flights',
                  arguments: { origin: 'MOW', destination: 'CMB' },
                },
              ],
            },
          }),
        },
      ],
      () => assistant('fallback'),
    );

    const response = await provider.chat({
      messages: [user('найди билеты')],
      tools: [
        {
          name: 'search_flights',
          description: 'Search flights',
          parameters: { type: 'object' },
        },
      ],
    });

    expect(response.message.toolCalls).toEqual([
      {
        id: 'call_1',
        name: 'search_flights',
        arguments: { origin: 'MOW', destination: 'CMB' },
      },
    ]);
  });

  it('позволяет stateful-ответы через замыкание', async () => {
    const sequence = ['first', 'second', 'third'];
    let i = 0;
    const provider = new MockChatProvider(
      [{ match: () => true, respond: () => assistant(sequence[i++]) }],
      () => assistant('fallback'),
    );

    const r1 = await provider.chat({ messages: [user('1')] });
    const r2 = await provider.chat({ messages: [user('2')] });
    const r3 = await provider.chat({ messages: [user('3')] });

    expect([r1.message.content, r2.message.content, r3.message.content])
      .toEqual(['first', 'second', 'third']);
  });
});