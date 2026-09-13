# Pile — fresh pre-judge handoff

Prepared September 12, 2026 after a new repository audit, adversarial tests, fixes and production verification. This is the product state submitted for external critique, before critique-driven changes.

## Verdict and release basis

READY for a controlled local/demo presentation; NOT live-sponsor verified. The reliable story is messy text or a document becoming a small, source-backed set of commitments. Do not pitch unconfigured voice transcription, semantic memory or hosted Tiger persistence as live features.

Public repository: https://github.com/Mohit-Bapatla/pile. Branch main. Verified baseline commit: 9ea5a53bc155c031039ec349d2ac5f2aaf45096a, matching origin after `git pull --ff-only origin main`. This handoff describes subsequent working-tree changes, not a falsely claimed new remote release. Final commit and CI follow external critique and another complete verification cycle. Local production: http://127.0.0.1:3001/app.

## Product and intended value

Pile is a calm workspace for students and people juggling loose commitments. Inputs arrive as thoughts, transcripts, syllabi, meeting notes and flyers. Instead of asking the user to manually categorize every sentence, Pile extracts actionable tasks, dates and bounded schedules, keeps context attached to the original, flags uncertainty, and waits for calendar approval. The board presents Today, This week, Later and Inbox. Projects group related items without turning the app into a complex project manager.

The useful product distinction is selective extraction plus source traceability. A conventional “summarize my PDF” tool can return many facts; Pile should surface only the few facts that change what the user needs to do. This is a bounded productivity workflow, not a chatbot. The present rule-based demo is deliberately narrower than a general AI promise.

## Fresh findings and fixes

1. **P1 competing dates were confidently accepted.** `Submit essay due September 18 or September 20` picked the first date. The parser now inspects multiple Chrono results/ranges. Same normalized titles with differing dates in one extraction are flagged. Uncertain candidates cannot be bulk-approved or exported without editing.
2. **P1 long captures failed validation.** Derived evidence and description exceeded 1,500/5,000 characters. They are bounded while the entire accepted original remains in the source. A 10 KB capture now persists and extracts without error.
3. **P1 local events lost locations.** `dentist tuesday 3pm at west campus dental` kept the place in a messy title and omitted the location field. It now yields Dentist, Tuesday 3 PM, West Campus Dental. Explicit event time ranges also preserve the end.
4. **P1 alternate syllabus omissions.** A second actual PDF layout had `Essay | September 18` and `No class November 2`; both were missed. Assessment-table context now admits dated rows. Cancellations/reschedules become uncertain reminders with a specific instruction to adjust the recurring class. No automatic recurrence-exception mutation is claimed.
5. **P2 non-actionable prose cluttered the board.** A single-note exemption made `random thought: plants are cool` a card; `but not now` could gain a misleading date. Both now remain searchable source-only captures. Explicit preferences still become notes; manually created notes remain supported.
6. **P2 basic typo/project errors.** Two common spelling mistakes (`emial`, `tomorow`) normalize, while evidence retains original wording. Probability gets a Probability project rather than automatic Calculus assignment. This is not general spelling correction.
7. **P1 invalid calendar intervals.** Shared event construction now rejects backwards ends and mixed date/date-time endpoints. Existing recurrence term-bound validation is retained and tested.
8. **P2 voice recovery.** An empty/whitespace provider transcript now says no speech was detected. Recorder-construction failures release tracks. Denied microphone tests prove typed fallback remains usable.
9. **P1 image-only PDF false success.** PDFParse inserts page-number markers even with no text. The app previously treated markers as readable content. It now checks actual page text and shows a useful error while retaining the original file.
10. **P2 settings outage.** A failed timezone network request escaped its async handler. It now produces a recoverable inline error without an unhandled browser exception.

The running reproduction/cause/fix log is docs/FINAL_QA.md. No major subsystem was rewritten. Existing personal source data was preserved.

## Feature status

