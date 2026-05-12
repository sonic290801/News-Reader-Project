# News Reader App — Specification

## Overview

A web application (self-hosted, accessible from any device on the network) that aggregates news from user-selected sources including RSS feeds, Reddit, YouTube channels, and arbitrary websites. Presents articles and video transcripts in multiple views, and uses an AI backend to generate summaries and analytical commentary on the meaning or significance of what was reported.

---

## Resolved Design Decisions

| Question | Decision |
|----------|----------|
| Platform | Web app (Next.js), self-hosted — accessible from PC and phone via browser |
| Full article fetching | Yes — fetch and clean full article text for AI context |
| Sync | Server-side database; all devices share same state in real time |
| Cost controls | Show estimated token cost before running any AI analysis |
| Offline | Not required |

---

## Source Types

### RSS / Atom Feeds
- Standard feed parsing: title, URL, author, published date, description, full text if embedded
- Fallback: fetch and parse the article HTML when feed only provides excerpts
- Examples: news sites, blogs, any outlet with a feed URL

### Reddit (r/worldnews and others)
- Use Reddit's public RSS endpoint: `reddit.com/r/{subreddit}/.rss`
- Each post becomes an "article": title, link, score, top-level summary
- Optionally follow the linked article URL and fetch full text from the destination

### YouTube Channels (e.g. The Enforcer)
- YouTube exposes a per-channel RSS feed: `youtube.com/feeds/videos.xml?channel_id=...`
- This gives: video title, URL, published date, description
- **Transcript fetching**: for each video, fetch the auto-generated or manual captions via the YouTube transcript API (`youtube-transcript` library or `yt-dlp --write-auto-sub`)
- Transcript is stored as plain text and used as the "full text" for AI analysis
- **Token cost note**: a 4-hour podcast transcript is typically 40,000–70,000 words (~50k–90k tokens). This is significant but manageable with Claude's 200k context window. Prompt caching is applied so re-analysis of the same transcript is ~90% cheaper. A full-transcript summary with `claude-sonnet-4-6` costs roughly $0.15–$0.25 per video.
- Transcript fetch is triggered manually or on a schedule — not automatic on every new video, to avoid unexpected cost

### Arbitrary Websites (e.g. pizzint.com)
- For sites without an RSS feed, use web scraping to detect new content
- Crawl the site's index/homepage on a schedule, detect new article links by diffing against stored URLs
- Fetch and clean full article text via Mozilla Readability (same library Firefox uses)
- Per-source CSS selector override if auto-detection fails

---

## Core Features

### 1. Source Management

- Add / remove sources by URL or from a preset list
- Source type auto-detected from URL (RSS, Reddit, YouTube, web)
- Per-source settings:
  - Nickname / label
  - Category tag (e.g. Politics, Tech, Finance, Podcast)
  - Fetch frequency (15 min / 1 hr / 6 hr / manual)
  - Enable / disable without deleting
  - For YouTube: auto-fetch transcript on new video (on/off toggle)
- Source health indicator: last successful fetch, error state

---

### 2. Article & Content Ingestion

- Normalise all source types into a single **Content Item** model (article, Reddit post, YouTube episode)
- De-duplicate by URL normalisation and title similarity
- Full text fetched and stored server-side; not re-fetched unless stale
- Configurable retention: keep last N days or last N items per source
- Mark as read / unread, bookmarked (synced across devices via shared server DB)

---

### 3. Display Modes

#### 3a. List View (default)
- Compact rows: source label, content type icon, headline/title, time ago, read indicator
- Sort: newest first, by source, by category
- Filter: source, category, content type, read/unread, date range

#### 3b. Card / Magazine View
- Grid of cards: headline, source, time, excerpt or transcript snippet
- Thumbnail if available (article image or YouTube thumbnail)

#### 3c. Reader View
- Full-content pane: cleaned article text or formatted transcript
- Distraction-free typography, comfortable on mobile
- Previous / next item navigation
- For YouTube: embed player above transcript with timestamp sync (click transcript line → seek video)

#### 3d. Digest View
- Grouped by category or time block (morning / afternoon / evening)
- Top N items per group with one-line teaser
- Designed for a quick daily scan on phone

---

### 4. AI Summary & Analysis

#### 4a. Single-Item Summary
- 2–4 sentence neutral summary of what happened / was said
- Key facts: who, what, when, where
- For YouTube podcasts: summarise by segment/topic, not as one flat block

#### 4c. Single-Item Analysis
- What this likely means or why it matters
- Background context the reader may need
- Potential implications or next developments to watch

#### 4d. Multi-Item Digest Summary
- Synthesises a selected set of items (e.g. all unread today) into a coherent briefing
- Groups related stories, notes when sources agree or diverge
- Highlights the most significant developments

#### 4e. Cross-Source Perspective View
- For a story covered by multiple sources, shows how framing or emphasis differs
- Useful for spotting bias, omission, or spin

#### 4f. AI Settings
- API key (stored server-side in `.env`, never exposed to browser)
- Default model (`gemini-1.5-flash` — free tier)
- Summary depth: brief / standard / deep
- Toggle analysis section on/off
- Provider selector: Ollama (default, local) | Gemini (fallback, free cloud) | Claude | OpenAI

---

### 5. Search

- Full-text search across stored articles and transcripts
- Filter by source, category, content type, date
- Saved searches / keyword alerts (flag new items matching a keyword)

---

### 6. Export & Sharing

- Copy item link
- Export digest or summary as plain text, Markdown, or HTML
- Share AI summary as clipboard text

---

## Technical Architecture

### Stack

