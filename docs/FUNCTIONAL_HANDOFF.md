# Pile functional release handoff — September 12, 2026

## 1. MVP verdict

**READY FOR HACKATHON DEMO in local/demo mode.** This is not a claim that live ElevenLabs, Backboard, Tiger Data or Google accounts were verified. No credentials for those services were available. Physical microphone speech was not manually verified. The demo should use live text, selective syllabus import, real Apple calendar-file export and truthful demo-calendar labeling.

Repository: https://github.com/Mohit-Bapatla/pile
Branch: main
Functional implementation commit: fcdfb3d3731ce82ccd4fce0a1ab1a3b87ff3265c
Local production URL: http://127.0.0.1:3001/app

The final chat handoff records the exact release SHA and successful GitHub Actions run. Within a checkout, `git rev-parse HEAD` is authoritative. This file is committed as part of the release and therefore cannot contain its own final content-addressed commit SHA.

## 2. What changed

### Search

Replaced shared-source substring matching with weighted token search. Exact title and title-prefix matches outrank project, filename, category and content. Multi-term queries require all meaningful terms; common plurals and deadline/due variants normalize. Source documents are independent results, so a Maya mention no longer makes every sibling card match. Legacy shared source-prefix excerpts are excluded. Conversational Backboard results merge by owned item ID and score; direct short queries remain lexical. Empty matches stay empty.

### Extraction

Added explicit actionability scoring, tiers, a shared post-filter, evidence clauses, structured recurrence, course metadata and deduplication. The schema permits zero candidates. A dedicated syllabus path produces one course project and bounded schedule candidates. Optional office hours/tutoring stay out of Today and are unchecked by default. The AI prompt explicitly prohibits exhaustive extraction and gives negative examples.

### Review

The paper review groups Calendar, Tasks & deadlines, Optional schedule and Useful references. It shows useful counts, select-all-important/clear, nested candidate editing without losing import context, source details, Save to Pile, a second calendar confirmation and Apple export. Capture toasts no longer overlap an open review.

### Timezone

The first browser timezone is persisted. Settings offers a searchable common-zone datalist and accepts valid IANA zones. Timed parsing/editor inputs convert to canonical UTC instants; displays use the preference. All-day dates remain date-only strings. Recurring schedules retain their schedule timezone across DST.

### Google Calendar

Added selected-calendar preferences, calendar-list scope, disconnect/reconnect UI, recurrence payloads, stored destination IDs and conditional updates. A linked edit reads the existing event, checks Pile ownership and sends a full update with its etag. Existing unrelated event fields remain. Stable event IDs protect retry creation; calendar revisions protect remove/re-add.

### Apple Calendar

Added real single/bulk `.ics` downloads, predictable filenames, stable UIDs, UTC stamps, source URLs, text escaping, UTF-8 byte folding, all-day exclusive ends, bounded RRULEs and explicit timezone observances. Exports do not mark items synced.

### ElevenLabs

Added server-side Scribe v2 transcription independently of OpenAI. The recorder selects a supported format, stops tracks, displays transcription progress, preserves measured duration, presents an editable transcript and sends it through the normal capture pipeline. The sample transcript remains explicitly labeled.

### Backboard

Replaced the old thread-message/answer path with explicit assistant memories and semantic search. Each browser workspace gets its own assistant. High-value items carry IDs, project, type and date metadata. Memory IDs are persisted for updates and deletion. Source prose is not indexed as dozens of memory writes. Corrections and meaningful preferences can be saved as one note.

### Tiger Data

`TIGER_DATABASE_URL` now takes precedence over `DATABASE_URL`. The existing PostgreSQL abstraction and migrations apply to hosted Tiger connections. Local fallback remains disk-backed PGlite. No extension or vector pipeline was added.

### Assets/UI

Replaced the fixtures with an original three-page university-style syllabus, restrained typographic event poster and realistic meeting notes. PDF previews render actual pages server-side; images stay images, voice remains a transcript with duration, and text stays readable. The existing warm board, typography, colors and responsive structure remain.

