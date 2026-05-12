# Agent: Ingest — YouTube

## Responsibility
Fetch new video entries from YouTube channels via their public RSS feed, and optionally fetch the auto-generated transcript for each video. Stores videos and transcripts as ContentItems.

## Output
- `lib/ingest/youtube.ts` — channel feed + transcript fetcher
- `app/api/ingest/youtube/route.ts` — manual trigger endpoint
- `app/api/ingest/transcript/route.ts` — trigger transcript fetch for a single video

## Dependencies to Install
```
youtube-transcript rss-parser axios
```

## How YouTube RSS Works
Every YouTube channel exposes a public RSS feed (no API key needed):
```
https://www.youtube.com/feeds/videos.xml?channel_id=CHANNEL_ID
```
This returns: video title, URL, published date, description, thumbnail.
The channel ID is different from the channel handle — see "Finding Channel ID" below.

## YouTube Fetcher (lib/ingest/youtube.ts)

### fetchYouTubeFeed(source: Source): Promise<void>
```ts
// source.channelId must be set (e.g. "UCxxxxxxxxxxxxxxxx")
// source.url = `https://www.youtube.com/feeds/videos.xml?channel_id=${source.channelId}`
// 1. Fetch and parse feed with rss-parser
// 2. Map each entry to ContentItem:
//    - type = ContentType.YOUTUBE_EPISODE
//    - url = `https://www.youtube.com/watch?v=${videoId}`
//    - title = entry.title
//    - publishedAt = entry.pubDate
//    - excerpt = entry.contentSnippet (video description, first ~300 chars)
//    - thumbnailUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
//    - transcript = null (fetched separately)
// 3. Upsert each item
// 4. If source.autoFetchTranscript === true, call fetchTranscript(videoId) for new items only
```

### fetchTranscript(videoId: string): Promise<string | null>
```ts
// Uses the youtube-transcript package
// import { YoutubeTranscript } from 'youtube-transcript'
// 1. Call YoutubeTranscript.fetchTranscript(videoId)
// 2. Returns array of { text, offset, duration } segments
// 3. Join all text segments into a single string with spaces
// 4. Return the full transcript text
// 5. Return null if transcript unavailable (private video, no captions)
// On error: log and return null — do not throw
```

### extractVideoId(url: string): string
```ts
// Handles formats:
//   https://www.youtube.com/watch?v=VIDEO_ID
//   https://youtu.be/VIDEO_ID
// Returns the VIDEO_ID string
```

## Transcript Chunking (lib/ingest/youtube.ts)

For use by the AI engine — the transcript may be very long (4hr ≈ 80k tokens).
Expose a helper that the AI agent calls:

```ts
// chunkTranscript(transcript: string, chunkWords = 9000): string[]
// Splits transcript into chunks of ~9000 words each (~11k tokens)
// Splits on sentence boundaries where possible (". " or "\n")
// Returns array of chunk strings
// A 4-hour podcast (~40,000 words) produces ~4-5 chunks
```

## API Routes

### app/api/ingest/youtube/route.ts
- POST `{ sourceId: string }` → runs fetchYouTubeFeed for that source
- Returns `{ ok: true, newVideos: number, transcriptsFetched: number }`

### app/api/ingest/transcript/route.ts
- POST `{ itemId: string }` → fetches transcript for a single ContentItem
- Updates ContentItem.transcript in DB
- Returns `{ ok: true, wordCount: number }` or `{ ok: false, reason: string }`
- This is called from the UI when the user clicks "Fetch Transcript" on a video

## Finding Channel ID (for Source Setup UI)
When a user adds a YouTube source, they will likely paste the channel URL (e.g. `https://www.youtube.com/c/TheEnforcer` or `https://www.youtube.com/@enforcer`).
Expose a helper endpoint:

### app/api/sources/resolve-youtube/route.ts
- POST `{ url: string }` → attempts to extract or resolve the channel ID
- Strategy: fetch the channel page HTML, look for `"channelId":"UC..."` in the page source
- Returns `{ channelId: string, title: string }` or error

## Acceptance Criteria
- Adding a YouTube source by channel URL resolves the channel ID automatically
- fetchYouTubeFeed populates ContentItems with type YOUTUBE_EPISODE
- Manual "Fetch Transcript" on a video item stores the transcript text
- autoFetchTranscript = true on a source automatically fetches transcripts for newly discovered videos
- chunkTranscript correctly splits a 40,000-word string into ~4 chunks
- No crash if transcript is unavailable for a video

## Dependencies on Other Agents
- Database (02) — needs upsertItem, updateSourceHealth
- Scaffold (01) — project must exist
