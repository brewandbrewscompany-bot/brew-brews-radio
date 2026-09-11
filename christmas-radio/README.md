# Brew & Brews Christmas Radio

**Application:** Brew & Brews Christmas Radio  
**Public entry:** `/christmas-radio/`  
**Entry file:** `/christmas-radio/index.html`

This folder is the Christmas seasonal radio experience for Brew And Brews Co LLC, a coffee roastery / roasting operation in Louisburg, Kansas. It is intentionally isolated from `halloween-radio/` and `louisburg-local/`.

## Phase 5 status

Phase 5 has completed the audio mastering and programming work for **13 approved music masters**. The mastered package is loudness-matched, checksummed, and paired with curated rotations for all six stations.

This branch is a **binary-ready staging checkpoint**, not yet the live playable checkpoint:

- `data/mastering.json` records the verified master properties and checksums.
- `data/phase5-library.json` contains the curated six-station rotations.
- `audio/README.md` lists the exact MP3 files and SHA-256 values required.
- Runtime `data/tracks.json` remains unchanged until the MP3 binaries physically exist in `audio/`.

This prevents the radio from publishing broken paths or trying to play files that are not present.

## Six-station system

| Frequency | Station | Role |
| --- | --- | --- |
| 88.7 | Snowfall AM | Golden-era / vintage Christmas |
| 92.5 | Fireside | Acoustic, piano, strings, folk, quiet instrumentals |
| 96.9 | Sleigh Bell Rock | Rockabilly, roots rock, guitar-driven Christmas |
| 100.3 | Candlelight | Emotional and reflective Christmas |
| 103.1 | B&B Christmas Radio | Flagship complete Christmas mix |
| 106.7 | North Pole After Hours | Playful late-night wildcard |

## Performance contract

- Plain HTML/CSS/JavaScript; no framework dependency.
- The audio element remains `preload="none"`.
- No audio starts on page load.
- Only an explicit Play press creates playback intent.
- Tuning never creates playback intent.
- The next track is prepared only after playback begins.
- Curated station orders are intentional and are not shuffled.
- `louisburg-local/` and Halloween Radio playback behavior remain untouched.

## Activation gate

1. Import all 13 MP3s into `christmas-radio/audio/`.
2. Run `python christmas-radio/tools/activate-phase5-library.py` from the repository root.
3. The activation script verifies every SHA-256 hash and writes `data/tracks.json` only when all checks pass.
4. Run the real-phone playback gate: first play, station tuning, next-track preparation, media-session metadata, full flagship wrap, and missing-file recovery.
