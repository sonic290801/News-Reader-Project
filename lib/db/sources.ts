import { prisma } from "@/lib/db";
import { Source, SourceType } from "@prisma/client";

export type CreateSourceData = {
  type: SourceType;
  url: string;
  channelId?: string;
  label: string;
  category?: string;
  fetchIntervalMinutes?: number;
  autoFetchTranscript?: boolean;
};

export type UpdateSourceData = Partial<
  Pick<
    Source,
    | "label"
    | "category"
    | "fetchIntervalMinutes"
    | "autoFetchTranscript"
    | "enabled"
  >
>;

export async function getSources() {
  return prisma.source.findMany({
    orderBy: { label: "asc" },
    include: {
      _count: { select: { items: true } },
    },
  });
}

export async function getSource(id: string) {
  return prisma.source.findUnique({
    where: { id },
    include: {
      _count: { select: { items: true } },
    },
  });
}

export async function createSource(data: CreateSourceData) {
  return prisma.source.create({ data });
}

export async function updateSource(id: string, data: UpdateSourceData) {
  return prisma.source.update({ where: { id }, data });
}

export async function deleteSource(id: string) {
  return prisma.source.delete({ where: { id } });
}

export async function updateSourceHealth(
  id: string,
  result: { success: true } | { success: false; error: string }
) {
  if (result.success) {
    return prisma.source.update({
      where: { id },
      data: { lastFetchedAt: new Date(), lastErrorAt: null, lastErrorMsg: null },
    });
  } else {
    return prisma.source.update({
      where: { id },
      data: { lastErrorAt: new Date(), lastErrorMsg: result.error },
    });
  }
}
