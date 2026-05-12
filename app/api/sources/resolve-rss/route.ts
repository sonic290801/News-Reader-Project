import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import RSSParser from "rss-parser";

const parser = new RSSParser();

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { url } = body as { url: string };

  if (!url) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  try {
    const { data: xml } = await axios.get<string>(url, {
      timeout: 10000,
      headers: { "User-Agent": "NewsReader/1.0" },
      responseType: "text",
    });
    const feed = await parser.parseString(xml);
    return NextResponse.json({
      title: feed.title ?? "",
      description: feed.description ?? "",
      itemCount: feed.items.length,
    });
  } catch {
    return NextResponse.json(
      { error: "Could not parse as an RSS/Atom feed. Check the URL and try again." },
      { status: 422 }
    );
  }
}