## 3. Root causes fixed

- **Search returned everything:** every item was scored against the whole shared source, so `recruiter` matched all five seed cards. OR substring scoring and a zero-token fallback compounded the bug.
- **Syllabus produced junk:** the fallback parser mapped every line to an item and fell back to `note`; the schema required at least one item. No actionability or metadata distinction existed. Every source prefix was copied into every excerpt.
- **Voice did not produce a real transcript:** the only real path depended on OpenAI credentials and Whisper. ElevenLabs was not wired to the recorder or server endpoint.
- **Calendar/zone gaps:** only one-off event payloads existed; synced edits were blocked, there was no ICS path, and the browser timezone was not a stored preference.

The baseline, decisions and sources are documented in `docs/FIX_PASS.md`.

## 4. Final extraction policy

- **Tier A / important:** actions, explicit reminders, dated assignments, assessments, deadlines, required events/classes, appointments and schedule changes. Default selected in review when confident.
- **Tier B / optional:** office hours, tutoring and optional review schedules. Unchecked by default and placed in Later, not Today. Users can change their tier to Important / Calendar.
- **References:** intentionally useful resources may be retained; ordinary course links/contact fields remain metadata.
- **Metadata:** course name, instructor, email, website, location, class schedule, term start/end and source link belong to the source/project.
- **Ignored as cards:** headings, repeated headers, page numbers, decorative text, generic overview/policy/assessment prose, standalone professor/contact/Canvas entries and duplicate facts.

Scoring includes action type, date, attendance, consequence signals and resurfacing value. The filter accepts useful candidates at 40 or above; a single deliberate short note can still be kept. The score is a product heuristic, not statistical confidence. Parsing confidence remains separate.

Syllabus recognition currently looks for course/syllabus and schedule/instructor signals, extracts explicit line-based assessment dates and weekly schedule times, infers one project, and carries bounded recurrence. A missing first meeting, time or term end causes clarification. An uncertain “at three” is converted to a time candidate but asks the user to clarify AM/PM.

## 5. Search architecture

`lib/search.ts` owns normalization, ranking and excerpt selection. Field weights are title 100, project 65, filename 45, category 35, description 25 and item evidence 20; exact-title and prefix boosts add 300 and 100. Deadline queries receive due-context matching. Meaningful terms all need coverage for lexical results. Full-source text and transcripts are searched separately as recognizable source hits.

`lib/memory.ts` uses Backboard `/assistants/{id}/memories` and `/memories/search`. Conversational queries of three or more words can retrieve semantic items; results require current local ownership, matching metadata user ID and score at least 0.65. IDs deduplicate against lexical results. Local records determine whether a deleted or archived item can appear. Provider failure returns the lexical results and an honest provider label, not a fabricated answer.

“Yesterday” filtering uses the saved timezone. Zero results show “Nothing in your pile matches that yet.”

## 6. Voice architecture

1. MediaRecorder requests microphone permission and chooses WebM/Opus, MP4 or WebM where supported.
2. Duration is displayed during recording; the waveform is explicitly a status animation, not a measured audio visualization.
3. Stop releases microphone tracks and shows “Transcribing...”.
4. The browser posts multipart `audio` to `/api/transcribe`.
5. The server validates nonempty audio, supported MIME and the 8 MB limit.
6. It posts multipart `file` plus `model_id=scribe_v2` to `https://api.elevenlabs.io/v1/speech-to-text`, using server-only `xi-api-key`.
7. The returned transcript appears in an editable textarea before sorting.
8. “Sort this” creates a voice source with transcript/duration and runs normal extraction.

The sample shortcut posts `demo=true` only when demo mode is enabled. No key is exposed in browser JavaScript. Raw audio is not retained for playback.

**Physical microphone verification: not completed.** Automated tests exercised Chromium recording with fake audio and an injected prerecorded-blob contract. The adapter test verified outgoing multipart bytes and processed a mocked ElevenLabs transcript into Maya/dentist items. No actual human recording or live ElevenLabs response was obtained because credentials were unavailable.

