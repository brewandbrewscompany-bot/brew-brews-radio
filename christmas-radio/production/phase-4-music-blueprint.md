# Brew & Brews Christmas Radio — Phase 4 Music Library + Broadcast Blueprint

Branch: `christmas-radio-phase-4-music-library`  
Source checkpoint: `christmas-radio-phase-3-audio` @ `1aafc879b23c84e96edbd2cd32a86e48931c5799`  
Locked visual source of truth: `christmas-radio-1031-approved` @ `f41843d2becccb165b7ef6a9b28dfa15af57598e`

This file is the production source of truth for Phase 4 music creation. It does **not** authorize changing Christmas Radio artwork, 103.1 control geometry, Halloween Radio playback behavior, or anything under `louisburg-local/`.

`christmas-radio/data/tracks.json` stays empty until real audio exists and each file has passed the Christmas Radio Audio Audit. No fake paths, placeholder songs, or nonexistent audio are allowed in the runtime manifest.

---

## 1. Core library recommendation

Build **42 unique mastered audio pieces** for the launch library:

- **24 vocal original songs**
- **8 instrumentals**
- **8 station IDs / bumpers**
- **2 scheduled special broadcast moments**

Why 42: it is large enough for the flagship to run for roughly 70–85 minutes before musical repetition while still giving every specialty station a coherent identity. It also keeps the first launch library producible and auditable instead of inflating the catalog with filler.

The 42 number refers to **unique masters**. A station ID or song master may be referenced more than once in a future curated playlist without creating another master file.

---

## 2. Station allocation and music ratios

Ratios below count music only; station IDs and scheduled specials are excluded.

| Station | Planned music masters | Vocal / instrumental | Core broadcast cadence | Programming intent |
| --- | ---: | ---: | --- | --- |
| 88.7 Snowfall AM | 8 | 6 / 2 = 75% / 25% | One short ID about every 25–30 min | Vintage continuity; no modern genre jumps |
| 92.5 Fireside | 10 | 7 / 3 = 70% / 30% | One quiet ID about every 30–35 min | Long uninterrupted warm stretches |
| 96.9 Sleigh Bell Rock | 8 | 6 / 2 = 75% / 25% | One punchy ID about every 18–22 min | Fast, guitar-forward, no fake crowd energy |
| 100.3 Candlelight | 10 | 7 / 3 = 70% / 30% | One clean ID about every 30–35 min | Emotional depth with breathing room |
| 103.1 B&B Christmas Radio | 24 | 18 / 6 = 75% / 25% | Alternate two IDs after roughly every 6 music tracks | Flagship complete mix; 70–85 min musical cycle |
| 106.7 North Pole After Hours | 8 | 6 / 2 = 75% / 25% | One of two IDs about every 15–20 min | Personality allowed, but never constant chatter |

Specialty stations intentionally reuse approved masters where the **same audio** genuinely fits both identities. They do not get alternate genre remixes just to pad counts.

---

## 3. Complete music catalog — 32 music masters

### Vocal originals

