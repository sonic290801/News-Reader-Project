import { NextRequest, NextResponse } from "next/server";
import { getSources, createSource } from "@/lib/db/sources";
import { SourceType } from "@prisma/client";

export async function GET() {
  const sources = await getSources();
  return NextResponse.json(sources);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { type, url, channelId, label, category, fetchIntervalMinutes, autoFetchTranscript, selectorConfig } = body as {
    type: SourceType;
    url: string;
    channelId?: string;
    label: string;
    category?: string;
    fetchIntervalMinutes?: number;
    autoFetchTranscript?: boolean;
    selectorConfig?: string;
  };

  if (!type || !url || !label) {
    return NextResponse.json({ error: "type, url, and label are required" }, { status: 400 });
  }

  try {
    const source = await createSource({
      type,
      url,
      channelId,
      label,
      category,
      fetchIntervalMinutes,
      autoFetchTranscript,
    });

    // Store selectorConfig if provided (WEB sources)
    if (selectorConfig) {
      const { updateSource } = await import("@/lib/db/sources");
      await updateSource(source.id, {});
      // selectorConfig stored separately since it's not in CreateSourceData
      const { prisma } = await import("@/lib/db");
      await prisma.source.update({ where: { id: source.id }, data: { selectorConfig } });
    }

    return NextResponse.json(source, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
