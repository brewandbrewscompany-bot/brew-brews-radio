from __future__ import annotations
import hashlib, json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
GLB=ROOT/'assets'/'models'/'witch-rider.glb'
MESH_MANIFEST=ROOT/'assets'/'witch-mesh-pass14.json'
BUILDER=ROOT/'tools'/'build_witch_pass14.py'
RUNTIME=ROOT/'witch-centerpiece-pass.js'

APPROVED_COMMIT='fc57a127836225f61a17f57e8af1540415dd6f18'
APPROVED_ARTIFACT='witch-pass14-mesh-renders'
LOCKED_GLB_BLOB='8ec46a27aa0b60244061ce8cc81c2d603a97b1c5'
LOCKED_BUILDER_BLOB='7dc2af89d1ecaca8a176026463dca9ff41bd1ac8'
LOCKED_GLB_BYTES=590644
LOCKED_UNRELATED={
    ROOT/'game.js':'a4d32f486d0b70900924196a0307cf2b2faa4583',
    ROOT/'index.html':'654a2c5da88e3cc35be6106e0e5de094248e8614',
    ROOT/'pass15-environment-traffic.js':'3abe399a343638b45c7fe143423df0cc3ca53f90',
    ROOT/'atmosphere-pass.js':'b994b94f3d7a7d4fa2dd0414696fb323e7946ef7',
    ROOT/'cinematic-camera-pass.js':'37061039ce1a9ba75f5ed871959fe0ca0d233253',
    ROOT/'composition-pass.js':'6c55751b5b7c8c5d9f41c6e09772eb932438e933',
    ROOT/'illumination-pass.js':'4eed64f7abcd7a07c9bbff051922fe3fb21aa833',
    ROOT/'realism-pass.js':'5b509c024dcf214ff30ed536c735528725172323',
}

def git_blob_sha(path:Path)->str:
    data=path.read_bytes()
    return hashlib.sha1(f'blob {len(data)}\0'.encode('ascii')+data).hexdigest()

assert GLB.is_file() and GLB.stat().st_size==LOCKED_GLB_BYTES,(GLB.exists(),GLB.stat().st_size if GLB.exists() else None)
assert git_blob_sha(GLB)==LOCKED_GLB_BLOB,(git_blob_sha(GLB),LOCKED_GLB_BLOB)
assert BUILDER.is_file() and git_blob_sha(BUILDER)==LOCKED_BUILDER_BLOB,(git_blob_sha(BUILDER),LOCKED_BUILDER_BLOB)
for path,expected in LOCKED_UNRELATED.items():
    assert path.is_file(),path
    actual=git_blob_sha(path)
    assert actual==expected,(str(path),actual,expected)

meta=json.loads(MESH_MANIFEST.read_text(encoding='utf-8'))
assert meta['pass']=='pass-14-mesh-only-v24'
assert meta['review']=='neutral-clay-mesh-review-only'
assert meta['geometry_strategy']=='full organic lofted silhouette; no visible primitive columns'
assert meta['materials_applied'] is False
assert meta['bytes']==LOCKED_GLB_BYTES
assert meta['nodes']==357 and meta['geometries']==341
assert meta['mane_primary_locks']==9 and meta['mane_shoulder_locks']==7
assert meta['cape_primary_folds']==4
assert meta['broom_bristles']==240 and meta['broom_straw_clumps']==56

src=RUNTIME.read_text(encoding='utf-8')
required=(
    'witch-centerpiece-pass-v15',
    'pass-15-sept8-approved-restore-v1',
    'september-8-pass14-approved-visual-lock',
    APPROVED_COMMIT,
    APPROVED_ARTIFACT,
    LOCKED_GLB_BLOB,
    'const GAMEPLAY_SCALE=.24',
    "const STANCE_NAMES=['leg_L','leg_R','boot_L','boot_R']",
    "app.on('prerender',lockGameplayPresentation)",
    "stanceMode:'pass14-exact-local-transforms'",
    'stanceOffsetsRemoved:true',
    'materialsApplied:false',
    'geometryLocked:true',
    'meshOnly:true',
    'scaleEnforced:true',
    'stanceLocked:true',
    "broomFlowAxis:'+Z toward chase camera/player'",
    'setDelta(tip,0,0,0)',
    "spring(br.x,speedN*.025+Math.sin(t*.96)*.008*air",
)
for token in required:
    assert token in src,token

# The September 8 witch is restored, not reinterpreted: no offsets, replacement geometry,
# material lookdev, or witch-local helper lights may alter the approved visual source.
for forbidden in (
    'STANCE_OFFSETS','leg_L:-.10','leg_R:.10','boot_L:-.14','boot_R:.14',
    'new pc.StandardMaterial','Pass15 aged black felt','Pass15 dense auburn hair',
    'Pass15 heavy charcoal wool','Witch Pass15 Moon Rim','Witch Pass15 Broom Bounce',
    "addComponent('render'","addComponent('model'",'createMesh','createBox','createSphere',
    'witch.clone','instantiateRenderEntity','loadFromUrl','assets/models/witch-rider'
):
    assert forbidden not in src,forbidden
assert "new pc.Entity(" not in src

# Guard Halloween Radio playback behavior: this visual pass must never call playback/station controls.
for forbidden in ('audio.play','audio.pause','currentTrack','nextTrack','previousTrack','station','shuffle','repeat','favorite','Haunted Auto Tune','Ghost Tune'):
    assert forbidden not in src,forbidden

print(json.dumps({
    'ok':True,
    'pass':'pass-15-sept8-approved-restore-v1',
    'approved_commit':APPROVED_COMMIT,
    'approved_artifact':APPROVED_ARTIFACT,
    'locked_glb_blob':LOCKED_GLB_BLOB,
    'locked_builder_blob':LOCKED_BUILDER_BLOB,
    'locked_glb_bytes':LOCKED_GLB_BYTES,
    'geometry_locked':True,
    'runtime_pose_lock':'exact Pass 14 local transforms; no offsets',
    'gameplay_scale':0.24,
    'unrelated_environment_files_locked':len(LOCKED_UNRELATED)
},indent=2))
