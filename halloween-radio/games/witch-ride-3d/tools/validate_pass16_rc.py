from __future__ import annotations
import json, subprocess
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
REPO=ROOT.parents[2]
LOCK=ROOT/'pass16-rc-lock.json'
ALLOWED={
    '.github/workflows/witch-ride-3d-pass16-rc.yml',
    'halloween-radio/games/witch-ride-3d/pass16-rc-lock.json',
    'halloween-radio/games/witch-ride-3d/tools/validate_pass16_rc.py',
}

def git(*args:str)->str:
    return subprocess.check_output(['git',*args],cwd=REPO,text=True).strip()

def blob(path:str)->str:
    return git('hash-object',path)

def fail(msg:str):
    raise SystemExit(msg)

lock=json.loads(LOCK.read_text())
source=lock['source_commit']
changed=[x for x in git('diff','--name-only',source,'HEAD').splitlines() if x]
extra=[x for x in changed if x not in ALLOWED]
if extra:
    fail('Pass 16 changed frozen production files: '+', '.join(extra))
if any(x.startswith('louisburg-local/') for x in changed):
    fail('louisburg-local/ changed')
for path,expected in lock['locked_files'].items():
    actual=blob(path)
    if actual!=expected:
        fail(f'locked file changed: {path} {actual} != {expected}')

runtime=(ROOT/'witch-centerpiece-pass.js').read_text()
for token in [
    "const LOCKED_GLB_BLOB='4b6b7009e86a53dc35d9216ea8d29133584b280d'",
    'const GAMEPLAY_SCALE=.24',
    "stanceMode:'pass14-exact-local-transforms'",
    'materialsApplied:false',
    'geometryLocked:true',
]:
    if token not in runtime:
        fail('approved witch runtime lock missing: '+token)

env=(ROOT/'pass15-environment-traffic.js').read_text()
for token in [
    "const VERSION='pass15-environment-traffic-v5'",
    'roadNeutralCharcoal:road.roads===9',
    'witchTouched:false',
    'beanHaloOpacity:beans.haloOpacity',
]:
    if token not in env:
        fail('frozen environment contract missing: '+token)

manifest=json.loads((ROOT/'assets'/'witch-mesh-pass14.json').read_text())
checks={
    'mane_primary_locks':14,
    'mane_shoulder_locks':8,
    'hair_main_locks':14,
    'hair_overlap_locks':8,
    'broom_bristles':240,
    'broom_straw_clumps':56,
    'broom_primary_groups':8,
    'broom_flow_axis':'+Z toward chase camera/player',
    'broom_flow_authored':True,
    'lower_body_runtime_physics':False,
}
for key,expected in checks.items():
    if manifest.get(key)!=expected:
        fail(f'approved manifest changed: {key}={manifest.get(key)!r}, expected {expected!r}')

print(json.dumps({
    'ok':True,
    'pass':lock['pass'],
    'source_commit':source,
    'changed_files':changed,
    'locked_production_files':len(lock['locked_files']),
    'witch_blob':lock['approved_witch_glb_blob'],
    'gameplay_scale':lock['gameplay_scale'],
    'production_runtime_changed':False,
    'louisburg_local_changed':False,
},indent=2))
