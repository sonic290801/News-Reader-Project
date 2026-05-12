import { prisma } from "@/lib/db";
import { ContentType, Prisma } from "@prisma/client";

export type ItemFilters = {
  sourceId?: string;
  type?: ContentType;
  isRead?: boolean;
  isBookmarked?: boolean;
  dateFrom?: Date;
  dateTo?: Date;
  skip?: number;
  take?: number;
};

export type UpsertItemData = {
  sourceId: string;
  type: ContentType;
  url: string;
  title: string;
  author?: string;
  publishedAt?: Date;
  excerpt?: string;
  fullText?: string;
  transcript?: string;
  thumbnailUrl?: string;
  durationSeconds?: number;
};

export async function getItems(filters: ItemFilters = {}) {
  const {
    sourceId,
    type,
    isRead,
    isBookmarked,
    dateFrom,
    dateTo,
    skip = 0,
    take = 50,
  } = filters;

  const where: Prisma.ContentItemWhereInput = {
    ...(sourceId && { sourceId }),
    ...(type && { type }),
    ...(isRead !== undefined && { isRead }),
    ...(isBookmarked !== undefined && { isBookmarked }),
    ...(dateFrom || dateTo
      ? {
          publishedAt: {
            ...(dateFrom && { gte: dateFrom }),
            ...(dateTo && { lte: dateTo }),
          },
        }
      : {}),
  };

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

  return { items, total, hasMore: skip + take < total };
}

export async function getItem(id: string) {
  return prisma.contentItem.findUnique({
    where: { id },
    include: {
      source: true,
      summaries: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
}

export async function upsertItem(data: UpsertItemData) {
  const { url, ...rest } = data;
  return prisma.contentItem.upsert({
    where: { url },
    update: {
      title: rest.title,
      author: rest.author,
      publishedAt: rest.publishedAt,
      excerpt: rest.excerpt,
      ...(rest.fullText && { fullText: rest.fullText }),
      ...(rest.transcript && { transcript: rest.transcript }),
      thumbnailUrl: rest.thumbnailUrl,
      durationSeconds: rest.durationSeconds,
    },
    create: { url, ...rest },
  });
}

export async function markRead(id: string) {
  return prisma.contentItem.update({ where: { id }, data: { isRead: true } });
}

export async function markBookmarked(id: string, value: boolean) {
  return prisma.contentItem.update({
    where: { id },
    data: { isBookmarked: value },
  });
}

export async function getUnreadCount() {
  return prisma.contentItem.count({ where: { isRead: false } });
}

export async function deleteOldItems(retentionDays: number) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);
  return prisma.contentItem.deleteMany({
    where: {
      isBookmarked: false,
      fetchedAt: { lt: cutoff },
    },
  });
}
