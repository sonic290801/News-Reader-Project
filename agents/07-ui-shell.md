# Agent: UI Shell

## Responsibility
Build the application shell: layout, navigation, auth gate, source management UI, and settings page. This is the structural frame that all view agents plug into.

## Output
- `app/(auth)/login/page.tsx` — password login page
- `app/(app)/layout.tsx` — main app layout with nav
- `app/(app)/sources/page.tsx` — source list + add/edit/delete
- `app/(app)/settings/page.tsx` — AI provider settings
- `components/nav/` — navigation components
- `components/ui/` — base UI primitives (button, input, badge, spinner, etc.)
- `middleware.ts` — auth guard

## Design Principles
- Mobile-first Tailwind CSS — must look good on a phone browser
- Dark mode by default (news reading is often done at night)
- Minimal, content-focused — no decorative chrome
- Navigation: bottom tab bar on mobile, left sidebar on desktop (responsive)

## Auth — middleware.ts
```ts
// On every request to /(app)/*:
//   Read signed session cookie "nr_session"
//   If missing or invalid: redirect to /login
// /login, /api/auth/* are public
// Sign cookie with AUTH_SECRET env var (add to .env.example)
// Session is valid for 30 days
```

## Login Page — app/(auth)/login/page.tsx
- Single password input + submit button
- POST to /api/auth/login
- On success: redirect to /feed
- On failure: show "Incorrect password" inline
- No username field — single shared password

## App Layout — app/(app)/layout.tsx
Navigation items:
- Feed (home icon) → /feed
- Sources → /sources
- Settings → /settings

Responsive behaviour:
- Mobile: fixed bottom tab bar with icons + labels
- Desktop (md+): fixed left sidebar, 64px wide collapsed / 200px wide expanded on hover
- Active item highlighted

## Source Management — app/(app)/sources/page.tsx

### Source list
- Cards for each source showing: label, type badge (RSS / Reddit / YouTube / Web), category, fetch interval, enabled toggle, last fetched time, error state indicator
- "Add Source" button opens an add source modal/drawer

### Add Source modal
Multi-step based on detected type:
1. User pastes a URL
2. App calls the appropriate resolve endpoint to detect type and validate:
   - RSS/Atom → /api/sources/resolve-rss (validate feed parses)
   - Reddit → detect reddit.com/r/ pattern, auto-construct RSS URL
   - YouTube → /api/sources/resolve-youtube (extract channel ID)
   - Web → /api/sources/resolve-web (preview detected article links)
3. Show detected source name / preview
4. User sets: label (pre-filled), category (dropdown), fetch interval, autoFetchTranscript (YouTube only)
5. Save → POST /api/sources

### Source actions (per card)
- Edit (label, category, interval, selector override)
- Refresh now (trigger manual ingest)
- Enable / disable toggle
- Delete (with confirmation — warns that all items will be deleted)

## Settings Page — app/(app)/settings/page.tsx

Sections:

### AI Provider
- Radio: Ollama (local) | Gemini (cloud, free)
- Ollama section: base URL input (default http://localhost:11434), model name input, "Test connection" button → calls /api/ai/status
- Gemini section: API key input (masked), link to aistudio.google.com
- Status badge: "Ollama running — qwen2.5:14b ready" or error state

### Summary Preferences
- Summary depth: Brief / Standard / Deep (radio)
- Show analysis section: toggle

### Data
- Retention: "Keep articles for X days" (number input, default 30)
- "Clear all read items" button (with confirmation)

## Base UI Components (components/ui/)
Build minimal versions of:
- `Button` — variants: primary, secondary, ghost, destructive
- `Input` — text input with label + error state
- `Badge` — small coloured label (for source type, category)
- `Spinner` — loading indicator
- `Modal` — accessible dialog with backdrop
- `Toggle` — on/off switch
- `Select` — styled dropdown

Use Tailwind only — no component library dependency.

## Acceptance Criteria
- Login page works: correct password → /feed, wrong password → error message
- Unauthenticated requests to /feed are redirected to /login
- Sources page lists all sources with correct type badges
- Add Source modal detects YouTube vs RSS vs Reddit vs Web from the URL
- YouTube source resolves channel ID and displays channel name
- Settings page saves AI provider and preferences to DB
- "Test connection" correctly reports Ollama status
- Layout is usable on a 390px-wide phone screen (no horizontal scroll)
- Dark mode is default, respects prefers-color-scheme

## Dependencies on Other Agents
- Scaffold (01) — project structure and auth env vars
- Database (02) — source CRUD, getSettings, updateSettings
- All ingest resolve endpoints (03, 04, 05) — used during add-source flow
