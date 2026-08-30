# Louisburg Local — Meta Social Worker

This file documents the production social-source worker added in `SocialWorker.gs`.

## Goal
Read public Facebook Page posts and public Instagram Business/Creator posts from verified Louisburg-only sources, normalize them into `Social Post Intake`, and preserve the existing `Verification Queue` gate. The worker never publishes directly to `Hub Feed`.

## Non-negotiable account rule
Do **not** authenticate Louisburg Local through Brew & Brews. Brew & Brews remains only a public source target. Do not use its credentials, cookies, Page roles, tokens or Meta assets.

If Meta authentication is used, it must be a separate Louisburg Local technical Meta app/account.

## Current Meta API track
Use Graph API v25.0 unless a later reviewed version is intentionally selected.

Facebook non-owned Page reads require the Meta feature/approval that permits Page public-content access. Meta App Review is therefore an external prerequisite for production reads of businesses Louisburg Local does not own/manage.

Instagram Business Discovery requires supported Instagram permissions plus an Instagram professional actor account configured for the dedicated technical app.

## Script Properties
Store secrets only in Apps Script **Script Properties**:

- `LL_META_ACCESS_TOKEN` — Meta access token authorized for the approved public-content use case.
- `LL_META_GRAPH_VERSION` — set to `v25.0` for the current production baseline.
- `LL_META_IG_ACTOR_ID` — Instagram professional actor ID used by Business Discovery, if Instagram ingestion is enabled.

Never store a token or app secret in Google Sheets, GitHub, frontend JavaScript, logs, or feed payloads.

## Worker flow
1. `runLouisburgLocalSocialWorker()` reads `Social Worker Queue`.
2. Only rows whose `Source Status` begins with `VERIFIED` are eligible.
3. `META_API_PUBLIC_PAGE` reads Facebook Page-created posts.
4. `META_IG_BUSINESS_DISCOVERY` reads Instagram professional public media.
5. The worker captures the exact content-level permalink, timestamp, text/caption and original media URL when Meta returns one.
6. New records are appended to `Social Post Intake`.
7. `processSocialPostIntake()` applies Louisburg, freshness, activity and dedupe gates.
8. Qualifying activity goes to `Verification Queue` as `OPEN - SOCIAL`.
9. Nothing is automatically published.

## Deployment test order
After `SocialWorker.gs`, `Config.gs` and `Setup.gs` are live in the Apps Script project:

1. Run `runLouisburgLocalSocialWorkerSelfTest()`.
2. Run `runLouisburgLocalSocialWorkerDiagnostics()`.
3. Confirm `metaTokenConfigured: true` before attempting live Meta reads.
4. Re-run `installLouisburgLocalCollectorTriggers()` so `runLouisburgLocalSocialWorker` is installed hourly.
5. Run `runLouisburgLocalSocialWorker()` manually once.
6. Inspect Timber Creek's `SOC-TIMBER-FB` row. A successful read must populate `Last Post URL`, `Last Post Date`, `Last Post Text` and, when available, `Last Media URL`.
7. Confirm the same post appears in `Social Post Intake` and then passes through the existing verification processor.

## Failure behavior
The worker fails closed. Missing Meta configuration is written as `BLOCKED - META CONFIG REQUIRED`. Meta API failures are written to `Last Result` with access tokens redacted. Unsupported scan modes are skipped. Existing verification and fair-rotation behavior remains unchanged.
