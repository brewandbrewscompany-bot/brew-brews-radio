# Brew & Brews Halloween Radio

Dedicated home for the Brew & Brews haunted Halloween broadcast project.

Brew & Brews is a **coffee roastery / roasting operation**, not a café.

## Current radio

- `index.html` — haunted 3D radio interface
- `assets/css/` — physical cabinet, components, lighting, responsive layout, and live broadcast readout
- `assets/js/radio.js` — tuner, playback intent, station playlists, station sound profiles, tuning transitions, broadcast bumpers, auto tune, ghost, discoveries, meter, knobs, and tube crackle
- `audio/` — Halloween songs, instrumentals, broadcast pieces, and effects
- `data/tracks.json` — master uploaded track-library manifest and station order
- `data/broadcasts.json` — station bumpers plus future real announcer/audio insert slots
- `data/remaining-8.json` — production plan for the final eight tracks needed to reach 34
- `artwork/` — radio artwork and future Halloween track graphics

## Audio library

Current target library size: **34 songs/music pieces**.

Current uploaded and wired library: **26 tracks**.

Remaining planned: **8 tracks**.

Use lowercase kebab-case filenames:

`the-skeleton-shuffle.mp3`

`brew-and-brews-after-dark.mp3`

If two genuinely different audio files share the same display title, keep both and use a clean version suffix such as:

`the-witching-hour-v2.mp3`

Playlist order belongs in `data/tracks.json`; filenames do not need numeric prefixes.

## Broadcast behavior

The radio must remain silent on page load. Only an explicit press of PLAY may create playback intent. Tuning, presets, previous/next, haunted auto tune, ghost activity, discoveries, the mug, and the vacuum tube must never start station audio by themselves.

When PLAY is already active, changing frequencies may play a short tuning/static transition before the selected station resumes.

Each station has its own browser-side audio character:

- 88.3 Graveyard AM — aged narrow AM tube sound
- 91.7 Dead Air — distant/fading signal with more noise
- 95.9 The Grind — dirtier roastery/industrial tone
- 99.5 After Dark — warm old-tube sound
- 103.1 B&B Radio — clearest main signal
- 106.7 Witching Hour — unstable late-night signal

Between songs, the radio can play short signal bumpers. `data/broadcasts.json` also contains planned announcer, roastery, werewolf-host, weather, and signoff insert slots. Those real spoken inserts stay disabled until their MP3 files are actually uploaded; the site does not substitute a modern computer voice.

## Current default track

The default track remains:

`audio/ironclad.mp3`

on **103.1 B&B Radio**.
