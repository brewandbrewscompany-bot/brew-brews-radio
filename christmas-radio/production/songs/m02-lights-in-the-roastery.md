# M02 — Lights in the Roastery

Master ID: `bbxmas-m02-lights-in-the-roastery`  
Primary station: `103.1 B&B Christmas Radio`  
Secondary station: `92.5 Fireside`  
Kind: vocal song  
Energy: 2/5  
Approved radio-edit length: 4:04.824  
Status: **audio approved; canonical MP3 repository upload pending**

## Production role

This is the first approved 103.1 production master. It establishes the flagship's warm, intimate center: legitimate Christmas music first, Brew & Brews setting second. The roastery is the visual anchor, not an advertisement.

## Final lyrics

[Verse 1]
Snow along the loading door
Tire tracks disappear in white
Last roast cooling in the silence
Amber bulbs against the night

[Pre-Chorus]
Outside, Louisburg turns silver
Inside, the little lights stay on

[Chorus]
Leave the lights in the roastery glowing
Let them spill a little gold across the snow
Some nights home is just a window
Saying there's still somewhere good to go

[Verse 2]
Paper stars in frosted windows
Headlights rolling down Amity
Boxes ready for the morning
Somebody's heading home to family

[Pre-Chorus]
Christmas doesn't need perfection
Sometimes warmth is all it asks

[Chorus]
Leave the lights in the roastery glowing
Let them spill a little gold across the snow
Some nights home is just a window
Saying there's still somewhere good to go

[Bridge]
Not every wonder comes like thunder
Not every gift is tied with string
Sometimes Christmas moves in quiet
Through the ordinary warmth we bring

[Final Chorus]
Keep the lights in the roastery glowing
While December settles soft and slow
Down a long and frozen roadway
Someone sees that gold and knows the way to go

[Outro]
[Instrumental release — fingerpicked guitar, felt piano, cello; gentle resolved ending]

## Suno style prompt used

Warm intimate acoustic Christmas folk, 82–86 BPM. Dry close male baritone-to-mid vocal with natural conversational phrasing, fingerpicked acoustic guitar, felt piano, soft cello and restrained strings, warm upright or electric bass, brushed percussion, extremely subtle sleigh texture. Airy, crisp, light soundscape with organic room tone; emotionally warm but not sleepy. Keep verses close and human, chorus memorable without shouting. No choir, no crowd, no glossy pop synths, no café ambience, no theatrical Broadway delivery, no huge cinematic build. Gentle resolved instrumental ending.

## Candidate audit

Two Suno renders were reviewed using the Christmas Radio lyric-aware process.

### Candidate A

Source upload: `Leave the Lights Glowing.mp3`

- Warm, intimate presentation
- Vocal and lyric meaning remained usable
- Chorus stayed flatter and sleepier than the stronger render
- Decision: reject as final master; retain only as alternate/reference

### Candidate B — selected

Source upload: `Leave the Lights Glowing (1).mp3`

- Clearer vocal presentation
- Better natural chorus lift
- Brighter acoustic detail without glossy holiday-pop character
- Louisburg, Amity and roastery remained understandable
- No announcer speech, fake audience or unexplained crowd noise
- Decision: approve after radio edit

## Approved radio edit

The selected render had an overlong instrumental tail. The approved edit preserves every vocal section and uses a smooth ending fade.

Canonical local master:

`bbxmas-m02-lights-in-the-roastery.mp3`

Verified metadata:

- Title: `Lights in the Roastery`
- Artist: `Brew & Brews Christmas Radio`
- Album: `Brew & Brews Christmas Radio — Christmas 2026`
- Duration: `244.824` seconds
- Vocal profile: `vocal-throughout-with-instrumental-release`
- Announcer speech: none
- Transition role: warm reset after upbeat, vintage or spoken material

## Runtime gate

Do not add M02 to `tracks.json` until the canonical binary exists at:

`christmas-radio/audio/bbxmas-m02-lights-in-the-roastery.mp3`

The GitHub chat connector used for this production pass can write repository text but cannot transfer the local binary MP3. The approved audio remains preserved in the conversation workspace for the next binary-capable repository upload step. No broken or fake manifest path is authorized.
