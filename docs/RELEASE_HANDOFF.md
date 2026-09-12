# Pile design release handoff

This pass redesigns the existing functional HackRice Work & Productivity MVP. It does not replace the architecture. Read this file with DESIGN.md, DESIGN_AUDIT.md, README.md and ARCHITECTURE.md before continuing.

## Product and visual intent

Pile turns a messy capture into tasks, dates and ideas while keeping the original source. Its board is a desk for the user's day. Today gets the first reading position, This week is a planning sheet, Later is a loose idea pocket, and the supporting calendar looks like a small paper calendar. Warm graphite text and purposeful type colors replace the earlier pale green serif interface.

The original functional pass already included all backend providers, ownership enforcement, persistent storage, source processing, CRUD, calendar approval, fixture extraction and eleven browser flows. This pass adds a new visual system, slim navigation, semantic note colors, source-specific cards, visible source receipts, actual image previews, extracted PDF text sheets, sorting feedback, completion feedback, a labeled recorder, reliable dialog focus restoration, responsive layouts and accessibility regression checks.

## Components and edit locations

| File / component                           | Responsibility                                                                                          | Inputs / state                                                                   |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| app/globals.css                            | Entire visual token system, layouts, objects, states, breakpoints and motion                            | CSS custom properties in :root; breakpoint blocks at end                         |
| app/layout.tsx                             | Local font imports and metadata                                                                         | Instrument Sans Variable and Caveat 500                                          |
| components/pile-card.tsx / PileCard        | Type-colored extracted note; title, description, date, project, complete and source receipt             | item, source, formatted date, onEdit, onComplete, onSource, arriving, completing |
| components/source-card.tsx / SourceCard    | Original source representation; compact board and full inbox modes                                      | source, item count, live review count, date, compact, onOpen, onReview           |
| components/source-card.tsx / SourcePreview | Actual image or PDF extracted-text sheet; voice transcript                                              | source; never invents audio duration/playback                                    |
| components/workspace.tsx / Workspace       | Route-specific composition, state snapshot, capture, search, navigation, calendars, sources and dialogs | view; snapshot, busy, selection, query, sorting receipt and transient item IDs   |
| components/workspace.tsx / Modal           | Radix overlay, title, description, keyboard focus containment and return                                | open, onClose, title, description, wide, children                                |
| components/workspace.tsx / ItemEditor      | Existing item form and calendar/remove/edit rules                                                       | item, source, onSave/onCalendar/onArchive/onDelete; local busy/error             |
| components/workspace.tsx / ReviewPanel     | Source extraction list; confidence restrictions and explicit approvals                                  | items, calendarName, onEdit/onApprove; selected IDs, busy/error                  |
| components/workspace.tsx / VoiceCapture    | MediaRecorder, timer, editable transcript and explicit demo sample                                      | real, demo, onCapture; recorder/stream refs, activity, seconds, recording        |

Shared classes are intentionally small semantic primitives: pile-card, source-card, source-receipt, capture-box, small-button, primary-button, icon-button, field-label, modal, error-banner and mode-pill. Do not introduce per-route competing palettes or random typeface changes.

## Existing technical architecture

Next.js 16.3.4 App Router / React 19.3.0 / strict TypeScript. Root / redirects to /app. app/app/[[...view]]/page.tsx passes the optional route parts into Workspace. app/api/[...path]/route.ts implements the API surface.

lib/db.ts chooses pg when DATABASE_URL exists, otherwise disk-backed PGlite. migrations/001_initial.sql defines the relational schema. Browser ownership uses opaque cookies resolved by lib/session.ts. Upload bytes are stored in PostgreSQL, not public files. Access goes through the session-protected file API.

A capture POST saves its source before interpretation. The process endpoint claims a queued source, chooses the provider, validates structured output, infers projects, and writes linked items and final source status transactionally. Failed jobs remain retryable; stale claims can be reclaimed. The processing is still request-bound, not a durable worker.

lib/ai.ts has a deterministic local parser and an OpenAI-compatible provider; schemas live in lib/model.ts. chrono-node plus timezone helpers interpret dates. lib/files.ts extracts real PDF text and handles images. Only the exact byte-verified sample flyer receives the demo image fallback. Arbitrary images require a vision provider.

lib/calendar.ts contains DemoCalendar and Google Calendar adapters. Calendar additions require explicit review or item action. Stable revision-based IDs prevent repeated approval duplicates; re-adding after deletion uses a new revision. OAuth tokens are encrypted. Google remains one primary calendar with one-way create/remove and upcoming-event retrieval.

lib/memory.ts offers local source-aware retrieval and optional Backboard memory. A Backboard thread is bound to its first Pile workspace; other sessions fall back to local retrieval. Remote memory can contain older context after local deletion.

## Integration truth

- Local/demo is fully functional: text capture, editable voice transcripts, actual microphone recording, PDF extraction, byte-verified sample image extraction, file storage, source linkage, CRUD, projects, keyword search and persistent demo calendar.
- MediaRecorder records actual browser audio. Without an API key it does not transcribe it; the UI says so. The demo sample is separately requested and labeled. Audio bytes are not retained after transcription; source history stores the transcript.
- The voice waveform is a status illustration, not an amplitude measurement. The timer reflects recording time; loading a sample clears it.
- OpenAI text/vision/transcription, Google OAuth/calendar, Backboard, hosted PostgreSQL and Tiger Data have implementation paths but no live credentials were supplied or tested in this pass.
- No authentication/account recovery, background queue, recurring calendar events, two-way synchronization, arbitrary offline image OCR, audio playback, native mobile app or freeform drag-positioning was added.

## Run and check

