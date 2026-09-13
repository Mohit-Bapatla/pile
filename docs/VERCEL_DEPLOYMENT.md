# Vercel deployment

Pile is live at **https://pile-black.vercel.app/app**. The `pile` Vercel project is linked to `Mohit-Bapatla/pile`; pushes to `main` deploy to production.

## Production configuration

- Vercel team: `bapatlamohitwork-2162s-projects`, project `pile`, Next.js on Node 24.
- Persistent storage: dedicated Neon `pile-db`, free plan, `iad1`. Migrations ran successfully. Original uploaded files are stored in PostgreSQL along with workspace records.
- Production variables: integration-managed `DATABASE_URL` and PostgreSQL companion variables; `DEMO_MODE=true`; `PILE_WORKSPACE_MODE=recording`; `NEXT_PUBLIC_MAX_UPLOAD_MB=4`; `ELEVENLABS_STT_MODEL=scribe_v2`; sensitive server-only `ELEVENLABS_API_KEY`.
- ElevenLabs transcription is live. Extraction and Calendar use the existing demo adapters. Google OAuth, Backboard, and Tiger are not configured for this deployment.
- Browser sessions use secure cookies on Vercel. Workspaces remain browser-cookie based; there is no multi-device account login.
- Local environment files, databases, build output, and QA artifacts are excluded from uploads. The local recording server and its database were preserved.

Hosted uploads and recordings are limited to 4 MB, with client and API validation. This leaves room for multipart metadata under Vercel's 4.5 MB function request limit. Local development retains its 8 MB default. API functions allow up to 120 seconds. See [Vercel function limits](https://vercel.com/docs/functions/limitations).

PDF initialization is lazy and imports `@napi-rs/canvas` explicitly so Vercel traces the native renderer. Migration SQL, fixture assets, and PDF worker files are also traced into the API function. Hosted execution refuses to fall back to an ephemeral embedded database when `DATABASE_URL` is missing.

## Deployment and maintenance

From the linked repository, `pnpm dlx vercel --prod --skip-domain` creates a staged production deployment. Verify it, then run `pnpm dlx vercel promote <deployment-url>`. Routine `main` pushes also deploy through the GitHub integration.

Production environment changes require a new deployment. Pull production variables only into a private scratch file when necessary; do not overwrite the local `.env.local`. Never commit pulled variables. Preview environments currently have no provider credentials or database; provision a separate database before using data-dependent previews.

## Release verification — September 13, 2026

- Lint, TypeScript, and the Vercel production build passed.
- 57 unit, 37 integration, and 41 browser tests passed.
- Extraction corpus: 54 cases, 81 expected and matched items, zero mismatches; segmentation: 28 exact.
- Hosted Chromium verification used generated speech through MediaRecorder and the real ElevenLabs endpoint. It produced a transcript and three separate academic items; saved data survived reload.
- PDF upload produced seven clean candidates and five confirmed demo Calendar additions. The native PDF preview rendered successfully.
- Calendar completion persisted to Board; unrelated search returned no cards; oversized upload was rejected before a network request.
- Board, Calendar, and Search were checked at desktop and mobile widths, with no horizontal overflow or browser page errors. The temporary verification workspace was removed afterward.
- No HTTP 5xx runtime logs were returned for the verified deployment during the verification window. PostgreSQL emitted a future SSL-mode compatibility warning; these requests succeeded.
- The promoted public `/app` returned HTTP 200 without Vercel authentication.

Machine-readable hosted evidence: [vercel-deployment.json](qa/vercel-deployment.json). The tested staged deployment was `dpl_CabT4H2qe2jJ3ftn4AcCGFM4JUgm` before promotion.

Physical microphone capture and native Safari were not exercised in this automated hosted check. The generated speech test verifies recording, upload, real transcription, item extraction, and persistence, but does not verify a particular device's microphone selection.