| ID | Title | Station eligibility | Role | Suno seed direction |
| --- | --- | --- | --- | --- |
| M01 | First Snow on Amity | 88.7, 103.1 | Local vintage anchor; soft first-snow nostalgia | 1940s/50s-inspired crooner, upright bass, brushes, piano, muted brass/strings, warm close baritone, elegant not parody |
| M02 | Lights in the Roastery | 92.5, 103.1 | Warm roastery identity without becoming an ad | Airy acoustic folk, dry close male baritone-to-mid vocal, fingerpicked guitar, felt piano, cello, brushes, organic and light |
| M03 | Christmas on the County Line | 96.9, 103.1 | Upbeat winter-drive roots-rock lift | Guitar-driven roots rock, warm character vocal, live drums, bass, acoustic rhythm, subtle bells, no arena crowd |
| M04 | Leave a Light in the Window | 88.7, 92.5, 100.3, 103.1 | Cross-format emotional standard; homecoming signal | Piano-led timeless ballad with restrained strings, intimate vocal, warm vintage edges, no huge cinematic build |
| M05 | Midnight Roast | 106.7, 103.1 | Playful branded story song; late-night swing | Family-friendly swing story, upright bass, piano, brushes, muted horn/clarinet, dry short North Pole radio cues |
| M06 | Home Before the Snow | 92.5, 100.3, 103.1 | Folk homecoming; warm middle-energy reset | Acoustic folk, guitar/piano/cello, natural vocal harmony, crisp airy production, gentle forward motion |
| M07 | Bells on Broadway | 88.7, 103.1, 106.7 | Small-town Christmas with vintage movement | Close-harmony vintage swing, piano, upright bass, brushes, light brass, lively but polished |
| M08 | The Long Way Home for Christmas | 100.3, 103.1 | Emotional winter-drive song; reflective but hopeful | Piano, acoustic guitar, strings, intimate vocal, steady restrained pulse, no melodramatic build |
| M09 | Under the Same December Sky | 92.5, 100.3, 103.1 | Airy family-distance song without loneliness framing | Light folk duet/harmony, fingerpicked guitar, piano, cello, open soundscape, hopeful and connected |
| M10 | Turn the Tree Lights Up | 96.9, 103.1 | Bright early-rock energy spike | Early rock-and-roll Christmas, electric guitar, upright/electric bass, snare, hand percussion, hooky vocal, no crowd |
| M11 | Quiet Star | 92.5, 100.3, 103.1 | Subtle faith / wonder song; never preachy | Intimate piano/acoustic song, soft strings, close clear vocal, restrained spiritual imagery, no choir wall |
| M12 | Snow Day Saturday | 96.9, 103.1, 106.7 | Family-fun energy; daytime playful track | Upbeat roots-pop/rock, bright guitar, live drums, playful vocal, winter-kid energy without novelty-cartoon sound |
| M13 | Keep the Porch Light Gold | 92.5, 103.1 | Small-town warmth; gentle recovery after high energy | Acoustic Americana folk, dry vocal, guitar, piano, bass, soft brushes, warm and lived-in |
| M14 | Christmas Coming Down the Road | 96.9, 103.1 | Rockabilly motion track; keeps flagship from getting sleepy | Rockabilly/early rock, slap-style bass feel, twang guitar, snare, piano, clean hook, no crowd |
| M15 | The Little Things We Keep | 88.7, 100.3, 103.1 | Deep emotional centerpiece; memory without grief bait | Timeless slow standard, piano, upright bass, brushes, strings, close vocal, classic phrasing and restraint |
| M16 | Hot Coffee, Cold Wind | 96.9, 103.1 | One direct coffee-forward roots song; brisk and fun | Roots rock, gritty-clean guitar, warm dry vocal, drums/bass, subtle bells, coffee reference but not commercial copy |
| M17 | Static in the Snow | 88.7, 103.1 | Vintage-radio texture track; weathered but musical | Crooner/close-harmony song with softly aged broadcast character, upright bass, brushes, piano, restrained static only at edges |
| M18 | Christmas '49 | **88.7 exclusive** | Deep specialty authenticity; old-dial fictional nostalgia | 1940s close harmony vocal group, piano, upright bass, brushes, subtle brass, monophonic-era character without lo-fi mud |
| M19 | Evergreen on the Mantel | **92.5 exclusive** | Fireside identity song; quiet domestic Christmas detail | Acoustic folk trio feel, fingerpicked guitar, felt piano, cello, soft harmony, no percussion or only brushes |
| M20 | Redline Sleigh | **96.9 exclusive** | Fastest guitar cut; specialty peak energy | Fast rockabilly Christmas original, twang lead, bass, tight live drums, piano accents, wild but controlled, no crowd |
| M21 | There Was Room in the Silence | **100.3 exclusive** | Candlelight faith-inflected centerpiece | Piano and strings, intimate vocal, Nativity meaning through image and implication, no sermon, no choir bombast |
| M22 | Eight Reindeer, One Wrong Turn | **106.7 exclusive** | Comic story song; family-friendly narrative | Swing/jump-jazz story song, nimble vocal, upright bass, piano, brushes, muted horn, dry radio aside, no cartoon voices |
| M23 | Mrs. Claus Runs the Night Shift | **106.7 exclusive** | Witty late-shift character song; competent Mrs. Claus | Smart swing/jazz lyric, confident female vocal, piano, upright bass, brushed kit, brass accents, no stereotype gag voice |
| M24 | December After Midnight | 106.7, 103.1 | Late-night smoky reset; unusual but still Christmas | Quiet noir-jazz Christmas, piano, upright bass, brushes, muted trumpet, intimate low vocal, warm not sinister |

