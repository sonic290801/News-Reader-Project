import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const alerts = await prisma.keywordAlert.findMany({
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(alerts);
}

export async function POST(request: NextRequest) {
  const { keyword } = await request.json();
  if (!keyword?.trim()) {
    return NextResponse.json({ error: "keyword is required" }, { status: 400 });
  }
  try {
    const alert = await prisma.keywordAlert.create({
      data: { keyword: keyword.trim().toLowerCase() },
    });
    return NextResponse.json(alert);
  } catch {
    return NextResponse.json({ error: "Keyword already exists" }, { status: 409 });
  }
}
