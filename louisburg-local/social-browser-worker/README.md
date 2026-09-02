# Louisburg Local public social browser worker

This worker adds browser-rendered public Facebook discovery to the existing Louisburg Local pipeline. It does not authenticate to Facebook, hold Facebook cookies, use Meta APIs, or publish directly to Hub Feed.

Flow:

1. Request verified Facebook workers from the existing Apps Script endpoint.
2. Open each verified Page in a fresh logged-out Chromium context.
3. Read only post permalinks visibly exposed by the public Page.
4. Open exposed public permalinks to capture public text, age/date, identity, and content-level media.
5. POST each captured activity to the existing `social_intake` action.
6. Record readable, login-only, age-gated, or error status in `Social Worker Queue`.

Required environment:

- `LL_SOCIAL_INGEST_KEY`: the existing Apps Script social intake key.
- `LL_SOCIAL_ENDPOINT`: optional; defaults to the deployed Louisburg Local endpoint.
- `LL_MAX_WORKERS`: optional; defaults to 25.
- `LL_MAX_POSTS_PER_PAGE`: optional; defaults to 2.
- `LL_FORCE_SCAN`: optional manual-test override. Normal scheduled runs respect each queue row's hourly/daily cadence.

The verification gate remains mandatory. A browser capture is discovery evidence, not automatic publication approval.

<!-- manual full-pipeline scan trigger: 2026-09-01 Q NAILS source validation -->
