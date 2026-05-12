# Agent: Scaffold

## Responsibility
Bootstrap the entire project structure. This agent runs first and produces the skeleton that all other agents build on top of.

## Output
A working Next.js 14 app (App Router, TypeScript) that starts with `docker compose up` and connects to PostgreSQL via Prisma.

## Stack
- Framework: Next.js 14 (App Router)
- Language: TypeScript (strict mode)
- Database ORM: Prisma
- Container: Docker Compose (two services: `app` and `db`)
- Styling: Tailwind CSS (mobile-first)
- Package manager: npm

## Folder Structure to Create
```
news-reader/
  app/                        # Next.js App Router pages
    (auth)/
      login/page.tsx
    (app)/
      layout.tsx
      page.tsx                # redirects to /feed
      feed/page.tsx
      sources/page.tsx
      settings/page.tsx
  components/                 # Shared React components
  lib/
    db.ts                     # Prisma client singleton
    auth.ts                   # Password gate helpers
  prisma/
    schema.prisma
    migrations/
  agents/                     # Agent briefs (this folder — do not modify)
  .env.example
  .env.local                  # gitignored
  docker-compose.yml
  Dockerfile
  SPEC.md
```

## docker-compose.yml
Two services:
- `db`: postgres:16-alpine, volume-mounted data, env vars POSTGRES_USER/PASSWORD/DB
- `app`: builds from Dockerfile, depends_on db, mounts `.env.local`, exposes port 3000

## Dockerfile
Multi-stage: builder (npm ci + prisma generate + next build) → runner (node:20-alpine, non-root user, copies build output).

## .env.example
```
DATABASE_URL=postgresql://newsreader:newsreader@db:5432/newsreader
AUTH_PASSWORD=changeme
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://host.docker.internal:11434
OLLAMA_MODEL=qwen2.5:14b
GEMINI_API_KEY=
```

## Prisma Setup
- `prisma/schema.prisma`: datasource postgresql, generator client
- Run `prisma migrate dev --name init` to create initial empty migration
- Export a singleton Prisma client from `lib/db.ts` safe for Next.js hot reload

## Auth
- Middleware-based password gate: `middleware.ts` at root
- Checks for a signed session cookie; if absent, redirects to `/login`
- Login page: single password field, POST to `/api/auth/login`, sets httpOnly cookie
- No user accounts — single shared password from `AUTH_PASSWORD` env var

## Dependencies to Install
```
@prisma/client prisma
next react react-dom
typescript @types/node @types/react @types/react-dom
tailwindcss postcss autoprefixer
```

## Acceptance Criteria
- `docker compose up` starts both services with no errors
- `http://localhost:3000` shows the login page
- After entering the correct password, redirects to `/feed`
- Prisma Studio (`npx prisma studio`) can connect to the database
- All other pages (`/sources`, `/settings`) render without runtime errors (can be empty shells)

## Dependencies on Other Agents
None — this runs first.