### Instrumentals

| ID | Title | Station eligibility | Role | Suno seed direction |
| --- | --- | --- | --- | --- |
| I01 | Snowfall Waltz | **88.7 exclusive** | Vintage instrumental breathing space | Golden-era 3/4 Christmas instrumental, piano, strings, upright bass, brushes, muted brass, no vocals |
| I02 | Holiday Route 69 | 88.7, 96.9, 103.1, 106.7 | Bridge between vintage swing and early rock | 1950s jump-swing / early electric-guitar instrumental, piano, bass, drums, light brass, no vocals |
| I03 | Fireside Embers | 92.5, 100.3, 103.1 | Quiet acoustic reset after vocal runs | Fingerpicked guitar, felt piano, cello, very soft brushes, warm room, no vocals or spoken word |
| I04 | Winter Highway Lights | 92.5, 100.3, 103.1 | Airy cinematic transition; night-driving space | Piano, acoustic guitar, cello/strings, restrained pulse, open winter soundscape, no build to trailer scale |
| I05 | Sleigh Bell Breakdown | 96.9, 103.1 | Short rock instrumental reset | Twang guitar, bass, live drums, piano, restrained sleigh accents, energetic instrumental, no crowd |
| I06 | Candlelight Nocturne | 92.5, 100.3, 103.1 | Emotional decompression; near-silent room feel | Felt piano, cello, soft strings, low warm ambience, very sparse, no choir, no vocals |
| I07 | Roastery Snowglow | **103.1 exclusive** | Flagship signature instrumental; warm roastery after-hours | Acoustic guitar, felt piano, cello, upright bass, brushes, subtle low bell/vibraphone accents, no vocals |
| I08 | North Pole Night Shift | **106.7 exclusive** | Quirky jazz instrumental bed / late-night reset | Playful small-combo jazz, piano, upright bass, brushes, muted trumpet/clarinet, tiny sleigh accent, no spoken word |

---

## 4. Broadcast master plan — 10 non-song pieces

| ID | Station | Type | Target length | Draft identity / use |
| --- | --- | --- | ---: | --- |
| B01 | 88.7 | Station ID | 8–10 sec | “This is 88.7 Snowfall AM — Christmas the way the old dial remembers it.” Warm vintage announcer, lightly weathered signal |
| B02 | 92.5 | Station ID | 5–7 sec | “92.5 Fireside. Quiet Christmas for the warm side of winter.” Almost no bed |
| B03 | 96.9 | Station ID | 5–7 sec | “96.9 Sleigh Bell Rock. Turn Christmas up.” Guitar sting, no crowd |
| B04 | 100.3 | Station ID | 5–7 sec | “100.3 Candlelight. Stay with the quiet part of Christmas.” Dry intimate read |
| B05 | 103.1 | Flagship ID A | 9–11 sec | “From the Brew & Brews roastery in Louisburg, Kansas — 103.1 B&B Christmas Radio. Brew Something Bold.” Warm flagship announcer |
| B06 | 103.1 | Flagship ID B | 6–8 sec | “Snow outside. Roaster lights on. 103.1 — B&B Christmas Radio.” Minimal musical bed |
| B07 | 106.7 | ID A | 10–12 sec | “106.7 North Pole After Hours. The late shift has the frequency.” Dry late-night desk feel |
| B08 | 106.7 | ID B | 8–10 sec | “[paper shuffle] North Pole desk, line two. You’re still on 106.7.” No laugh track, no crowd |
| S01 | 103.1 + 100.3 | Christmas Eve special | 45–60 sec | Scheduled near midnight on Dec. 24; reflective, warm, not preachy |
| S02 | 103.1 | Christmas morning special | 30–45 sec | Once-per-session Christmas morning greeting; family-forward and lightly roastery-branded |

### Draft S01 — Christmas Eve

[Warm announcer, close-mic, no crowd]
If you’re hearing this, Christmas Eve is almost at midnight. Around Louisburg, porch lights are still glowing, the roads are finally getting quiet, and somewhere a kid is trying very hard not to fall asleep. Whatever this year carried, you made it here. For the next few minutes, keep the room soft, hold your people close, and let Christmas arrive without rushing it. From Brew & Brews in Louisburg, this is 103.1 B&B Christmas Radio. Merry Christmas.

