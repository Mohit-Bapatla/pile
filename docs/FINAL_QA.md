# Final pre-judging QA — September 12, 2026

Baseline: main `9ea5a53bc155c031039ec349d2ac5f2aaf45096a`, clean and matching origin after pull. Baseline 34 unit, 22 integration, 21 Chromium E2E pass. Those tests did not cover the following reproduced defects.

| ID / severity | Reproduction | Expected / actual | Root cause | Fix / verification |
|---|---|---|---|---|
| QA-01 P1 | Capture “Submit essay due September 18 or September 20” and two copies with different dates | Review alternatives / first date confidently chosen | Parser only read first Chrono result; no cross-candidate conflicts | Inspect multiple date matches and duplicate titles with distinct dates; regression blocks calendar until reviewed |
| QA-02 P1 | Capture 10 KB single-clause brain dump | Preserve source, bounded candidates / schema error | Unbounded evidence/description fields | Bound derived fields while original remains intact; long-capture regression |
| QA-03 P1 | Capture “dentist tuesday 3pm at west campus dental” | Location in calendar / location missing | Local provider omitted location | Extract explicit trailing location and clean title; exact date/location regression |
| QA-04 P1 | Import second syllabus with `Essay | September 18` and `No class November 2` | Assignment plus flagged schedule exception / both silently missing | Only explicit assessment keyword lines supported | Recognize assessment table context and schedule changes; exception explicitly requires manual recurrence adjustment |
| QA-05 P2 | Capture “random thought: plants are cool” or “grad school but not now” | Source-only / low-value note card, sometimes a misleading date | Single-note exemption and unrestricted Chrono dates | Zero-action source retained; explicit preference notes still supported; regression |
| QA-06 P2 | Capture “emial maya tomorow” and probability homework | Recover obvious typo and relevant project / note and Calculus project | Narrow tokens and broad project alias | Two bounded spelling corrections; Probability project; tests |
| QA-07 P1 | Construct calendar export with end before start or term ending before first meeting | Reject / invalid calendar interval emitted | Validation only in one edit route | Shared calendar validation covers all callers; tests |
| QA-08 P2 | Transcription returns whitespace; recorder constructor fails after microphone grant | Friendly recovery, tracks released / raw schema error or retained tracks | Empty transcript schema exception; missing catch cleanup | Friendly no-speech message and catch cleanup; request/browser regressions |

Provider keys checked by presence only: OpenAI, ElevenLabs, Backboard, Tiger, generic PostgreSQL and Google absent. No secrets printed. Live verification cannot be inferred from mocks.

## Audit scope

Read AGENTS, both previous handoffs, design documents, scripts, migrations, extraction, schemas, pipeline/store, search, provider adapters, calendar/ICS, recurrence, settings, review and recorder. Production baseline reachable on port 3001, visible board and no framework error overlay. Existing tests are retained; the ownership test now captures an explicit private task because generic prose intentionally creates zero cards.

This log is extended with verification and critique outcomes before release.

## Additional reproduced issues

- **QA-09 P1:** Image-only PDF returned PDFParse page markers and was incorrectly treated as readable. Fixed by checking per-page text. A real image-only fixture now fails with a recovery message and preserves its original. Integration + browser regression pass.
- **QA-10 P2:** Abort the settings preferences request, then Save timezone. Expected inline error; actual unhandled fetch rejection. Added catch and browser error-list assertion. Regression passes.
- **QA-11 P1 demo-preparation risk:** Native Safari's pre-existing workspace still holds an old 50-item import. Stored output is not automatically reprocessed. Preserve personal data and prepare a fresh demo browser workspace. No destructive cleanup performed.
- **QA-12 P2 environment limitation:** Native Safari microphone access remained pending without a usable permission prompt. Escape recovered. Physical microphone and native MP4 recording unverified; Chromium fake-device recording and MP4 adapter contract remain independently tested.

## Pre-critique gate

53 unit + 36 integration + 26 Chromium E2E = 115 pass. E2E ran against `pnpm start`, not a dev server. Lint, typecheck, production build, fresh DATA_DIR migration + seed, secret scan and diff check pass. Screenshot generator produced current route/dialog captures; 12 axe dialog/content states have zero violations. Six routes across desktop/mobile also pass in E2E.

Manual Chromium walkthrough verified a fresh text capture, exact two-card result with location, syllabus defaults, calendar confirmation and calendar occurrences. Viewport screenshots were visually inspected. Native Safari board and voice dialog navigation were attempted; pending microphone request recovered by Escape. Apple Calendar's file preview correctly rendered the disposable five-minute event, but Import remained disabled and Finder could not be controlled because no window was available. No calendar import or personal-calendar mutation occurred.

External critique submission: complete fresh handoff attached as Markdown (preserving all contents), plus board, review, voice-review, search, calendar and settings PNGs, to the user's existing ChatGPT session. Prompt explicitly requests harsh judge/user/SWE/sponsor review and feasible ranked changes.

## Additional DST findings while the external review was pending

