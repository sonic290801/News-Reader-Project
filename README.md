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
git clone https://github.com/<you>/news-reader.git
cd news-reader
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

The seed creates three sources: r/worldnews, pizzint.com, and The Enforcer (YouTube).

### 5. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and log in with `AUTH_PASSWORD`.

### 6. Ollama (optional)

Install a model and start Ollama:

```bash
ollama pull qwen2.5:14b
ollama serve
```

In Settings, set Provider to **Ollama** and verify the connection.

---

## Deploying to Netlify

### Database: Neon (free tier)

1. Sign up at [neon.tech](https://neon.tech)
2. Create a project and copy the connection string (looks like `postgresql://user:pass@host/dbname?sslmode=require`)

### Netlify setup

1. Push this repo to GitHub
2. In Netlify: **Add new site → Import from Git → GitHub**
3. Select the repo, branch `main` — build settings come from `netlify.toml` automatically
4. Go to **Site Settings → Environment Variables** and add:

| Variable | Value |
|---|---|
| `DATABASE_URL` | Neon connection string |
| `AUTH_PASSWORD` | password to share with your tutor |
| `AUTH_SECRET` | `openssl rand -hex 32` |
| `GEMINI_API_KEY` | from [aistudio.google.com](https://aistudio.google.com) (free) |
| `AI_PROVIDER` | `gemini` |

5. **Trigger deploy** — Netlify runs `prisma generate && prisma migrate deploy && next build`
6. After deploy succeeds, run the seed once via the Netlify CLI or a one-off function invocation:

```bash
# Using Netlify CLI
netlify env:set DATABASE_URL "your-neon-url"
npx prisma db seed
```

Or manually add sources through the Sources page after first login.

### Sharing with your tutor

Give them the `.netlify.app` URL and the `AUTH_PASSWORD` value.

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

- **Local**: `node-cron` starts automatically via Next.js instrumentation hook on server boot
- **Netlify**: `netlify/functions/scheduled-ingest.ts` runs on `0 * * * *` (hourly)
