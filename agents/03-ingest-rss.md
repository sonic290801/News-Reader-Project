# Agent: Ingest — RSS / Reddit

## Responsibility
Fetch and store content from RSS/Atom feeds and Reddit subreddits. Handles periodic polling, deduplication, full-text extraction, and source health tracking.

## Output
- `lib/ingest/rss.ts` — RSS/Atom fetcher
- `lib/ingest/reddit.ts` — Reddit RSS fetcher
- `lib/ingest/readability.ts` — full article text extractor
- `lib/ingest/scheduler.ts` — polling scheduler
- `app/api/ingest/rss/route.ts` — manual trigger endpoint
- `app/api/ingest/reddit/route.ts` — manual trigger endpoint

## Dependencies to Install
```
rss-parser axios @mozilla/readability jsdom
```

## RSS Fetcher (lib/ingest/rss.ts)

```ts
// fetchRssFeed(source: Source): Promise<void>
// 1. GET source.url with axios (10s timeout, User-Agent header)
// 2. Parse with rss-parser
// 3. For each item: map to ContentItem shape
// 4. If feed item has no full content (<content:encoded>), call extractFullText(item.link)
// 5. Upsert each item via lib/db/items.upsertItem()
// 6. Call updateSourceHealth(source.id, { success: true })
// On any error: call updateSourceHealth(source.id, { success: false, error: err.message })
```

### Field mapping (RSS item → ContentItem)
| RSS field | ContentItem field |
|-----------|------------------|
| item.title | title |
| item.link | url |
| item.creator / item.author | author |
| item.pubDate / item.isoDate | publishedAt |
| item.contentSnippet | excerpt |
| item.content or extracted | fullText |
| item.enclosure?.url or media:thumbnail | thumbnailUrl |

## Reddit Fetcher (lib/ingest/reddit.ts)

Reddit exposes RSS at `https://www.reddit.com/r/{subreddit}/.rss`

```ts
// fetchRedditFeed(source: Source): Promise<void>
// source.url example: "https://www.reddit.com/r/worldnews/.rss"
// Same rss-parser approach, but:
//   - type = ContentType.REDDIT_POST
//   - excerpt = item.contentSnippet (Reddit includes post body/link preview)
//   - fullText: follow item.link and extract full article text (the linked article, not Reddit page)
//   - thumbnailUrl: parse from item['media:thumbnail']?.$?.url if present
```

## Full Text Extractor (lib/ingest/readability.ts)

```ts
// extractFullText(url: string): Promise<{ text: string; title: string } | null>
// 1. GET the URL with axios (15s timeout, realistic User-Agent)
// 2. Parse HTML with jsdom: new JSDOM(html, { url })
// 3. Run Mozilla Readability: new Readability(dom.window.document).parse()
// 4. Return { text: result.textContent, title: result.title }
// 5. Return null on fetch error or if Readability returns null (not a readable article)
// Rate limit: max 1 request per second to avoid hammering sites
```

## Scheduler (lib/ingest/scheduler.ts)

```ts
// startScheduler(): void
// On startup, load all enabled sources from DB
// For each source, schedule a recurring job based on source.fetchIntervalMinutes
// Use node-cron or simple setInterval
// Run fetchRssFeed / fetchRedditFeed depending on source.type
// Also expose: runSourceNow(sourceId) for manual refresh
```

Install: `node-cron @types/node-cron`

## API Routes

### app/api/ingest/rss/route.ts
- POST `{ sourceId: string }` → runs fetchRssFeed for that source immediately
- Returns `{ ok: true, newItems: number }` or error

### app/api/ingest/reddit/route.ts
- Same shape as above but calls fetchRedditFeed

## Deduplication
- `upsertItem` uses `url` as the unique key — Prisma upsert handles this
- Before calling extractFullText, check if item already has fullText stored (skip re-fetch)

## Error Handling
- Per-item errors (e.g. one article 404s) should not abort the whole feed fetch
- Log errors per item, continue processing remaining items
- Source-level errors (feed URL unreachable) are written to Source.lastErrorMsg

## Acceptance Criteria
- Adding an RSS source and triggering a manual fetch populates ContentItems in DB
- Reddit source fetches posts and follows the linked article URL for full text
- Items already in DB are not duplicated on re-fetch
- Source.lastFetchedAt is updated on success; lastErrorMsg is set on failure
- Scheduler starts automatically when the Next.js server starts (call startScheduler in a server-side init file)

## Dependencies on Other Agents
- Database (02) — needs upsertItem, updateSourceHealth
- Scaffold (01) — project must exist