- **QA-13 P2:** At Nov 1 23:30 America/Chicago after fall-back, subtracting 24 hours still landed on Nov 1, so a “Maya yesterday” search missed Oct 31. Use previous local calendar date. Fixed and regression passes.
- **QA-14 P1:** All-day weekly recurrence was expanded into timed ISO strings, allowing display-zone date shifts. Preserve date-only starts/ends and next-meeting dates. Fixed and regression passes in Tokyo/Los Angeles.

External-network-blocked production smoke: local text, PDF, flyer, sample transcript, all routes, search, demo calendar pass; real Chromium MediaRecorder with a fake microphone ran for 2 seconds and 20 seconds and recovered honestly with no STT key. Zero browser runtime errors. Evidence: PREJUDGE_RELIABILITY.json. This is simulated input, not physical speech or live STT.

## Post-critique release gate

55 unit + 36 integration + 29 Chromium E2E = **120 passing functional tests**. The final E2E production run completed in 43.3 seconds. Lint and typecheck pass after the new browser tests. Production build passed after all application changes. No dependencies or database migrations changed.

The six critique implementation groups are recorded in CRITIQUE_DECISIONS.md. Added a 15-second microphone permission timeout with late-stream cleanup; automated fake-clock regression passes. Updated source-evidence review, capture value copy, separate search groups/counts, and calendar labels. The complete external response is in CHATGPT_CRITIQUE.md; only trailing whitespace was normalized, with the whitespace-normalized completeness check unchanged.

All screenshots regenerated against production. Twelve additional axe content/dialog states have zero violations, alongside six routes at desktop/mobile in E2E. Visually inspected board at 1280×800, mobile 390×844, review, calendar and search after changes. Existing tests cover 1440×900, 1280×800, 390×844 review/PDF dialogs; screenshot kit adds 1512×982.

POST_CRITIQUE_RELIABILITY.json records another production rehearsal with browser external requests blocked: capture/location, syllabus evidence, explicit approval of five demo events, flyer, sample transcript editing, six routes at eight widths, search and nonsense. Zero console/runtime errors and zero page-level horizontal overflow. Browser-only blocking is not a physical Wi-Fi shutdown or a server network firewall. Provider credentials were absent. A scratch smoke initially expected a duplicate source result for typed text; inspection confirmed deliberate suppression of redundant plain-text source rows, then the assertion was corrected. This was a smoke-script expectation error, not a product defect.

A separate agent-driven browser rehearsal confirmed exact typed input, seven syllabus candidates with five selected, optional schedules unchecked, the five-event confirmation, and recurring class occurrences with location. A fresh headed Chromium session named `pile-judging` was prepared and verified to have only five seeded items. The old Safari workspace remains untouched. Production server stdout showed no new errors during the final flow.

## CI-discovered follow-up

The first implementation CI run (34727795253) passed unit/integration checks and 28 browser tests, but the settings-outage test timed out before the form appeared. Its intercept could abort the workspace's initial timezone-detection PATCH. The test now waits for the settings field, then intercepts only PATCH save requests. It still requires the visible recovery message and zero runtime exceptions.

**QA-15 P1:** CI also surfaced a real hydration warning from the date header: server and client clocks/timezones could render different weekdays, and the header ignored the selected preference. The header now renders after workspace data arrives and formats in the active timezone. A new browser regression fixes the browser clock to a different year, reloads, switches Los Angeles/Tokyo across a date boundary, and requires correct header dates with zero page errors. This issue was found after the external critique, during the release gate.

Final follow-up target: 55 unit + 36 integration + 30 E2E = 121 functional tests. The 120-test result above remains a historical successful local gate, not the final CI result. Migrations and seed were also rerun successfully in another fresh isolated DATA_DIR after critique.

CI follow-up local gate passed: **55 unit + 36 integration + 30 E2E = 121**. The new date-header regression failed against the previous production build (Tokyo incorrectly displayed January 1), then passed after rebuilding with the fix. Full E2E completed in 44.4 seconds. Lint, typecheck, production build, screenshots, twelve-state accessibility audit, and the eight-width production smoke all passed again.

## Native Apple import completed during the final CI wait

The earlier import limitation was resolved by bringing Calendar's main window/dialog to the foreground before acting. Created a separate `Pile QA disposable` iCloud calendar, selected the generated ICS, chose that destination, and confirmed import. The actual calendar event and editor displayed **Pile QA disposable import test**, **Local demo**, **September 14, 2026, 12:00–12:05 PM**, source URL and description, with no invitees. This is a completed native import, not merely Quick Look. Removed the disposable event, verified it absent, then removed the empty QA calendar and verified both names absent from the full accessibility state. Existing calendars/events were preserved. No personal calendar screenshots or account details were copied into the repository. This supersedes the earlier blocked native-import observation.

Native Safari final follow-up: raised the existing Pile window, reloaded the final production build, then verified initial search guidance, `Maya` yielding one item and one voice source with separate headings, and `zzzzqwertyxyz123` yielding zero items/sources. No legacy sources were deleted or modified. Physical speech/native recording remains unverified. This supersedes the earlier incomplete Safari search attempt.

Final implementation CI **passed** on `1df21a76078ee617285681adf7747172b1ce4c83`: https://github.com/Mohit-Bapatla/pile/actions/runs/34728100359. All 30 E2E tests and production build completed successfully. Final handoff/README/native verification notes are a subsequent documentation-only commit and receive their own CI run.
