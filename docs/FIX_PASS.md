# Pile functional fix pass — September 12, 2026

## Baseline investigation

Pulled main (e3b6338); all six primary routes load on port 3001. A browser request for `recruiter` returned all five seeded items. A stopword-only query also returned all five. The parser maps every nonempty line to an item, including a fallback `note`, and the schema requires at least one item. Source excerpts copy the first 1,500 characters of the entire source onto every item. Voice uses OpenAI credentials and Whisper, not ElevenLabs. Google uses stable IDs but blocks edits and has no recurrence/export workflow; timezone is device-only.

| Bug                                  | Cause                                                                               | Intended behavior                                                              | Implementation                                                                         | Verification                                                                                               |
| ------------------------------------ | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Search returns unrelated cards       | Shared full-source text and OR substring scoring; empty tokens match all            | Ranked relevant items; independent recognizable source hits; zero means zero   | Weighted token fields, meaningful-term coverage, source-level index, semantic ID merge | Maya, recruiter, chemistry deadlines, nonsense and shared-source tests                                     |
| Syllabus creates dozens of notes     | Exhaustive line mapping, no actionability gate, no metadata/schedule representation | A few actions, bounded schedules and optional resources                        | Tier/score policy, syllabus parser, metadata, recurrence and deduplication             | Long realistic fixture + negative assertions + import E2E                                                  |
| Voice does not transcribe            | Only OpenAI adapter and key gate                                                    | Recorded bytes → server → ElevenLabs Scribe v2 → editable transcript → capture | ElevenLabs multipart adapter, validation, duration and error handling                  | Request contract, mocked integration and MediaRecorder E2E; physical microphone status reported separately |
| Timezone is not a preference         | Device zone used directly; editor uses browser Date                                 | Persisted IANA zone, UTC instants, unchanged all-day dates                     | User preferences + zoned conversion                                                    | Chicago/New York and reload E2E                                                                            |
| Calendar lacks recurrence and export | One-off event schema and Google-only write path                                     | Bounded recurring events, safe updates, valid Apple files                      | Structured recurrence, Google conditional update, ICS export                           | RRULE, byte folding, Google mock and browser downloads                                                     |

## Sources consulted

- [Backboard memory API](https://docs.backboard.io/concepts/memory): explicit assistant memories and semantic search, with metadata.
- [ElevenLabs speech-to-text](https://elevenlabs.io/docs/api-reference/speech-to-text/convert): multipart `file`, `model_id=scribe_v2`, `xi-api-key`.
- [Google recurrence](https://developers.google.com/workspace/calendar/api/guides/recurringevents) and [event updates](https://developers.google.com/workspace/calendar/api/v3/reference/events/update): timezone-aware recurring parents and conditional writes.
- [RFC 5545](https://www.rfc-editor.org/rfc/rfc5545): CRLF, UTF-8 byte folding, text escaping, exclusive all-day end dates.
- [UT Austin syllabus guidance](https://fisd.utexas.edu/teaching-resources-library/teaching-resources/effective-syllabus) and [signature course template](https://undergraduates.utexas.edu/first-year-experience/signature-courses/faculty-resources/plan-propose-signature-course/signature-course-syllabus-template): course metadata, schedule, assessment and policies kept distinct. Demo prose is original, fictional material.

## Credential boundary

No ElevenLabs, OpenAI, Backboard, Tiger/PostgreSQL or Google credentials were present at baseline. Mocked HTTP verification must not be described as live integration verification. Physical microphone verification is separate from simulated MediaRecorder coverage.

## Implemented policy and regression outcome

A three-page UGS 303 fixture now yields exactly seven candidates: four assessments, one Tue/Thu class and two optional schedules. Five are selected by default. Instructor/contact/website/term/location live on the project and source. A repeated Observation #2 date produces one item. Missing recurrence bounds require clarification. The model prompt and deterministic post-filter both apply the same actionability policy; document-only imports may produce zero cards.

Search uses exact/prefix title boosts, weighted field tokens, sensible plural handling and full meaningful-term coverage. Full source text produces source results rather than contaminating sibling items. Legacy shared excerpts are explicitly excluded. Conversational Backboard retrieval is ownership-checked, score-gated and deduplicated with lexical results; short direct queries remain lexical.

The ElevenLabs request contract, Google RRULE/conditional update, Backboard write/search/update and local PostgreSQL preferences/CRUD are covered by integration tests. No external credentials were present. The complete browser suite covers actual Chromium recording with fake audio and a mocked recorded-blob transcription flow, not physical microphone speech.

The production build, all primary routes, grouped review, full PDF/image preview, Apple downloads, timezone persistence, search filtering, editing, duplicate uploads and calendar retry behavior were exercised. See FUNCTIONAL_HANDOFF.md for release evidence and exact counts.

A final production regression caught missing duration on short voice captures: the display timer could lag behind Stop. Duration now uses a monotonic start/stop clock, independent of React interval updates. The browser regression records a subsecond clip and requires a positive persisted duration.