## 7. Calendar architecture

Google uses OAuth with `calendar.events` and `calendar.calendarlist.readonly`. Tokens are AES-256-GCM encrypted server-side. Settings loads writable calendars and persists the chosen destination. Reconnect is needed for an older grant lacking calendar-list access. Disconnect deletes the local token and resets the default target; existing Google events remain.

Creation uses deterministic Pile event IDs. Per-item destination IDs keep edits/removal targeted correctly even after the default calendar changes. Recurring parents carry a bounded weekly RRULE and timezone. Edits GET the existing event and PUT a merged resource with `If-Match`; conflicts and revoked access fail visibly rather than silently overwriting.

SHA-256 source fingerprints prevent repeat byte-identical file uploads, including renamed files, from generating new imports. A database unique index handles concurrent capture races. Candidate title/date normalization removes repeats within an extraction. Different file bytes are not treated as identical merely because they contain similar prose.

Apple export is a web download, not EventKit or live synchronization. The user opens/imports the file in Apple Calendar. Export status says Exported, and calendarStatus is unchanged. Actual import in Apple Calendar was not performed.

All-day dates use `VALUE=DATE` and exclusive next-day end. Timed nonrecurring events use UTC. Recurring exports use TZID plus explicit observances over the bounded interval so local meeting time survives DST. A missing event end defaults to one hour when constructing a calendar event; the extracted item itself does not invent an end.

## 8. Sponsor status

| Integration          | Status                                  | Evidence                                                                                                                                                                     | Not verified                                                                     |
| -------------------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| ElevenLabs           | IMPLEMENTED BUT NOT CREDENTIAL-VERIFIED | Exact endpoint/model/header/multipart bytes, successful response parsing, invalid audio/authentication failures, transcript-to-items integration, browser recorded-blob flow | Live API request and physical microphone speech                                  |
| Backboard            | IMPLEMENTED BUT NOT CREDENTIAL-VERIFIED | Official assistant-memory endpoints, private account mapping, writes, semantic ID retrieval, correction update, ownership filtering and outage fallback mocks                | Live write/search and score calibration on real memories                         |
| Tiger Data           | IMPLEMENTED BUT NOT CREDENTIAL-VERIFIED | Connection priority and common PostgreSQL architecture implemented; migrations and CRUD validated on PGlite                                                                  | Tiger network connection, migration/CRUD against hosted Tiger, hosted deployment |
| Google Calendar      | IMPLEMENTED BUT NOT CREDENTIAL-VERIFIED | Mocked recurrence and conditional update; browser demo approval/retry/edit flows                                                                                             | Real OAuth, real calendar creation/update/removal                                |
| Apple Calendar files | REAL FILE GENERATION VERIFIED           | Browser downloads and ICS assertions                                                                                                                                         | Manual import into the Apple Calendar application                                |

No Capital One or Persona integration was added.

## 9. Demo assets

- `demo-assets/sample-syllabus.pdf`: three pages, UGS 303 — Identity, Community & Development, Fall 2026. Dr. Avery Morgan is fictional. Term August 24–December 10; Tue/Thu 9:30–10:45 in CAL 100; four key dates; office hours/tutoring optional. Seven candidates total, five selected. Observation #2 appears twice in the document but once in output. Instructor/Canvas/headings never become cards.
- `demo-assets/sample-meeting-notes.txt`: September 12 project check-in, attendees Maya/Jordan/Sam, two assigned actions, Monday launch and contextual paragraphs. Expected three useful items, not every sentence.
- `demo-assets/sample-event.png`: Design Night, Thursday September 17, 2026 at 7 PM, Rice Architecture / Anderson Hall. One event. The demo fallback validates actual file bytes rather than trusting the filename.

`pnpm fixtures` regenerates the originals. All three PDF pages were rendered and visually inspected. The layout principles came from university syllabus guidance; the prose/assets are original fictional demo content, not copied course materials.

## 10. UI/design changes

