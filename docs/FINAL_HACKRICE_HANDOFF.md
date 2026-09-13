# Pile — final HackRice handoff

Prepared September 12, 2026 (America/Chicago). This is the authoritative post-critique handoff. FINAL_PREJUDGE_HANDOFF.md records the earlier state actually submitted to ChatGPT; FUNCTIONAL_HANDOFF.md and FIX_PASS.md are historical. No credentials or private account records are included.

## 1. FINAL VERDICT

**READY for the controlled local HackRice demonstration.** The tested path is typed capture → selective syllabus review → explicit demo-calendar approval → source-backed search. The current app is useful, coherent and stable on that path. No reproduced P0 or unresolved in-scope P1 remains in the tested local flow.

This verdict does not certify live sponsor services, physical microphone speech, arbitrary unseen documents or broad native recurrence compatibility. Those boundaries are explicit below. Use the prepared Chromium workspace; preserve the user's legacy Safari data.

## 2. RELEASE

- GitHub: [Mohit-Bapatla/pile](https://github.com/Mohit-Bapatla/pile).
- Branch: `main`.
- Verified starting commit: `9ea5a53bc155c031039ec349d2ac5f2aaf45096a`; pulled fast-forward-only and matched remote before edits.
- Implementation commits: `d3ec42bfa97dcbc77d447135bcc0ebed2c6994ff` — adversarial capture and critique changes; `1df21a76078ee617285681adf7747172b1ce4c83` — date-header hydration and CI outage-test correction. Pushed to origin/main.
- Final implementation CI: **PASS** — [Pile checks, run 34728100359](https://github.com/Mohit-Bapatla/pile/actions/runs/34728100359), exact commit `1df21a76078ee617285681adf7747172b1ce4c83`. The [initial run](https://github.com/Mohit-Bapatla/pile/actions/runs/34727795253) failed on a settings-test setup race (28/29 browser tests); that failure and a date-header hydration warning were investigated and fixed. The final run passed all 30 E2E tests and production build.
- This handoff is committed afterward in a documentation-only release commit. Its own hash cannot be embedded in its contents; `git rev-parse HEAD` gives that final release hash, also reported in the final delivery. Product/test source remains the final implementation commit above. Final remote equality, clean tree and CI are checked after the documentation push.
- Local production URL: [Pile](http://127.0.0.1:3001/app). `pnpm start` is running on port 3001; port 3000 was not changed.
- A separate headed Chromium session, `pile-judging`, is left on the board with **five seed items**. Rehearsal/test workspaces are separate. Do not clear personal browser data to prepare the pitch.

## 3. PRODUCT

Pile gives students and busy people a calm place for thoughts, transcripts, syllabi, meeting notes and event flyers. The pain is losing commitments inside information, then having to turn every source into tasks by hand.

The workflow is capture → extract the actionable parts → inspect uncertainty and original evidence → keep a small board → approve calendar changes → find the original later. Today, This week and Later organize commitments; Inbox holds original captures; Projects group related work. The value is selective organization, provenance and follow-through. The credential-free demo uses deterministic rules and clearly labeled sample media.

## 4. EVERYTHING TESTED

Automated and agent-driven browser evidence is distinguished from native-device testing.

| Area | Actual coverage |
|---|---|
| Repository | Baseline pull/remote match; AGENTS and previous handoffs/design docs; API boundary, migrations, provider adapters, schema, pipeline, store, extraction, recurrence, search, UI and scripts inspected |
| Text | Simple/multiple tasks; relative/explicit dates; event/location; reminders; vague weekend; competing dates; typos; emoji/punctuation; long input; zero-action prose; explicit preference; repeated candidates and separate captures |
| Documents | Real sample syllabus, meeting notes, a second table layout, prose-only PDF, image-only PDF, metadata/repeated headers, duplicated assessments, competing dates, schedule cancellation, repeated and renamed byte-identical upload |
| Images | Supplied flyer title/date/time/location and approval; arbitrary renamed image cannot produce fixture output; missing vision credentials fail honestly. No live noisy-image/ambiguous-image extraction claim |
| Search | Maya, chemistry deadlines, HackRice, dentist, probability, internship, Tuesday, filename, source phrase, exact-title ranking, separate source retrieval, source-only prose and zero nonsense results |
| Timezone | Chicago, New York, Los Angeles, London, Tokyo; preference persistence/reload/new capture; timed conversions; all-day stability; DST class time; 25-hour-day “yesterday”; all-day recurrence |
| Calendar | Approval/confirmation; repeat create; edit without duplicate; remove/re-add revision IDs; interval validation; recurring bounds; ICS single/bulk, timed/all-day/recurrence, escaping/folding; Google mock contracts |
| Voice | Chromium fake-device MediaRecorder; subsecond, 2-second and 20-second recording paths; Blob/MIME contract; sample and typed transcript editing; denied/pending permission; late grant cleanup; silence, auth and network error contracts |
| Persistence | Fresh local migrations and seed; repeat/idempotent operations; CRUD and ownership; concurrent extraction; source deletion safeguards; transaction rollback; persistence across refresh |
| Reliability | Production walkthroughs, external browser-request blocking with providers absent, browser errors, server output, all main routes, sample inputs and local calendar |
| UI | Board, Inbox, Calendar, Projects/detail, Search, Settings, import review, PDF/image source, voice/transcript, editing, empty/error/processing states; desktop/mobile screenshots; intermediate width changes |
| Accessibility | axe route/dialog audits; keyboard recording; dialog focus/Escape; focus restoration; visible controls; accessible names; reduced motion; color-independent calendar legend; responsive capture/dialog usability |

The automated total is **121 tests**. Native Safari and Apple evidence is narrower and recorded in section 16.

## 5. BUGS FOUND THIS PASS

Full reproduction, expected/actual behavior and verification are in [FINAL_QA.md](FINAL_QA.md).

| ID / severity | Cause and result | Fix |
|---|---|---|
| QA-01 P1 | Only first parsed date trusted; conflicting commitments looked certain | Flag multiple date alternatives and same-title/different-date candidates; require resolution |
| QA-02 P1 | Long evidence/description exceeded schema limits | Bound derived fields, preserve the original accepted source |
| QA-03 P1 | Local parser omitted appointment location | Extract explicit trailing place, clean title and preserve explicit time range |
| QA-04 P1 | Alternate dated assessment rows and class cancellations omitted | Table-header context; uncertain schedule-change reminders with manual recurrence-adjustment instruction |
| QA-05 P2 | Single-note exemption created junk cards; prose acquired dates | Zero-action source-only capture; no dates on note/reference/idea output |
| QA-06 P2 | Narrow spelling tokens; Probability mapped to Calculus | Two bounded typo corrections and separate Probability project |
| QA-07 P1 | Calendar callers could emit invalid intervals | Shared end/start format/order checks; retain bounded recurrence validation |
| QA-08 P2 | Silent STT surfaced schema errors; failed recorder setup retained tracks | Friendly no-speech recovery and track cleanup |
| QA-09 P1 | PDF page markers passed the readable-text check | Inspect actual per-page text; preserve original with readable failure |
| QA-10 P2 | Settings fetch rejection escaped handler | Inline recoverable network error, no unhandled rejection |
| QA-11 P1 demo risk | Legacy Safari workspace retained old 50-item output | Separate clean judging workspace; no destructive rewriting of old data |
| QA-12 P2 environment | Safari microphone request stayed pending | 15-second app recovery, typed/sample fallback, late-stream cleanup; native speech still unverified |
| QA-13 P2 | Subtracting 24 hours on a 25-hour DST day gave wrong “yesterday” | Previous local-calendar-date arithmetic |
| QA-14 P1 | All-day recurrence expanded to timed instants | Preserve date-only starts, ends and next meetings |
| QA-15 P1 | Header used server/browser local dates before hydration and ignored active timezone | Render after data arrives, format in selected zone, regression across a changed browser clock and date boundary |

The settings-outage intercept raced initial timezone setup on CI; it now waits for the form before intercepting the save. A test-selector ambiguity and one scratch smoke expectation were also corrected after inspecting the actual behavior; these were test-harness issues, not product bugs. No tests were removed to manufacture a green result.

## 6. CHATGPT CRITIQUE

The user's existing logged-in ChatGPT conversation received the complete fresh handoff as a Markdown attachment and six screenshots: board, review, voice review, search, calendar and settings. The requested harsh judge/user/SWE/sponsor prompt was submitted. No secret files were shared.

The **complete rendered response** is saved in [CHATGPT_CRITIQUE.md](CHATGPT_CRITIQUE.md). Completeness was compared against the browser text after whitespace normalization: 11,235 UTF-16 characters, FNV-1a 123955505. Only trailing whitespace was normalized in the file. Citation labels and the response's substantive text remain intact. Its numerical scores are one model's subjective opinions, not actual HackRice judging results.

Its ten main concerns: unclear first-ten-second value; no live sponsor proof; old 50-item data weakening the demo; Safari/microphone risk; insufficient visible extraction evidence; item/source results resembling duplicates; unconfigured Settings looking unfinished; repetitive calendar labels; Apple button implying direct integration; and a generic-AI-wrapper perception. It recommended small clarity/reliability changes and preserving the visual identity.

## 7. CRITIQUE DECISIONS

[CRITIQUE_DECISIONS.md](CRITIQUE_DECISIONS.md) evaluates each suggestion by benefit, implementation cost, regression risk and judging relevance.

**DO NOW:** clarify capture value, expose exact evidence and page count, distinguish search items/sources, simplify calendar labels, rename ICS download, bound microphone permission waiting, prepare an isolated demo and improve the pitch.

**DO IF CHEAP:** one live sponsor verification and clearer completion affordance. No credentials were available; no live proof is claimed. Completion already has specific Complete/Reopen accessible names, so it was left stable.

**DO NOT DO:** invent an ignored-detail count, replace truthful Not configured with Available/Connected, destroy legacy user data, redesign the board, or spend the pitch reciting test counts.

**POST-HACKATHON:** OCR, accounts, email ingestion, broad recurrence/two-way sync, agents, vector infrastructure and major board interaction changes. Their time and regression risk exceed the immediate benefit.

## 8. IMPROVEMENTS MADE AFTER CHATGPT REVIEW

Six bounded groups were completed:

1. Capture now explains: “Drop a thought or file. Keep the actions, leave the noise.” The Today count remains below it.
2. Review shows the actual page count and **Why this item?** disclosures containing stored evidence. No invented page citations or skipped-fact totals.
3. Search has separate item/source headings and counts, a truthful search-provider label, and a useful initial state. Nonsense still yields zero results.
4. Calendar has one mode label and a solid/dashed legend; mixed live/demo events retain identifying labels. Both export actions say **Download calendar file (.ics)**.
5. Microphone permission waiting times out after 15 seconds; a late stream is released. The absent-key state points to typing or the explicitly labeled sample.
6. A fresh headed judging workspace and an actionability-first 100-second script were prepared.

The DST fixes were independently found while ChatGPT was thinking; they are not attributed to the critique. The release CI subsequently exposed a date-header hydration issue; a small active-timezone rendering fix and regression were added. No dependencies, schema migrations or major subsystems were added.

## 9. DESIGN STATE

The paper palette, Instrument Sans/Caveat typography, semantic sticky-note colors, narrow navigation, taped mini-calendar and source receipts remain intact. Review is grouped with important selections and optional schedules; evidence expands only when needed. Mobile capture stacks controls and the calendar remains navigable.

Visual review covered the required 1440×900, 1280×800 and 390×844 views, plus 1512×982. Production width sweeps covered 390, 600, 768, 900, 1100, 1280, 1440 and 1512 across six routes without page overflow. Dialog content intentionally scrolls; there is no claim that the entire syllabus review fits one screen.

Current evidence: [board](screenshots/board.png), [1280 board](screenshots/board-1280.png), [mobile](screenshots/mobile.png), [syllabus review](screenshots/review.png), [PDF preview](screenshots/source-pdf.png), [voice](screenshots/voice.png), [search](screenshots/search.png), [calendar](screenshots/calendar.png), [mobile calendar](screenshots/calendar-mobile.png), [settings](screenshots/settings.png). Additional empty/error/editor/project screens are in the same folder.

No blocking clipping or overflow was observed. Unconfigured sponsor statuses remain visible and truthful. Evidence disclosures and a long calendar may require scrolling on small screens. Those are acceptable for the current product.

## 10. EXTRACTION STATE

The policy is actionability: tasks, reminders, dated assessments, exams and bounded required schedules. Instructor/email/URLs, course descriptions, grading prose and repeated metadata remain with project/source context. Optional office hours and tutoring default unchecked and stay in Later. A source may legitimately produce zero cards.

- Supplied three-page syllabus: **four dates + one class + two optional schedules = seven candidates; five selected**. Tue/Thu class at 9:30–10:45 AM in CAL 100 ends with the term. A repeated assessment appears once.
- Alternate actual PDF: **six candidates**, including two competing Essay rows and a no-class reminder requiring clarification. It tests a second table layout, not broad document accuracy.
- Meeting notes: two assigned actions and a launch date; attendees/prose omitted.
- Prose-only PDF and “random thought: plants are cool”: zero cards; original remains searchable.
- “Email Maya tomorrow and dentist Tuesday at 3pm at West Campus Dental”: a task and appointment with location.
- Image-only PDF: honest no-readable-text error with original retained. No OCR exists.

Within-extraction title/date dedupe and byte-fingerprint upload dedupe protect repeated/renamed identical files. Separate text submissions remain separate captures; semantically equivalent but different files are not globally deduplicated. Local long input processes at most 50 candidate clauses, retains accepted source text, and bounds derived evidence/description. Input and extracted PDF text are capped at 60,000 characters. Parsing rules and corpus are deliberately limited; arbitrary vision requires credentials.

## 11. SEARCH STATE

Weighted lexical search normalizes words/plurals/deadline terms, removes stopwords and requires meaningful query terms. Exact titles rank above weaker context. Matching source content does not return every sibling item. A redundant plain-text source row is suppressed when its matching item is already shown; PDF/image/voice source matches can appear separately with explicit headings.

Maya and the full requested query corpus return relevant results; `zzzzqwertyxyz123` returns **zero items and zero sources**. “Yesterday” uses the prior date in the active timezone, including the 25-hour DST case.

Backboard can add owned, currently valid item IDs from private assistant memory with a score gate. Mock tests cover write/update/delete, ownership and outage fallback. Natural-language semantic retrieval and thresholds were not live calibrated. Lexical search remains usable when Backboard fails.

## 12. VOICE STATE

MediaRecorder chooses supported WebM/Opus, MP4 or WebM, measures elapsed duration, releases tracks and uploads the Blob. The transcript can be edited before normal extraction. No audio playback/history is retained. The animated bars are explicitly a status animation.

The server ElevenLabs adapter uses `scribe_v2`, multipart audio and a server-only key. Tests verify actual submitted bytes and MIME contracts, authentication/network errors and silence handling. Chromium used fake audio devices; 2-second and 20-second recordings were exercised, along with short-stop and permission recovery paths. The final pending-permission regression advances a fake clock and confirms that late-granted tracks stop.

**No physical human speech or live ElevenLabs response was verified.** Safari's native permission attempt remained pending; native MP4 encoding is unverified despite the MP4 request contract passing. Use typed capture as the hero. If showing the sample, name it as a sample.

## 13. CALENDAR STATE

**Google:** OAuth scopes, encrypted/refreshable tokens, writable-calendar selection, destination persistence, event create/update/remove, owned event checks and conditional ETag updates are implemented. Stable IDs prevent retry duplicates; re-add uses a new revision. Mock contracts cover list/refresh, recurrence, duplicate 409, deleted 410, revoked 401, stale 412 and provider 503. No real OAuth/account writes occurred.

**Apple ICS:** real downloadable snapshot with UID, DTSTAMP, DTSTART/DTEND, SUMMARY, LOCATION, DESCRIPTION/source URL, CRLF, escaped text, UTF-8 line folding, all-day exclusive next-day end, bounded weekly RRULE and timezone definitions. An event without an end uses a one-hour calendar default. Export is not Apple sync. A generated timed event was successfully imported into a separate native Apple Calendar QA calendar. Title, location, date, start/end, description and source URL were visible. The disposable event and calendar were removed afterward. Native all-day/recurring/bulk import remains contract-tested rather than manually verified.

**Timezone/recurrence:** timed instants convert across all five requested zones; date-only values remain dates; source-zone weekly classes retain local time across DST. Shared calendar construction rejects backwards/mixed endpoints. Cancellations ask the user to adjust recurrence; EXDATE/automatic exceptions, monthly/yearly recurrence and full Google reconciliation are not implemented.

## 14. SPONSOR INTEGRATIONS

| Sponsor | Exact status | Meaningful role | Actual evidence |
|---|---|---|---|
| ELEVENLABS | **IMPLEMENTED BUT NOT LIVE VERIFIED** | Spoken capture → editable transcript → structured commitments | Browser simulated recording, multipart/Scribe contracts, error recovery |
| BACKBOARD | **IMPLEMENTED BUT NOT LIVE VERIFIED** | Private persistent semantic memory of useful captures and corrections | Assistant/memory API mocks, ownership gates, write/update/delete, lexical fallback |
| TIGER DATA | **IMPLEMENTED BUT NOT LIVE VERIFIED** | Hosted PostgreSQL persistence | `pg` connection abstraction inspected; common migrations/CRUD/transactions verified in local PGlite |

PGlite is live locally; the active calendar is a local demo. Google and OpenAI-compatible providers are implemented but not live verified. Environment and .env.local presence checks found no relevant provider credentials; values were not printed or shared. PGlite success is not evidence that a Tiger service was contacted.

## 15. TEST RESULTS

| Gate | Final result |
|---|---|
| Lint | PASS |
| Typecheck | PASS |
| Unit | **55 passed** |
| Integration | **36 passed** |
| Chromium E2E | **30 passed**, 44.4 seconds, against production locally |
| Functional total | **121 passed**; baseline was 77 |
| Production build | PASS after all application changes |
| Fresh migrations + seed | PASS in isolated DATA_DIR; repeat/idempotency also tested |
| Accessibility | Zero axe violations in six desktop/mobile route checks and 12 additional dialog/content states |
| Visual audit | Refreshed screenshots; required sizes and additional 1512 view inspected; eight-width route sweep has no page overflow |
| Reliability | Post-critique production smoke: no browser console/runtime errors; server output without new errors |
| Secret/artifact scan | PASS, including all 101 staged/tracked files in the final documentation commit |
| Whitespace | `git diff --check` and staged check PASS |
| CI | PASS on final implementation commit; all suites plus production build. Final documentation commit is independently checked after push |

The pre-critique gate was 53 + 36 + 26 = 115; the final gate adds two DST regressions and four browser regressions. Historical documents retain their earlier counts intentionally. Local E2E used an already-running production server; GitHub CI starts the configured development test server, then separately builds production.

Machine-readable evidence: [accessibility](ACCESSIBILITY_RESULTS.json), [pre-critique reliability](PREJUDGE_RELIABILITY.json), [post-critique reliability](POST_CRITIQUE_RELIABILITY.json). The latter blocks external browser requests, not the machine's Wi-Fi or all server traffic. Providers were absent. Resource transfer snapshots are diagnostic samples, not a benchmark or a performance score.

## 16. MANUAL DEVICE/BROWSER TESTING

- **Chromium:** agent-driven production interaction confirmed exact typed capture, dates/location, seven-candidate review/five selected, calendar confirmation/occurrences, Maya search, original source and zero results. Automation additionally covers editing, deletion guards, PDFs, image, transcript, responsive routes and keyboard flows. A separate fresh headed workspace was verified and left ready.
- **Safari on this Mac:** existing board opened; voice dialog and microphone request attempted. Access stayed pending without a usable prompt and Escape recovered. A later final-build reload verified both Maya results (one item and one voice source) and nonsense (zero items/sources), with separate result headings. This remains narrower than a complete Safari end-to-end certification.
- **Microphone:** simulated Chromium input and Blob contracts, not physical speech. MP4 upload is tested, native Safari recording is not.
- **Apple Calendar:** after an initially blocked chooser, bringing Calendar forward enabled actual import. The harmless five-minute event appeared in a separate `Pile QA disposable` calendar on September 14, 2026, noon–12:05 PM, with the correct title, location, source URL and description and no invitees. The event and empty QA calendar were removed and their absence verified. Existing personal calendars/events were preserved. This verifies one timed native import, not every recurrence/export variant.
- **Mobile:** Chromium viewport emulation, not a physical iPhone/Android device.

## 17. DEMO SCRIPT

Target **100–115 seconds** in the prepared Chromium workspace. Rehearse once without changing configuration.

| Time | Click/type | Say |
|---|---|---|
| 0–12s | Board | “My commitments arrive as loose thoughts and dense documents. Pile keeps the parts that affect my day, with the original attached.” |
| 12–32s | Type `Email Maya tomorrow and dentist Tuesday at 3pm at West Campus Dental`; click **Sort my pile** | “One thought becomes two commitments. The appointment keeps its time and location.” |
| 32–58s | **Try a syllabus**; show five important selections and two optional unchecked schedules; expand **Why this item?** | “Three pages become four dates and a class schedule. Office hours are optional. The evidence is here; the rest stays with the source.” |
| 58–78s | **Add 5 to calendar** → **Confirm add 5** → Calendar | “Calendar changes need my approval. This is the local demo calendar. The class repeats within the term, and the deadline stays all day.” |
| 78–98s | Search → `Maya`; open the item's source receipt | “I can recover the commitment and the original context, without getting every item from the same capture.” |
| 98–108s | Close source; search `zzzzqwertyxyz123` | “No match means no match. Pile doesn't fill the screen with unrelated tasks.” |
| 108–115s | End on board or source | “The useful work is filtering, preserving evidence, handling uncertainty and turning an approved decision into a persistent plan.” |

If a judge asks about voice: show **Talk it out → Use sample transcript**, state “This is the labeled sample; the ElevenLabs adapter is implemented but not live-verified here.” Explain sponsor architecture in Q&A instead of spending the main demo in Settings. Do not claim an ignored-fact count or live sponsor connection.

## 18. DEMO BACKUP PLAN

- **Wi-Fi fails:** keep the localhost production process running. Local text rules, supplied PDF/flyer, sample transcript, lexical search and demo calendar work without sponsor services. This is a locally hosted app, not an offline installable PWA.
- **ElevenLabs fails:** type the sentence or use the labeled sample. Never call the sample a successful live transcription.
- **Google OAuth fails:** remain on the clearly labeled demo calendar; download ICS if useful. Do not troubleshoot credentials on stage or call ICS sync.
- **Microphone fails or permission waits:** app recovers after 15 seconds; switch to typed capture immediately for the pitch.
- **Unexpected old data:** use `pile-judging` or a new isolated browser session. Do not clear the user's Safari history/workspace or delete old imports.
- **Local process fails:** restart `pnpm start` from the repo after confirming port 3001 is free. Keep the screenshot kit available as visual backup, explicitly described as screenshots.

## 19. KNOWN LIMITATIONS

Absent live credentials and device verification are detailed above. Other actual limits: narrow local language/layout rules and small corpus; no OCR; arbitrary images require vision; bounded input and 50 local candidate clauses; separate text captures can repeat; byte-based rather than semantic cross-file dedupe; optional extracted candidates remain stored even when unchecked for calendar; old captures are not retroactively reprocessed; weekly bounded recurrence only; cancellations need manual adjustment; no full Google two-way reconciliation; ICS snapshots only; no audio replay; no multi-device account recovery; Backboard thresholds uncalibrated and no durable indexing retry queue. No broad unseen-input accuracy or production-scale performance claim is made.

## 20. DO NOT TOUCH BEFORE JUDGING

Preserve the lockfile and installed framework version, cookie ownership checks, provider status honesty, source fingerprints, calendar IDs/ETags and explicit approval, timezone/date-only semantics, conservative extraction policy, source originals, working fixtures, and the board's visual identity. Avoid bulk reformatting, schema replacement, authentication refactors, new agents/vector stores, or changing demo input files. Do not run CLI PGlite migrations against the same DATA_DIR while the production process owns it.

## 21. IF WE GET 30 MORE MINUTES

1. Rehearse the exact script in the prepared profile and verify the venue display/browser zoom; keep screenshots and fixture files ready.
2. If the user already has an ElevenLabs key securely configured, perform one real physical-speech capture and record actual evidence. Do not spend all 30 minutes provisioning accounts.
3. Exercise two representative user documents or manually import an all-day/recurring ICS into a disposable calendar. Change only a reproduced, low-risk defect; preserve the current build otherwise.

## 22. IF WE GET 2 MORE HOURS

1. Live-verify ElevenLabs on physical Chromium audio, short/long/silent recordings and one Safari format path.
2. Live-verify Backboard's private-memory write/search/correction/delete and measure false positives on a small query set.
3. Run a disposable Tiger-backed workspace through migration/seed/CRUD/rollback and app persistence if credentials are available.
4. Use an authorized disposable Google calendar for OAuth/create/update/remove/reconnect; extend native Apple verification to all-day/recurring/bulk exports without modifying personal events.
5. Expand the actual syllabus/meeting-note corpus and document failures; add only narrow fixes backed by tests. If credentials are unavailable, spend the time here rather than building a new subsystem.

## 23. CONTINUATION INSTRUCTIONS

Local checkout:

```sh
cd /Users/mohit/Documents/Codex/2026-09-11/files-pasted-by-the-user-you/outputs/pile
git status --short
git fetch origin
git rev-parse HEAD
git rev-parse origin/main
gh run list --branch main --limit 3
```

The final implementation anchor is `1df21a76078ee617285681adf7747172b1ce4c83`; final HEAD includes this handoff. Do not reset to the older baseline or trust historical counts. Pull only when clean and the remote has newer intended work.

Install/check in a stopped or isolated checkout:

```sh
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm test:integration
pnpm build
pnpm start
```

`pnpm start` stays running in its own terminal. In another terminal against that production server:

```sh
pnpm test:e2e
pnpm screenshots
pnpm secret:scan
git diff --check
```

To check clean migrations without opening the active embedded database:

```sh
PILE_QA_DIR=$(mktemp -d)
DATA_DIR="$PILE_QA_DIR" pnpm db:migrate
DATA_DIR="$PILE_QA_DIR" pnpm db:seed
```

To return to the prepared session, while its browser remains running:

```sh
pnpm dlx agent-browser --session pile-judging --headed open http://127.0.0.1:3001/app
```

A new session name creates a separate browser workspace; existing-cookie storage is not shared automatically. Keep the hostname `127.0.0.1` consistent. Never overwrite .env.local with an example or print credential values. Restart/rebuild as needed after securely changing server configuration, then verify actual responses before changing any live-status label.

Key files: `components/workspace.tsx` for board/review/voice/search UI, `components/calendar-settings.tsx` for settings, `lib/ai.ts` and `lib/syllabus.ts` for parsing, `lib/actionability.ts` for filtering, `lib/pipeline.ts` and `lib/store.ts` for persisted processing, `lib/search.ts`/`lib/memory.ts` for retrieval, `lib/calendar.ts`/`lib/ics.ts`/`lib/recurrence.ts` for calendar semantics, and `app/api/[...path]/route.ts` for session-owned API operations. `lib/db.ts` selects PostgreSQL or local PGlite. Tests live in `tests/unit.test.ts`, `tests/integration.test.ts` and `tests/e2e/`; actual new PDFs are under `tests/fixtures/`.

Read AGENTS.md and the relevant installed Next.js documentation before code changes. Preserve the complete critique, QA evidence and truthful verification boundaries. The next useful work is real-provider evidence or a reproduced defect, not another feature list.
