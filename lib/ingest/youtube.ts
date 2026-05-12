import axios from "axios";
import RSSParser from "rss-parser";
import { YoutubeTranscript } from "youtube-transcript";
import { Source } from "@prisma/client";
import { upsertItem } from "@/lib/db/items";
import { updateSourceHealth } from "@/lib/db/sources";
import { prisma } from "@/lib/db";

type YTFeedItem = RSSParser.Item & {
  "yt:videoId"?: string;
  "media:group"?: {
    "media:thumbnail"?: Array<{ $?: { url?: string } }>;
    "media:description"?: string[];
  };
};

const parser = new RSSParser<Record<string, unknown>, YTFeedItem>({
  customFields: {
    item: [
      ["yt:videoId", "yt:videoId"],
      ["media:group", "media:group"],
    ],
  },
});

const USER_AGENT = "NewsReader/1.0 (feed aggregator)";

// ── Video ID helpers ─────────────────────────────────────────────────────────

export function extractVideoId(url: string): string | null {
  const patterns = [
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// ── Transcript fetching ──────────────────────────────────────────────────────

export async function fetchTranscript(videoId: string): Promise<string | null> {
  try {
    const segments = await YoutubeTranscript.fetchTranscript(videoId);
    if (!segments || segments.length === 0) return null;
    return segments.map((s) => s.text).join(" ");
  } catch (err) {
    console.error(`[youtube] transcript unavailable for ${videoId}:`, err);
    return null;
  }
}

// ── Transcript chunking ──────────────────────────────────────────────────────

export function chunkTranscript(transcript: string, chunkWords = 9000): string[] {
  const words = transcript.split(/\s+/);
  if (words.length <= chunkWords) return [transcript];

  const chunks: string[] = [];
  let start = 0;

  while (start < words.length) {
    let end = Math.min(start + chunkWords, words.length);

    // Try to end on a sentence boundary within the last 200 words
    if (end < words.length) {
      const slice = words.slice(start, end).join(" ");
      const lastSentence = Math.max(
        slice.lastIndexOf(". "),
        slice.lastIndexOf(".\n"),
        slice.lastIndexOf("? "),
        slice.lastIndexOf("! ")
      );
      if (lastSentence > slice.length - 1200) {
        const trimmed = slice.slice(0, lastSentence + 1);
        chunks.push(trimmed.trim());
        // Recalculate start based on actual words used
        start += trimmed.split(/\s+/).length;
        continue;
      }
    }

    chunks.push(words.slice(start, end).join(" "));
    start = end;
  }

  return chunks;
}

// ── Channel feed fetcher ─────────────────────────────────────────────────────

export async function fetchYouTubeFeed(source: Source): Promise<{ newVideos: number; transcriptsFetched: number }> {
  if (!source.channelId) {
    throw new Error(`Source ${source.id} has no channelId set`);
  }

  try {
    const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${source.channelId}`;
    const { data: xml } = await axios.get<string>(feedUrl, {
      timeout: 10000,
      headers: { "User-Agent": USER_AGENT },
      responseType: "text",
    });

    const feed = await parser.parseString(xml);
    let newVideos = 0;
    let transcriptsFetched = 0;

    for (const item of feed.items) {
      try {
        const videoId = item["yt:videoId"] ?? (item.link ? extractVideoId(item.link) : null);
        if (!videoId || !item.title) continue;

        const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
        const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
        const description =
          item["media:group"]?.["media:description"]?.[0] ??
          item.contentSnippet ??
          undefined;

        // Check if this video is already in DB with a transcript
        const existing = await prisma.contentItem.findUnique({
          where: { url: videoUrl },
          select: { id: true, transcript: true },
        });

        const alreadyHasTranscript = !!(existing?.transcript);

        await upsertItem({
          sourceId: source.id,
          type: "YOUTUBE_EPISODE",
          url: videoUrl,
          title: item.title,
          publishedAt: item.isoDate ? new Date(item.isoDate) : undefined,
          excerpt: description?.slice(0, 500),
          thumbnailUrl,
        });

        newVideos++;

        // Fetch transcript for new videos (or if missing) when autoFetchTranscript is on
        if (source.autoFetchTranscript && !alreadyHasTranscript) {
          const transcript = await fetchTranscript(videoId);
          if (transcript) {
            await prisma.contentItem.update({
              where: { url: videoUrl },
              data: { transcript },
            });
            transcriptsFetched++;
          }
        }
      } catch (err) {
        console.error(`[youtube] failed to process video "${item.title}":`, err);
      }
    }

    await updateSourceHealth(source.id, { success: true });
    return { newVideos, transcriptsFetched };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await updateSourceHealth(source.id, { success: false, error: msg });
    throw err;
  }
}