The board keeps its warm paper palette and Instrument Sans/Caveat typography. Review has a compact summary and groups instead of an undifferentiated list. Editing returns to the same import. Optional schedules are visually quieter and unchecked. Source details are disclosed rather than made into checkboxes. Bulk calendar changes have a concrete confirmation.

PDF source previews render actual page images with page controls and an extracted-text fallback. Image sources display their original bytes. Voice sources preserve transcript and measured duration when available. Search shows type-specific cards and subtly highlighted snippets. Settings has Time & Calendar and understated real configuration labels. A configured API key is labeled Configured, not live-verified.

Screenshots cover 1440×900, 1512×982, 1280×800 and 390×844. The review actions fit the three specifically requested sizes. See `docs/screenshots/review.png`, `search.png`, `source-pdf.png`, `settings.png`, `calendar-confirmation.png` and `mobile.png`.

## 11. Important files

| Path                                                             | Purpose                                                                          |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `app/api/[...path]/route.ts`                                     | Authenticated capture/process/search/transcription/preferences/calendar/file API |
| `lib/model.ts`                                                   | Zod schemas, tiers, metadata, recurrence and item/source types                   |
| `lib/actionability.ts`                                           | Actionability heuristic, conservative filtering, normalized candidate keys       |
| `lib/syllabus.ts`                                                | Course metadata, explicit assessment dates, bounded weekly schedules             |
| `lib/ai.ts`                                                      | Local parser, AI prompt/provider, ElevenLabs adapter, sample transcript          |
| `lib/search.ts`                                                  | Lexical fields/ranking, source results, snippet matching                         |
| `lib/memory.ts`                                                  | Backboard private assistants, memory persistence/update/delete/search            |
| `lib/calendar.ts`                                                | Google/demo adapters, OAuth token encryption, stable IDs, conditional updates    |
| `lib/ics.ts`                                                     | iCalendar escaping/folding, timezone observances, bounded RRULE exports          |
| `lib/recurrence.ts`                                              | Next meeting and calendar display occurrences across DST                         |
| `lib/preferences.ts`                                             | Persisted timezone/calendar preferences                                          |
| `lib/db.ts`, `lib/store.ts`, `lib/pipeline.ts`                   | DB abstraction, source/item/project persistence, processing claim/commit         |
| `lib/files.ts`                                                   | PDF text/page rendering and exact sample-image fallback                          |
| `migrations/002_preferences_memory.sql`                          | Preferences, memory mappings and source fingerprint uniqueness                   |
| `components/workspace.tsx`                                       | Board, grouped review, editing, recording and source workflows                   |
| `components/calendar-settings.tsx`                               | Timezone/integration settings and ICS download helper                            |
| `components/source-card.tsx`                                     | Recognizable source cards and actual previews                                    |
| `app/globals.css`                                                | Preserved design tokens and responsive review styles                             |
| `scripts/fixtures.ts`, `scripts/screenshots.mjs`                 | Reproducible fixtures and screenshot/accessibility audit                         |
| `tests/unit.test.ts`, `tests/integration.test.ts`, `tests/e2e/*` | Functional/provider/browser regression coverage                                  |

## 12. Environment variables

No secrets were committed. `.env.example` contains empty values/defaults.

- `DEMO_MODE`: optional; default true. False disables sample transcription/demo calendar and requires configured AI for automatic parsing.
- `DATA_DIR`: optional; `.data/pile` default for embedded persistence.
- `TIGER_DATABASE_URL`: optional Tiger PostgreSQL URL; preferred over DATABASE_URL.
- `DATABASE_URL`: optional generic PostgreSQL URL; absent means PGlite.
- `OPENAI_API_KEY`: optional real text/vision provider key.
- `OPENAI_BASE_URL`: optional; default `https://api.openai.com/v1`.
- `OPENAI_MODEL`: optional; default `gpt-4.1-mini`.
- `ELEVENLABS_API_KEY`: needed for real speech-to-text only.
- `ELEVENLABS_STT_MODEL`: optional; default `scribe_v2`.
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`: all required to configure OAuth.
- `TOKEN_ENCRYPTION_KEY`: required with Google, minimum 32 characters.
- `BACKBOARD_API_KEY`: optional persistent memory/search key.
- `BACKBOARD_BASE_URL`: optional; default `https://app.backboard.io/api`.
- `OPENAI_TRANSCRIPTION_MODEL`: only used by the retained legacy adapter, not the active application path; default `whisper-1`.
- `BACKBOARD_THREAD_ID`: obsolete and unused.

