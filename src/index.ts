import {
  createOpenAICompatible,
  type OpenAICompatibleProviderSettings,
} from '@ai-sdk/openai-compatible';

export const LANSEQ_DEFAULT_BASE_URL = 'https://api.lanseq.cloud/v1';

export type LanseqProvider = ReturnType<typeof createOpenAICompatible>;

export interface LanseqProviderSettings {
  /** Lanseq API key. Defaults to LANSEQ_API_KEY when running in Node.js. */
  apiKey?: string;
  /** API base URL, without a trailing slash. */
  baseURL?: string;
  /** Additional headers sent with every request. */
  headers?: OpenAICompatibleProviderSettings['headers'];
  /** Custom fetch implementation, useful for proxies, testing, and tracing. */
  fetch?: OpenAICompatibleProviderSettings['fetch'];
}

function readApiKey(): string | undefined {
  // Avoid a dependency on Node types and remain safe in browsers and edge runtimes.
  const processLike = (globalThis as {
    process?: { env?: Record<string, string | undefined> };
  }).process;
  return processLike?.env?.LANSEQ_API_KEY;
}

/** Create a Lanseq provider backed by the official OpenAI-compatible adapter. */
export function createLanseq(
  settings: LanseqProviderSettings = {},
): LanseqProvider {
  const apiKey = settings.apiKey ?? readApiKey();
  return createOpenAICompatible({
    name: 'lanseq',
    baseURL: (settings.baseURL ?? LANSEQ_DEFAULT_BASE_URL).replace(/\/$/, ''),
    ...(apiKey === undefined ? {} : { apiKey }),
    ...(settings.headers === undefined ? {} : { headers: settings.headers }),
    ...(settings.fetch === undefined ? {} : { fetch: settings.fetch }),
    // Lanseq's qualified chat endpoint supports OpenAI json_schema structured output.
    supportsStructuredOutputs: true,
    // Request usage in streaming responses so AI SDK can expose final token accounting.
    includeUsage: true,
  });
}

/** Default Lanseq provider. It reads LANSEQ_API_KEY in Node.js environments. */
export const lanseq = createLanseq();
