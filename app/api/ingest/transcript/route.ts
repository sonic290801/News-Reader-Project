import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { extractVideoId, fetchTranscript } from "@/lib/ingest/youtube";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { itemId } = body as { itemId: string };

  if (!itemId) {
    return NextResponse.json({ error: "itemId is required" }, { status: 400 });
  }

  const item = await prisma.contentItem.findUnique({ where: { id: itemId } });
  if (!item) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }
  if (item.type !== "YOUTUBE_EPISODE") {
    return NextResponse.json({ error: "Item is not a YouTube episode" }, { status: 400 });
  }

  const videoId = extractVideoId(item.url);
  if (!videoId) {
    return NextResponse.json({ ok: false, reason: "Could not extract video ID from URL" }, { status: 400 });
  }

  const transcript = await fetchTranscript(videoId);
  if (!transcript) {
    return NextResponse.json({ ok: false, reason: "Transcript unavailable — video may have no captions" });
  }

  await prisma.contentItem.update({
    where: { id: itemId },
    data: { transcript },
  });

  const wordCount = transcript.split(/\s+/).length;
  return NextResponse.json({ ok: true, wordCount });
}
