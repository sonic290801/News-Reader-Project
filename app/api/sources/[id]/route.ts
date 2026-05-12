import { NextRequest, NextResponse } from "next/server";
import { updateSource, deleteSource } from "@/lib/db/sources";
import { prisma } from "@/lib/db";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await request.json();
  const { selectorConfig, ...rest } = body;

  try {
    const source = await updateSource(params.id, rest);

    if (selectorConfig !== undefined) {
      await prisma.source.update({
        where: { id: params.id },
        data: { selectorConfig },
      });
    }

    return NextResponse.json(source);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await deleteSource(params.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
