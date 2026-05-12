import { ContentItem, Settings } from "@prisma/client";
import { AIProvider, SummariseInput } from "./types";
import { chunkTranscript } from "@/lib/ingest/youtube";

const DIRECT_WORD_LIMIT = 12000;

// Yields SSE-compatible strings. Progress markers use the format:
// "__PROGRESS__:Summarising part 2 of 4…"
// so the UI can display them without polluting the summary text.
export async function* summariseLongContent(
  item: ContentItem & { source: { label: string } },
  provider: AIProvider,
  settings: Settings
): AsyncIterable<string> {
  const content = item.transcript ?? item.fullText ?? item.excerpt ?? "";
  const wordCount = content.split(/\s+/).length;
  const showAnalysis = settings.showAnalysis;
  const depth = (settings.summaryDepth as SummariseInput["depth"]) ?? "standard";

  // Short enough to summarise directly
  if (wordCount <= DIRECT_WORD_LIMIT) {
    yield* provider.summarise({
      type: "single",
      depth,
      showAnalysis,
      items: [
        {
          title: item.title,
          source: item.source.label,
          publishedAt: item.publishedAt?.toISOString().slice(0, 10),
          content,
        },
      ],
    });
    return;
  }

  // Long content — chunk, summarise each, then synthesise
  const chunks = chunkTranscript(content);
  const chunkSummaries: string[] = [];

  for (let i = 0; i < chunks.length; i++) {
    yield `__PROGRESS__:Summarising part ${i + 1} of ${chunks.length}…\n`;

    let chunkSummary = "";
    for await (const token of provider.summarise({
      type: "single",
      depth: "brief",
      showAnalysis: false,
      items: [
        {
          title: `${item.title} — part ${i + 1}`,
          source: item.source.label,
          content: chunks[i],
        },
      ],
    })) {
      chunkSummary += token;
    }
    chunkSummaries.push(chunkSummary);
  }

  yield `__PROGRESS__:Synthesising…\n`;

  // Final synthesis pass — stream this to the caller
  yield* provider.summarise({
    type: "chunkSynthesis",
    depth,
    showAnalysis,
    items: chunkSummaries.map((summary, i) => ({
      title: `Part ${i + 1}`,
      source: item.title,
      content: summary,
    })),
  });
}