### Draft S02 — Christmas morning

[Warm announcer, bright but unhurried]
Good morning, Louisburg. It’s Christmas. The wrapping paper may already be losing the battle, the coffee is probably winning, and the house sounds a little different this morning. Wherever you’re listening from, we hope you get a few minutes that feel worth remembering. From the Brew & Brews roastery, this is 103.1 B&B Christmas Radio. Merry Christmas.

---

## 5. Broadcaster / bumper frequency rules

- **Never** place two spoken/broadcast pieces back-to-back.
- A spoken intro that is part of a song counts as spoken content for spacing.
- **88.7:** B01 roughly once per 8-music-track cycle; do not add DJ chatter between songs.
- **92.5:** B02 once per full 10-track music cycle. Fireside should feel nearly uninterrupted.
- **96.9:** B03 after about 5–6 music tracks. Keep the sting short and let the guitars provide the energy.
- **100.3:** B04 once per full 10-track music cycle. No chatter after an emotional song; allow silence/music to do the work.
- **103.1:** alternate B05 and B06 after roughly every 6 music tracks. A future manifest may reference each master more than once in the loop.
- **106.7:** alternate B07/B08 about every 4–5 music tracks. This is the only station where a little character continuity is encouraged.
- No “ladies and gentlemen” habit, fake audience, applause, laugh track, party crowd, or unexplained room noise.

---

## 6. 103.1 flagship programming strategy

103.1 is not a sampler that constantly changes genre for novelty. It is one Christmas station with six colors inside the same warm production world.

### Core flagship pool

103.1 receives:

- Vocal: M01–M17 plus M24 = **18 vocals**
- Instrumental: I02, I03, I04, I05, I06, I07 = **6 instrumentals**
- IDs: B05 and B06
- Specials: S01/S02 only when their event rules apply

### Pacing rules

1. Do not run more than **3 vocal songs in a row** without an instrumental or very light reset.
2. Do not place two heavy emotional songs adjacent.
3. Do not place two fast guitar songs adjacent unless the first has a soft/clean ending and the second has a restrained intro.
4. Keep direct coffee/roastery lyric tracks at least **4 music tracks apart**. M02, M05 and M16 are the obvious branded cuts.
5. Use vintage tracks as warmth, not costume. A vintage song should normally be followed by acoustic, reflective, or mid-energy material rather than the hardest rock cut.
6. Place an instrumental after a high-energy run, a deep emotional centerpiece, or a spoken piece when the audit shows the transition needs air.
7. Build every transition for the **actual audited outro and intro**, not just title/genre labels.
8. The loop wrap must sound intentional because session position memory means many listeners will not start at track 1.
9. Preserve explicit playback intent. Scheduled specials may only interrupt while the listener is already playing audio; never auto-start audio because a clock condition is true.

### Target 103.1 energy shape

Use repeating 5–7-track waves rather than one giant build:

- warm/mid opener
- brighter movement
- emotional or vintage contrast
- instrumental breath
- acoustic/folk return
- rock or playful lift
- station ID if due

Final exact order is **not approved until the Christmas Radio Audio Audit has inspected every real render**.

---

## 7. Christmas Eve / special-event concepts

Core launch specials are S01 and S02 above. Future optional events should be added only after the core library is stable:

- **First measurable snow in Louisburg:** optional one-time “first snow” ID, but only if a future external-weather trigger can be made reliable without auto-playing audio.
- **December 23 home-stretch:** short evening ID focused on winter drives and people heading home; not required for launch.
- **Christmas Eve roastery close:** 15–20 second sign-off style piece earlier in the evening, then normal music continues.
- **New Year handoff:** only if Christmas Radio remains live after Dec. 25; do not dilute the Christmas library now.

Special events should feel rare enough that hearing one is genuinely special.

---

## 8. Creation order

The creation sequence deliberately proves the flagship sound first, then fills shared specialty inventory, then exclusives, then broadcast pieces.

### Batch 01 — flagship sonic proof
1. M02 Lights in the Roastery
2. M03 Christmas on the County Line
3. M04 Leave a Light in the Window
4. M01 First Snow on Amity
5. M05 Midnight Roast
6. I07 Roastery Snowglow

