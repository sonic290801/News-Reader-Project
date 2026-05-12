import { prisma } from "@/lib/db";
import { SummaryType } from "@prisma/client";

export type CreateSummaryData = {
  type: SummaryType;
  provider: string;
  model: string;
  summary: string;
  analysis?: string;
  itemIds: string[];
};

export async function getSummary(itemId: string) {
  return prisma.aISummary.findFirst({
    where: {
      type: "SINGLE",
      items: { some: { id: itemId } },
    },
    orderBy: { createdAt: "desc" },
    include: { items: { select: { id: true } } },
  });
}

export async function createSummary(data: CreateSummaryData) {
  const { itemIds, ...rest } = data;
  return prisma.aISummary.create({
    data: {
      ...rest,
      items: { connect: itemIds.map((id) => ({ id })) },
    },
  });
}

export async function linkItemsToSummary(summaryId: string, itemIds: string[]) {
  return prisma.aISummary.update({
    where: { id: summaryId },
    data: {
      items: { connect: itemIds.map((id) => ({ id })) },
    },
  });
}
