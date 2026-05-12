import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { markBookmarked } from "@/lib/db/items";

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
