# Agent: Deployment

## Responsibility
Prepare the app for GitHub version control and Netlify cloud hosting. Ensures the codebase works correctly in both environments (local Docker and Netlify serverless), and produces a publicly accessible URL that can be shared with a tutor.

## Output
- `.gitignore` — excludes secrets, build artifacts, node_modules
- `netlify.toml` — Netlify build config and scheduled function declarations
- `netlify/functions/scheduled-ingest.ts` — scheduled feed refresh for cloud
- `lib/scheduler/index.ts` — environment-aware scheduler (node-cron locally, no-op on Netlify)
- `prisma/seed.ts` — seed initial sources so the tutor sees something on first load
- `.env.example` — all required env vars documented
- Updated `README.md` — setup instructions for both local and Netlify
- Verified `next.config.ts` — compatible with Netlify deployment

## Key Constraint: Netlify is Serverless
Netlify runs Next.js as serverless functions. This means:
- **No persistent processes** — node-cron cannot run; use Netlify Scheduled Functions instead
- **No Ollama** — Ollama requires a running local process with GPU; on Netlify, Gemini is always used
- **No local filesystem writes** — all state must be in the database (already the case)
- **Serverless function timeout** — default 10s, background functions up to 15 minutes; ingest jobs may need background function treatment for large feeds

## .gitignore
```
node_modules/
.next/
.env.local
.env
*.env
prisma/dev.db
dist/
.netlify/
```
Never commit `.env.local` or any file containing real secrets.

## netlify.toml
```toml
[build]
  command = "npm run build"
  publish = ".next"

[[plugins]]
  package = "@netlify/plugin-nextjs"

# Refresh all feeds every hour
[[scheduled_functions]]
  name = "scheduled-ingest"
  schedule = "0 * * * *"

[build.environment]
  NODE_VERSION = "20"
  NEXT_TELEMETRY_DISABLED = "1"
```

## Netlify Scheduled Function (netlify/functions/scheduled-ingest.ts)
```ts
// Runs on the cron schedule defined in netlify.toml
// Replaces node-cron for the cloud environment
import type { Config } from "@netlify/functions"
import { fetchAllSources } from "../../lib/ingest/runner"

export default async function handler() {
  await fetchAllSources()
}

export const config: Config = {
  schedule: "0 * * * *"
}
```

Create `lib/ingest/runner.ts` that the scheduler (both environments) calls:
```ts
// fetchAllSources(): Promise<void>
// Loads all enabled sources from DB
// Calls the appropriate fetcher per source type
// Catches and logs per-source errors without aborting others
```

## Environment-Aware Scheduler (lib/scheduler/index.ts)
```ts
// startScheduler(): void
// if (process.env.NETLIFY) return  // Netlify uses scheduled functions, not node-cron
// else: start node-cron jobs for each source interval
// Called once in Next.js instrumentation.ts (server startup hook)
```

Next.js instrumentation hook — create `instrumentation.ts` at project root:
```ts
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startScheduler } = await import('./lib/scheduler')
    startScheduler()
  }
}
```
Enable in `next.config.ts`: `experimental: { instrumentationHook: true }`

## Database: Neon Setup Instructions (for README)
1. Go to neon.tech, sign up free
2. Create a project → copy the connection string
3. Set `DATABASE_URL` in Netlify environment variables
4. Run `npx prisma migrate deploy` (not `migrate dev`) in the Netlify build command, or add it as a build plugin step:

```toml
[build]
  command = "npx prisma migrate deploy && npm run build"
```

## Environment Variables

### .env.example (commit this — no real values)
```
# Database
DATABASE_URL=postgresql://user:pass@host/dbname

# Auth
AUTH_PASSWORD=your-chosen-password
AUTH_SECRET=random-32-char-string-for-cookie-signing

# AI — local
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://host.docker.internal:11434
OLLAMA_MODEL=qwen2.5:14b

# AI — cloud (set this in Netlify dashboard)
GEMINI_API_KEY=

# Set automatically by Netlify — do not set manually
# NETLIFY=true
```

### In Netlify dashboard, set:
- `DATABASE_URL` — Neon connection string
- `AUTH_PASSWORD` — password you'll share with your tutor
- `AUTH_SECRET` — random string (generate with `openssl rand -hex 32`)
- `GEMINI_API_KEY` — from aistudio.google.com (free)
- `AI_PROVIDER` — set to `gemini`

## Prisma Seed (prisma/seed.ts)
Pre-populate the DB with the user's three sources so the tutor sees real content on first load:
```ts
// Seeds:
// 1. Source: The Enforcer (YouTube) — channel ID to be filled in
// 2. Source: r/worldnews (Reddit) — https://www.reddit.com/r/worldnews/.rss
// 3. Source: pizzint.com (Web) — https://pizzint.com
```
Add to `package.json`:
```json
"prisma": { "seed": "ts-node --compiler-options {\"module\":\"CommonJS\"} prisma/seed.ts" }
```
Run with: `npx prisma db seed`

## GitHub Setup
1. Create a new **private** repository on GitHub (private = tutor only sees what you share)
2. `git init` in the project root
3. `git remote add origin https://github.com/<username>/news-reader.git`
4. Initial commit and push to `main`

## Netlify Setup
1. In Netlify dashboard: "Add new site" → "Import from Git" → connect GitHub
2. Select the `news-reader` repo, branch `main`
3. Build settings are read from `netlify.toml` automatically
4. Add all environment variables in Site Settings → Environment Variables
5. Trigger first deploy — Netlify runs `prisma migrate deploy && npm run build`
6. Share the generated `.netlify.app` URL with your tutor along with the `AUTH_PASSWORD`

## Acceptance Criteria
- `git push origin main` triggers an automatic Netlify deploy
- Netlify build succeeds (prisma migrate + next build complete without errors)
- The `.netlify.app` URL is publicly accessible (login page appears)
- Tutor can log in with `AUTH_PASSWORD` and see the feed
- Feed sources are pre-populated via seed (no manual setup needed for tutor)
- Netlify scheduled function runs hourly and refreshes feeds
- On Netlify, AI provider automatically uses Gemini (Ollama not available)
- `.env.local` and secrets are not committed to GitHub

## Dependencies on Other Agents
- All agents (01–09) must be complete — this agent wires everything together for production
- Scaffold (01) — needs `next.config.ts` and project structure in place
- Database (02) — needs working migrations for `prisma migrate deploy`
- AI Engine (06) — Gemini must work as standalone provider (no Ollama fallback on Netlify)
