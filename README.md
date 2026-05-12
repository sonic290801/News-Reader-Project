# News Reader

A personal news aggregator with AI summaries. Pulls from RSS feeds, Reddit, YouTube, and web pages. Summarises content with Ollama (local) or Gemini (cloud).

## Features

- RSS, Reddit, YouTube, and web sources
- AI summaries — brief / standard / deep
- Full-text search across all content
- Keyword alerts flagged in the feed
- Bookmarks and read/unread tracking
- Mobile-friendly, dark UI

---

## Local Development

### Prerequisites

- [Docker Desktop](https://docs.docker.com/desktop/) — for PostgreSQL
- [Node.js 20+](https://nodejs.org/)
- [Ollama](https://ollama.com/) (optional — for local AI)

### 1. Clone and install

```bash
git clone https://github.com/sonic290801/News-Reader-Project.git
cd News-Reader-Project
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```
DATABASE_URL=postgresql://newsreader:newsreader@localhost:5432/newsreader
AUTH_PASSWORD=pick-a-password
AUTH_SECRET=run: openssl rand -hex 32
AI_PROVIDER=ollama          # or gemini
GEMINI_API_KEY=             # only needed if AI_PROVIDER=gemini
```

### 3. Start the database

```bash
docker compose up -d db
```

### 4. Run migrations and seed

```bash
npx prisma migrate dev
npx prisma db seed
```

### 5. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and log in with `AUTH_PASSWORD`.

### 6. Ollama (optional)

```bash
ollama pull qwen2.5:14b
ollama serve
```

In Settings, set Provider to **Ollama** and verify the connection.

---

## Netlify Deployment

### Environment variables

| Variable | Value |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (e.g. Neon) |
| `AUTH_PASSWORD` | Login password |
| `AUTH_SECRET` | Random 32-char string (`openssl rand -hex 32`) |
| `GEMINI_API_KEY` | From [aistudio.google.com](https://aistudio.google.com) (free) |
| `AI_PROVIDER` | `gemini` |

Build settings are read from `netlify.toml` automatically.

---

## Project structure

```
app/
  (app)/          # authenticated pages: feed, sources, settings
  (auth)/login/   # login page
  api/            # API routes
lib/
  ai/             # Ollama + Gemini clients, prompt templates
  db/             # Prisma helpers
  ingest/         # RSS, Reddit, YouTube, web fetchers + scheduler
netlify/
  functions/      # Netlify scheduled function (runs hourly in cloud)
prisma/
  schema.prisma
  seed.ts
```

## Scheduled ingest

- **Local**: node-cron starts automatically on server boot via Next.js instrumentation hook
- **Netlify**: `netlify/functions/scheduled-ingest.ts` runs hourly (`0 * * * *`)
