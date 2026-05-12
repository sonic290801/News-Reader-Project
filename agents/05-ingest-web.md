# Agent: Ingest — Web Scraper

## Responsibility
Fetch new content from arbitrary websites that have no RSS feed (e.g. pizzint.com). Detects new articles by diffing against known URLs, fetches and cleans full article text using Mozilla Readability.

## Output
- `lib/ingest/web.ts` — web scraper and article extractor
- `app/api/ingest/web/route.ts` — manual trigger endpoint
- `app/api/sources/resolve-web/route.ts` — test scrape for a new source

## Dependencies to Install
```
axios @mozilla/readability jsdom cheerio
```
(readability and jsdom may already be installed by ingest-rss agent — do not duplicate)

## How It Works

1. Fetch the site's homepage / index page
2. Extract all `<a href>` links from the page
3. Filter to links that look like article URLs (same domain, contain a path segment, not navigation links)
4. Diff against URLs already stored in DB for this source
5. For each new URL: fetch the page, run Readability, store as ContentItem
6. If a CSS selector override is set on the source, use that to find article links instead of auto-detection

## Web Fetcher (lib/ingest/web.ts)

### fetchWebSource(source: Source): Promise<void>
```ts
// 1. Fetch source.url (the site homepage / index page)
// 2. Use cheerio to extract candidate article links:
//    - If source has a cssSelector stored: use that selector to find links
//    - Otherwise: find all <a href> on the page, filter by heuristics (see below)
// 3. For each candidate URL not already in DB:
//    a. Fetch the article page
//    b. Run Readability to extract { title, textContent, excerpt }
//    c. Upsert ContentItem with type = ARTICLE
// 4. Rate limit: 1 request per 2 seconds
// 5. Update source health
```

### Link filtering heuristics (auto-detect mode)
```ts
// Keep a link if ALL of:
// - Same hostname as source.url
// - Path has at least 2 segments (e.g. /news/article-title, not just /about)
// - Does not match common nav patterns: /tag/, /category/, /author/, /page/, /search/
// - Not already seen in DB
// - href is not an anchor (#), mailto:, or external domain
```

### extractArticle(url: string): Promise<ArticleData | null>
```ts
// Reuse lib/ingest/readability.ts from the RSS agent
// Returns { title, fullText, excerpt, publishedAt? } or null
// publishedAt: look for <time datetime="..."> or JSON-LD Article.datePublished in the page
```

## Source CSS Selector Override
Stored as a JSON string in Source — extend the Source model or use a separate metadata field:
```
selectorConfig: String? // e.g. '{"articleLinks": "h2.post-title > a"}'
```
When set, use this selector with cheerio instead of the auto-detect heuristics.

## API Routes

### app/api/ingest/web/route.ts
- POST `{ sourceId: string }` → runs fetchWebSource
- Returns `{ ok: true, newItems: number }`

### app/api/sources/resolve-web/route.ts
Used during source setup to preview what the scraper will find:
- POST `{ url: string, cssSelector?: string }` → runs a test scrape
- Returns `{ candidateLinks: string[], sampleTitle?: string }` (first 10 links found)
- Lets the user verify the scraper is finding the right articles before saving the source

## Error Handling
- Per-article errors (404, Readability returns null) should not abort the whole scrape
- Log and skip unparseable pages
- If the index page itself fails: update source health with error

## Acceptance Criteria
- Adding pizzint.com as a WEB source and triggering a fetch populates ContentItems
- Re-fetching does not duplicate already-stored articles
- resolve-web endpoint returns a list of detected article links for preview
- CSS selector override correctly targets article links when auto-detect fails
- Rate limiting prevents hammering the site

## Dependencies on Other Agents
- Database (02) — needs upsertItem, updateSourceHealth
- RSS Ingest (03) — reuses lib/ingest/readability.ts
- Scaffold (01) — project must exist
