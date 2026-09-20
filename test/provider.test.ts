import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createCompatible } = vi.hoisted(() => ({
  createCompatible: vi.fn(),
}));

vi.mock('@ai-sdk/openai-compatible', () => ({
  createOpenAICompatible: createCompatible,
}));

describe('Lanseq provider', () => {
  beforeEach(() => {
    vi.resetModules();
    createCompatible.mockReset();
    createCompatible.mockImplementation((options: { name: string }) => {
      const provider = vi.fn((modelId: string) => ({
        provider: `${options.name}.chat`,
        modelId,
        specificationVersion: 'v4',
      }));
      return Object.assign(provider, {
        languageModel: provider,
        chatModel: provider,
      });
    });
    delete process.env.LANSEQ_API_KEY;
  });

  it('uses the production endpoint and Lanseq provider identity by default', async () => {
    const { createLanseq, LANSEQ_DEFAULT_BASE_URL } = await import('../src/index.js');
    const provider = createLanseq({ apiKey: 'test-key' });
    const model = provider('qwen3.8-27b-int4');

    expect(createCompatible).toHaveBeenLastCalledWith(
      expect.objectContaining({
        name: 'lanseq',
        baseURL: LANSEQ_DEFAULT_BASE_URL,
        apiKey: 'test-key',
      }),
    );
    expect(model).toMatchObject({
      provider: 'lanseq.chat',
      modelId: 'qwen3.8-27b-int4',
      specificationVersion: 'v4',
    });
  });

  it('forwards custom endpoint, headers, and fetch without wrapping them', async () => {
    const customFetch = vi.fn();
    const headers = { 'x-request-source': 'test' };
    const { createLanseq } = await import('../src/index.js');

    createLanseq({
      apiKey: 'explicit-key',
      baseURL: 'https://example.test/openai/',
      headers,
      fetch: customFetch,
    });

    expect(createCompatible).toHaveBeenLastCalledWith({
      name: 'lanseq',
      baseURL: 'https://example.test/openai',
      apiKey: 'explicit-key',
      headers,
      fetch: customFetch,
      includeUsage: true,
      supportsStructuredOutputs: true,
    });
  });

  it('reads LANSEQ_API_KEY and lets an explicit key take precedence', async () => {
    process.env.LANSEQ_API_KEY = 'environment-key';
    const { createLanseq } = await import('../src/index.js');

    createLanseq();
    expect(createCompatible).toHaveBeenLastCalledWith(
      expect.objectContaining({ apiKey: 'environment-key' }),
    );

    createLanseq({ apiKey: 'explicit-key' });
    expect(createCompatible).toHaveBeenLastCalledWith(
      expect.objectContaining({ apiKey: 'explicit-key' }),
    );
  });

  it('exposes languageModel and chatModel delegation from the adapter', async () => {
    const { createLanseq } = await import('../src/index.js');
    const provider = createLanseq({ apiKey: 'test-key' });

    expect(provider.languageModel('first')).toMatchObject({ modelId: 'first' });
    expect(provider.chatModel('second')).toMatchObject({ modelId: 'second' });
  });

  it('exports a convenient default provider', async () => {
    const { lanseq } = await import('../src/index.js');
    expect(lanseq).toBeTypeOf('function');
    expect(lanseq('qwen3.8-27b-int4')).toMatchObject({
      modelId: 'qwen3.8-27b-int4',
    });
  });
});
