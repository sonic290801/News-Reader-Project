import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fetchWebSource } from "@/lib/ingest/web";

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
  if (source.type !== "WEB") {
    return NextResponse.json({ error: "Source is not WEB type" }, { status: 400 });
  }

  try {
    const newItems = await fetchWebSource(source);
    return NextResponse.json({ ok: true, newItems });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
