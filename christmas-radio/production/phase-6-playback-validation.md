# Brew & Brews Christmas Radio — Phase 6 Playback Validation

Branch: `christmas-radio-phase-6-playback-validation`

## Result

**PLAYBACK GATE PASSED** at the 430 × 932 phone viewport.

Validated against the activated Phase 5 library:

- 13 audited/mastered MP3 binaries
- 35 curated station placements
- all 6 stations
- exact MP3 file sizes and SHA-256 hashes
- explicit Play requirement
- no MP3 request before playback intent
- all six station selections while paused
- first Play on 103.1 flagship
- real media-end auto-advance using an accelerated final audio tail
- live station switching while ON AIR
- pause + retune without starting/fetching the newly selected track
- complete 88.7 Snowfall AM loop wrap
- volume persistence across reload without restoring playback intent
- phone control geometry and bottom navigation
- six cards in the Stations panel

## Production bug fixed

A first-time visitor with no `bbxmas:volume` local-storage value was incorrectly initialized at volume 0 because `Number(null)` evaluates to zero.

`ChristmasRadioEngine.savedVolume()` now distinguishes a missing/blank setting from an intentionally saved zero value. New visitors correctly start at 80% while an intentionally muted/saved volume still restores normally.

## Passed evidence

GitHub Actions run: `34630168056`

Passing tested commit: `a5653d51a4b78ca868db8cd815691ab5281b25dc`

Observed gate metrics:

- local DOM ready: 485 ms
- viewport: 430 × 932
- page scroll width: 430 px
- Play target: ~69 × 69 px
- tuner target: ~266 × 41 px
- bottom navigation: fully inside the viewport
- critical HTTP errors: none
- only HTTP 404s: browser requests for `/favicon.ico`

The run produced `report.json` and `christmas-radio-430x932.png` as validation evidence.

## Visual follow-up

Playback/interaction is approved for Phase 6. The evidence screenshot is intentionally retained for a separate visual pass: the roastery artwork reads extremely dark in the headless 430 × 932 capture even though the controls and layout pass. Do not treat that visual observation as a playback regression; verify and polish the scene on a real phone before release.

## Guardrails retained

- Phase 5 remains the frozen pre-validation checkpoint.
- Halloween Radio playback was not modified.
- `louisburg-local/` was not modified.
- No autoplay was introduced.
- Curated station ordering remains unchanged.
