import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fetchYouTubeFeed } from "@/lib/ingest/youtube";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { sourceId } = body as { sourceId: string };

  if (!sourceId) {
    return NextResponse.json({ error: "sourceId is required" }, { status: 400 });
  }

  const source = await prisma.source.findUnique({ where: { id: sourceId } });
  if (!source) {
    return NextResponse.json({ error: "Source not found" }, { status: 404 });
  }
  if (source.type !== "YOUTUBE") {
    return NextResponse.json({ error: "Source is not YouTube type" }, { status: 400 });
  }

  try {
    const result = await fetchYouTubeFeed(source);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
