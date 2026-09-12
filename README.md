# Pile

**Dump anything in. Pile turns voice notes, files, screenshots, and messy thoughts into an organized plan.**

A warm, quiet bulletin board for a busy mind. Built for **HackRice 16 · Work & Productivity**.

![Pile’s bulletin board](docs/screenshots/board.png)

## What Pile Does

Your life arrives in fragments: a voice note on a walk, a deadline in a syllabus, a screenshot of an event, a thought between meetings. Pile gives those fragments one place to land.

Capture something, watch it become useful tasks, events, reminders, notes, ideas, and references, then act on it. The original source stays attached. Uncertain details come back to you for a quick review. Calendar changes happen only when you approve them.

## Core Features

- **Natural-language capture:** split a brain dump into dated, project-associated items.
- **Voice:** microphone recording with timer and waveform, editable transcription, and an explicit sample-transcript path without credentials.
- **PDFs:** actual text extraction, with bulk review before adding dates to the calendar.
- **Images:** an OpenAI-compatible vision adapter, plus a byte-verified sample-flyer fallback in demo mode.
- **Files:** PDF, PNG, JPEG, TXT, and Markdown; drag/drop or a file picker, up to 8 MB.
- **Board:** Today, This week, Later, and a review inbox; complete, reopen, edit, schedule, and archive items.
- **Manual entry:** create a task or idea exactly as you want it, without an AI call.
- **Source traceability:** original text, transcription, and uploaded files remain available; source deletion also removes its items.
- **Calendar:** agenda/week view, explicit approvals, all-day deadlines, repeat-safe event creation, and event removal.
- **Projects:** automatic lightweight spaces with their items and source context.
- **Search:** source-aware keyword retrieval, with optional Backboard memory.
- **Demo mode:** immediate entry, isolated browser workspaces, disk-backed data, seeded projects and calendar, and offline fixtures.

## Why We Built It

Saving information is easy. Doing the organizational work afterward is the hard part. We wanted one place where a messy thought could become something useful without opening five apps or filling out a form.

Pile is a capture-and-action workspace. The interface leads with your board and what needs attention; a conversation window is not the product.

## Running Locally

Requires **Node.js 22 or newer** and **pnpm 11**. The validated environment used Node.js 26.0.0 and pnpm 11.19.0.

```bash
git clone https://github.com/Mohit-Bapatla/pile.git
cd pile
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Open **http://127.0.0.1:3001**. The port is deliberately 3001. Keep the hostname consistent so the browser uses the same session cookie.

For the production build:

```bash
pnpm build
pnpm start
```

Stop the development server before starting production on the same port. Run migrations/seeding before starting a server, not concurrently with a server using the embedded database.

## Demo Mode

`DEMO_MODE=true` is the default. No API keys, database service, account registration, or OAuth are required. Each new browser session receives its own seeded workspace. Reloading retains that workspace, its sources, and calendar changes.

The fallback parser uses deterministic language/date rules. It is clearly identified in Settings and in source details. It is useful for live text, but does not claim the breadth of an LLM. Ambiguous phrases such as “tomorrow morning” need a precise date/time review. When a configured AI provider is unavailable, demo mode falls back to local text parsing; production mode preserves the source with an error instead.

Fonts, fixtures, and application assets are bundled locally. Arbitrary screenshots need a configured vision provider; renaming a file to the sample flyer does not trigger fake extraction. A sample transcript is never presented as transcription of the user’s recording.

## Demo

A 90-second route through Pile:

1. Open `/app`. Show the seeded Today / This week / Later board.
2. Click **Talk it out → Use sample transcript → Sort my words**. With a configured transcription key, record your own dump instead. The sample mentions the HackRice presentation, emailing Maya, and a dentist appointment. Review the imprecise morning deadline using **Edit**.
3. Click **Try a syllabus**, or upload `demo-assets/sample-syllabus.pdf`. The review contains **six dates**: three assignments, midterm, final, and office hours. Select which to keep; click **Add 6 to calendar** to approve all dated entries.
4. Click **Try an event flyer**. Review “HackRice Closing Ceremony,” September 20, 2026, 3 PM America/Chicago, RMC Grand Hall. Click **Add 1 to calendar**.
5. Open **Calendar** and use the week arrows to find the approved events. Entries explicitly identify the demo calendar.
6. Open **Search** and ask **“What did I say about Maya?”** Open an item and expand its source.
7. Complete a task. Use **Completed** to see it, or reopen it.

Also try this live text:

> Physics exam Tuesday at 2 PM and remind me to email Alex tomorrow.

Use **Settings → Your demo kit** to download the three fixtures. `pnpm fixtures` regenerates them. Fixture dates are intentionally printed, fixed Fall 2026 dates; new text uses the current local date.

## Screenshots

The board screenshot above and [mobile view](docs/screenshots/mobile.png) are captured from the running application with Playwright. The UI adapts to narrow screens and dialogs fit the viewport. Add more screenshots here as the product evolves.

## Tech Stack

- Next.js 16 App Router, React 19, strict TypeScript
- CSS design tokens, locally bundled DM Sans / DM Serif Display, Lucide icons
- Radix accessible dialog primitives, CSS transitions with reduced-motion support
- Zod structured-output validation, chrono-node and date-fns-tz for dates
- PGlite embedded PostgreSQL for local persistence; `pg` for hosted PostgreSQL
- `pdf-parse` for PDF text, MediaRecorder for audio capture
- Vitest, Playwright, ESLint, Prettier

## Architecture

```text
text / voice / PDF / image / file
                  ↓
          persisted source + job
                  ↓
        parsing provider + validation
                  ↓
      linked items + inferred projects
                  ↓
        board + review + source history
                  ↓
     approved calendar actions / search
