import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const q = sp.get("q")?.trim() ?? "";
  const sourceId = sp.get("sourceId") || undefined;
  const skip = parseInt(sp.get("skip") ?? "0");
  const take = Math.min(parseInt(sp.get("take") ?? "30"), 100);

  if (!q) {
    return NextResponse.json({ items: [], total: 0, hasMore: false });
  }

  const where: Prisma.ContentItemWhereInput = {
    AND: [
      {
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { excerpt: { contains: q, mode: "insensitive" } },
          { fullText: { contains: q, mode: "insensitive" } },
          { transcript: { contains: q, mode: "insensitive" } },
          { author: { contains: q, mode: "insensitive" } },
        ],
      },
      ...(sourceId ? [{ sourceId }] : []),
    ],
  };

  try {
    const [items, total] = await Promise.all([
      prisma.contentItem.findMany({
        where,
        orderBy: { publishedAt: "desc" },
        skip,
        take,
        include: { source: { select: { label: true, type: true } } },
      }),
      prisma.contentItem.count({ where }),
    ]);
    return NextResponse.json({ items, total, hasMore: skip + take < total });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