```sh
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Keep http://127.0.0.1:3001 consistent across browsers and OAuth. Stop the server before migration/seed CLI commands access the same embedded data directory. For production, stop dev, run pnpm build, then pnpm start.

```sh
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm test:integration
pnpm test:e2e
pnpm build
pnpm secret:scan
```

Current suites: 15 unit, 13 integration, 15 E2E (11 preserved + 4 design/accessibility regressions). The design suite checks six routes at four sizes, automated WCAG A/AA at desktop/mobile, Today visibility, source previews, keyboard recorder/dialog behavior, reduced motion, truthful sorting, and failure recovery. Fake microphone devices are test-only Chromium launch arguments; they do not affect product audio.

## Demo in 110 seconds

1. 0–12s: Start /app in a new browser context. Show three Today notes, rose deadline, lavender idea, paper calendar and the capture tray.
2. 12–38s: Talk it out → Use sample transcript. Say clearly that this is the credential-free demo sample. The transcript reads: “I need to finish the HackRice presentation by tomorrow morning, email Maya about our meeting, and my dentist appointment is Tuesday at 3 PM.” Sort my words. Show the receipt and review. The morning deadline asks for clarification; Pile does not silently invent an exact time. Close review.
3. 38–65s: Scroll to Try a syllabus or attach demo-assets/sample-syllabus.pdf. Show the six dates, scroll the review list while approval stays reachable, then Add 6 to calendar.
4. 65–84s: Try an event flyer or upload demo-assets/sample-event.png. Approve HackRice Closing Ceremony, September 20, 2026, 3 PM, RMC Grand Hall.
5. 84–98s: Calendar → Jump to date September 20, 2026. The week contains the ceremony, September 21 assignment and September 22 office hours. They explicitly say Demo calendar.
6. 98–110s: Search “What did I say about Maya?” → source receipt. Show the original voice transcript. This closes the capture→action→memory story.

The fixtures are fixed Fall 2026 documents; use the date picker, not an assumption that their dates are this week. Live text uses the current local date. The sample syllabus emits 14 total items with six dates under the local parser; its headings become additional notes. This is a known demo-parser limitation.

## Storage and configuration

Default data lives in .data/pile, ignored by Git. DATABASE_URL selects standard PostgreSQL. DATA_DIR overrides only the embedded directory. Sources, files, extracted items, projects, events, users, provider token records and memory ownership live in the database. A new browser session is independently seeded in demo mode with HackRice, Calculus, Personal and Job Search; five starter items; three sample calendar events. Browser refresh preserves identity and data. Deleting a source removes its extracted items subject to existing synced-calendar safeguards.

Every configuration variable is documented in README.md and .env.example: DEMO_MODE, DATABASE_URL, DATA_DIR, OPENAI_API_KEY, OPENAI_BASE_URL, OPENAI_MODEL, OPENAI_TRANSCRIPTION_MODEL, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI, TOKEN_ENCRYPTION_KEY, BACKBOARD_API_KEY, BACKBOARD_THREAD_ID, BACKBOARD_BASE_URL. None is needed beyond default/demo values for the local demonstration. Google requires all OAuth/encryption fields. Backboard requires key and a dedicated existing thread. Provider secrets remain on the server.

## Remaining priorities

1. Live provider rehearsal: configure credentials and validate voice→extraction→Google approval, plus Backboard retrieval. High hackathon impact, medium cost, external integration risk; lib/ai.ts, lib/calendar.ts, lib/memory.ts, .env.local.
2. Better PDF item triage: suppress document furniture, group dates and notes, select dated items quickly. High demo impact, medium cost, extraction/regression risk; lib/ai.ts and ReviewPanel. Preserve source text and the six genuine dates.
3. Demo presentation mode: reliable reset of a dedicated synthetic workspace and route shortcuts, without touching real data. High presentation value, medium cost, data-deletion risk if scoped poorly; lib/store.ts, session/API and Settings.
4. Large-pile navigation: collapsing past/later groups, project/source filters, and more compact search lists. High product value, medium cost, low backend risk; Workspace, PileCard and globals.css. Never silently hide tasks.
5. Production foundation: recoverable authentication, quotas, hosted PostgreSQL, durable processing and deployment. High long-term value, high cost, lower last-minute hackathon relevance; lib/session.ts, lib/db.ts, lib/pipeline.ts and API.

Design opportunities: source content snippets in search; PDF page thumbnails via a deliberate renderer; real audio amplitude display and optional retained playback; stronger empty-project recovery; smart multi-day calendar treatment; overflow-density modes; reduced visual repetition when Today grows past three. Preserve the current coherent colors and typography while solving these specific problems.

## Next Codex session

Do not rebuild this application. Verify git status and the remote head first, read AGENTS.md and the local Next docs relevant to your changes. Start with DESIGN.md and this handoff; tokens are in app/globals.css, board and flow orchestration in components/workspace.tsx, reusable objects in pile-card.tsx and source-card.tsx. Backend behavior is established and tested. Keep the original-source contract, ownership, transaction/claim behavior, calendar approval and idempotency.

Use the existing pnpm commands and port 3001. Demo mode needs no credentials. Rehearse the exact sequence above before judging extraction. Do not confuse sample transcription with a live speech service, and do not spend another session recreating provider scaffolding, changing frameworks or reskinning every screen. The highest-value next work is live integration verification, then PDF triage. Run all affected tests, the 15-browser-flow suite and a production build before publishing further changes. With a running local server, `pnpm screenshots` regenerates the curated demo/state screenshots in isolated browser contexts and the accessibility report. Curated screenshots are under docs/screenshots; routine tests write to test-results so they do not overwrite demo images.