### Batch 02 — flagship contrast
7. M06 Home Before the Snow
8. M10 Turn the Tree Lights Up
9. M11 Quiet Star
10. M13 Keep the Porch Light Gold
11. M16 Hot Coffee, Cold Wind
12. I05 Sleigh Bell Breakdown

### Batch 03 — vintage / reflective / road
13. M07 Bells on Broadway
14. M08 The Long Way Home for Christmas
15. M09 Under the Same December Sky
16. M14 Christmas Coming Down the Road
17. M15 The Little Things We Keep
18. I02 Holiday Route 69

### Batch 04 — flagship completion + quiet beds
19. M12 Snow Day Saturday
20. M17 Static in the Snow
21. M24 December After Midnight
22. I03 Fireside Embers
23. I04 Winter Highway Lights
24. I06 Candlelight Nocturne

### Batch 05 — specialty exclusives
25. M18 Christmas '49
26. M19 Evergreen on the Mantel
27. M20 Redline Sleigh
28. M21 There Was Room in the Silence
29. M22 Eight Reindeer, One Wrong Turn
30. M23 Mrs. Claus Runs the Night Shift
31. I01 Snowfall Waltz
32. I08 North Pole Night Shift

### Batch 06 — broadcast masters
33. B05 Flagship ID A
34. B06 Flagship ID B
35. B01 Snowfall AM ID
36. B02 Fireside ID
37. B03 Sleigh Bell Rock ID
38. B04 Candlelight ID
39. B07 North Pole ID A
40. B08 North Pole ID B
41. S01 Christmas Eve special
42. S02 Christmas morning special

---

## 9. Christmas Radio Audio Audit — mandatory gate

The Halloween workflow is the model, but Christmas final approval must be more than word-count/VAD classification.

For **every candidate render**:

1. Record exact file name and duration.
2. Sample/listen to the **beginning** (roughly first 30–35 sec).
3. Sample/listen to the **middle** (around 45% of duration, roughly 25–30 sec window).
4. Sample/listen to the **late section** (around 80% of duration, roughly 20–25 sec window).
5. Check the final outro/cut separately when the late sample does not include it clearly.
6. Use transcription/VAD only as a locator. Compare audible lyrics against intended lyrics and note hallucinated lines, ad-libs, announcer speech, choir words, or crowd artifacts.
7. Classify vocal behavior as one of:
   - `vocal-throughout`
   - `vocal-with-instrumental-tail`
   - `spoken-intro-plus-song`
   - `spoken-intro-plus-mostly-instrumental`
   - `instrumental`
   - `mixed-uncertain`
8. Rate energy 1–5 and record intro/outro texture.
9. Record transition tags: `hard-start`, `soft-start`, `cold-end`, `ring-out`, `fade`, `long-instrumental-tail`, `spoken-open`, `spoken-close`.
10. Check station fit against the **real audio**, not the prompt that generated it.
11. Reject or rerender for:
   - unexplained crowd/applause/laugh track
   - repeated “ladies and gentlemen” style announcer filler
   - café framing for Brew & Brews
   - lyric errors that change meaning
   - excessive generic Christmas filler
   - harsh/piercing bells or fatiguing top end
   - muddy vintage filtering that hurts intelligibility
   - overlong intros or endings that damage radio pacing
   - a render whose genre/energy no longer fits its intended stations
12. Only an `approved` audited master may receive its final filename and be added to runtime manifests.

### Audit record fields

Minimum audit record per master:

- `masterId`
- `candidateFile`
- `durationSec`
- `frontNotes`
- `middleNotes`
- `lateNotes`
- `outroNotes`
- `vocalBehavior`
- `announcerSpeech`
- `energy` (1–5)
- `introTag`
- `outroTag`
- `stationFitPrimary`
- `stationFitSecondary`
- `lyricAccuracy`
- `artifactNotes`
- `transitionNotes`
- `decision` = `approve` / `revise` / `reject`
- `approvedFinalFile` only after approval

Final playlist arrangement starts only after the real masters have this audit data.

---

## 10. Naming and metadata standard

### Master IDs

- Music: `bbxmas-m01-first-snow-on-amity`
- Instrumental: `bbxmas-i01-snowfall-waltz`
- Broadcast: `bbxmas-b01-snowfall-am-id`
- Special: `bbxmas-s01-christmas-eve-midnight`

