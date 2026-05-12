import { SummariseInput } from "./types";

export const SYSTEM_PROMPT = `You are a sharp, neutral news analyst. You read source material carefully and produce clear, factual summaries followed by concise analysis of significance and implications. Never speculate beyond what the sources support. Be direct — no filler phrases.`;

const DEPTH_INSTRUCTIONS = {
  brief: "Write 2-3 sentences only.",
  standard: "Write one focused paragraph.",
  deep: "Write 3 substantive paragraphs.",
};

export function buildPrompt(input: SummariseInput): string {
  const depthNote = DEPTH_INSTRUCTIONS[input.depth];

  if (input.type === "single") {
    const item = input.items[0];
    const datePart = item.publishedAt ? ` (${item.publishedAt})` : "";
    return [
      `Source: ${item.source} — ${item.title}${datePart}`,
      ``,
      item.content,
      ``,
      `---`,
      `${depthNote}`,
      ``,
      `SUMMARY:`,
      input.showAnalysis ? `\nANALYSIS:` : "",
    ]
      .filter((l) => l !== undefined)
      .join("\n");
  }

  if (input.type === "digest") {
    const numbered = input.items
      .map(
        (item, i) =>
          `${i + 1}. [${item.source}] ${item.title}\n${item.content.slice(0, 600)}`
      )
      .join("\n\n");

    return [
      `The following ${input.items.length} items were recently published:`,
      ``,
      numbered,
      ``,
      `---`,
      `Produce a coherent briefing that:`,
      `1. Groups related stories`,
      `2. Notes where sources agree or diverge`,
      `3. Highlights the 2-3 most significant developments`,
      input.showAnalysis
        ? `4. Gives a brief overall analysis of what this news means`
        : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (input.type === "chunkSynthesis") {
    const title = input.items[0]?.source ?? "this episode";
    const numbered = input.items
      .map((item, i) => `Segment ${i + 1}:\n${item.content}`)
      .join("\n\n");

    return [
      `The following are summaries of consecutive segments from: "${title}"`,
      ``,
      numbered,
      ``,
      `---`,
      `Synthesise these into:`,
      `OVERALL SUMMARY: [coherent episode overview, key topics covered]`,
      input.showAnalysis
        ? `\nANALYSIS: [key arguments made, what was significant, what to watch for]`
        : "",
    ]
      .filter((l) => l !== undefined)
      .join("\n");
  }

  if (input.type === "crossSource") {
    const numbered = input.items
      .map(
        (item, i) =>
          `${i + 1}. [${item.source}]\n${item.content.slice(0, 800)}`
      )
      .join("\n\n");

    return [
      `The following ${input.items.length} sources cover the same story:`,
      ``,
      numbered,
      ``,
      `---`,
      `Analyse how coverage differs across these sources:`,
      `- What facts do all sources agree on?`,
      `- Where do framing, emphasis, or omissions differ?`,
      `- Which source provides the most context?`,
      input.showAnalysis ? `- What does the difference in coverage reveal?` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  return input.items.map((i) => i.content).join("\n\n");
}
