# Agent: AI Engine

## Responsibility
Implement the AI abstraction layer: a single interface that accepts content and returns streamed summaries/analysis, backed by Ollama (primary) or Gemini (fallback). Handles long-transcript chunking and synthesis.

## Output
- `lib/ai/types.ts` — shared types and provider interface
- `lib/ai/ollama.ts` — Ollama provider
- `lib/ai/gemini.ts` — Gemini provider
- `lib/ai/index.ts` — provider factory + fallback logic
- `lib/ai/prompts.ts` — all prompt templates
- `lib/ai/chunker.ts` — transcript chunking + synthesis
- `app/api/ai/summarise/route.ts` — streaming summary endpoint
- `app/api/ai/digest/route.ts` — multi-item digest endpoint

## Dependencies to Install
```
ollama @google/generative-ai
```

## Provider Interface (lib/ai/types.ts)

```ts
export interface AIProvider {
  name: string
  summarise(input: SummariseInput): AsyncIterable<string>
  isAvailable(): Promise<boolean>
}

export interface SummariseInput {
  type: 'single' | 'digest' | 'crossSource' | 'chunkSynthesis'
  depth: 'brief' | 'standard' | 'deep'
  showAnalysis: boolean
  items: Array<{
    title: string
    source: string
    publishedAt?: string
    content: string   // fullText, transcript chunk, or excerpt
  }>
}

export interface SummariseOutput {
  summary: string
  analysis?: string
}
```

## Ollama Provider (lib/ai/ollama.ts)

```ts
// Uses the ollama npm package
// Base URL from env: OLLAMA_BASE_URL (default: http://localhost:11434)
// Model from env: OLLAMA_MODEL (default: qwen2.5:14b)

// summarise(input): AsyncIterable<string>
// - Build prompt from lib/ai/prompts.ts
// - Call ollama.chat({ model, messages, stream: true })
// - Yield each chunk.message.content as it arrives
// - Full response is streamed to the caller

// isAvailable(): Promise<boolean>
// - GET OLLAMA_BASE_URL/api/tags (Ollama health check)
// - Returns true if reachable and OLLAMA_MODEL is in the list
```

## Gemini Provider (lib/ai/gemini.ts)

```ts
// Uses @google/generative-ai
// API key from env: GEMINI_API_KEY
// Model: gemini-1.5-flash

// summarise(input): AsyncIterable<string>
// - Build prompt from lib/ai/prompts.ts
// - Use generateContentStream for streaming
// - Yield each chunk

// isAvailable(): Promise<boolean>
// - Returns true if GEMINI_API_KEY is set (non-empty)
```

## Provider Factory + Fallback (lib/ai/index.ts)

```ts
// getProvider(): Promise<AIProvider>
// 1. Load settings from DB (getSettings())
// 2. If settings.aiProvider === 'ollama' and ollama.isAvailable(): return OllamaProvider
// 3. Else if gemini.isAvailable(): return GeminiProvider (fallback)
// 4. Else throw Error('No AI provider available. Start Ollama or set GEMINI_API_KEY.')
```

## Prompt Templates (lib/ai/prompts.ts)

### System prompt (all types)
```
You are a sharp, neutral news analyst. You read source material carefully and produce
clear, factual summaries followed by concise analysis of significance and implications.
Never speculate beyond what the sources support. Be direct — no filler phrases.
```

### Single item prompt
```
[DEPTH: brief=2-3 sentences | standard=1 paragraph | deep=3 paragraphs]

Source: {source} — {title} ({publishedAt})

{content}

---
Produce:
SUMMARY: [neutral summary of what happened/was said]
{if showAnalysis}
ANALYSIS: [why this matters, context, implications]
{/if}
```

### Digest prompt (multiple items)
```
The following {n} items were published in the past {timeRange}:

{items: numbered list of title + content}

---
Produce a coherent briefing that:
1. Groups related stories
2. Notes where sources agree or diverge
3. Highlights the 2-3 most significant developments
{if showAnalysis}
4. Gives a brief overall analysis of what today's news means
{/if}
```

### Chunk synthesis prompt (used after chunking a long transcript)
```
The following are summaries of consecutive segments from a single episode titled "{title}":

{chunkSummaries: numbered list}

---
Synthesise these into:
OVERALL SUMMARY: [coherent episode overview, key topics covered]
{if showAnalysis}
ANALYSIS: [key arguments made, what was significant, what to watch for]
{/if}
```

## Transcript Chunking (lib/ai/chunker.ts)

```ts
// summariseLongContent(item: ContentItem, provider: AIProvider, settings: Settings)
//   : AsyncIterable<string>
//
// If item.transcript.length < 12000 words: summarise directly (fits in context)
// Else:
//   1. Split transcript into chunks via chunkTranscript() from youtube ingest agent
//   2. Summarise each chunk individually (type: 'single', depth: 'brief')
//   3. Collect all chunk summaries
//   4. Run a final synthesis pass (type: 'chunkSynthesis') over the collected summaries
//   5. Stream the final synthesis output to the caller
//   Emit progress events between chunks so the UI can show "Summarising part 2 of 4..."
```

## API Routes

### app/api/ai/summarise/route.ts
- POST `{ itemId: string, depth?: string }`
- Server-Sent Events (SSE) streaming response
- Calls getProvider(), then provider.summarise()
- Saves completed summary to DB via createSummary()
- Returns streamed text chunks + a final `[DONE]` event with the saved summary ID

### app/api/ai/digest/route.ts
- POST `{ itemIds: string[], depth?: string }`
- Same SSE streaming pattern
- Collects all items, builds digest prompt, streams result

## Acceptance Criteria
- Calling /api/ai/summarise for a news article streams a summary and analysis back to the client
- Calling /api/ai/summarise for a YouTube episode with a long transcript triggers chunked processing with progress updates
- If Ollama is not running, automatically falls back to Gemini (if key is set)
- If neither provider is available, returns a clear error message (not a crash)
- Completed summaries are persisted in DB and returned on subsequent requests without re-running AI

## Dependencies on Other Agents
- Database (02) — needs getSettings, createSummary, getItem
- YouTube Ingest (04) — reuses chunkTranscript helper
- Scaffold (01) — project must exist