The local Google redirect is `http://127.0.0.1:3001/api/oauth/callback`. Keep all keys on the server. Restart after changing environment configuration.

## 13. Database and migrations

PGlite persists real PostgreSQL tables locally. Tiger/generic PostgreSQL uses `pg.Pool` through the same query/transaction interface. Migrations are repeatable SQL files applied in sorted order. The initial schema stores users, projects, sources/files, items, calendar links, activity, processing jobs and OAuth tokens. Migration 002 adds preferences, assistant mappings, memory IDs/update revisions and source fingerprint uniqueness.

`pnpm db:migrate` and `pnpm db:seed` succeeded against local disk persistence. Integration tests use a fresh in-memory PostgreSQL database, repeat migration/seed, and verify create/read/update/delete and ownership. No hosted Tiger database was contacted. Do not run a second embedded writer while the application owns the same data directory.

## 14. Exact tests

- `pnpm lint`: passed, no warnings/errors.
- `pnpm typecheck`: passed.
- `pnpm test:unit`: **34 passed**.
- `pnpm test:integration`: **22 passed**.
- `pnpm test:e2e`: **21 passed** against the production server.
- Total automated functional tests: **77**.
- `pnpm build`: passed.
- `pnpm db:migrate`, `pnpm db:seed`: passed.
- `pnpm screenshots`: completed; 12 audited UI states, zero accessibility violations.
- `pnpm secret:scan`, `git diff --check`: passed before release.

The first E2E run found a review contrast/animation-state issue. Review text contrast was tightened, the visual audit uses reduced motion to inspect settled content, and the targeted test then passed. A subsequent production run caught a short-recording duration race. Duration now comes from the monotonic start/stop clock rather than the UI timer, with a subsecond recording regression. The complete production suite was rerun. No assertion was removed to hide a functional regression.

## 15. Browser/manual QA

The agent drove browsers and inspected rendered screenshots; this was not a claim of a human manually exercising external accounts.

Verified: all primary routes; text → cards; actual Chromium recording start/stop with fake audio; injected blob → mocked transcription → edited transcript → cards; syllabus seven-candidate review; optional selection and promotion; source metadata; in-place date/type editing; five-item bulk demo-calendar confirmation; valid Apple download; duplicate reupload; Design Night date/time/location; actual PDF page 1/2 and image previews; Chicago→New York display and reload; Maya/chemistry/nonsense search; complete/reopen/delete; synced demo edit; calendar remove/re-add; source/item session ownership; cross-origin rejection; desktop/mobile overflow and accessibility.

Not verified: actual human microphone speech, live ElevenLabs, live Backboard, hosted Tiger, Google OAuth against a real account, and opening/importing the file in Apple Calendar. Those require credentials or human/device interaction unavailable here.

## 16. Known limitations

1. External provider requests are implemented and mock-verified, not live-verified.
2. Deterministic syllabus extraction handles explicit line-based layouts; arbitrary complex tables/layouts need the real AI provider and broader corpus validation. Scanned PDFs without text still require OCR, which is not implemented.
3. Byte-identical file imports deduplicate. Semantically equivalent but changed files are not globally merged automatically.
4. Previously saved imports are not destructively re-extracted or deleted by this pass. Reimporting an old document after deliberate cleanup uses the new filter.
5. Google is outbound create/edit/remove, not continuous bidirectional reconciliation. Its list endpoint currently displays up to 100 upcoming events and does not page historical calendars. External edits/deletions are not background-synced into Pile items.
6. Apple files are snapshots, not subscriptions; repeated imports and later changes are managed by the calendar application.
7. Raw audio is not retained; there is no audio playback. The waveform is a recording-state animation.
8. Sessions are browser-cookie workspaces, not login accounts or cross-device synchronization.
9. Backboard score threshold/recall need calibration with live service data. Failed memory indexing leaves local captures intact and does not provide a durable background retry queue.
10. Missing event ends use a one-hour calendar default. The current recurring form edits weekly schedules, not arbitrary monthly/yearly rules or holiday exceptions.

