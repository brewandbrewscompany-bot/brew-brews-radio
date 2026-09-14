# Regular Brew & Brews Radio — Visual Lock

Status: **APPROVED / LOCKED**

Approved by the owner on September 14, 2026. This file is the visual source-of-truth guardrail for the regular Brew & Brews Radio. Do not drift back toward the old Spotify-style library/dashboard, flat web cards, or seasonal radio styling.

## Scope

This lock applies only to the **regular Brew & Brews Radio** experience. It does not authorize changes to Halloween Radio, Christmas Radio, Witch Ride, or Louisburg Local.

The page is strictly a **radio/music listening experience** for Brew And Brews Co LLC, Louisburg, Kansas. It is not a storefront, general home page, coffee product catalog, or café interface.

## Approved physical design language

- Rich dark walnut cabinet with believable grain, lacquer depth, rounded physical enclosure and warm edge reflections.
- Blackened / brushed gunmetal faceplate with subtle machining rather than flat black panels.
- Brass and bronze frames, bevels, trim and hardware with realistic depth and contact shadows.
- Deep recessed smoked green-black tuner glass with subtle reflections and internal warm illumination.
- Exactly **one** thin movable amber tuner needle. Never bake a needle into artwork.
- Desktop uses left and right physical speaker sections with perforated metal grilles and drivers visibly recessed behind the mesh.
- Mobile is a purpose-built vertical physical radio, not a scaled-down desktop dashboard.
- Premium machined circular PREV / PLAY / NEXT hardware controls. PLAY is largest and receives the strongest restrained amber illumination.
- Premium machined / knurled VOLUME and TUNING knobs with visible markers and rotation.
- Recessed NOW BREWING display integrated into the radio face with current cover art, song title, station/frequency and progress.
- Four physical station presets: 91.7 Morning, 101.7 Roastery, 103.1 Regular, 106.5 After Hours.
- Branding remains restrained and physical: LOUISBURG · KANSAS / BREW & BREWS / ROASTERY RADIO.
- Palette: dark espresso walnut, blackened metal, aged brass/bronze, amber light, smoked green-black glass.

## Never regress to

- Spotify-like library or browse page as the main experience.
- Search-first song catalog UI.
- Generic dashboard cards.
- Flat gradients pretending to be physical material.
- Giant neon glows or orange rectangles.
- Fake screenshot hotspots or a flat image replacing interactive controls.
- Product/shop/roastery-story sections on the radio page.
- Halloween or Christmas art, names, stations or behaviors.
- Multiple tuner needles.

## Locked interaction behavior

- **Only an explicit PLAY action creates playback intent.**
- Tuning, presets, volume, PREV, NEXT, menus or selection changes never start audio by themselves.
- PREV / NEXT while paused remain paused.
- A natural track end may continue to the next track only when playback intent already exists.
- Current cover art may be visible while paused; visible artwork does not grant playback intent.
- Volume and tuning controls must work as real controls on touch/mouse and remain keyboard accessible.
- Audio remains `preload="none"`; the library streams instead of being preloaded into the initial app shell.

## Responsive / performance lock

Primary mobile release gate: **430 × 932**.

- No horizontal scroll.
- Touch targets must remain usable.
- The physical radio should substantially fill the mobile viewport.
- Desktop must retain the wide hi-fi cabinet composition.
- No heavy visual library should be introduced solely for material effects.
- Keep procedural/CSS material treatment lightweight and cacheable.
- Do not preload the full audio library.

## Current implementation layers

- `index.html` — physical radio structure.
- `style.css` — legacy/base layer retained for compatibility.
- `radio-experience.css` — approved physical radio structure/responsive shell.
- `materials-polish.css` — locked premium walnut/metal/brass/glass material layer.
- `player.js` — playback intent, stations, tuner, artwork and rotary interaction behavior.
- `playlist.js` — regular 18-track library metadata.
- `service-worker.js` — PWA shell caching; audio streams rather than being cached as the initial shell.
- `.github/workflows/regular-radio-final-release.yml` — regression/audio/mobile/desktop release gate.

## Release proof expectation

Before accepting a future visual or functional pass, the release workflow must remain green and produce both:

- `mobile-430x932.png`
- `desktop-1280x900.png`

The proof must validate all 18 intended MP3 files by full decode and must preserve explicit-PLAY-only behavior.

If a later implementation conflicts with this document, preserve the approved visual/interaction direction unless the owner explicitly approves a new direction.