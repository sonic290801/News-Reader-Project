import { prisma } from "@/lib/db";
import { Settings } from "@prisma/client";

export type UpdateSettingsData = Partial<
  Pick<
    Settings,
    "aiProvider" | "ollamaModel" | "geminiApiKey" | "summaryDepth" | "showAnalysis"
  >
>;

export async function getSettings(): Promise<Settings> {
  const existing = await prisma.settings.findUnique({
    where: { id: "singleton" },
  });
  if (existing) return existing;

  return prisma.settings.create({ data: { id: "singleton" } });
}

export async function updateSettings(data: UpdateSettingsData) {
  return prisma.settings.upsert({
    where: { id: "singleton" },
    update: data,
    create: { id: "singleton", ...data },
  });
}
