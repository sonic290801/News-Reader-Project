import axios from "axios";
import RSSParser from "rss-parser";
import { Source } from "@prisma/client";
import { upsertItem } from "@/lib/db/items";
import { updateSourceHealth } from "@/lib/db/sources";
import { extractFullText } from "./readability";

type FeedItem = RSSParser.Item & {
  "media:thumbnail"?: { $?: { url?: string } };
  "media:content"?: { $?: { url?: string } };
};

const parser = new RSSParser<Record<string, unknown>, FeedItem>({
  customFields: {
    item: [
      ["media:thumbnail", "media:thumbnail"],
      ["media:content", "media:content"],
    ],
  },
});

const USER_AGENT = "NewsReader/1.0 (feed aggregator)";

export async function fetchRssFeed(source: Source): Promise<number> {
  try {
    const { data: xml } = await axios.get<string>(source.url, {
      timeout: 10000,
      headers: { "User-Agent": USER_AGENT },
      responseType: "text",
    });

    const feed = await parser.parseString(xml);
    let newCount = 0;

    for (const item of feed.items) {
      try {
        if (!item.link || !item.title) continue;

        const hasFullContent = !!(item.content && item.content.length > 500);
        let fullText: string | undefined;

        if (!hasFullContent && item.link) {
          const extracted = await extractFullText(item.link);
          fullText = extracted?.text;
        } else {
          fullText = item.content ?? undefined;
        }

        const thumbnailUrl =
          item["media:thumbnail"]?.$?.url ??
          item["media:content"]?.$?.url ??
          undefined;

        await upsertItem({
          sourceId: source.id,
          type: "ARTICLE",
          url: item.link,
          title: item.title,
          author: item.creator ?? undefined,
          publishedAt: item.isoDate ? new Date(item.isoDate) : undefined,
          excerpt: item.contentSnippet?.slice(0, 500) ?? undefined,
          fullText,
          thumbnailUrl,
        });

        newCount++;
      } catch (err) {
        console.error(`[rss] failed to process item "${item.title}":`, err);
      }
    }

    await updateSourceHealth(source.id, { success: true });
    return newCount;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await updateSourceHealth(source.id, { success: false, error: msg });
    throw err;
  }
}
