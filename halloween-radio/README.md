# Brew & Brews Halloween Radio

Dedicated home for the Brew & Brews haunted Halloween broadcast project.

Brew & Brews is a **coffee roastery / roasting operation**, not a café.

## Current radio

- `index.html` — haunted 3D radio interface
- `assets/css/` — physical cabinet, components, lighting, and responsive layout
- `assets/js/radio.js` — tuner, playback intent, auto tune, ghost, discoveries, meter, knobs, tube crackle
- `audio/` — Halloween songs, instrumentals, broadcast pieces, and effects
- `data/tracks.json` — master track-library manifest
- `artwork/` — radio artwork and future Halloween track graphics

## Audio library

Current planned library size: **34 songs/music pieces**.

Use lowercase kebab-case filenames and keep the track number at the front when the final broadcast order is known:

`01-track-name.mp3`

`02-track-name.mp3`

The radio must remain silent on page load. Only an explicit press of PLAY may create playback intent. Tuning, presets, previous/next, haunted auto tune, ghost activity, discoveries, the mug, and the vacuum tube must never start audio by themselves.

## Current default track

The current radio interface expects:

`audio/ironclad.mp3`

The rest of the 34-track library will be added to `audio/` and registered in `data/tracks.json` as the broadcast lineup is finalized.
