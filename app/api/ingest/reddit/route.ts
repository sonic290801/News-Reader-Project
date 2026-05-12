import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fetchRedditFeed } from "@/lib/ingest/reddit";

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
  if (source.type !== "REDDIT") {
    return NextResponse.json({ error: "Source is not Reddit type" }, { status: 400 });
  }

  try {
    const count = await fetchRedditFeed(source);
    return NextResponse.json({ ok: true, newItems: count });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
