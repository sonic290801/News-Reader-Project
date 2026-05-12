import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function DELETE() {
  await prisma.contentItem.deleteMany({ where: { isRead: true, isBookmarked: false } });
  return NextResponse.json({ ok: true });
}