Use lowercase kebab-case, ASCII characters, no spaces, apostrophes, ampersands or parentheses.

### Candidate filenames before approval

`bbxmas-m02-lights-in-the-roastery-candidate-a.mp3`

Do not reuse a candidate filename after replacing the audio; advance candidate letter/version so audit notes remain traceable.

### Approved final audio filenames

`christmas-radio/audio/bbxmas-m02-lights-in-the-roastery.mp3`

Approved filenames have **no candidate/version suffix**. Only the audited final file gets the clean canonical name.

### Display metadata

- `title`: listener-facing song title
- `artist`: `Brew & Brews Christmas Radio` unless a deliberately credited performer identity is approved later
- `album`: `Brew & Brews Christmas Radio — Christmas 2026`
- `kind`: `song`, `instrumental`, `station-id`, or `special`
- `energy`: 1–5
- `vocalProfile`: audit result
- `masterId`: stable master identity shared across station assignments

### Future `tracks.json` assignment structure

Do **not** add this example to the runtime manifest until the referenced audio file exists and passes audit. The current engine accepts one `stationId` per row, so a shared master should use separate assignment rows that point to the same approved `src`.

```json
{
  "id": "bbxmas-m02-lights-in-the-roastery__bb-christmas-radio",
  "masterId": "bbxmas-m02-lights-in-the-roastery",
  "stationId": "bb-christmas-radio",
  "order": 20,
  "title": "Lights in the Roastery",
  "artist": "Brew & Brews Christmas Radio",
  "album": "Brew & Brews Christmas Radio — Christmas 2026",
  "src": "audio/bbxmas-m02-lights-in-the-roastery.mp3",
  "kind": "song",
  "energy": 2,
  "vocalProfile": "vocal-throughout",
  "auditStatus": "approved"
}
```

A Fireside assignment for that same audio would use a different assignment `id`, `stationId: "fireside"`, and station-specific `order`, while keeping the same `masterId` and `src`.

---

# BATCH 01 — FULL SUNO DEVELOPMENT

Batch 01 is designed to test the entire 103.1 sonic world before mass production: acoustic warmth, roots-rock lift, emotional ballad, vintage crooner, playful swing, and a signature instrumental.

## M02 — Lights in the Roastery

**Role:** flagship warm identity / Fireside crossover  
**Target length:** 3:00–3:35  
**Energy:** 2/5

### Lyrics

[Verse 1]
Snow along the loading door
Tire tracks fading down the street
Last batch settling into quiet
Cold glass, warm hands, steady heat

[Pre-Chorus]
Outside, the whole town turns to silver
Inside, the smallest lights hold on

[Chorus]
Leave the lights in the roastery glowing
Let them spill a little warmth across the snow
There are nights when home is just a window
Saying you’ve still got somewhere good to go

[Verse 2]
Paper stars in upstairs windows
Headlights drift along Amity
Boxes stacked for morning orders
Someone’s driving home to family

[Pre-Chorus]
No one needs a perfect evening
Just a place that feels like it belongs

[Chorus]
Leave the lights in the roastery glowing
Let them spill a little warmth across the snow
There are nights when home is just a window
Saying you’ve still got somewhere good to go

[Bridge]
Not every wonder comes with thunder
Not every gift is tied with string
Sometimes Christmas is the quiet
And the warmth that ordinary people bring

[Final Chorus]
Keep the lights in the roastery glowing
While December settles soft and slow
Somewhere down a cold and empty roadway
Someone sees that warmth and knows the way to go

### Suno style prompt

Warm intimate acoustic Christmas folk, 82–86 BPM. Dry close male baritone-to-mid vocal with natural phrasing, fingerpicked acoustic guitar, felt piano, soft cello/strings, upright or warm electric bass, brushed percussion, extremely restrained sleigh texture. Airy, crisp, light soundscape with organic room tone; emotionally warm but not sleepy. No choir, no crowd, no glossy pop synths, no café ambience, no huge build. Keep verses conversational, chorus memorable without shouting, and finish with a gentle resolved ending.

---

## M03 — Christmas on the County Line

**Role:** flagship movement / Sleigh Bell Rock crossover  
**Target length:** 2:50–3:20  
**Energy:** 4/5

