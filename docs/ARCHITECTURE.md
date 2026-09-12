# Architecture

## Application structure

- `app/app/[[...view]]/page.tsx`: board, inbox, calendar, projects, search, settings.
- `components/workspace.tsx`: interactive workspace, capture controls, accessible item/review/voice dialogs.
- `app/api/[...path]/route.ts`: session-scoped JSON/file endpoints. Mutations reject browser requests with a mismatched Origin/Host.
- `lib/model.ts`: Zod extraction contract and board/date/domain rules.
- `lib/ai.ts`: real and deterministic parsing, relative dates, transcription.
- `lib/pipeline.ts`: persisted job claim, processing, validation, atomic item creation, retryable errors.
- `lib/store.ts`, `lib/db.ts`: ownership-filtered storage and SQL connection abstraction.
- `lib/calendar.ts`: demo and Google adapters, encrypted tokens and stable event IDs.
- `lib/memory.ts`: local source-aware retrieval and optional Backboard memory.

## Database

The SQL migration runs on PGlite or PostgreSQL. `users` owns browser sessions (only a hash of the random session token is stored). `sources` owns the original text and optional file bytes. `items` has a source foreign key and optional project foreign key. Flexible domain fields live in JSONB while IDs, ownership and relationships are indexed relational columns.

`projects` is unique by user/name. `calendar_links` is unique by item. `processing_jobs` records one processing state per source, and `activity_events` captures the small operational timeline. `oauth_tokens` stores AES-GCM encrypted credentials. Backboard’s optional `memory_owner` association binds a configured personal thread to one browser workspace.

Source deletion cascades to items and local links. A source with synced calendar items cannot be deleted until those calendar events are removed, preventing silent orphaning. Every source/item read and mutation is scoped to the session owner.

## File and AI pipeline

Uploads are limited to 8 MB and accepted by a small extension allowlist. Image signatures are checked. The original is stored, then PDF bytes are parsed with `pdf-parse`. Text or vision output is validated with Zod before any item is saved. Large extraction batches and uncertainty go to review.

The OpenAI-compatible adapter requests JSON, provides the contract plus current time/timezone/project context, validates the result and retries once. Unknown fields and malformed output are rejected. Source text is treated as untrusted data. Model output never calls external tools or executes application actions. Product explanations are short source/type summaries, not chain-of-thought.

The demo parser uses chrono-node against the user’s local wall clock, converting timed results to ISO instants. Unscheduled notes and ideas remain undated. Imprecise timing is flagged. Demo flyer extraction requires an exact SHA-256 match to the checked-in fixture; an arbitrary file with the same name cannot masquerade as the fixture.

`POST /capture` saves a source. `POST /process/:id` atomically claims its job. A claim older than two minutes can be retried; provider timeouts are shorter. The item/project creation and final source status use one transaction. Queued/error captures remain visible in the inbox.

## Calendar

OAuth uses a short-lived, HTTP-only state cookie, a server-side code exchange, refresh tokens, and AES-256-GCM encryption. Tokens never enter client state or source control. All-day deadlines have an exclusive next-day end. Timed events use timezone-aware timestamps and a one-hour default duration when no end was given.

An event ID derived from the item UUID and calendar revision is sent to Google. Removing an event increments the revision so re-adding it does not reuse a deleted Google event ID. Repeating the same request uses the same ID; the database also enforces one link per item. Google 409 on insertion means the stable ID already exists. Failed requests keep the item retryable and do not claim it synced. A real Google account is used only after the workspace has connected OAuth; otherwise the explicit demo adapter is used in demo mode.

## Memory/search

Local search checks titles, descriptions, project names, filenames and preserved source text. It remains available without providers. A dedicated, configured Backboard thread can store source summaries and supply a recalled answer alongside local item matches. Its association is restricted to the first workspace that uses it. Historical external memory is labeled separately; local item results still obey current session ownership and archived/deleted state.

## Operational scope

The default is a loopback-bound personal demo with opaque browser sessions and persistent local disk. Migrations and seed scripts run before the server. Run only one process per embedded PGlite data directory. A standard `DATABASE_URL` switches to `pg`; a production service would add accounts, a durable job runner, object storage, rate limits and deployment controls.

## Reference documentation

- [Next.js route handlers](https://nextjs.org/docs/app/getting-started/route-handlers)
- [PGlite filesystem persistence](https://pglite.dev/docs/filesystems)
- [Google Calendar event creation](https://developers.google.com/workspace/calendar/api/guides/create-events)
- [Backboard messages and memory](https://docs.backboard.io/concepts/messages)
