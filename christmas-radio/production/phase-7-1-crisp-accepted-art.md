# Christmas Radio Phase 7.1 — Crisp Accepted Artwork Restore

Status: GREEN / LOCKED VISUAL SOURCE

Branch: `christmas-radio-phase-7-1-crisp-accepted-art`

## Locked source of truth

The exact accepted 103.1 Christmas Radio artwork is restored from the original approved Git history:

- Original approved branch: `christmas-radio-1031-approved`
- Original approved commit: `f41843d2becccb165b7ef6a9b28dfa15af57598e`
- Historical source: `christmas-radio/artwork/flagship-roastery-stage.png`
- Production source in this phase: `christmas-radio/artwork/flagship-roastery-stage-approved.png`
- Dimensions: 709 × 1536
- Format: lossless PNG

The historical source was verified pixel-for-pixel against the accepted image re-supplied by the owner on September 11, 2026. Do not substitute the 430 × 854 Phase 7 preview/JPEG as production artwork.

## Production behavior

- The CSS foreground and blurred background layers use `flagship-roastery-stage-approved.png`.
- The page preload uses the same accepted PNG.
- Existing functional HTML controls remain over the artwork.
- Playback engine behavior is unchanged.
- Explicit listener playback intent remains required; no autoplay.
- Halloween Radio playback behavior is untouched.
- `louisburg-local/` is untouched.

## High-DPI validation

The reusable visual gate in `.github/workflows/christmas-radio-phase-7-visual-probe.yml` now validates Phase 7.1 at:

- CSS viewport: 430 × 932
- Device pixel ratio: 3
- Physical screenshot: 1290 × 2796

The gate requires:

- branch artwork is byte-for-byte identical to the original approved Git source
- natural artwork dimensions remain 709 × 1536
- production CSS uses the accepted PNG for both scene layers
- flagship station remains 103.1 / `bb-christmas-radio`
- no horizontal overflow
- Play target remains touch-safe
- bottom navigation remains fully on-screen
- no critical HTTP errors or page errors

The generated DPR-3 render was also compared against the accepted owner-supplied image in the radio content area to guard against composition drift.

## Guardrail

This accepted artwork is now the visual source of truth. Do not regenerate, reinterpret, sharpen from a lower-resolution copy, or replace it with the Phase 7 430-pixel preview. Future visual work must preserve this exact accepted composition unless the owner explicitly approves a new source of truth.
