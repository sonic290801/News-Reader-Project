import { NextRequest } from "next/server";
import { getItem } from "@/lib/db/items";
import { getSettings } from "@/lib/db/settings";
import { createSummary } from "@/lib/db/summaries";
import { getProvider } from "@/lib/ai";
import { summariseLongContent } from "@/lib/ai/chunker";
import { SummariseInput } from "@/lib/ai/types";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { itemId, depth } = body as { itemId: string; depth?: string };

  if (!itemId) {
    return new Response(JSON.stringify({ error: "itemId is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const item = await getItem(itemId);
  if (!item) {
    return new Response(JSON.stringify({ error: "Item not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Return cached summary if available
  if (item.summaries.length > 0) {
    const cached = item.summaries[0];
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(`data: ${cached.summary}\n\n`);
        if (cached.analysis) {
          controller.enqueue(`data: \n\nANALYSIS:\n${cached.analysis}\n\n`);
        }
        controller.enqueue(`event: done\ndata: ${cached.id}\n\n`);
        controller.close();
      },
    });
    return new Response(stream, { headers: sseHeaders() });
  }

  let provider;
  try {
    provider = await getProvider();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "No AI provider available";
    return new Response(JSON.stringify({ error: msg }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  const settings = await getSettings();
  const resolvedDepth = (depth ?? settings.summaryDepth) as SummariseInput["depth"];

  const encoder = new TextEncoder();
  let fullText = "";

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const tokens = summariseLongContent(
          item as Parameters<typeof summariseLongContent>[0],
          provider,
          { ...settings, summaryDepth: resolvedDepth }
        );

        for await (const token of tokens) {
          fullText += token;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(token)}\n\n`));
        }

        // Parse and persist the completed summary
        const { summary, analysis } = parseSummaryText(fullText);
        const saved = await createSummary({
          type: "SINGLE",
          provider: provider.name,
          model: provider.name === "ollama" ? (settings.ollamaModel ?? "unknown") : "gemini-1.5-flash",
          summary,
          analysis,
          itemIds: [itemId],
        });

        controller.enqueue(
          encoder.encode(`event: done\ndata: ${saved.id}\n\n`)
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : "AI error";
        controller.enqueue(
          encoder.encode(`event: error\ndata: ${JSON.stringify(msg)}\n\n`)
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: sseHeaders() });
}

function sseHeaders() {
  return {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  };
}

function parseSummaryText(text: string): { summary: string; analysis?: string } {
  // Strip progress markers
  const clean = text.replace(/__PROGRESS__:[^\n]*\n/g, "").trim();

  const analysisIdx = clean.search(/\bANALYSIS\s*:/i);
  if (analysisIdx === -1) {
    return { summary: clean };
  }

  const summary = clean.slice(0, analysisIdx).replace(/^SUMMARY\s*:\s*/i, "").trim();
  const analysis = clean.slice(analysisIdx).replace(/^ANALYSIS\s*:\s*/i, "").trim();
  return { summary, analysis };
}
