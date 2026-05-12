import axios from "axios";
import RSSParser from "rss-parser";
import { Source } from "@prisma/client";
import { upsertItem } from "@/lib/db/items";
import { updateSourceHealth } from "@/lib/db/sources";
import { extractFullText } from "./readability";

type RedditItem = RSSParser.Item & {
  "media:thumbnail"?: { $?: { url?: string } };
};

const parser = new RSSParser<Record<string, unknown>, RedditItem>({
  customFields: {
    item: [["media:thumbnail", "media:thumbnail"]],
  },
});

const USER_AGENT = "NewsReader/1.0 (feed aggregator)";

// Reddit RSS URLs look like: https://www.reddit.com/r/worldnews/.rss
export async function fetchRedditFeed(source: Source): Promise<number> {
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

        // Reddit post links point to the Reddit discussion page.
        // item.content often contains the linked article URL in an <a> tag.
        // Extract the actual external article URL if present.
        const externalUrl = extractExternalLink(item.content ?? "") ?? item.link;
        const isExternalArticle = externalUrl !== item.link;

        let fullText: string | undefined;
        if (isExternalArticle) {
          const extracted = await extractFullText(externalUrl);
          fullText = extracted?.text;
        }

        const thumbnailUrl = item["media:thumbnail"]?.$?.url ?? undefined;

        await upsertItem({
          sourceId: source.id,
          type: "REDDIT_POST",
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
        console.error(`[reddit] failed to process item "${item.title}":`, err);
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

// Pull the first external href from Reddit's HTML content snippet
function extractExternalLink(html: string): string | null {
  const match = html.match(/href="(https?:\/\/(?!www\.reddit\.com)[^"]+)"/);
  return match?.[1] ?? null;
}
