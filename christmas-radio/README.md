# Brew & Brews Christmas Radio

**Application:** Brew & Brews Christmas Radio  
**Public entry:** `/christmas-radio/`  
**Entry file:** `/christmas-radio/index.html`

This folder is the Christmas seasonal radio experience for Brew And Brews Co LLC, a coffee roastery / roasting operation in Louisburg, Kansas. It is intentionally isolated from `halloween-radio/` and `louisburg-local/`.

## Index naming rule

Keep the entry file named `index.html` so the public URL stays clean. The **folder path is the application namespace**. Christmas-specific CSS, JavaScript, manifests, DOM ids, comments, and documentation use explicit Christmas Radio names, so there is no ambiguous root-level `index` identity.

## Experience direction

Warm vintage Christmas radio inside a roastery on a snowy night: rich wood, brass, amber glow, restrained Christmas magic, and subtle snowfall. It should feel like the warm seasonal counterpart to Halloween Radio, not a red-and-green reskin.

The flagship is **103.1 B&B Christmas Radio**. A listener should be able to open the page, press Play once, and enjoy the complete experience without touching another control.

## Six-station system

| Frequency | Station | Role |
| --- | --- | --- |
| 88.7 | Snowfall AM | Golden-era / vintage Christmas |
| 92.5 | Fireside | Acoustic, piano, strings, folk, quiet instrumentals |
| 96.9 | Sleigh Bell Rock | Rockabilly, roots rock, guitar-driven Christmas |
| 100.3 | Candlelight | Emotional and reflective Christmas |
| 103.1 | B&B Christmas Radio | Flagship complete Christmas mix |
| 106.7 | North Pole After Hours | Playful late-night wildcard |

`Snowfall AM` is a nostalgic character name even though 88.7 is in the FM band; it can be renamed later if literal band accuracy becomes more important.

## Performance contract

- Plain HTML/CSS/JavaScript; no framework dependency.
- CSS creates the foundation scene, so heavy artwork is not required for first render.
- The audio element is `preload="none"`.
- No audio starts on page load.
- Only an explicit Play press creates playback intent.
- Tuning never creates playback intent.
- When audio arrives, load the current track only as needed and prepare the next while the current one plays.
- Optimize shipped art to WebP/AVIF where practical; do not put multi-megabyte PNG source art on the first-load path.
- Stations / Now Playing / About should remain panels in this same app so browsing never interrupts playback.

## Foundation files

- `index.html` — Christmas Radio app shell only.
- `assets/css/christmas-radio.css` — visual system and responsive layout.
- `assets/js/christmas-radio.js` — tuner, explicit playback intent, station rendering and audio shell.
- `data/stations.json` — canonical six-station definitions.
- `data/tracks.json` — empty until Christmas tracks are audited and assigned.
- `data/broadcasts.json` — empty until station IDs and announcer pieces are approved.

## Audio / broadcast guardrails

Family-friendly. Brew & Brews is a roastery, not a café. Announcer moments stay sparse. Avoid repetitive “ladies and gentlemen” lines and unnecessary fake crowd noise. Do not substitute modern TTS for intended character/vintage announcer recordings. Candlelight may carry an indirect, reflective Christian Christmas tone without becoming preachy.

## Next milestone

Validate the opening radio at a real phone viewport, create and audit the first Christmas tracks, populate `tracks.json`, then wire real track selection / next-track preparation without weakening the explicit-playback-intent rule.
