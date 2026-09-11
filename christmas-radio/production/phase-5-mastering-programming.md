# Brew & Brews Christmas Radio — Phase 5 Mastering + Programming

Branch: `christmas-radio-phase-5-mastering-programming`

- 13 audited masters
- Loudness target: approximately -14 LUFS integrated
- MP3: stereo, 192 kbps, 44.1 kHz
- Curated six-station rotations stored in `data/phase5-library.json`
- `tools/activate-phase5-library.py` verifies all 13 MP3 hashes before generating the runtime `data/tracks.json`
- No audio starts until the listener explicitly presses Play
- Halloween Radio and `louisburg-local/` are untouched
