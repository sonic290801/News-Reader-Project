import { NextRequest, NextResponse } from "next/server";
import { getItems } from "@/lib/db/items";
import { ContentType } from "@prisma/client";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const isReadParam = sp.get("isRead");
  const isBookmarkedParam = sp.get("isBookmarked");

  const filters = {
    sourceId: sp.get("sourceId") ?? undefined,
    type: (sp.get("type") as ContentType) || undefined,
    isRead: isReadParam !== null ? isReadParam === "true" : undefined,
    isBookmarked: isBookmarkedParam !== null ? isBookmarkedParam === "true" : undefined,
    skip: parseInt(sp.get("skip") ?? "0"),
    take: parseInt(sp.get("take") ?? "50"),
  };

  try {
    const result = await getItems(filters);
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
