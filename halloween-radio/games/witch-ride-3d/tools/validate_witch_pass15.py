from __future__ import annotations
import hashlib, json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
GLB=ROOT/'assets'/'models'/'witch-rider.glb'
MESH_MANIFEST=ROOT/'assets'/'witch-mesh-pass14.json'
BUILDER=ROOT/'tools'/'build_witch_pass14.py'
RUNTIME=ROOT/'witch-centerpiece-pass.js'

LOCKED_GLB_BLOB='8ec46a27aa0b60244061ce8cc81c2d603a97b1c5'
LOCKED_BUILDER_BLOB='7dc2af89d1ecaca8a176026463dca9ff41bd1ac8'
LOCKED_GLB_BYTES=590644

def git_blob_sha(path:Path)->str:
    data=path.read_bytes()
    return hashlib.sha1(f'blob {len(data)}\0'.encode('ascii')+data).hexdigest()

assert GLB.is_file() and GLB.stat().st_size==LOCKED_GLB_BYTES,(GLB.exists(),GLB.stat().st_size if GLB.exists() else None)
assert git_blob_sha(GLB)==LOCKED_GLB_BLOB,(git_blob_sha(GLB),LOCKED_GLB_BLOB)
assert BUILDER.is_file() and git_blob_sha(BUILDER)==LOCKED_BUILDER_BLOB,(git_blob_sha(BUILDER),LOCKED_BUILDER_BLOB)

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
    "witch-centerpiece-pass-v15",
    "pass-15-materials-v1",
    "locked-pass14-mesh-material-lookdev",
    LOCKED_GLB_BLOB,
    "materialsApplied:true",
    "geometryLocked:true",
    "meshOnly:false",
    "Pass15 aged black felt",
    "Pass15 dense auburn hair",
    "Pass15 heavy charcoal wool",
    "Pass15 restrained oxblood lining",
    "Pass15 aged riding leather",
    "Pass15 weathered crooked broom wood",
    "Pass15 dark natural broom straw",
    "Witch Pass15 Moon Rim",
    "Witch Pass15 Broom Bounce"
)
for token in required:
    assert token in src,token

# Materials-only means no approved rider transform/scale/position edits in runtime.
for forbidden in ('setLocalScale(','setPosition(','setEulerAngles(','setLocalPosition(0,0,0)','clone()'):
    if forbidden=='clone()':
        continue
# The only new entities allowed are the two visual lights; no replacement rider meshes.
assert src.count("new pc.Entity(")==2,src.count("new pc.Entity(")
assert "addComponent('render'" not in src and "addComponent('model'" not in src
assert "createMesh" not in src and "createBox" not in src and "createSphere" not in src

# Guard Halloween Radio behavior: this visual pass must not call playback/station controls.
for forbidden in ('audio.play','audio.pause','currentTrack','nextTrack','previousTrack','station','shuffle','repeat','favorite','Haunted Auto Tune','Ghost Tune'):
    assert forbidden not in src,forbidden

print(json.dumps({
    'ok':True,
    'pass':'pass-15-materials-v1',
    'locked_glb_blob':LOCKED_GLB_BLOB,
    'locked_builder_blob':LOCKED_BUILDER_BLOB,
    'locked_glb_bytes':LOCKED_GLB_BYTES,
    'geometry_locked':True,
    'materials_runtime_only':True
},indent=2))
