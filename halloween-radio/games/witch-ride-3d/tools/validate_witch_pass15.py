from __future__ import annotations
import hashlib, json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
GLB=ROOT/'assets'/'models'/'witch-rider.glb'
MANIFEST=ROOT/'assets'/'witch-mesh-pass14.json'
RUNTIME=ROOT/'witch-centerpiece-pass.js'
APPROVED_COMMIT='fc57a127836225f61a17f57e8af1540415dd6f18'
APPROVED_ARTIFACT='witch-pass14-mesh-renders'
LOCKED_GLB_BLOB='4b6b7009e86a53dc35d9216ea8d29133584b280d'
LOCKED_MANIFEST_BLOB='ecd1aab936d770bcb135dddce0b03020801e052a'
LOCKED_GLB_BYTES=878708
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

def blob(path:Path)->str:
    data=path.read_bytes()
    return hashlib.sha1(f'blob {len(data)}\0'.encode('ascii')+data).hexdigest()

assert GLB.is_file() and GLB.stat().st_size==LOCKED_GLB_BYTES
assert blob(GLB)==LOCKED_GLB_BLOB,(blob(GLB),LOCKED_GLB_BLOB)
assert MANIFEST.is_file() and blob(MANIFEST)==LOCKED_MANIFEST_BLOB,(blob(MANIFEST),LOCKED_MANIFEST_BLOB)
for path,expected in LOCKED_UNRELATED.items():
    assert path.is_file(),path
    assert blob(path)==expected,(str(path),blob(path),expected)

m=json.loads(MANIFEST.read_text(encoding='utf-8'))
assert m['pass']=='pass-14-mesh-only-v24'
assert m['review']=='neutral-clay-mesh-review-only'
assert m['geometry_strategy']=='full organic lofted silhouette; no visible primitive columns'
assert m['materials_applied'] is False
assert m['bytes']==878708 and m['nodes']==373 and m['geometries']==357
assert m['mane_primary_locks']==14 and m['mane_shoulder_locks']==8
assert m['hair_main_locks']==14 and m['hair_overlap_locks']==8 and m['hair_cap'] is True
assert m['lower_body_runtime_physics'] is False
assert m['lower_body_max_knee_center_x']==0.37 and m['lower_body_ankle_center_x']==0.38 and m['lower_body_boot_center_x']==0.403
assert m['cape_primary_folds']==4
assert m['broom_bristles']==240 and m['broom_straw_clumps']==56 and m['broom_primary_groups']==8
assert m['broom_flow_axis']=='+Z toward chase camera/player' and m['broom_flow_authored'] is True
assert m['broom_full_root_clumps']==8 and m['broom_full_root_bristles']==48 and m['broom_flyaway_bristles']==40

src=RUNTIME.read_text(encoding='utf-8')
for token in (
    'witch-centerpiece-pass-v15','pass-15-sept8-approved-restore-v1','september-8-pass14-approved-visual-lock',
    APPROVED_COMMIT,APPROVED_ARTIFACT,LOCKED_GLB_BLOB,'const GAMEPLAY_SCALE=.24',
    "const STANCE_NAMES=['leg_L','leg_R','boot_L','boot_R']","app.on('prerender',lockGameplayPresentation)",
    "stanceMode:'pass14-exact-local-transforms'",'stanceOffsetsRemoved:true','materialsApplied:false',
    'geometryLocked:true','meshOnly:true','scaleEnforced:true','stanceLocked:true',
    "broomFlowAxis:'+Z toward chase camera/player'",'setDelta(tip,0,0,0)'):
    assert token in src,token
for forbidden in (
    'STANCE_OFFSETS','leg_L:-.10','leg_R:.10','boot_L:-.14','boot_R:.14','new pc.StandardMaterial',
    'Pass15 aged black felt','Pass15 dense auburn hair','Pass15 heavy charcoal wool','Witch Pass15 Moon Rim',
    'Witch Pass15 Broom Bounce',"addComponent('render'","addComponent('model'",'createMesh','createBox','createSphere',
    'witch.clone','instantiateRenderEntity','loadFromUrl','assets/models/witch-rider'):
    assert forbidden not in src,forbidden
assert "new pc.Entity(" not in src
for forbidden in ('audio.play','audio.pause','currentTrack','nextTrack','previousTrack','station','shuffle','repeat','favorite','Haunted Auto Tune','Ghost Tune'):
    assert forbidden not in src,forbidden

print(json.dumps({'ok':True,'approved_commit':APPROVED_COMMIT,'approved_artifact':APPROVED_ARTIFACT,'locked_glb_blob':LOCKED_GLB_BLOB,'locked_manifest_blob':LOCKED_MANIFEST_BLOB,'locked_glb_bytes':LOCKED_GLB_BYTES,'runtime_pose_lock':'exact approved local transforms; no offsets','gameplay_scale':0.24,'unrelated_environment_files_locked':len(LOCKED_UNRELATED)},indent=2))
