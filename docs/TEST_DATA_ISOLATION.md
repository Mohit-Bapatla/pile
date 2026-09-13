# Test data isolation and recording reset

The original local database contained 528 sessions, 836 sources, and 3,685 items when inspected on September 12, 2026. The five largest source counts per session were 6, 6, 5, 5, and 4; the reported single-workspace count of 57 could not be reproduced from this database snapshot. The confirmed problem was database-wide accumulation: Playwright previously reused the demo server, two test requests hard-coded port 3001, and the screenshot script also wrote captures there. Cookie isolation protected other sessions' item access, but did not isolate storage or persistent QA artifacts.

## Three environments

- Recording: port 3001, `DATA_DIR=.data/demo`, `PILE_WORKSPACE_MODE=recording`, `DEMO_MODE=true`. The prior `.data/pile` database remains preserved and is no longer the recording target.
- Automated E2E: port 3002. `pnpm test:e2e` starts its own server, refuses to reuse any existing server, creates an OS temporary directory, and deletes it after shutdown. Real provider and database variables are explicitly blanked before Next loads `.env.local`.
- Manual QA: port 3003. `pnpm qa:server` creates a separate OS temporary database with the same credential isolation. `pnpm screenshots` targets this port. Stop the QA server to remove its temporary database.

Unit tests do not open persistent storage. Integration tests explicitly use `openDB('memory://')`. E2E tests use per-context cookies within their temporary database. The extraction evaluator does not write to the app database; its report is saved under `docs/qa/`.

Do not point ad hoc scripts at port 3001 for destructive tests. Final recording screenshots are read-only and intentionally target that port.

## Reset the recording workspace

Stop the recording server first, then run from the repository:

```sh
pnpm demo:reset
pnpm start
```

The reset aborts unless ALL of these are true: `DEMO_MODE=true`, `PILE_WORKSPACE_MODE=recording`, `DATA_DIR` resolves to this checkout's `.data/demo`, both remote database URLs are empty, port 3001 is stopped, and the `.data/demo-workspace.json` identity marker matches the checkout. It refuses symlink targets. It never reads a remote database or deletes `.data/pile`.

The first initialization uses `pnpm demo:reset --initialize` and refuses an existing demo target or identity marker. Initialization is performed once during this release. Later resets archive only the identified demo directory under ignored `.data/demo-backups/`, then recreate it. Code, credentials, and configuration are untouched.

Every fresh recording session receives five curated items: Finish HackRice demo and Email Maya today; Probability homework next Sunday; Dentist appointment next Tuesday at 3 PM; and A quieter internet, one tab at a time. There is one intentional seed source, no needs-review items, and three separate demo calendar events: Design catch-up, Coffee with Maya, Team check-in. Dated Board items also appear as dashed cards in Calendar. Upload assets remain under `demo-assets/` without being pre-imported.

Closing a voice dialog discards its local audio playback. Audio is not persisted in the database. The transcript and source relationship persist when sorted.

Guard checks during this pass: a reset with the recording server running aborted before mutation; a reset with a nonempty dummy remote `DATABASE_URL` aborted before connection or mutation. A second E2E process refused an occupied port 3002 rather than reusing it. Never run two Playwright invocations concurrently in the same checkout: they share the ignored trace/output directory even though app storage is isolated.
