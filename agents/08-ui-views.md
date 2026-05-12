# Agent: UI Views

## Responsibility
Build all four content display modes (List, Card, Reader, Digest) plus the AI summary panel. These are the core reading experience pages.

## Output
- `app/(app)/feed/page.tsx` — feed page (hosts view switcher + active view)
- `components/views/ListView.tsx`
- `components/views/CardView.tsx`
- `components/views/ReaderView.tsx`
- `components/views/DigestView.tsx`
- `components/ai/SummaryPanel.tsx` — AI summary + analysis display
- `components/ai/SummaryButton.tsx` — trigger button with streaming progress
- `app/api/items/route.ts` — paginated item list endpoint
- `app/api/items/[id]/route.ts` — single item endpoint + mark-read

## Feed Page — app/(app)/feed/page.tsx
- Toolbar: view switcher (List / Card / Digest icons), filter bar, unread count badge
- Filter bar: source selector, category selector, type filter (All / Articles / Reddit / YouTube), unread only toggle
- Persists selected view + filters in URL params (shareable, survives refresh)
- Loads items via /api/items with filter params
- Infinite scroll or "Load more" pagination

## List View — components/views/ListView.tsx
Each row:
- Left: coloured source-type icon (RSS=blue, Reddit=orange, YouTube=red, Web=grey)
- Main: headline (bold if unread), source label + time ago
- Right: bookmark icon, summarise button (magic wand icon)
- Tap/click row: opens Reader View (slide-in panel on desktop, full page on mobile)
- Swipe left on mobile: mark read

## Card View — components/views/CardView.tsx
- Responsive grid: 1 col mobile, 2 col tablet, 3 col desktop
- Each card: thumbnail (or coloured placeholder with source initial), source badge, headline, excerpt snippet (2 lines), time ago
- Tap: opens Reader View
- Bookmark icon on hover/long-press

## Reader View — components/views/ReaderView.tsx
Layout:
- Header: source label, published date, external link icon, close button
- Title (large)
- Body: cleaned article text or transcript, comfortable line width (max 680px), 18px font

For YouTube episodes:
- Embedded YouTube player (iframe) pinned at top or in a collapsible section
- Transcript displayed below player with timestamps every ~5 minutes
- Clicking a timestamp seeks the embedded player to that position

AI Summary Panel (always visible in Reader View, collapsible):
- See SummaryPanel component below

Navigation: previous / next item arrows (keyboard: ← →)
Marks item as read automatically when opened

## Digest View — components/views/DigestView.tsx
Grouped display, refreshed daily:

Groups: Morning (midnight–noon) / Afternoon (noon–6pm) / Evening (6pm–midnight), or by Category if user prefers (toggle)

Each group:
- Group header with item count
- Top 5 items: source badge, headline, 1-line excerpt
- "Summarise this group" button → triggers multi-item digest AI call
- Expand to see all items in group

## AI Summary Panel — components/ai/SummaryPanel.tsx

States:
1. **Not yet summarised** — shows "Summarise" button with estimated word count of content
2. **Loading** — streams AI output in real time, shows provider badge (Ollama / Gemini)
   - For chunked transcripts: shows "Summarising part 2 of 4..." progress
3. **Done** — shows formatted result:
   - **SUMMARY** section (always)
   - **ANALYSIS** section (if enabled in settings, collapsible)
   - Timestamp of when summary was generated, model used
4. **Error** — shows error message with retry button

The panel is persistent — once a summary is generated it is loaded from DB on subsequent views.

### SummaryButton — components/ai/SummaryButton.tsx
- Compact version for use in list/card views
- Shows spinner while loading, checkmark when done
- On click: opens Reader View and triggers summary simultaneously

## API Routes

### app/api/items/route.ts
GET with query params:
- `sourceId`, `category`, `type`, `isRead`, `isBookmarked`
- `from`, `to` (date range)
- `page`, `limit` (default 50)
Returns: `{ items: ContentItem[], total: number, hasMore: boolean }`

### app/api/items/[id]/route.ts
- GET → returns single item with source, latest summary
- PATCH `{ isRead?, isBookmarked? }` → updates flags

## Streaming SSE in the UI
The SummaryPanel connects to /api/ai/summarise via EventSource (SSE):
```ts
// const es = new EventSource(`/api/ai/summarise?itemId=${id}`)
// es.onmessage = (e) => appendToken(e.data)
// es.addEventListener('done', () => markComplete())
// es.addEventListener('error', () => showError())
```

## Acceptance Criteria
- All four views render the correct layout at mobile (390px) and desktop (1280px) widths
- List view rows show bold headlines for unread items, normal weight for read
- Opening an item in Reader View marks it as read
- YouTube Reader View shows the embedded player and a scrollable transcript
- AI summary streams token-by-token into the panel without page reload
- Chunked transcript shows "Summarising part X of Y" progress text
- Navigating with ← → arrows moves between items without full page reload
- Digest view groups today's items correctly by time block
- Filters in the toolbar update the item list immediately

## Dependencies on Other Agents
- Database (02) — getItems, getItem, markRead, markBookmarked
- AI Engine (06) — /api/ai/summarise and /api/ai/digest endpoints
- UI Shell (07) — layout, base UI components, auth