### Lyrics

[Verse 1]
Frost on the fence posts, heater turned high
Louisburg shrinking in the rearview light
Two-lane blacktop, fields lying still
December rolling over every hill

[Pre-Chorus]
No need to race what we’re heading toward
The best part waits past the county road

[Chorus]
Christmas on the county line
Cold road, bright night, engine humming
Every mile pulls the house lights closer
You can feel that good thing coming

[Verse 2]
Farmhouse windows burning gold
One hand warm, one steering cold
Radio low and the sky stretched wide
A trunk full of gifts and the family inside

[Pre-Chorus]
We’ve made this drive a hundred times
Tonight it feels like every mile is mine

[Chorus]
Christmas on the county line
Cold road, bright night, engine humming
Every mile pulls the house lights closer
You can feel that good thing coming

[Instrumental Break]
[Short electric-guitar break, no crowd]

[Bridge]
Let the city lights fall behind us
Let the frozen fields roll by
There’s a porch light up ahead now
And that’s all the sign we need tonight

[Final Chorus]
Christmas on the county line
Cold road, bright night, home is coming
Every mile puts the year behind us
And the whole dashboard keeps humming

### Suno style prompt

Energetic Christmas roots rock, 120–126 BPM. Warm dry male vocal with character, electric lead guitar, acoustic rhythm guitar, live bass, tight snare/kick, tambourine and very subtle sleigh bells. Kansas winter highway feel: driving, grounded, melodic, not arena rock. No crowd, no gang shouts, no modern EDM/pop synths. Strong hook, short tasteful guitar break, verses with forward motion, clean punchy ending rather than a long fade.

---

## M04 — Leave a Light in the Window

**Role:** flagship emotional standard / crossover for Snowfall AM, Fireside and Candlelight  
**Target length:** 3:15–3:50  
**Energy:** 2/5

### Lyrics

[Verse 1]
Somebody’s still on the highway
Somebody’s closing the store
Somebody’s counting the miles left
To a wreath on a familiar door

[Pre-Chorus]
The night can stretch farther than we planned
So give the road a sign it understands

[Chorus]
Leave a light in the window
Warm enough to find from the street
Not because the dark is empty
But because love knows where to meet

[Verse 2]
Children asleep under blankets
Kitchen clock past eleven
Two cups waiting on the counter
Snow beginning over the steps

[Pre-Chorus]
No one has to say a word out loud
Some kinds of welcome carry through the dark

[Chorus]
Leave a light in the window
Warm enough to find from the street
Not because the dark is empty
But because love knows where to meet

[Bridge]
Long before we knew the answer
One small light was enough to start
Hope arriving without thunder
Making room inside the heart

[Final Chorus]
Leave a light in the window
Let it hold there steady and sweet
Every road gets a little shorter
When somebody’s waiting where it leads

### Suno style prompt

Intimate piano-led Christmas ballad, 72–78 BPM. Warm clear lead vocal, close-mic and emotionally controlled; piano, cello, soft strings, restrained acoustic guitar, minimal low percussion. Timeless enough to sit beside vintage material but clean enough for the flagship. No giant cinematic build, no choir wall, no crowd, no theatrical belting. Let the bridge lift emotionally through harmony rather than volume; leave space between phrases and end softly but completely.

---

## M01 — First Snow on Amity

**Role:** local vintage anchor / Snowfall AM crossover  
**Target length:** 2:45–3:20  
**Energy:** 2/5

### Lyrics

[Verse 1]
First snow on Amity, soft on the signs
Streetlamps wear halos, traffic takes time
Windows turn amber as daylight goes blue
December slows down like it wanted us to

[Chorus]
First snow on Amity, stay for a while
Quiet the rooftops for mile after mile
No hurry tonight, let the old year move slow
Christmas comes softly with the first snow

[Verse 2]
Porch rails go white, every mailbox wears lace
Neighbors wave longer when winter slows pace
The radio warms with an old-fashioned tune
And headlights go gold under one silver moon

[Chorus]
First snow on Amity, stay for a while
Quiet the rooftops for mile after mile
No hurry tonight, let the old year move slow
Christmas comes softly with the first snow

[Bridge]
Morning can turn it to water and gray
Tonight gets to keep what tomorrow takes away
So lower the radio, take the long way home
Let the town have one night dressed in snow