| Feature | Current state |
|---|---|
| Text capture | Real local persistence and deterministic parsing; configured OpenAI-compatible provider supported; requests up to 60,000 characters; derived candidate caps |
| Multiple actions | Split common conjunctions/newlines/semicolons; normalized title/date dedupe within one capture |
| Dates/uncertainty | Chrono local-wall-clock parsing; five-zone tests; competing dates flagged; vague weekend and spoken AM/PM require review |
| Non-actionable input | Original persists and is searchable without a board card |
| PDF import | Real PDF text extraction/page rendering; sample and alternate actual PDF tested; source preserved on failure |
| Syllabus | One course project, course metadata, important assessments, bounded weekly classes, optional office hours/tutoring |
| Meeting notes | Three useful outputs from current sample, attendees/prose omitted |
| Images | Exact byte-matched supplied flyer works locally; arbitrary images need configured vision and otherwise fail honestly |
| Voice | MediaRecorder architecture, editable transcript, sample flow, real server ElevenLabs adapter; live STT unavailable here |
| Board | Today/week/later/inbox, semantic item colors, completion/reopening, source receipts, manual creation/edit/archive/delete |
| Projects | Grouped related items and course metadata/source |
| Search | Weighted lexical terms, exact-title ranking, independent source results, zero nonsense results; conditional Backboard semantic merging |
| Calendar | Approved demo calendar plus real ICS download; Google adapter implemented, no live account configuration |
| Timezone | Stored browser-workspace preference; canonical timed instants; all-day dates stable; recurring class source timezone retained |
| Source trust | Actual text/PDF/image/transcript; excerpts and original file access; real PDF page previews |
| Demo kit | Original three-page syllabus, typographic Design Night flyer, meeting notes; runs against localhost without sponsor keys |
| Persistence | Disk-backed PGlite live locally; PostgreSQL/Tiger connection path implemented |
| Authentication | Opaque browser session and owner-scoped records; no cross-device identity/account system |

## Extraction policy and corpus

Important outputs include actions, reminders, dated assignments/exams/deadlines and required meetings. Optional schedules default unchecked and stay in Later. Course name, instructor, email, URL, meeting location and term bounds belong to project/source metadata. Headings, overview paragraphs, policy prose and duplicate facts do not become cards. Non-actionable text may produce zero items. Manually created notes and explicit remembered preferences are supported.

Current three-page sample: UGS 303 Identity, Community & Development, Fall 2026, fictional instructor. Four assessment dates, one Tue/Thu class, two optional schedules = seven candidates, five selected. Repeated Observation #2 appears once. Class is 9:30–10:45 AM in CAL 100, bounded by the term. The flyer is Design Night, September 17, 2026 at 7 PM, Rice Architecture / Anderson Hall. Meeting notes yield two assigned actions and a launch date.

Fresh corpus includes a real alternative PDF with pipe-separated table rows, duplicate metadata, two conflicting Essay dates, a no-class date, Mon/Wed class and office hours. It yields six candidates, three requiring clarification (two competing Essay rows and the schedule exception). A prose-only PDF yields zero. A PDF containing only a colored rectangle fails with “no readable text.” All three new PDFs were rendered and visually inspected. These are explicitly QA fixtures, not a claim of broad unseen-document accuracy.

Dedupe covers normalized title/date within an extraction and exact uploaded bytes across repeated/renamed file imports, including a database uniqueness constraint. Separate repeated text submissions still represent separate captures. Different file bytes with semantically equivalent content are not fuzzy-deduplicated. A very long dump is bounded to 50 candidate clauses; remaining original text stays accessible. This limit needs honest demo expectations.

**Legacy-data observation:** the existing native Safari workspace still contains a 50-item import from the old parser. Current code does not destructively rewrite existing captures. Fresh imports and fresh browser workspaces demonstrate the new selective behavior. This is a demo-preparation risk, not evidence that old stored outputs automatically healed.

## Search

Lexical search normalizes Unicode words, plurals and due/deadline terms, removes stopwords, and requires all meaningful terms to match. Title scores outrank project, filename, category, description and evidence. Exact title and title prefix receive additional boosts. Source content is searched separately, so a mention in one document does not make all sibling items appear. Legacy shared source-prefix excerpts are excluded from item ranking. Source hits retain their media identity and matching snippets.

