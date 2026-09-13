# 1. FINAL VERDICT

Pile is ready for the prepared local HackRice demo, with a clean recording workspace and the reproduced extraction/Calendar bugs fixed. The final functional checks, extraction corpus, production visual checks, and live ElevenLabs transcription path passed.

The remaining human prerequisite is a short physical-microphone rehearsal in the browser you will record. The Mac was initially locked. Access returned later, but Safari was taken back into use during the native check; native Safari and a recording of your actual voice remain incomplete. The successful live speech tests used generated spoken audio through Chromium’s microphone capture and the real ElevenLabs API. Google, Backboard and Tiger were not live-account verified because those credentials are absent.

The 54-case synthetic corpus is regression evidence, not proof that every arbitrary syllabus or conversation will parse perfectly. Review remains part of the product: preserve the original, show a few candidates, and require explicit Calendar approval.

# 2. EXACT RELEASE COMMIT

Application release: **`c4c1c1252526f74b8777860d5d050d4f2274ef39`** — [view the exact code release](https://github.com/Mohit-Bapatla/pile/commit/c4c1c1252526f74b8777860d5d050d4f2274ef39).

Repository: [Mohit-Bapatla/pile](https://github.com/Mohit-Bapatla/pile), branch **main**. The application release is followed by a documentation-only handoff commit, so the release SHA above identifies the tested application changes rather than attempting to embed a document’s own commit hash inside itself. Publishing checks verify that local and remote main agree and that CI is green. [Application release CI](https://github.com/Mohit-Bapatla/pile/actions/runs/34738057249).

The working checkout is `/Users/mohit/Documents/Codex/2026-09-11/files-pasted-by-the-user-you/outputs/pile`. The similarly named `/Users/mohit/Documents/ChatGPT/pile` directory was an empty, unborn repository and was not used for this release.

# 3. P0/P1 BUGS FOUND

- **P0 — policy prose became work.** Extension requests, email response policies and grading text could become independent tasks/deadlines, including the reported “By via Canvas” garbage.
- **P0 — independent commitments were merged.** Probability test, linear algebra midterm Wednesday and calculus homework Friday could collapse into one long item with the wrong date scope.
- **P1 — recurrence text was malformed.** Abbreviated Tues./Thur. and a Friday section could become one awkward schedule/location.
- **P1 — automated QA shared recording storage.** Playwright reused port 3001; two explicit test requests and screenshot captures also targeted it.
- **P1 — Calendar lacked coherent completion.** Actionable Calendar cards needed to update the same item as Board, including reopening and reload persistence.
- **P1 — voice behavior was opaque.** A recording could be discarded because of stale configuration, and users had insufficient evidence that audio existed or a failed upload could be retried.
- **P1 — transcription formatting changed time interpretation.** Real ElevenLabs output used “3:00”; the afternoon convention handled “three” and “3” but initially interpreted “3:00” as morning.
- **Additional regression found during QA:** “Juniper” could be mistaken for the month June. Exact month/date anchors now prevent that.

# 4. ROOT CAUSES

The deterministic parser split only a limited set of separators. Sentence boundaries and independent “and …” clauses were not consistently identified before classification and date resolution. The first recognized date could therefore govern unrelated text.

The syllabus parser carried table context too broadly and accepted dated pipe-delimited prose without confirming an assessment. The actionability score trusted a candidate’s task/deadline type too readily. Loose natural-language date parsing could interpret policy numbers relative to the syllabus context and generate bogus January dates. The recurring-schedule grammar missed common abbreviations and combined lecture/discussion facts.

Cookie ownership isolated access between sessions, but every automated browser still accumulated data in the same persistent storage. That was storage contamination even when another session could not read the records.

Voice configuration was cached in an already-open client. Microphone permission and a running timer alone did not prove that useful bytes reached transcription. The UI needed upload, playback, retry and error states that followed the actual recording lifecycle.

# 5. FIXES

The shared pipeline now segments independent intentions, applies conservative actionability filtering, classifies each candidate, and resolves dates within that candidate. It preserves coherent objects such as “Maya and Jordan,” “peanut butter and jelly,” and “chapters 4 and 5.” Local corrections replace their clause’s date; repeated commitments deduplicate; descriptive and cancelled clauses do not create forced actions.

Extracted titles are normalized and capped at 80 characters. Full input remains in the source, with bounded item evidence. A missing date affects that item’s clarification state instead of contaminating siblings. Text and transcribed voice use the same local parsing path; the structured provider prompt/schema also explicitly allow zero or multiple items.

Syllabus extraction requires concrete assessment/action evidence, handles real assignment columns, keeps policy/metadata in source context, and creates separate named schedules. Calendar completion uses one underlying item, blocks overlapping writes, persists across views, and avoids unnecessary external event updates for a status-only change.

The recording UI refreshes configuration, sends nonempty audio to the server regardless of stale client flags, shows an input meter, preserves local playback, permits retry, and reports permission, empty-audio and transcription timeout failures. Recording seed timestamps use the Chicago timezone rather than a hard-coded daylight-saving offset.

# 6. EXTRACTION CORPUS

**54 versioned JSON fixtures:** 11 syllabus cases, 15 other document structures, 19 voice cases and 9 text cases. Each has expected candidate output and forbidden phrases; metadata, optional tiers, project/location/recurrence expectations are included where relevant. Fixed evaluation context: September 12, 2026, America/Chicago.

Syllabi: simple key dates; schedule table; prose-heavy; policy-heavy; STEM; humanities; grading percentages; separate recurring lecture/discussion; multiple date formats; no actionable dates; optional-only schedules.

Other documents: meeting notes, project planning, event flyer, conference agenda, job posting, travel itinerary, appointment instructions, club announcement, pasted email, personal note, grocery list, lecture notes, assignment prompt, receipt and application instructions.

Voice: academic merged-input regression, two academic deadlines, three ordinary commitments, four unrelated actions, disfluency, duplicate action, shared names, shared groceries, shared chapters, two local dates, mid-sentence correction, cancellation, ambiguous timing, next Friday, idea plus task, recurring activity, thinking aloud, no actions, and the real-STT numeric-clock regression.

Text: bullets, shorthand, typo, emoji, undated action, contradictory dates, Unicode name, empty input and Juniper/month-name collision. [Corpus directory](/Users/mohit/Documents/Codex/2026-09-11/files-pasted-by-the-user-you/outputs/pile/tests/fixtures/extraction-corpus) and [machine-readable results](/Users/mohit/Documents/Codex/2026-09-11/files-pasted-by-the-user-you/outputs/pile/docs/qa/extraction-results.json).

# 7. EXTRACTION EVALUATION RESULTS

`pnpm eval:extraction`:

| Metric | Actual result |
|---|---:|
| Cases | 54 |
| Expected items, including optional candidates | 81 |
| Matched titles | 81 |
| False positives | 0 |
| False negatives | 0 |
| Date mismatches | 0 |
| Type mismatches | 0 |
| Forbidden-item violations | 0 |
| Additional checked detail mismatches | 0 |
| False discoveries among emitted matched/unmatched candidates | 0/81 |
| Voice/text segmentation cases | 28 |
| Exact item-count matches | 28/28 |
| Under-count / over-count cases | 0 / 0 |
| Local date-binding errors | 0 |
| Duplicate-action errors | 0 |

These are actual results on this synthetic regression set. The reported false-discovery ratio is not a population-wide false-positive rate. “Matched” is title-based with separate type/date/detail checks; the evaluator fails on any mismatch. Under/over-count checks detect item-count problems, while title and local-date checks catch incorrect grouping even when counts happen to match.

# 8. SYLLABUS GOLDEN RESULTS

| Case | Expected | Actual | Result |
|---|---:|---:|---|
| formats-syllabus | 5 | 5 | Pass |
| humanities-syllabus | 2 | 2 | Pass |
| no-dates-syllabus | 0 | 0 | Pass |
| optional-syllabus | 2 | 2 | Pass |
| percent-syllabus | 0 | 0 | Pass |
| policy-syllabus | 0 | 0 | Pass |
| prose-syllabus | 1 | 1 | Pass |
| recurring-syllabus | 2 | 2 | Pass |
| simple-syllabus | 2 | 2 | Pass |
| stem-syllabus | 3 | 3 | Pass |
| table-syllabus | 2 | 2 | Pass |

The four-page demo PDF separately produces **7 candidates: 4 assessment dates, 1 important lecture schedule, and 2 optional schedules**. Five are initially selected for Calendar; office hours and tutoring are unchecked. Course/instructor/resource facts stay attached as metadata/source context. The added policy and grading page produces no extra cards.

Expected versus actual for the demo PDF (Chicago local time):

| Candidate | Expected | Actual |
|---|---|---|
| Observation #2 | September 18 deadline | Matched |
| Midterm | October 14, 9:30 AM | Matched |
| Project proposal | November 12 deadline | Matched |
| Final project | December 8 deadline | Matched |
| UGS 303 Lecture | Tue/Thu, 9:30–10:45 AM, CAL 100; through December 10 | Matched |
| UGS 303 Office hours | Optional Tuesday, 2–4 PM, CAL 214 | Matched; unchecked |
| UGS 303 Tutoring | Optional Wednesday, 6 PM, Learning Commons | Matched; unchecked |

The recurring corpus case produces UGS 303 Lecture on Tuesday/Thursday, 9:30–10:45 AM, CAL 100; and UGS 303 Discussion on Friday, 11:00–11:50 AM, RLP 0.102. These are separate bounded recurrence objects, not a combined title. Percentage-only, policy-only and undated prose syllabi emit zero actionable items.

# 9. VOICE GOLDEN RESULTS

| Case | Expected | Actual | Result |
|---|---:|---:|---|
| voice-ambiguous | 1 | 1 | Pass |
| voice-cancel | 0 | 0 | Pass |
| voice-correction | 2 | 2 | Pass |
| voice-disfluent | 3 | 3 | Pass |
| voice-duplicate | 2 | 2 | Pass |
| voice-four-actions | 4 | 4 | Pass |
| voice-idea-task | 2 | 2 | Pass |
| voice-merged-p0 | 3 | 3 | Pass |
| voice-next-friday | 1 | 1 | Pass |
| voice-none | 0 | 0 | Pass |
| voice-recurring | 1 | 1 | Pass |
| voice-shared-chapters | 1 | 1 | Pass |
| voice-shared-groceries | 1 | 1 | Pass |
| voice-shared-names | 1 | 1 | Pass |
| voice-stt-clock | 2 | 2 | Pass |
| voice-thinking | 0 | 0 | Pass |
| voice-three-actions | 3 | 3 | Pass |
| voice-two-academic | 2 | 2 | Pass |
| voice-two-dates | 2 | 2 | Pass |

The requested academic regression yields Probability test with a date question, Linear algebra midterm on Wednesday September 16, and Calculus homework on Friday September 18. The Wednesday and Friday candidates are independently editable and do not inherit the probability item’s clarification. Saving them retains one shared original source; editing or deleting one does not mutate its sibling.

The shared-object cases remain one item each. A repeated Email Maya becomes one action. Correction within a capture replaces Tuesday with Wednesday; a cancellation-only capture creates no action. This does not implement automatic correction/deletion of an unrelated earlier capture.

# 10. OTHER DOCUMENT RESULTS

| Case | Expected | Actual | Result |
|---|---:|---:|---|
| application | 2 | 2 | Pass |
| assignment | 1 | 1 | Pass |
| club | 2 | 2 | Pass |
| conference | 2 | 2 | Pass |
| doctor | 2 | 2 | Pass |
| email | 1 | 1 | Pass |
| flyer | 1 | 1 | Pass |
| grocery | 3 | 3 | Pass |
| job | 1 | 1 | Pass |
| lecture | 0 | 0 | Pass |
| meeting-notes | 2 | 2 | Pass |
| project-plan | 2 | 2 | Pass |
| random-note | 0 | 0 | Pass |
| receipt | 0 | 0 | Pass |
| travel | 2 | 2 | Pass |

The job posting keeps its application deadline without turning qualifications into tasks. Receipts, lecture prose and the random personal note produce no forced actions. Grocery items preserve compound objects. Meeting owners, deliverables, appointment instructions and travel facts are retained only when the source supplies an actionable commitment. The nine text fixtures also pass, including source-only empty input and the Juniper regression.

# 11. TEST DATA ISOLATION

Recording uses port **3001** and `.data/demo`. Automated E2E uses **3002** with a fresh OS temporary directory. Manual destructive QA uses **3003** with its own temporary directory. Test launchers explicitly blank database and provider credentials before Next loads local environment files. Playwright refuses an occupied server instead of reusing it, and shutdown removes temporary storage.

Unit tests do not open persistent storage; integration tests explicitly use an in-memory database. The evaluator only writes its report. Screenshot capture scripts target manual QA on 3003. Final recording screenshots are intentional, read-only inspections of 3001.

The preserved original database contained **528 sessions, 836 sources and 3,685 items**. Its largest per-session source counts were 6, 6, 5, 5 and 4. I confirmed QA accumulation across the database; I could not reproduce the exact reported 57-source single workspace from that snapshot. The old `.data/pile` database remains intact.

Both the old-store isolation check and the final recording-store digest check report unchanged content across isolated testing. The latter hashes sorted relative paths and file contents with the recording server stopped. [Isolation design](/Users/mohit/Documents/Codex/2026-09-11/files-pasted-by-the-user-you/outputs/pile/docs/TEST_DATA_ISOLATION.md); [recording digest evidence](/Users/mohit/Documents/Codex/2026-09-11/files-pasted-by-the-user-you/outputs/pile/docs/qa/recording-isolation-check.json).

# 12. DEMO RESET

From `/Users/mohit/Documents/Codex/2026-09-11/files-pasted-by-the-user-you/outputs/pile`, stop the port-3001 server, then run:

```sh
pnpm demo:reset
pnpm start
```

Reset requires `DEMO_MODE=true`, `PILE_WORKSPACE_MODE=recording`, exact `DATA_DIR=.data/demo`, no remote database URLs, a matching identity marker, a stopped server, and nonsymlink targets. It aborts on ambiguity. Running-server and dummy-remote-URL guard checks both aborted before mutation.

The previous recording directory is archived under ignored `.data/demo-backups/`; the reset recreates only the recognized demo store and seeds five items, one source and three demo events. It preserves code, configuration, credentials and the original `.data/pile`. `--initialize` is for first setup only and refuses an existing target/marker; it has already been performed here.

The final reset was run after functional, visual and golden-demo testing. Only read-only final state inspection/screenshots followed. Fresh browser sessions get the same small curated seed.

# 13. BOARD/CALENDAR CONSISTENCY

Calendar task, deadline and reminder controls patch the same item ID used by Board. Completion persists after reload, hides the item from the active Board, appears under Completed, and can be reopened from either supported view. Both linked and unsynced Calendar tasks were exercised.

A pending completion disables its control and suppresses a repeated write. Completed cards are visually subdued. Completed and archived items are excluded from Needs a look. Status-only completion does not require a successful Google event edit. Ordinary external events, including Coffee with Maya, have no todo completion control.

# 14. CALENDAR INTERACTIONS

Verified previous/next week, repeated navigation, Today, date picker, linked-item detail, ordinary event detail, task/deadline completion and reopening, Board persistence, date edits/removal, Calendar add/remove/re-add, linked-event edits without duplication, recurrence term/location edits, and selected ICS export.

Calendar cards use a compact visual distinction for unsynced items instead of repeating “On your board · not synced.” Unsynced timed cards show their time and available location. Unfinished tasks display an empty completion circle; a completed item displays the check. External events open read-only details. Editing/removing an external provider event directly is outside this UI; linked Pile events use the Pile editor.

Adding to the demo calendar is local, explicitly labeled behavior. Google live writes still require configured OAuth and an explicit user approval step.

# 15. INTERACTION MATRIX

The [interaction matrix](/Users/mohit/Documents/Codex/2026-09-11/files-pasted-by-the-user-you/outputs/pile/docs/INTERACTION_MATRIX.md) inventories **54 control/state groups** across Global, Board, editor, import review, Calendar, Inbox, previews, Projects, Search, Settings and state/security behavior. Related controls are grouped; 54 is not a count of every rendered DOM button.

The functional suite contains 40 E2E scenarios, supplemented by unit/integration checks and the production browser matrix. It exercises normal clicks, relevant keyboard use, duplicate/repeated actions, disabled/loading states, cancellation/ambiguity and practical network/provider failures. The matrix names the evidence and identifies untested combinations.

Important combinations include completed plus linked, completed plus unsynced, edit after sync, source cascade deletion, source reupload, optional candidate promotion, duplicate processing, invalid dates, empty selection, failed transcription with retained playback, and 100-candidate review. Not every mathematical cross-product of controls and failures is claimed. Workspace/profile/theme selectors do not exist; the sun control opens the welcome guide.

# 16. VISUAL QA

Production visual checks cover **48 route/viewport combinations**: six routes × four viewports × two engines. Viewports: 1512×982, 1440×900, 1280×800 and 390×844. Routes: Board, Inbox, Calendar, Projects, Search and Settings. No horizontal overflow or uncaught page errors were reported. Two additional PDF paging checks verified first/last disabled states and pages 1→2→3→4→3.

Eight contact sheets preserve all combinations in a compact form. Full-size QA PNGs remain ignored local artifacts; the three final recording screenshots are versioned separately. Contact sheets were visually inspected. Calendar’s misleading unfinished checkmarks were corrected before the final production screenshots.

Chromium E2E also performs accessibility checks on desktop/mobile routes, responsive ordering checks and dialog/footer fit checks. This is practical visual/accessibility QA, not a complete accessibility certification. [Visual report](/Users/mohit/Documents/Codex/2026-09-11/files-pasted-by-the-user-you/outputs/pile/docs/qa/visual-results.json); [contact sheets](/Users/mohit/Documents/Codex/2026-09-11/files-pasted-by-the-user-you/outputs/pile/docs/screenshots/qa).

# 17. BROWSER QA

Chromium: complete functional E2E suite, production route/viewport checks, PDF preview/paging, real MediaRecorder with generated speech, and live ElevenLabs transcription.

WebKit: all 24 production route/viewport combinations and PDF paging passed. WebKit automation is useful Safari-engine evidence, but it is not a claim that native Safari itself was operated.

Native Safari and your physical microphone: not signed off. The Mac initially rejected automatic unlock. Access returned during release publishing; an isolated Safari QA page was opened, but the user resumed controlling Safari before the flow could be verified. The two working in-app Pile tabs were refreshed successfully to the clean release. Complete one short spoken rehearsal in the browser you will use on stage.

# 18. SEARCH QA

Verified relevant Maya results, chemistry-plus-deadline filtering, exact-title ranking, case/punctuation/plural normalization, source-text retrieval, source results independent of item results, date-relative source search, suggested query chips, clear controls and true zero-result states.

A shared capture mentioning Maya does not make every sibling item a Maya result. Nonsense queries do not fall back to unrelated cards. Original text remains searchable when no actions are emitted. Backboard outage contracts preserve local lexical search. The final recording workspace has no active search query.

# 19. VOICE QA

The successful live flow was generated speech → Chromium microphone stream → MediaRecorder blob → Pile transcription endpoint → real ElevenLabs → editable transcript → shared segmentation → separate review items. It was not a mocked provider response and was not your physical voice.

- **academic-voice**: ElevenLabs returned “I have a probability test, linear algebra midterm Wednesday, and calculus homework due Friday.” The review contained 3 separate items: Probability test, Linear algebra midterm, Calculus homework.
- **golden-voice**: ElevenLabs returned “I need to finish the Hackry submission tomorrow morning, email Maya tonight, and my dentist appointment is Tuesday at three.” The review contained 3 separate items: Finish HackRice submission, Email Maya, Dentist appointment.

The golden demo corrected a misheard proper name in the transcript editor when necessary. That is an honest recovery path, not fabricated provider accuracy. Numeric “3:00” now follows the same afternoon convention as the corresponding spoken “three” in this local parser.

The input meter reads the stream, and the recording can be played back before sorting. Retry uses the retained recording. Permission denial, pending permission, late stream cleanup, stale configuration, upload failure, empty/unsupported audio, silent responses, network errors and timeout messaging have explicit checks. Audio playback is session-local and is discarded when the dialog closes; the sorted transcript/source persists.

For your rehearsal: refresh the page, click Talk it out, start recording, speak a complete sentence, stop, wait for transcription, and play the audio if uncertain. Correct a name/date in the transcript before sorting. If transcription fails, retry while the dialog is still open.

# 20. GOOGLE CALENDAR QA

Live Google OAuth was not configured, so no real account create/edit/delete cycle is claimed. Contract tests cover token refresh, writable calendar listing, bounded recurrence, stable event IDs, duplicate create protection, conditional updates with the prior etag, and deleted-event handling. UI completion, edits and add/remove behavior were exercised against the local demo adapter.

The final environment says Demo calendar. Do not present local demo events as real Google synchronization. If connecting later, configure the documented OAuth variables and exact redirect URI, select the intended calendar, then test one event’s full add/edit/remove cycle before recording.

# 21. APPLE CALENDAR QA

Actual `.ics` downloads were exercised in review and item detail. Checks cover VEVENT counts, filenames, UID, source URL, UTF-8 folding/escaping, all-day exclusive end, timezone-aware timestamps and bounded recurrence. The live golden demo downloaded and parsed an event file.

Native Apple Calendar import was not repeated during this pass because the Mac was locked. The older handoff records a prior successful native import and cleanup; that historical result is not being relabeled as a new check. ICS is a file export, not ongoing two-way sync.

# 22. BACKBOARD QA

Backboard is not configured in the final local environment. Contract tests cover private assistant creation, explicit memories, memory-ID persistence, correction updates, owned deletion, semantic-score/ownership gates, and preserving lexical search during provider outages.

No live Backboard indexing or semantic retrieval result is claimed. Source/item persistence and local search work without it.

# 23. TIGER QA

Tiger is not configured; the prepared demo uses persistent local PGlite/PostgreSQL-compatible storage. In-memory integration tests cover repeatable migrations, idempotent seed, ownership, pipeline persistence, concurrent extraction, safe deletion and rollback behavior. The PostgreSQL adapter’s transaction failure path is checked with a controlled client.

No remote Tiger provisioning, connectivity, durability or latency measurement is claimed. QA launchers blank remote database variables, and demo reset refuses them.

# 24. EXACT AUTOMATED TEST RESULTS

Final commands and results:

| Command/check | Result |
|---|---|
| `pnpm lint` | Pass |
| `pnpm typecheck` | Pass |
| `pnpm test:unit` | 57 passed |
| `pnpm test:integration` | 36 passed |
| `pnpm test:e2e` | 40 passed |
| `pnpm eval:extraction` | 54 cases; 81/81 expected items matched; zero mismatches |
| `pnpm build` | Pass |
| `pnpm secret:scan` | Pass on staged/tracked release contents |
| `git diff --check` | Pass |
| Production visual script | 48 route/viewport checks + 2 PDF paging checks; zero failures |
| Recording database digest | Unchanged across isolated testing |
| Reset refusal checks | Running server and remote URL both rejected |

Functional total: **133 passing tests**. Corpus cases, visual combinations and live provider demonstrations are separate evidence, not added to inflate that total.

Earlier attempts found stale assertions and real parsing bugs, which were corrected. A Mac sleep interrupted one run. A mistakenly overlapping Playwright invocation was rejected at the server port but disturbed its shared trace directory; the final run was serial. The recurrence-editor test was corrected to avoid closing an already-open disclosure. The first GitHub CI run passed 39 browser tests and exposed a timezone assumption in the remaining Calendar test: a Chicago-dated seed task was outside the runner’s UTC week. The test now navigates to the saved task date and waits for completion before changing views. All eight correctness tests passed with an explicitly UTC browser, followed by the complete green CI run. Final green results are from the corrected suite, not a selective aggregation of failed runs.

# 25. GOLDEN DEMO TEST

1. Opened the curated recording environment in a fresh browser session.
2. Recorded generated spoken audio through the actual browser recording path and transcribed it with live ElevenLabs.
3. Reviewed three separate candidates, corrected a misheard proper name when needed, and saved them.
4. Uploaded the strengthened four-page syllabus. Review showed seven candidates: four dates, one lecture and two optional schedules.
5. Confirmed adding the five initially selected candidates to the explicitly labeled demo calendar.
6. Navigated to the voice task’s date, completed it from Calendar, and verified it disappeared from active Board.
7. Searched Maya and checked relevance; searched nonsense and verified zero items.
8. Opened the retained PDF and verified a rendered page with nonzero image dimensions.
9. Opened an assessment item and downloaded a valid ICS file.
10. Ran the separate academic voice capture: three items, only Probability test needing a date.
11. Reset the recording database after testing; verified the final seed and captured the final screens.

[Golden demo evidence](/Users/mohit/Documents/Codex/2026-09-11/files-pasted-by-the-user-you/outputs/pile/docs/qa/golden-demo.json) and [reproducible rehearsal notes](/Users/mohit/Documents/Codex/2026-09-11/files-pasted-by-the-user-you/outputs/pile/docs/GOLDEN_DEMO_TEST.md). The two live voice runs use generated speech, so the physical-microphone prerequisite remains. The two working in-app Pile tabs were subsequently refreshed to the clean release.

# 26. FINAL RECORDING WORKSPACE

Final state inspection: `2026-09-13T04:21:36.017Z`.

| Area | Intentional contents |
|---|---|
| Today | Finish HackRice demo — HackRice; Email Maya — Personal |
| This Week | Probability homework — next Sunday; Dentist appointment — next Tuesday, 3 PM Chicago |
| Later / Ideas | A quieter internet, one tab at a time |
| Inbox | One intentional curated starting-board source |
| Needs a look | Zero |
| External demo Calendar events | Design catch-up; Coffee with Maya; Team check-in |

The five Board items are the only seeded items. Dated Board items also appear as dashed Calendar cards, so the Calendar contains those representations in addition to its three separate demo events. Nothing is pre-imported from the syllabus, flyer or meeting notes. No QA transcript, malformed policy task, duplicate syllabus or active search is left in the recording workspace.

Dates are generated relative to reset/session creation; Chicago controls the seeded timed events. The ready-to-upload assets stay in `demo-assets/`. Provider indicators are truthful: ElevenLabs configured; local deterministic extraction; local persistence; Demo calendar; Backboard not configured.

# 27. FINAL SCREENSHOTS

- [Final Board — 1440×900](/Users/mohit/Documents/Codex/2026-09-11/files-pasted-by-the-user-you/outputs/pile/docs/screenshots/final-demo-board.png)
- [Final Calendar — 1440×900](/Users/mohit/Documents/Codex/2026-09-11/files-pasted-by-the-user-you/outputs/pile/docs/screenshots/final-demo-calendar.png)
- [Final Inbox — 1440×900](/Users/mohit/Documents/Codex/2026-09-11/files-pasted-by-the-user-you/outputs/pile/docs/screenshots/final-demo-inbox.png)

Additional viewport/browser evidence is in [QA contact sheets](/Users/mohit/Documents/Codex/2026-09-11/files-pasted-by-the-user-you/outputs/pile/docs/screenshots/qa). The JSON snapshot is [final-recording-state.json](/Users/mohit/Documents/Codex/2026-09-11/files-pasted-by-the-user-you/outputs/pile/docs/qa/final-recording-state.json). These final images were taken after reset, not after importing the golden-demo files.

# 28. KNOWN LIMITATIONS

- No completed physical-microphone/native-Safari rehearsal; initial lock and later concurrent Safari use prevented a full native check.
- Natural language remains heuristic in local/demo mode. The synthetic corpus does not guarantee arbitrary layouts or paraphrases.
- The local 1–7 o’clock afternoon convention and “tonight” at 7 PM are defaults, not certainty about user intent. Review/edit the time; explicit AM/PM is safer. “Tomorrow morning” can remain date-only when no exact hour is supplied.
- Proper names can be misheard by speech recognition. The editable transcript is the recovery path.
- Cross-capture natural-language correction/cancellation is not an automatic database update. Correct an existing item through its editor.
- Scanned/image-only PDFs do not have general OCR. Arbitrary image understanding needs the optional vision provider; the sample flyer has a deterministic fixture path.
- Browser-cookie workspaces are not a multi-device account system. Keep the hostname/browser consistent.
- Google, Backboard and Tiger live account behavior is not signed off. No background two-way Calendar reconciliation exists.
- ICS export is not live sync. Voice audio is not archived persistently.
- Source deletion cascades its extracted items; archive does not have a dedicated restoration listing. Cross-tab preference/state changes require refresh.
- The 100-candidate review check is a usability bound, not a high-volume load test or evidence for hundreds of external calendar writes.

# 29. DEMO RISKS

The highest remaining risk is microphone/browser/device setup, followed by provider latency and misheard proper names. Rehearse once in the actual recording browser. A running timer alone is insufficient; verify the transcript and use playback.

Use the prepared PDF rather than an unfamiliar scanned document during the 90-second demo. Keep Calendar labeled Demo unless you separately configure and verify Google. Refresh old Pile tabs after the production restart so they load the updated recording code. Keep the Mac awake during the recording and keep only one server on port 3001.

Do not imply perfect extraction or live sponsor integrations from synthetic/mocked evidence. The clean review, source traceability, editable dates and reliable fallback are the demo’s strongest defensible claims.

# 30. EXACT 90-SECOND DEMO SCRIPT

| Time | Action and narration |
|---|---|
| 0–10s | Show the clean Board. “Pile turns messy input into a few things I can actually act on.” |
| 10–27s | Open Talk it out. Say: “I have a probability test, linear algebra midterm Wednesday, and calc homework due Friday.” Stop and wait for the transcript. |
| 27–39s | Sort. Show three separate candidates. “Each commitment keeps its own date. Only the probability test needs a quick question.” |
| 39–55s | Close review and upload the sample syllabus. “The policy stays in the source. These are the four dates and the class schedule that matter.” Point out unchecked optional schedules. |
| 55–67s | Confirm five additions to the labeled demo calendar. “I choose what reaches my calendar.” |
| 67–76s | Return to Today in Calendar, complete Finish HackRice demo, then show Board reflecting the same completion. |
| 76–84s | Search Maya, then briefly show a nonsense query returning nothing. “It finds relevant items without filling the screen with unrelated cards.” |
| 84–90s | Open the retained PDF or point to its source receipt. “The original is always there. A little less on your mind.” |

This assumes the microphone rehearsal succeeded and the provider returns promptly. Do not spend the recording waiting through an outage; use the backup below.

# 31. BACKUP DEMO PATH

If live voice stalls, retain the recording and use the editable transcript field or paste the same academic sentence into text capture. Say plainly that you are demonstrating the same extraction path with text. The sample transcript shortcut is also labeled as a sample.

Continue with the prepared four-page PDF, local review and demo Calendar. If Google is unavailable, keep Demo calendar visible or download the ICS file. If a PDF preview is unexpectedly slow, open the original source file. Do not switch providers, rotate keys or attempt a new integration during the recording.

The backup still demonstrates the important product claims: few useful actions, separate dates, per-item clarification, explicit Calendar approval, shared source provenance and consistent completion.

# 32. DO NOT TOUCH BEFORE JUDGING

Keep the prepared `.env.local`, provider key permissions, database target and identity marker unchanged. Do not run old screenshot/QA scripts against port 3001. Do not restore `.data/pile` into `.data/demo` or import every fixture into the recording workspace.

Do not upgrade dependencies, change extraction prompts, add unverified integrations, change browser/hostname mid-demo, or rerun a destructive reset while the server is running. Do not commit environment files, audio recordings or database backups. Run only one Playwright process per checkout because traces share a local output directory.

Use `pnpm start` for recording from the completed build. After any intentional rehearsal that changes the Board, stop the server, run the guarded reset, restart and refresh before the take.

# 33. IF WE HAVE 30 MINUTES LEFT

1. Spend the first five minutes on the actual physical microphone in the intended recording browser. Speak the academic example, inspect the transcript, listen to playback and verify three candidates.
2. Rehearse the 90-second flow twice, including the text fallback. Correct narration that accidentally implies live Google or perfect extraction.
3. If native Safari is your target, spend five minutes verifying record/stop/transcript, PDF preview and Calendar completion there. WebKit checks reduce risk but do not replace this.
4. Check screen framing, zoom, notifications and audio input selection. Keep only the relevant demo tab visible.
5. Stop, reset, restart, refresh, and inspect the calm starting Board. Reserve the final minutes for recording, not code changes.

Do not start broad feature work. Any last code fix should have a concrete reproduction and a focused regression check, followed by the affected release checks.

# 34. CONTINUATION INSTRUCTIONS

Continue in `/Users/mohit/Documents/Codex/2026-09-11/files-pasted-by-the-user-you/outputs/pile` on main. Read this handoff, [interaction matrix](/Users/mohit/Documents/Codex/2026-09-11/files-pasted-by-the-user-you/outputs/pile/docs/INTERACTION_MATRIX.md), [test-isolation guide](/Users/mohit/Documents/Codex/2026-09-11/files-pasted-by-the-user-you/outputs/pile/docs/TEST_DATA_ISOLATION.md), and the JSON evidence under `docs/qa/`. Prior handoffs describe older release states.

For code changes, obey `AGENTS.md` and the installed Next.js documentation. Preserve the segment → actionability → local date/classification boundary, per-item source identity, explicit Calendar approval, and server-only credentials. Any reported false-positive prose or merged capture should become a structured corpus fixture before changing the parser.

Run the canonical lint, type, unit, integration, E2E, extraction, build and staged secret/diff checks. E2E must stay on 3002 with temporary storage; manual destructive QA belongs on 3003. Do not weaken tests or point them at the recording database. Inspect genuine UI output and provider responses rather than inferring success from configuration flags.

The next required human action is to complete the physical-microphone rehearsal in the refreshed recording tab. After any rehearsal, use the guarded reset and restart for a clean take. Future live Google/Backboard/Tiger work should include account-backed verification and update the evidence boundaries explicitly.
