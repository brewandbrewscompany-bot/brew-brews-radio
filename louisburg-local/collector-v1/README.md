# Louisburg Local — Collector V1.1

Collector V1.1 is the conservative automation layer for Louisburg Local.

## What it does
- Reads active rows from `Source Endpoints`.
- Processes only `DIRECT` endpoints in normal collector runs.
- Checks HIGH sources every 6 hours, MEDIUM daily, LOW weekly.
- Processes at most 20 due DIRECT endpoints per run and persists a cursor between runs.
- Uses a script lock so overlapping hourly executions cannot process the same batch simultaneously.
- Retries temporary 429/5xx/network failures with exponential backoff.
- Normalizes public webpage text and stores a SHA-256 fingerprint in `Collector State`.
- Ignores unchanged pages.
- Changed sources with timely Louisburg signals create review candidates in `Verification Queue`.
- Prevents duplicate open collector candidates for the same organization/source.
- Runs a separate verified social-source worker for approved Meta API routes.
- Social results are normalized into `Social Post Intake` and must pass the existing verification gate.
- Never automatically publishes a discovered candidate to `Hub Feed`.
- Logs collector activity and runs lifecycle/maintenance automation.
- Processes pending Sherlock source rechecks before the normal collector batch.
- Runs daily privacy/retention maintenance for pseudonymous Sherlock/reaction keys.

## Required Google Sheet tabs
- Master Registry
- Source Endpoints
- Discovery Coverage
- Collector State
- Collector Log
- Verification Queue
- Hub Feed
- Sherlock Notes
- Reactions
- Category Rules
- Social Worker Queue
- Social Post Intake
- Meta API Setup

The spreadsheet timezone should be `America/Chicago`.

## Install / deploy
Create/use the existing Google Apps Script project associated with Louisburg Local and keep the files in `louisburg-local/collector-v1/` synchronized with that project.

At minimum the live project must include:
- `Config.gs`
- `Collector.gs`
- `SocialWorker.gs`
- `SocialIntake.gs`
- `Lifecycle.gs`
- `Setup.gs`
- `WebApp.gs`
- the existing supporting backend files in this folder

Then:
1. Run the relevant self-tests.
2. Run `seedLouisburgLocalCollector()` only when intentionally establishing/resetting collector baselines.
3. Run `installLouisburgLocalCollectorTriggers()` to install the hourly collector, hourly social worker, five-minute social-intake processor, lifecycle trigger and maintenance trigger.
4. Verify `Collector State`, `Collector Log`, `Social Worker Queue`, `Social Post Intake` and `Verification Queue` before treating a source path as production-ready.

## Social worker / Meta
`SocialWorker.gs` is the consumer for `Social Worker Queue`. It uses supported Meta Graph API routes only and captures content-level post permalinks, timestamps, text/captions and source media when Meta returns them.

Production reads of non-owned Facebook Pages require the appropriate Meta public-content feature/permission and App Review. Use a dedicated Louisburg Local technical Meta app. **Never authenticate through Brew & Brews or use Brew & Brews credentials, cookies, Page roles, tokens or Meta assets.**

Secrets belong only in Apps Script Script Properties. See `META-SOCIAL-WORKER.md` for the exact properties and production test order.

Until Meta production access is approved, public/indexed discovery may supplement coverage, but it must never use logged-in scraping, cookies, anti-bot bypassing or substitute homepage/stock imagery for actual post media.

## Sherlock
Sherlock Notes are factual correction/confirmation reports, not comments. A Sherlock report can request an immediate source recheck. A single anonymous report does not automatically cancel or alter an event. See `Guardrails.md` for moderation, trust, privacy, reaction and release rules.

## Safety / source rules
The collector does not circumvent logins, privacy controls, robots/access restrictions, or other barriers. `SURFACE`, `LINK-ONLY`, and `BLOCKED` sources are not treated as ordinary direct-fetch endpoints. Social content must preserve the content-level original source and remain behind verification.

## Release tests
Before treating a new source adapter as production-ready, test at minimum:
- cancellation after posting
- wrong date/time
- rain/weather delay
- moved event
- sold-out or ended special
- multi-day event
- deleted original source post
- duplicate information from multiple sources
- private facility reservation filtering
- strict Louisburg-only applicability
- social post permalink/text/media preservation
- Meta token/permission failure behavior

## Structured adapters
Prefer structured adapters for known calendars/RSS/JSON/social APIs so exact titles, event dates, times and destination URLs are preserved instead of relying primarily on generic page-change detection.
