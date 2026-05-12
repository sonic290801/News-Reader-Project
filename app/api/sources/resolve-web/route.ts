import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import { getCandidateLinks, extractArticle } from "@/lib/ingest/web";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { url, cssSelector } = body as { url: string; cssSelector?: string };

  if (!url) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  try {
    const { data: html } = await axios.get<string>(url, {
      timeout: 10000,
      headers: { "User-Agent": USER_AGENT },
      responseType: "text",
    });

    const candidates = getCandidateLinks(html, url, cssSelector);
    const preview = candidates.slice(0, 10);

    // Fetch the first candidate to show a sample title
    let sampleTitle: string | undefined;
    if (preview.length > 0) {
      const article = await extractArticle(preview[0]);
      sampleTitle = article?.title;
    }

    return NextResponse.json({ candidateLinks: preview, sampleTitle });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to scrape ${url}: ${msg}` },
      { status: 500 }
    );
  }
}
