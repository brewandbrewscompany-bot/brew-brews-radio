# Louisburg Local — Collector V1

Collector V1 is the conservative first automation layer for Louisburg Local.

## What it does
- Reads active rows from the Google Sheet `Source Endpoints` tab.
- Processes only `DIRECT` endpoints in V1.
- Checks HIGH sources every 6 hours, MEDIUM daily, LOW weekly.
- Normalizes public webpage text and stores a SHA-256 fingerprint in `Collector State`.
- Ignores unchanged pages.
- When a previously fingerprinted source changes, checks for timely signals such as specials, sales, events, live music, registration, closures, hiring, fundraisers and launches.
- Requires Louisburg relevance.
- Sends changed-source candidates to `Verification Queue`.
- Never automatically publishes a candidate to `Hub Feed`.
- Logs each run to `Collector Log`.

## Google Sheet
Master spreadsheet ID is configured in `Config.gs`.

Required tabs:
- Source Endpoints
- Collector State
- Collector Log
- Verification Queue
- Hub Feed

## Install
Create or use a Google Apps Script project, copy `Config.gs`, `Collector.gs`, and `Setup.gs` into it, authorize URL Fetch + Spreadsheet access, then run:

1. `seedLouisburgLocalCollector()` — establishes the first fingerprints.
2. `installLouisburgLocalCollectorTriggers()` — creates an hourly scheduler. Each source still obeys its own priority interval.

## Safety / source rules
Collector V1 does not scrape Facebook/Instagram and does not circumvent logins, privacy controls, robots/access restrictions, or other barriers. `SURFACE`, `LINK-ONLY`, and `BLOCKED` endpoints are skipped.

## Next version
V1.1 should add structured extraction for known official calendars/RSS/JSON endpoints so exact title, event date, time and destination can be created as structured candidates rather than generic changed-source reviews.