| Layer | Choice | Reason |
|-------|--------|--------|
| Framework | **Next.js 14 (App Router)** | Full-stack, one repo, server-side fetch & DB, good mobile browser support |
| Language | TypeScript | Type safety across front and back |
| Database | **PostgreSQL** (via Prisma ORM) | Reliable, handles concurrent reads from multiple devices |
| Feed fetching | `rss-parser`, `axios`, `@mozilla/readability` | RSS parsing + HTML cleaning |
| YouTube transcripts | `youtube-transcript` npm package or `yt-dlp` CLI | Fetches captions without needing audio processing |
| Reddit | Public RSS endpoints | No API key required for read-only access |
| AI primary | Ollama + Qwen 2.5 14B (`ollama` npm package) | Local, free, private — runs well on GTX 1080 Ti (11GB VRAM) |
| AI fallback | `@google/generative-ai` SDK — Gemini 1.5 Flash | Free tier, 1M context — handles full 4hr transcripts in one shot |
| Scheduler | `node-cron` (local) / Netlify Scheduled Functions (cloud) | Periodic feed refresh — adapter chosen by environment |
| Auth | Simple password gate (single-user app) | Prevents open access if hosted beyond local network |
| Hosting (local) | Docker Compose on PC | Accessible on home network from phone and PC, Ollama runs here |
| Hosting (cloud) | Netlify (Next.js) + Neon PostgreSQL | Publicly accessible URL for sharing; free tier sufficient |
| Version control | GitHub | Source of truth; Netlify auto-deploys on push to main |

### AI Integration

- **Primary: Ollama running Qwen 2.5 14B locally**
  - Runs on GTX 1080 Ti (11GB VRAM) — model fits at ~9GB (4-bit quantized)
  - Estimated inference speed: ~40 tokens/second — a 500-word summary in ~12 seconds
  - Completely free, no API key, no internet required for inference, data never leaves the machine
  - Install: `ollama pull qwen2.5:14b`
- **Fallback: Google Gemini 1.5 Flash** (free tier)
  - Useful for processing full 4-hour transcripts in one shot (1M token context)
  - API key from Google AI Studio (aistudio.google.com) — free, no credit card needed
  - Falls back automatically if Ollama is unavailable
- **4-hour podcast handling:** transcript is chunked into 1-hour segments (~11k tokens each), each segment summarised individually, then a final synthesis pass produces an overall episode summary — also better UX (per-hour breakdowns available)
- AI abstraction layer so provider can be swapped via `.env` without touching code
- Responses streamed to UI for faster perceived performance

### Deployment Environments

The app runs in two distinct environments with different constraints:

| Concern | Local (Docker) | Cloud (Netlify) |
|---------|---------------|-----------------|
| AI provider | Ollama (primary) | Gemini free tier (Ollama unavailable) |
| Database | PostgreSQL in Docker container | Neon serverless PostgreSQL (free tier) |
| Scheduler | `node-cron` persistent process | Netlify Scheduled Functions (cron) |
| Access | Home network only | Public URL |
| Cost | Free | Free |

#### Local Setup
- `docker-compose.yml`: two services — `app` (Next.js) and `db` (PostgreSQL)
- Ollama runs natively on the host (not in Docker) so it has GPU access; app reaches it at `host.docker.internal:11434`
- Accessible at `http://<pc-local-ip>:3000` from any device on the same WiFi

#### Cloud Setup (Netlify + Neon)
- Source code pushed to GitHub; Netlify auto-deploys on every push to `main`
- Database: Neon free tier (serverless PostgreSQL — Prisma compatible, no always-on cost)
- AI: Gemini 1.5 Flash (free tier) — Ollama cannot run on Netlify's serverless infrastructure
- Feed scheduler: Netlify Scheduled Functions replace `node-cron` (run on a cron schedule)
- Environment variables set in Netlify dashboard (DATABASE_URL, GEMINI_API_KEY, AUTH_PASSWORD, AUTH_SECRET)
- Netlify plugin: `@netlify/plugin-nextjs` for full App Router support

---

## Data Models

```
Source {
  id, type (rss | reddit | youtube | web),
  url, channelId (YouTube), label, category,
  fetchIntervalMinutes, autoFetchTranscript,
  enabled, lastFetchedAt, lastErrorAt, lastErrorMsg
}

ContentItem {
  id, sourceId, type (article | redditPost | youtubeEpisode),
  url, title, author, publishedAt,
  excerpt, fullText, transcript,
  thumbnailUrl, durationSeconds (YouTube),
  isRead, isBookmarked, fetchedAt
}

AISummary {
  id, contentItemIds[],
  type (single | digest | crossSource),
  provider, model,
  summary, analysis, createdAt
}

Settings {
  anthropicApiKey, defaultModel, summaryDepth,
  showAnalysis, monthlySpendUsd
}
```

---

## Phased Roadmap

### Phase 1 — MVP
- [ ] Next.js + PostgreSQL + Docker Compose setup
- [ ] Source management: RSS, Reddit, YouTube, web scrape
- [ ] YouTube transcript fetching
- [ ] List view and Reader view (mobile-friendly)
- [ ] Single-item AI summary + analysis with cost estimate gate
- [ ] Read/unread state synced via server DB

### Phase 2 — Enhanced Reading
- [ ] Card view and Digest view
- [ ] Multi-item digest AI summary
- [ ] Full-text search with filters
- [ ] Bookmarking and retention controls
- [ ] YouTube reader view with transcript + embedded player

### Phase 3 — Power Features
- [ ] Cross-source perspective view
- [ ] Saved searches / keyword alerts
- [ ] Export (Markdown, HTML)
- [ ] AI spend dashboard (daily/monthly totals)
- [ ] Tailscale / tunnel setup guide for remote access