Tested queries include Maya, chemistry deadlines, HackRice, dentist, probability, internship, Tuesday, filename and source-only phrases. Nonsense `zzzzqwertyxyz123` returns zero items and zero sources. Multiword query behavior is lexical unless Backboard is configured; this is not a general natural-language answering system.

Backboard uses assistant memories, one assistant per browser workspace, and persisted memory IDs for updates/deletes. Semantic results must map to an owned current item, matching user metadata, with score at least 0.65. Provider outages retain lexical results. No live semantic score calibration occurred. No durable background indexing retry queue exists.

## Voice and browser evidence

MediaRecorder selects WebM/Opus, MP4 or WebM when supported, measures duration using a monotonic clock, releases tracks, submits the Blob, displays an editable transcript, and sorts through the normal pipeline. Audio is not retained for playback. Bars are honestly described as a recording-status animation.

ElevenLabs sends multipart file plus model_id=scribe_v2 to the speech-to-text endpoint with a server-only xi-api-key. Tests verify bytes, MIME variants, response shape, empty/unsupported audio, auth failures, silent transcript and network error paths. Chromium E2E uses fake audio devices and an injected recorded-blob contract, including subsecond Stop. These are not physical human speech.

Native Safari was opened through macOS UI. Board, voice dialog and search navigation are accessible. Start recording remained at “Waiting for microphone access…” without a usable permission prompt; Escape recovered. Therefore native Safari physical recording and MP4 encoding were NOT verified. MP4 upload acceptance is contract-tested. Do not claim Safari mic readiness from this attempt.

All keys checked by presence only in environment and .env.local: ElevenLabs, OpenAI, Backboard, Tiger, generic PostgreSQL, Google client ID/secret absent. No credential values were printed or shared.

## Calendar

Google OAuth uses event-write and calendar-list scopes; encrypted tokens, refresh, writable destination selection, connection removal and reconnect are implemented. Stable event IDs protect creation retries. Stored destination IDs keep later edits/removals on the right calendar. Updates read the existing event, verify Pile ownership, preserve unrelated fields and send If-Match. Mock tests cover refresh, list, recurrence, conditional updates, conflict, revoked access, duplicate creation and idempotent removal. No real OAuth or Google mutation was performed.

ICS supports UID, DTSTAMP, SUMMARY, DESCRIPTION, LOCATION, source URL, escaped text, CRLF, 75-byte UTF-8 folding, exclusive next-day all-day ends, UTC timed events and bounded weekly RRULEs with explicit VTIMEZONE observances. It is a downloadable snapshot, not Apple synchronization. Missing event end defaults to one hour at calendar construction.

Manual Apple attempt used a five-minute clearly labeled disposable event without attendees/invitations. macOS preview rendered September 14 at 12:00–12:05 PM correctly. Calendar’s Import chooser kept its Import button disabled. The alternative Finder control was unavailable (no controllable window). No event was imported and no personal calendars were changed. Actual import remains unverified.

Timed dates were tested in America/Chicago, America/New_York, America/Los_Angeles, Europe/London and Asia/Tokyo. Date-only values do not shift. Weekly class local time stays stable across DST in recurrence tests. Unsupported recurrence exceptions, holidays, monthly/yearly rules and full Google two-way reconciliation remain outside this release.

## Sponsor status

| Sponsor | Required honest status | Meaningful role | Evidence |
|---|---|---|---|
| ElevenLabs | IMPLEMENTED BUT NOT LIVE VERIFIED | Voice removes the need to type a brain dump; transcript becomes editable structured commitments | Request contract, MIME variants, browser simulated recording, error handling |
| Backboard | IMPLEMENTED BUT NOT LIVE VERIFIED | Persistent semantic retrieval of meaningful captures and corrections | Assistant/memory API mocks, isolation gates, write/update/delete, outage fallback |
| Tiger Data | IMPLEMENTED BUT NOT LIVE VERIFIED | Hosted PostgreSQL persistence for sources/items/projects/preferences/calendar links | Common pg abstraction inspected; migrations, CRUD and rollback tested locally in PGlite |

