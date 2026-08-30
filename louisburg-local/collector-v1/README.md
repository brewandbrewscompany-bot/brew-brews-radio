# Louisburg Local — Collector V1.1

Collector V1.1 is the conservative automation layer for Louisburg Local.

## What it does
- Reads active rows from `Source Endpoints`.
- Processes only `DIRECT` endpoints in V1.1.
- Checks HIGH sources every 6 hours, MEDIUM daily, LOW weekly.
- Processes at most 20 due DIRECT endpoints per run and persists a cursor between runs.
- Uses a script lock so overlapping hourly executions cannot process the same batch simultaneously.
- Retries temporary 429/5xx/network failures with exponential backoff.
- Normalizes public webpage text and stores a SHA-256 fingerprint in `Collector State`.
- Ignores unchanged pages.
- Changed sources with timely Louisburg signals create review candidates in `Verification Queue`.
- Prevents duplicate open collector candidates for the same organization/source.
- Never automatically publishes a candidate to `Hub Feed`.
- Logs each run to `Collector Log`.
- Processes pending Sherlock source rechecks before the normal collector batch.
- Runs daily privacy/retention maintenance for pseudonymous Sherlock/reaction keys.

## Required Google Sheet tabs
- Source Endpoints
- Collector State
- Collector Log
- Verification Queue
- Hub Feed
- Sherlock Notes
- Reactions
- Category Rules

The spreadsheet timezone should be `America/Chicago`.

## Install
Create/use the Google Apps Script project associated with the Louisburg Local master sheet and copy:
- `Config.gs`
- `Collector.gs`
- `Setup.gs`

Authorize Spreadsheet, URL Fetch, Properties, Lock and Trigger access as requested by your own Apps Script project.

Then run:
1. `seedLouisburgLocalCollector()` — establishes initial fingerprints. Baseline content is not treated as new merely because state was empty.
2. Inspect `Collector State` and `Collector Log`.
3. `installLouisburgLocalCollectorTriggers()` — installs the hourly collector plus daily maintenance trigger.
4. Keep the public feed in staging for at least one full day before launch.

## Sherlock
Sherlock Notes are factual correction/confirmation reports, not comments. A Sherlock report can request an immediate source recheck. A single anonymous report does not automatically cancel or alter an event. See `Guardrails.md` for moderation, trust, privacy, reaction and release rules.

## Safety / source rules
Collector V1.1 does not scrape Facebook/Instagram and does not circumvent logins, privacy controls, robots/access restrictions, or other barriers. `SURFACE`, `LINK-ONLY`, and `BLOCKED` endpoints are skipped.

## Release tests
Before public launch test at minimum:
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

## Next version
Structured adapters for known calendars/RSS/JSON endpoints can extract exact titles, event dates, times and destination URLs instead of relying primarily on generic page-change detection.