```

A source is saved before interpretation. Failed processing preserves the source and can be retried. A database claim prevents parallel requests from processing the same source twice. Items and their source status are committed in one transaction.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the schema, provider boundaries, and operational constraints.

## Integrations

| Capability         | Included implementation                                                                                    | Default in this repository                                            |
| ------------------ | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Text understanding | OpenAI-compatible Chat Completions, JSON contract, Zod validation, one retry and bounded timeouts          | Deterministic local parser                                            |
| Vision             | OpenAI-compatible image input                                                                              | Exact sample flyer only; other images get a clear configuration error |
| Transcription      | OpenAI-compatible audio transcription API                                                                  | Editable sample transcript or typed text                              |
| Google Calendar    | OAuth state protection, encrypted token storage, token refresh, upcoming events, create/remove, stable IDs | Persistent demo calendar                                              |
| Database           | Standard PostgreSQL through `pg`, or embedded PGlite with the same SQL migration                           | Disk-backed PGlite                                                    |
| Backboard.io       | Optional persistent source-memory writes and memory-assisted search, with local retrieval fallback         | Local search                                                          |
| Tiger Data         | Compatible PostgreSQL connection through `DATABASE_URL`                                                    | No hosted Tiger Data service connected                                |

**No external provider is preconnected or bundled with credentials.** The real adapters are implemented, but their live authenticated behavior was not exercised without credentials. Tests exercise the complete local/demo system. This is a local hackathon MVP, not a deployed multi-tenant SaaS service.

### Configuration

Copy `.env.example` to `.env.local`. All values below are optional for demo mode.

| Variable                     | Purpose / default                                                                      |
| ---------------------------- | -------------------------------------------------------------------------------------- |
| `DEMO_MODE`                  | `true`; set `false` to disable demo parsing, seed and calendar fallbacks               |
| `DATABASE_URL`               | PostgreSQL connection string; uses `pg` if supplied                                    |
| `DATA_DIR`                   | Embedded PostgreSQL directory; default `.data/pile`                                    |
| `OPENAI_API_KEY`             | Server-side text, image, and transcription credential                                  |
| `OPENAI_BASE_URL`            | Default `https://api.openai.com/v1`                                                    |
| `OPENAI_MODEL`               | Default `gpt-4.1-mini`; must support JSON output and images to use vision              |
| `OPENAI_TRANSCRIPTION_MODEL` | Default `whisper-1`                                                                    |
| `GOOGLE_CLIENT_ID`           | OAuth web client ID                                                                    |
| `GOOGLE_CLIENT_SECRET`       | OAuth web client secret                                                                |
| `GOOGLE_REDIRECT_URI`        | Exact registered callback; default example `http://127.0.0.1:3001/api/oauth/callback`  |
| `TOKEN_ENCRYPTION_KEY`       | At least 32 random characters; protects OAuth tokens with AES-256-GCM                  |
| `BACKBOARD_API_KEY`          | Optional Backboard credential                                                          |
| `BACKBOARD_THREAD_ID`        | Existing dedicated personal thread; bound to the first Pile workspace that uses memory |
| `BACKBOARD_BASE_URL`         | Default `https://app.backboard.io/api`                                                 |

To configure Google Calendar, enable the Calendar API in a Google Cloud project, create an OAuth web client, register the exact redirect URI above, and add your test account if the consent screen is in testing. Set the four Google/encryption values and restart. Use **Settings → Connect**. Pile requests the `calendar.events` scope, stores encrypted server-side tokens, and never automatically creates calendar events.

Use a fresh, dedicated Backboard thread for this demo. Its first Pile workspace owns that thread association; other browser sessions use local search. Backboard memory can retain older context, even after a local source is deleted. Do not reuse a thread containing another person’s information. This adapter is optional and not presented as a verified sponsor deployment.

## Testing

```bash
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm test:integration
pnpm test:e2e
pnpm build
```

Install the browser once if needed:

```bash
pnpm exec playwright install chromium
```

Playwright starts or reuses the server on port 3001. Each test uses a separate browser workspace. Unit tests cover schema validation, dates/timezones, classification, board sections, project associations, confidence, source linking, and calendar IDs. Integration tests use a fresh PostgreSQL engine and run real file extraction, the source pipeline, persistence, search, deletion, and calendar approval. Browser tests exercise the primary user flows and check desktop/mobile rendering.

`.data/`, secrets, dependencies, build output, traces, and Playwright reports are ignored. Only synthetic fixture assets and curated screenshots are committed.

## Known Limits

- Demo parsing is rule-based; complex language needs a configured AI provider. General image OCR needs vision credentials. Scanned PDFs without text return a clear error.
- Demo sessions are browser-cookie workspaces, not recoverable accounts. The default server binds to loopback; public deployment requires real authentication, quotas, and deployment-specific security controls.
- Embedded PGlite is for a single application process with persistent disk. Use hosted PostgreSQL for multi-instance/serverless deployment; uploaded bytes are stored in the database for this MVP.
- Processing happens in an HTTP request, with a persisted retryable job state. It is not a durable background worker.
- Google Calendar support is one primary calendar, explicit one-way creation/removal, and fetching the next 100 upcoming events. Editing a synced item requires removing its calendar event first. No recurring events or two-way reconciliation.
- Backboard is optional personal memory, not a full semantic index of current items; local source-aware keyword results always remain available.

## HackRice 16

Built for the **Work & Productivity** track: less organizational labor, more room to think.

## Team

Add your team’s names, roles, and links here.
