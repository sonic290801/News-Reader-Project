import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { markBookmarked } from "@/lib/db/items";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const item = await prisma.contentItem.findUnique({
    where: { id: params.id },
    include: { source: { select: { label: true, type: true } } },
  });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(item);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await request.json();
  try {
    if (body.isRead !== undefined) {
      await prisma.contentItem.update({
        where: { id: params.id },
        data: { isRead: body.isRead },
      });
    }
    if (body.isBookmarked !== undefined) {
      await markBookmarked(params.id, body.isBookmarked);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
