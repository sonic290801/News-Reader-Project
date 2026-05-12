import { prisma } from "@/lib/db";
import { fetchRssFeed } from "./rss";
import { fetchRedditFeed } from "./reddit";
import { fetchYouTubeFeed } from "./youtube";
import { fetchWebSource } from "./web";

export async function fetchAllSources(): Promise<void> {
  const sources = await prisma.source.findMany({ where: { enabled: true } });

  await Promise.allSettled(
    sources.map(async (source) => {
      try {
        if (source.type === "RSS") await fetchRssFeed(source);
        else if (source.type === "REDDIT") await fetchRedditFeed(source);
        else if (source.type === "YOUTUBE") await fetchYouTubeFeed(source);
        else if (source.type === "WEB") await fetchWebSource(source);
      } catch (err) {
        console.error(`[runner] source ${source.id} (${source.label}) failed:`, err);
      }
    })
  );
}
