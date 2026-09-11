#!/usr/bin/env python3
"""Verify Phase 5 audio binaries and activate the runtime track manifest."""

from __future__ import annotations

import hashlib
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
AUDIO = ROOT / "audio"
DATA = ROOT / "data"
MASTERING = json.loads((DATA / "mastering.json").read_text(encoding="utf-8"))
LIBRARY = json.loads((DATA / "phase5-library.json").read_text(encoding="utf-8"))
TRACKS_PATH = DATA / "tracks.json"

masters = {master["catalogId"]: master for master in MASTERING["masters"]}
errors: list[str] = []

for master_id, metadata in masters.items():
    path = AUDIO / metadata["file"]
    if not path.exists():
        errors.append(f"missing: {path.relative_to(ROOT)}")
        continue

    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    if digest != metadata["sha256"]:
        errors.append(f"hash mismatch: {metadata['file']}")

for station_id, master_ids in LIBRARY["rotations"].items():
    for master_id in master_ids:
        if master_id not in masters:
            errors.append(f"unknown master in {station_id}: {master_id}")

if errors:
    print("PHASE 5 ACTIVATION BLOCKED")
    print("\n".join(f"- {error}" for error in errors))
    sys.exit(1)

tracks: list[dict[str, object]] = []
for station_id, master_ids in LIBRARY["rotations"].items():
    for order, master_id in enumerate(master_ids, start=1):
        master = masters[master_id]
        tracks.append(
            {
                "id": f"{station_id}-{master_id.lower()}",
                "masterId": master_id,
                "stationId": station_id,
                "order": order,
                "title": master["title"],
                "artist": "Brew & Brews Christmas Radio",
                "album": "Brew & Brews Christmas Radio — Christmas 2026",
                "src": f"audio/{master['file']}",
                "durationSeconds": master["durationSeconds"],
                "type": master["type"],
                "genre": master["genre"],
                "energy": master["energy"],
                "mastering": {
                    "integratedLUFS": master["integratedLUFS"],
                    "truePeakDb": master["truePeakDb"],
                },
                "sha256": master["sha256"],
            }
        )

manifest = {
    "version": 3,
    "status": "phase-5-playable-library",
    "defaultStationId": LIBRARY["defaultStationId"],
    "audioPolicy": LIBRARY["audioPolicy"],
    "mastering": MASTERING["target"],
    "notes": (
        "Only audited Phase 5 masters physically present under "
        "christmas-radio/audio are listed. Curated order is intentional. "
        "No audio is requested before explicit Play."
    ),
    "tracks": tracks,
}

TRACKS_PATH.write_text(
    json.dumps(manifest, indent=2, ensure_ascii=False) + "\n",
    encoding="utf-8",
)
print(f"PHASE 5 ACTIVATED: {len(masters)} masters, {len(tracks)} station entries")
