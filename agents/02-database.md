# Agent: Database

## Responsibility
Define and implement all Prisma models, migrations, and database access utilities. All other agents that read or write data depend on the contracts established here.

## Output
- Complete `prisma/schema.prisma` with all models
- Initial migration
- `lib/db/` utility modules with typed CRUD helpers for each model

## Models

### Source
```prisma
model Source {
  id                  String        @id @default(cuid())
  type                SourceType
  url                 String        @unique
  channelId           String?       // YouTube channel ID
  label               String
  category            String?
  fetchIntervalMinutes Int          @default(60)
  autoFetchTranscript Boolean       @default(false)
  enabled             Boolean       @default(true)
  lastFetchedAt       DateTime?
  lastErrorAt         DateTime?
  lastErrorMsg        String?
  createdAt           DateTime      @default(now())
  items               ContentItem[]
}

enum SourceType {
  RSS
  REDDIT
  YOUTUBE
  WEB
}
```

### ContentItem
```prisma
model ContentItem {
  id            String      @id @default(cuid())
  sourceId      String
  source        Source      @relation(fields: [sourceId], references: [id], onDelete: Cascade)
  type          ContentType
  url           String      @unique
  title         String
  author        String?
  publishedAt   DateTime?
  excerpt       String?     @db.Text
  fullText      String?     @db.Text
  transcript    String?     @db.Text
  thumbnailUrl  String?
  durationSeconds Int?      // YouTube only
  isRead        Boolean     @default(false)
  isBookmarked  Boolean     @default(false)
  fetchedAt     DateTime    @default(now())
  summaries     AISummary[] @relation("SummaryItems")
}

enum ContentType {
  ARTICLE
  REDDIT_POST
  YOUTUBE_EPISODE
}
```

### AISummary
```prisma
model AISummary {
  id           String        @id @default(cuid())
  type         SummaryType
  provider     String        // "ollama" | "gemini"
  model        String
  summary      String        @db.Text
  analysis     String?       @db.Text
  createdAt    DateTime      @default(now())
  items        ContentItem[] @relation("SummaryItems")
}

enum SummaryType {
  SINGLE
  DIGEST
  CROSS_SOURCE
}
```

### Settings
```prisma
model Settings {
  id             String  @id @default("singleton")
  aiProvider     String  @default("ollama")
  ollamaModel    String  @default("qwen2.5:14b")
  geminiApiKey   String?
  summaryDepth   String  @default("standard")  // "brief" | "standard" | "deep"
  showAnalysis   Boolean @default(true)
}
```

## Utility Modules to Create

### lib/db/sources.ts
- `getSources()` — all sources ordered by label
- `getSource(id)` — single source with item count
- `createSource(data)` — insert new source
- `updateSource(id, data)` — partial update
- `deleteSource(id)` — cascade deletes items
- `updateSourceHealth(id, { success: boolean, error?: string })` — update lastFetchedAt or lastErrorAt

### lib/db/items.ts
- `getItems(filters?)` — paginated, filterable by sourceId, type, isRead, isBookmarked, date range
- `getItem(id)` — single item with source and summaries
- `upsertItem(data)` — insert or update by URL (used by ingest agents)
- `markRead(id)` — set isRead = true
- `markBookmarked(id, value)` — toggle bookmark
- `getUnreadCount()` — for badge display
- `deleteOldItems(retentionDays)` — cleanup job

### lib/db/summaries.ts
- `getSummary(itemId)` — latest single summary for an item
- `createSummary(data)` — insert new summary
- `linkItemsToSummary(summaryId, itemIds[])` — many-to-many join

### lib/db/settings.ts
- `getSettings()` — always returns the singleton row, creates default if missing
- `updateSettings(data)` — partial update

## Indexes to Add
```prisma
@@index([sourceId])       // ContentItem — filter by source
@@index([isRead])         // ContentItem — unread filter
@@index([publishedAt])    // ContentItem — date sort
@@index([type])           // ContentItem — filter by content type
```

## Acceptance Criteria
- `npx prisma migrate dev` runs without errors
- All utility functions are typed (no `any`)
- `getItems()` supports pagination (`skip`, `take`) and all filter combinations
- Upsert on ContentItem correctly handles the `url` unique constraint

## Dependencies on Other Agents
- Scaffold (01) must be complete — needs Prisma installed and `lib/db.ts` singleton in place