The active demo uses local rules, local PostgreSQL and demo-calendar behavior. These distinctions are part of the pitch, not hidden caveats.

## Validation and UI state

Expanded unit suite: 53. Expanded integration suite: 36. Expanded Chromium E2E suite: 26. The pre-critique full pass records final results in FINAL_QA.md; successful green results are required before submitting this document. Baseline was 77 tests; expanded scope is 115 functional tests. Lint, typecheck, production build, fresh migrations/seed, secret scan and diff whitespace checks are required. One new settings test initially had an ambiguous selector matching Next's hidden route announcer; it now targets the visible error banner without weakening the assertion.

The production build preserves the warm paper palette, Instrument Sans/Caveat typography, semantic note colors, narrow navigation, source-specific objects and compact grouped review. Current screenshots: board.png, board-1280.png, board-1512.png, mobile.png, review.png, source-pdf.png, source-image.png, voice.png, voice-review.png, search.png, calendar.png, calendar-mobile.png, settings.png, project-detail.png, empty.png and error.png under docs/screenshots.

All six routes and key dialogs are covered at 1440×900, 1280×800, 1512×982 and 390×844. Automated axe audits cover 12 additional UI states with zero violations in the preceding refreshed run. Keyboard recording names, Escape/focus restoration, reduced motion, source previews, failed completion and no horizontal overflow are regression-tested. Screenshots were inspected directly; tests are not substituted for visual review. The external critic receives selected images, not merely assertions about polish.

Manual Chromium walkthrough: typed Maya/dentist capture produces two cards; uploaded sample syllabus shows five important selections and two optional unchecked schedules; explicit calendar confirmation adds five, and calendar shows Tue/Thu classes plus Observation #2. Search returns only matching content. Automated flows additionally cover editing, completion/reopen, source deletion guards, duplicate upload, timezone persistence and ICS download. Native Safari scope is narrower as described above.

## Best demonstration and fallback

0–15 seconds: “Tasks arrive as scattered thoughts and dense documents. Pile turns the parts that affect your day into a small plan, with the original still attached.” Show the calm board.

15–35 seconds: type `Email Maya tomorrow and dentist Tuesday at 3pm at West Campus Dental`. Sort; point to separate task and appointment, correct location and source receipt.

35–65 seconds: Try a syllabus. Show seven candidates, only five important selected, optional office hours/tutoring unchecked. Open the original PDF or explain the metadata. “The professor biography isn't a task. These are the dates I need to act on.”

65–85 seconds: Add five to demo calendar, confirm. Show the bounded class and a deadline. Explain ICS is a real calendar file; Google requires connection.

85–105 seconds: Search Maya, then an impossible term. “Finding one thought should not bring back everything.”

105–115 seconds: show voice's labeled sample transcript if time. Do not attempt unverified microphone/ElevenLabs as the hero moment. End on the source-backed actionability benefit.

If Wi-Fi fails, keep localhost and the production process running: local text, PDF, supplied flyer, sample transcript, lexical search and demo calendar need no sponsor network. If microphone or transcription fails, type the same sentence or use the explicitly labeled sample. If Google fails, use the demo calendar/ICS and state that distinction. Avoid changing configuration on stage.

## Remaining risks and next work

The largest remaining gap is external provider evidence, not another feature. Next is a clean prepared demo workspace, since old imports remain stored. Other real limitations: narrow deterministic parsing and limited corpus; no OCR; simple clause splitting; repeated text submissions can duplicate; 50-candidate/60 KB bounds; no automatic cancellation exceptions; weekly-only recurrence; no audio playback; snapshot ICS; no full Google reconciliation; no account recovery across browsers; no live Backboard calibration/durable retry.

Useful small improvements for critique to evaluate: make the core pain clearer in capture copy; distinguish empty search from no-results; expose an exact evidence quote in review; state local/semantic search mode; offer easy sample-first voice recovery; improve review selection explanations. Avoid authentication rewrites, new vector stores, drag-and-drop canvases, giant sponsor walls and unrelated dashboards. Preserve the working architecture before judging.
