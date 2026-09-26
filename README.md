# Lanseq AI SDK Provider

Official Vercel AI SDK provider for [Lanseq](https://lanseq.cloud) — inference infrastructure for open models.

`@lanseq/ai-sdk-provider` connects the [Vercel AI SDK](https://ai-sdk.dev/) to Lanseq's OpenAI-compatible inference API. It is built on the official `@ai-sdk/openai-compatible` provider and is intended for production API and agent workloads.

The current qualified production model is `qwen3.8-27b-int4`.

## Installation

```sh
npm install @lanseq/ai-sdk-provider ai
```

Set your API key in a server-side environment:

```sh
export LANSEQ_API_KEY="your-api-key"
```

Never expose an API key in browser code. Lanseq does not use customer data to train models.

## Quick start

```ts
import { generateText } from 'ai';
import { lanseq } from '@lanseq/ai-sdk-provider';

const { text } = await generateText({
  model: lanseq('qwen3.8-27b-int4'),
  prompt: 'Explain speculative decoding in two paragraphs.',
});

console.log(text);
```

## Create a provider

```ts
import { createLanseq } from '@lanseq/ai-sdk-provider';

const lanseq = createLanseq({
  apiKey: process.env.LANSEQ_API_KEY,
});

const model = lanseq('qwen3.8-27b-int4');
```

For Node.js applications, the exported default provider reads `LANSEQ_API_KEY`:

```ts
import { lanseq } from '@lanseq/ai-sdk-provider';

const model = lanseq('qwen3.8-27b-int4');
```

## Streaming

```ts
import { streamText } from 'ai';
import { lanseq } from '@lanseq/ai-sdk-provider';

const result = streamText({
  model: lanseq('qwen3.8-27b-int4'),
  prompt: 'Write a short story about a compiler.',
});

for await (const chunk of result.textStream) {
  process.stdout.write(chunk);
}
```

## Tool calling

```ts
import { generateText, tool } from 'ai';
import { z } from 'zod';
import { lanseq } from '@lanseq/ai-sdk-provider';

const result = await generateText({
  model: lanseq('qwen3.8-27b-int4'),
  prompt: 'What is the weather in Paris?',
  tools: {
    getWeather: tool({
      description: 'Get the weather for a city',
      inputSchema: z.object({ city: z.string() }),
      execute: async ({ city }) => ({ city, temperatureCelsius: 18 }),
    }),
  },
});
```

Install `zod` if you use this example.

## Structured output

Lanseq has qualified schema-backed structured output. With the current AI SDK, request it through `Output.object`:

```ts
import { generateText, Output } from 'ai';
import { z } from 'zod';
import { lanseq } from '@lanseq/ai-sdk-provider';

const { output } = await generateText({
  model: lanseq('qwen3.8-27b-int4'),
  prompt: 'Describe three benefits of batching inference requests.',
  output: Output.object({
    schema: z.object({ benefits: z.array(z.string()).length(3) }),
  }),
});
```

This package does not claim generic `json_object` support; use schema-backed structured output.

## Custom endpoint and request options

```ts
const lanseq = createLanseq({
  apiKey: process.env.LANSEQ_API_KEY,
  baseURL: 'https://your-gateway.example/v1',
  headers: { 'x-tenant-id': 'example' },
  fetch: instrumentedFetch,
});
```

## Model and capability notes

| Model | Context | Maximum output | Modalities |
| --- | ---: | ---: | --- |
| `qwen3.8-27b-int4` | 70,000 tokens | 8,192 tokens | Text input and output |

- Production API: `https://api.lanseq.cloud/v1`
- [API documentation](https://api.lanseq.cloud/docs)
- Streaming, usage accounting, tools/function calling, and schema-backed structured output are supported through the OpenAI-compatible API.
- The live endpoint emits reasoning data and supports Lanseq's qualified reasoning behavior.
- Do not send images or attachments to `qwen3.8-27b-int4`; it is text-only.

Current published pricing for `qwen3.8-27b-int4` is $0.25 per million input tokens and $1.99 per million output tokens. Check Lanseq documentation for current pricing before making purchasing decisions.

## About Lanseq

Lanseq provides inference infrastructure for open models, with a focus on reliable capacity, OpenAI-compatible access, agent workloads, and production routing.

## Official links

- Website: https://lanseq.cloud
- API: https://api.lanseq.cloud/v1
- Documentation: https://api.lanseq.cloud/docs
- GitHub: https://github.com/Lanseqcloud
- X: https://x.com/lanseqcloud
- Privacy: https://lanseq.cloud/privacy
- Terms: https://lanseq.cloud/terms

## License

Apache-2.0. See [LICENSE](./LICENSE).
