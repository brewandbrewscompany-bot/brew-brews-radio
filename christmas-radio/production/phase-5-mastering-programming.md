# Brew & Brews Christmas Radio — Phase 5 Mastering + Programming

Branch: `christmas-radio-phase-5-mastering-programming`  
Source: `christmas-radio-phase-4-music-library`

## Checkpoint

- 13 real audio masters passed the working-session audio audit and were mastered locally.
- Every master was loudness-matched to approximately **−14 LUFS integrated** and encoded as stereo MP3 at 192 kbps / 44.1 kHz. The binary package is preserved separately for import.
- The verified post-encode true-peak range is **-2.68 to -1.29 dBTP**.
- Total unique music runtime: **39.6 minutes**.
- The first flagship cycle is **39.6 minutes** with all 13 masters once each.
- The failed orchestral-vocal attempt `There Was Room in the Silence` is excluded; no placeholder or rejected audio is in the manifest.
- Broadcast IDs and Christmas Eve/morning specials remain separate future assets and do not block music playback.

## Approved unique masters

| ID | Title | Type | Duration | LUFS | True peak |
| --- | --- | --- | ---: | ---: | ---: |
| M02 | Lights in the Roastery | vocal | 4:04.8 | -14.25 | -1.68 dBTP |
| M03 | Christmas on the County Line | vocal | 3:04.8 | -14.23 | -1.52 dBTP |
| M05 | Midnight Roast | vocal | 2:59.6 | -14.24 | -1.45 dBTP |
| M09 | All Through Louisburg | vocal | 3:01.3 | -14.21 | -1.46 dBTP |
| M10 | Turn the Tree Lights Up | vocal | 2:59.6 | -14.25 | -2.68 dBTP |
| M18 | Christmas ’49 | vocal | 2:59.4 | -14.27 | -1.50 dBTP |
| M19 | Evergreen on the Mantel | vocal | 3:38.4 | -14.27 | -1.41 dBTP |
| M22 | Eight Reindeer, One Wrong Turn | vocal | 2:44.9 | -14.19 | -1.29 dBTP |
| X03 | Christmas at Our House | vocal | 2:50.0 | -14.23 | -1.56 dBTP |
| X04 | Christmas Morning on Amity | vocal | 3:01.4 | -14.25 | -1.76 dBTP |
| I01 | Snowfall Waltz | instrumental | 2:43.2 | -14.27 | -1.62 dBTP |
| I04 | Winter Highway Lights | instrumental | 2:59.8 | -14.26 | -2.43 dBTP |
| I05 | Sleigh Bell Breakdown | instrumental | 2:28.7 | -14.22 | -1.43 dBTP |

## Curated launch rotations

### snowfall-am
M18 Christmas ’49 → X03 Christmas at Our House → M09 All Through Louisburg → I01 Snowfall Waltz

### fireside
M02 Lights in the Roastery → M19 Evergreen on the Mantel → I04 Winter Highway Lights → X03 Christmas at Our House → X04 Christmas Morning on Amity

### sleigh-bell-rock
M03 Christmas on the County Line → M10 Turn the Tree Lights Up → I05 Sleigh Bell Breakdown

### candlelight
I04 Winter Highway Lights → M19 Evergreen on the Mantel → X03 Christmas at Our House → I01 Snowfall Waltz → M18 Christmas ’49 → M02 Lights in the Roastery

### bb-christmas-radio
X04 Christmas Morning on Amity → M02 Lights in the Roastery → M10 Turn the Tree Lights Up → I01 Snowfall Waltz → M09 All Through Louisburg → M03 Christmas on the County Line → M19 Evergreen on the Mantel → I05 Sleigh Bell Breakdown → X03 Christmas at Our House → M05 Midnight Roast → I04 Winter Highway Lights → M22 Eight Reindeer, One Wrong Turn → M18 Christmas ’49

### north-pole-after-hours
M05 Midnight Roast → M22 Eight Reindeer, One Wrong Turn → M09 All Through Louisburg → M18 Christmas ’49

## Repository activation status

- The curated rotations are stored as `data/phase5-library.json`.
- Runtime `data/tracks.json` remains unchanged because the MP3 binaries are not yet physically present in GitHub.
- `audio/README.md` is the checksum contract for the 13-file import.
- `tools/activate-phase5-library.py` verifies all hashes and generates `data/tracks.json`; activating missing paths is forbidden.

## Runtime guardrails retained

- `preload="none"` remains in force.
- No audio starts without an explicit listener Play action.
- Tuning stations does not create playback intent.
- The next track is prepared only after playback has started.
- Curated station order is not shuffled.
- `louisburg-local/` and Halloween Radio behavior are untouched.

## Next validation gate

1. Import the 13 mastered MP3 files into `christmas-radio/audio/`.
2. Run the activation script; it generates the runtime manifest only after all hashes pass.
3. Press Play once on 103.1 and verify the full 13-track wrap.
4. Tune every station during playback and verify track/title changes and fast start.
5. Check mobile network first-play latency and next-track preparation.
6. Add approved station IDs only after their actual audio files exist and pass audit.
