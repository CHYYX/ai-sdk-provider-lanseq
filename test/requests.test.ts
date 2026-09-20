import { generateText, jsonSchema, Output, streamText, tool } from 'ai';
import { describe, expect, it, vi } from 'vitest';
import { createLanseq } from '../src/index.js';

const completion = (message: Record<string, unknown>, usage = {
  prompt_tokens: 11,
  completion_tokens: 4,
  total_tokens: 15,
}) => ({
  id: 'chatcmpl_test',
  object: 'chat.completion',
  created: 1,
  model: 'qwen3.8-27b-int4',
  choices: [{ index: 0, message: { role: 'assistant', ...message }, finish_reason: 'stop' }],
  usage,
});

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('OpenAI-compatible request delegation', () => {
  it('generates text and preserves token usage', async () => {
    const fetch = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => jsonResponse(completion({ content: 'hello' })));
    const result = await generateText({
      model: createLanseq({ apiKey: 'secret', fetch })('qwen3.8-27b-int4'),
      prompt: 'Say hello',
    });

    expect(result.text).toBe('hello');
    expect(result.usage).toMatchObject({ inputTokens: 11, outputTokens: 4 });
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe('https://api.lanseq.cloud/v1/chat/completions');
    expect(new Headers(init?.headers).get('authorization')).toBe('Bearer secret');
  });

  it('streams text and usage from SSE chunks', async () => {
    const events = [
      { id: '1', object: 'chat.completion.chunk', created: 1, model: 'qwen3.8-27b-int4', choices: [{ index: 0, delta: { role: 'assistant', content: 'Hi' }, finish_reason: null }] },
      { id: '1', object: 'chat.completion.chunk', created: 1, model: 'qwen3.8-27b-int4', choices: [{ index: 0, delta: { content: '!' }, finish_reason: 'stop' }], usage: { prompt_tokens: 2, completion_tokens: 2, total_tokens: 4 } },
    ];
    const body = events.map(event => `data: ${JSON.stringify(event)}\n\n`).join('') + 'data: [DONE]\n\n';
    const fetch = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(body, {
      headers: { 'content-type': 'text/event-stream' },
    }));

    const result = streamText({
      model: createLanseq({ apiKey: 'secret', fetch })('qwen3.8-27b-int4'),
      prompt: 'Greet me',
    });
    let text = '';
    for await (const part of result.textStream) text += part;

    expect(text).toBe('Hi!');
    expect(await result.usage).toMatchObject({ inputTokens: 2, outputTokens: 2 });
    const request = JSON.parse(String(fetch.mock.calls[0]![1]?.body));
    expect(request).toMatchObject({ stream: true, stream_options: { include_usage: true } });
  });

  it('serializes tools as OpenAI functions', async () => {
    const fetch = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => jsonResponse(completion({ content: 'sunny' })));
    await generateText({
      model: createLanseq({ apiKey: 'secret', fetch })('qwen3.8-27b-int4'),
      prompt: 'Weather?',
      tools: {
        weather: tool({
          description: 'Read the weather',
          inputSchema: jsonSchema<{ city: string }>({
            type: 'object', properties: { city: { type: 'string' } }, required: ['city'],
          }),
        }),
      },
    });

    const request = JSON.parse(String(fetch.mock.calls[0]![1]?.body));
    expect(request.tools[0]).toMatchObject({
      type: 'function',
      function: { name: 'weather', description: 'Read the weather' },
    });
  });

  it('requests schema-backed structured output', async () => {
    const fetch = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => jsonResponse(completion({ content: '{"answer":42}' })));
    const result = await generateText({
      model: createLanseq({ apiKey: 'secret', fetch })('qwen3.8-27b-int4'),
      prompt: 'The answer?',
      output: Output.object({
        schema: jsonSchema<{ answer: number }>({
          type: 'object', properties: { answer: { type: 'number' } }, required: ['answer'],
        }),
      }),
    });

    expect(result.output).toEqual({ answer: 42 });
    const request = JSON.parse(String(fetch.mock.calls[0]![1]?.body));
    expect(request.response_format).toMatchObject({
      type: 'json_schema',
      json_schema: { schema: expect.objectContaining({ type: 'object' }) },
    });
  });

  it('propagates HTTP errors and abort signals', async () => {
    const errorFetch = vi.fn(async () => jsonResponse({ error: { message: 'upstream failed' } }, 500));
    await expect(generateText({
      model: createLanseq({ apiKey: 'secret', fetch: errorFetch })('qwen3.8-27b-int4'),
      prompt: 'fail',
    })).rejects.toThrow();

    const abortFetch = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.signal?.aborted).toBe(true);
      throw new DOMException('Aborted', 'AbortError');
    });
    const controller = new AbortController();
    controller.abort();
    await expect(generateText({
      model: createLanseq({ apiKey: 'secret', fetch: abortFetch })('qwen3.8-27b-int4'),
      prompt: 'stop',
      abortSignal: controller.signal,
    })).rejects.toThrow();
  });
});
