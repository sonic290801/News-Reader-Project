import axios from "axios";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// Simple 1-req/sec rate limiter
let lastFetchAt = 0;
async function rateLimit() {
  const now = Date.now();
  const gap = now - lastFetchAt;
  if (gap < 1000) await new Promise((r) => setTimeout(r, 1000 - gap));
  lastFetchAt = Date.now();
}

export async function extractFullText(
  url: string
): Promise<{ text: string; title: string } | null> {
  try {
    await rateLimit();

    const { data: html } = await axios.get<string>(url, {
      timeout: 15000,
      headers: { "User-Agent": USER_AGENT },
      responseType: "text",
    });

    const { JSDOM } = await import("jsdom");
    const { Readability } = await import("@mozilla/readability");
    const dom = new JSDOM(html, { url });
    const article = new Readability(dom.window.document).parse();

    if (!article) return null;

    return {
      text: (article.textContent ?? "").trim(),
      title: article.title ?? "",
    };
  } catch {
    return null;
  }
}