[Final Chorus]
First snow on Amity, stay if you can
Soft on the rooftops and white on the land
No hurry tonight, there is nowhere to go
Better than right here in the first Christmas snow

### Suno style prompt

1940s/1950s-inspired Christmas crooner, 76–82 BPM. Close-mic warm baritone, upright bass, brushed drums, piano, muted brass and soft strings, occasional tasteful close-harmony backing. Elegant and sincere, never parody. Give it softly weathered broadcast warmth while preserving clear modern intelligibility and full-range master quality. No crowd, no big-band blast, no modern drum kit punch, no excessive vinyl crackle. Smooth phrasing and a short classic resolved ending.

---

## M05 — Midnight Roast

**Role:** flagship playful swing / North Pole After Hours crossover  
**Target length:** 2:50–3:25  
**Energy:** 3/5

### Lyrics

[Spoken Intro]
[Dry North Pole radio voice]
North Pole desk to Louisburg. Late-shift clearance granted.

[Verse 1]
Eleven fifty-nine, the drum is winding down
Snow against the loading door, not a tire in town
A candy cane is leaning by the cooling tray
And a note in crooked handwriting says, “Save a cup this way”

[Pre-Chorus]
Then the old brass bell gives one little ring
And somebody swears they heard sleigh runners sing

[Chorus]
Midnight roast, midnight snow
Keep the late-shift rhythm low
Beans are cooling, stars are bright
Something’s on the roof tonight

[Verse 2]
The shipping list says Kansas but the stamp says N.P.
There’s a red thread on the latch where no red thread ought to be
One mug went missing, then it wandered back
With a peppermint crumb and a bootprint on the mat

[Pre-Chorus]
No alarm, no need to make a scene
Just one more strange thing on the Christmas night shift screen

[Chorus]
Midnight roast, midnight snow
Keep the late-shift rhythm low
Beans are cooling, stars are bright
Something’s on the roof tonight

[Radio Break]
[Dry North Pole radio voice]
Louisburg, North Pole traffic. We have your signal. Keep the chimney clear.

[Instrumental Break]
[Short piano and muted-horn swing break]

[Final Chorus]
Midnight roast, midnight snow
Some things better left unknown
Beans are cooling, morning’s near
Christmas took the late shift here

### Suno style prompt

Playful late-night Christmas swing story, 134–142 BPM swing feel. Nimble warm male vocal, upright bass, brushed kit, piano, muted trumpet and/or clarinet, tiny restrained sleigh accents. Spoken North Pole radio cues should be dry, short, calm and believable, not cartoon voices. Family friendly, witty rather than goofy. No crowd, applause, laugh track, party ambience or announcer hype. Keep the story intelligible, give the instrumental break real small-combo swing, and end crisply.

---

## I07 — Roastery Snowglow

**Role:** 103.1 signature instrumental / flagship pacing reset  
**Target length:** 2:30–3:10  
**Energy:** 2/5

### Suno style prompt

Instrumental only. Warm intimate Christmas soundscape at 78–84 BPM with fingerpicked acoustic guitar, felt piano, cello, upright bass and soft brushed percussion. Add only restrained low-register vibraphone or muted bell accents; no piercing glockenspiel. Mood: snowy Louisburg night, warm roastery lights after the work slows down, reflective but comforting. Airy and cinematic on a human scale, no huge build, no choir, no vocals, no spoken word, no café ambience. Make the intro immediately usable after a vocal song and give the ending a gentle resolved cadence for clean radio sequencing.

---

## 11. Batch 01 acceptance rule

Do **not** create Batch 02 just because six Suno files exist. Render candidates for Batch 01, run the Christmas Radio Audio Audit on the real files, compare the six together as a station, and answer these questions first:

- Does 103.1 sound like one station rather than six unrelated genre experiments?
- Is the vocal production warm and recognizable across styles without every singer sounding identical?
- Are the vintage textures tasteful and intelligible?
- Are rock cuts energetic without crowd/arena artifacts?
- Do the emotional songs stay sincere and restrained?
- Are Brew & Brews references selective enough that the station still feels like Christmas music rather than an advertisement?
- Do intros/outros create enough transition options for a curated loop?

Only after those answers are positive should Batch 02 be rendered at scale.
