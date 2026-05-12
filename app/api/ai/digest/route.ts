import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/db/settings";
import { createSummary } from "@/lib/db/summaries";
import { getProvider } from "@/lib/ai";
import { SummariseInput } from "@/lib/ai/types";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { itemIds, depth } = body as { itemIds: string[]; depth?: string };

  if (!itemIds?.length) {
    return new Response(JSON.stringify({ error: "itemIds is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const items = await prisma.contentItem.findMany({
    where: { id: { in: itemIds } },
    include: { source: { select: { label: true } } },
    orderBy: { publishedAt: "desc" },
  });

  if (items.length === 0) {
    return new Response(JSON.stringify({ error: "No items found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
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
        const input: SummariseInput = {
          type: "digest",
          depth: resolvedDepth,
          showAnalysis: settings.showAnalysis,
          items: items.map((item) => ({
            title: item.title,
            source: item.source.label,
            publishedAt: item.publishedAt?.toISOString().slice(0, 10),
            content: (item.fullText ?? item.excerpt ?? "").slice(0, 800),
          })),
        };

        for await (const token of provider.summarise(input)) {
          fullText += token;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(token)}\n\n`));
        }

        const saved = await createSummary({
          type: "DIGEST",
          provider: provider.name,
          model:
            provider.name === "ollama"
              ? (settings.ollamaModel ?? "unknown")
              : "gemini-1.5-flash",
          summary: fullText.trim(),
          itemIds,
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
