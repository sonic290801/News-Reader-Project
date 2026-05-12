import { NextRequest, NextResponse } from "next/server";
import axios from "axios";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { url } = body as { url: string };

  if (!url) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  // If they pasted the RSS feed URL directly, extract channelId from it
  const rssMatch = url.match(/channel_id=([a-zA-Z0-9_-]+)/);
  if (rssMatch) {
    return NextResponse.json({ channelId: rssMatch[1], title: "" });
  }

  // Otherwise fetch the channel page and scrape the channelId
  try {
    const { data: html } = await axios.get<string>(url, {
      timeout: 10000,
      headers: { "User-Agent": USER_AGENT },
      responseType: "text",
    });

    // YouTube embeds the channel ID in the page source in several places
    const patterns = [
      /"channelId"\s*:\s*"(UC[a-zA-Z0-9_-]{22})"/,
      /"externalChannelId"\s*:\s*"(UC[a-zA-Z0-9_-]{22})"/,
      /channel\/(UC[a-zA-Z0-9_-]{22})/,
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match) {
        // Try to extract channel title too
        const titleMatch = html.match(/<title>([^<]+)<\/title>/);
        const title = titleMatch
          ? titleMatch[1].replace(" - YouTube", "").trim()
          : "";
        return NextResponse.json({ channelId: match[1], title });
      }
    }

    return NextResponse.json(
      { error: "Could not find channel ID on this page. Try pasting the channel URL directly." },
      { status: 422 }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Failed to fetch channel page: ${msg}` }, { status: 500 });
  }
}