## 17. Best current 90-second demo

- **0–10 seconds:** show Today; explain that Pile keeps the few things that affect your day.
- **10–25:** type a Maya task and chemistry deadline, sort, and show the original source attached.
- **25–50:** import the syllabus. Show four dates, one class schedule and two unchecked optional schedules. Open source details to show that professor/website information is preserved without becoming work.
- **50–65:** export the five selected items as an Apple Calendar file, or confirm them into the explicitly labeled demo calendar. Show the bounded class recurrence.
- **65–80:** search Maya, chemistry deadlines and nonsense. Show only meaningful matches and the proper empty state.
- **80–90:** open the actual PDF preview. Optionally show the sample voice transcript, explicitly labeled sample.

Only replace the typed capture with real voice after a successful live ElevenLabs request and actual microphone test.

## 18. Sponsor judging story

**ElevenLabs** converts the unstructured spoken capture into an editable transcript that Pile can organize. **Backboard** gives meaningful captured items persistent semantic recall while local ownership and lexical search keep results dependable. **Tiger Data** can persist the structured capture stream using the same PostgreSQL schema and transaction boundary as the local app.

Current truthful wording: “These integrations are implemented and request-contract tested. This laptop is running the local demo without sponsor credentials.” Do not claim real sponsor usage metrics, live writes, or successful authentication that did not happen.

## 19. Next highest-impact tasks

1. Configure sponsor credentials and run live ElevenLabs audio, Backboard write/retrieval, Tiger migration/CRUD and Google OAuth/recurrence/update checks. Record actual HTTP outcomes without secrets.
2. Test a human microphone in Chromium and Safari; verify permission denial, interruption, long recordings and MIME compatibility.
3. Expand the syllabus corpus across genuine layouts, dated tables, term ambiguity and exam schedules; score false positives and missed deadlines.
4. Add durable Backboard indexing retry/reconciliation and calibrate semantic scores against real memories.
5. Add calendar exception handling and external-event reconciliation before advertising two-way sync.
6. Add account sign-in/cross-device persistence only if needed for use beyond the personal hackathon demo.

## 20. Instructions to the next Codex agent

Continue this existing repository. Do not scaffold a replacement product, add a chat dashboard, remove the working local fallback, or flatten all sources into identical cards. Preserve the warm visual identity and its tokens in `app/globals.css`.

Start by reading `AGENTS.md`, the relevant installed Next.js docs, this handoff, `docs/FIX_PASS.md` and `git status`. The main app remains `components/workspace.tsx`; extract bounded components only when it helps an actual task. APIs are in `app/api/[...path]/route.ts`, with provider/persistence logic in `lib/`.

The most fragile boundaries are recurrence/timezone semantics, Google conditional updates and destination IDs, Backboard tenant isolation and memory response contracts, MediaRecorder MIME/permission behavior, and conservative extraction across unfamiliar documents. Keep all-day dates date-only; never replace canonical instants when changing display timezone. Never allow a missing recurrence end to become an infinite calendar series. Do not mark Apple exports synced.

Use the commands in section 14. Start the app on port 3001. Stop it before build/start transitions or CLI access to the same PGlite directory. Final checks should cover both the provider contracts and the browser UI. Verify actual external credentials before changing any integration status to live-verified.

The final release chat supplies the exact latest commit and CI URL. Resolve `git rev-parse HEAD` and `git ls-remote origin refs/heads/main` before beginning new changes; the release branch is main.
