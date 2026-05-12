import axios from "axios";
import * as cheerio from "cheerio";
import { Source } from "@prisma/client";
import { upsertItem } from "@/lib/db/items";
import { updateSourceHealth } from "@/lib/db/sources";
import { prisma } from "@/lib/db";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const NAV_PATTERNS = [
  /^\/(tag|tags|category|categories|author|authors|page|search|about|contact|privacy|terms|faq|feed|rss)\b/i,
];

// ── Link extraction ──────────────────────────────────────────────────────────

export function getCandidateLinks(
  html: string,
  baseUrl: string,
  cssSelector?: string
): string[] {
  const $ = cheerio.load(html);
  const base = new URL(baseUrl);
  const seen = new Set<string>();
  const links: string[] = [];

  const addLink = (href: string | undefined) => {
    if (!href) return;
    try {
      const resolved = new URL(href, baseUrl);
      // Same hostname only
      if (resolved.hostname !== base.hostname) return;
      // Remove hash and query for dedup
      resolved.hash = "";
      const clean = resolved.toString();
      if (seen.has(clean)) return;
      seen.add(clean);
      links.push(clean);
    } catch {
      // malformed href — skip
    }
  };

  if (cssSelector) {
    $(cssSelector).each((_, el) => {
      addLink($(el).attr("href") ?? $(el).find("a").attr("href"));
    });
  } else {
    $("a[href]").each((_, el) => {
      const href = $(el).attr("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:")) return;

      try {
        const resolved = new URL(href, baseUrl);
        if (resolved.hostname !== base.hostname) return;

        const path = resolved.pathname;
        // Need at least 2 path segments: /section/article-slug
        const segments = path.split("/").filter(Boolean);
        if (segments.length < 2) return;

        // Skip navigation-pattern paths
        if (NAV_PATTERNS.some((p) => p.test(path))) return;

        resolved.hash = "";
        const clean = resolved.toString();
        if (!seen.has(clean)) {
          seen.add(clean);
          links.push(clean);
        }
      } catch {
        // skip
      }
    });
  }

  return links;
}

// ── Article extraction ───────────────────────────────────────────────────────

type ArticleData = {
  title: string;
  fullText: string;
  excerpt: string;
  publishedAt?: Date;
};

export async function extractArticle(url: string): Promise<ArticleData | null> {
  try {
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

    const publishedAt = extractPublishedDate(html, dom);

    const fullText = (article.textContent ?? "").trim();
    return {
      title: article.title ?? "",
      fullText,
      excerpt: fullText.slice(0, 500),
      publishedAt,
    };
  } catch {
    return null;
  }
}

function extractPublishedDate(html: string, dom: InstanceType<typeof import("jsdom").JSDOM>): Date | undefined {
  // Try <time datetime="...">
  const timeEl = dom.window.document.querySelector("time[datetime]");
  if (timeEl) {
    const dt = timeEl.getAttribute("datetime");
    if (dt) {
      const d = new Date(dt);
      if (!isNaN(d.getTime())) return d;
    }
  }

  // Try JSON-LD Article.datePublished
  const scripts = dom.window.document.querySelectorAll(
    'script[type="application/ld+json"]'
  );
  for (const script of Array.from(scripts)) {
    try {
      const data = JSON.parse(script.textContent ?? "");
      const date =
        data?.datePublished ??
        data?.["@graph"]?.find(
          (n: { "@type"?: string }) => n["@type"] === "Article" || n["@type"] === "NewsArticle"
        )?.datePublished;
      if (date) {
        const d = new Date(date);
        if (!isNaN(d.getTime())) return d;
      }
    } catch {
      // skip malformed JSON-LD
    }
  }

  // Try meta tags
  const metaDate =
    dom.window.document
      .querySelector('meta[property="article:published_time"]')
      ?.getAttribute("content") ??
    dom.window.document
      .querySelector('meta[name="pubdate"]')
      ?.getAttribute("content");

  if (metaDate) {
    const d = new Date(metaDate);
    if (!isNaN(d.getTime())) return d;
  }

  return undefined;
}

// ── Rate limiter (2s between article fetches) ────────────────────────────────

let lastArticleFetch = 0;
async function rateLimit() {
  const gap = Date.now() - lastArticleFetch;
  if (gap < 2000) await new Promise((r) => setTimeout(r, 2000 - gap));
  lastArticleFetch = Date.now();
}

// ── Main fetcher ─────────────────────────────────────────────────────────────

export async function fetchWebSource(source: Source): Promise<number> {
  try {
    const { data: html } = await axios.get<string>(source.url, {
      timeout: 10000,
      headers: { "User-Agent": USER_AGENT },
      responseType: "text",
    });

    const selectorConfig = source.selectorConfig
      ? (JSON.parse(source.selectorConfig) as { articleLinks?: string })
      : null;

    const candidates = getCandidateLinks(
      html,
      source.url,
      selectorConfig?.articleLinks
    );

    // Find which URLs we haven't seen yet
    const existing = await prisma.contentItem.findMany({
      where: { sourceId: source.id },
      select: { url: true },
    });
    const existingUrls = new Set(existing.map((e) => e.url));
    const newUrls = candidates.filter((u) => !existingUrls.has(u));

    let newCount = 0;
    for (const url of newUrls) {
      try {
        await rateLimit();
        const article = await extractArticle(url);
        if (!article) continue;

        await upsertItem({
          sourceId: source.id,
          type: "ARTICLE",
          url,
          title: article.title,
          publishedAt: article.publishedAt,
          excerpt: article.excerpt,
          fullText: article.fullText,
        });
        newCount++;
      } catch (err) {
        console.error(`[web] failed to process article ${url}:`, err);
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
