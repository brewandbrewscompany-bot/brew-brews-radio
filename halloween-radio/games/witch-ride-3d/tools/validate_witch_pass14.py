from __future__ import annotations
import json, math, re
from pathlib import Path
import numpy as np
import trimesh

ROOT=Path(__file__).resolve().parents[1]
GLB=ROOT/"assets"/"models"/"witch-rider.glb"
MANIFEST=ROOT/"assets"/"witch-mesh-pass14.json"

assert GLB.exists(), f"missing {GLB}"
assert MANIFEST.exists(), f"missing {MANIFEST}"
assert GLB.stat().st_size >= 500_000, f"GLB too small: {GLB.stat().st_size}"

meta=json.loads(MANIFEST.read_text(encoding="utf-8"))
assert meta["pass"]=="pass-14-mesh-only-v21", meta
assert meta["review"]=="neutral-clay-mesh-review-only", meta
assert meta["geometry_strategy"]=="camera-safe large forms", meta
assert meta["cape_primary_folds"]==3, meta
assert meta["mane_primary_locks"]==5, meta
assert meta["broom_bristles"]>=144, meta
assert meta["broom_straw_clumps"]>=18, meta

scene=trimesh.load(GLB, force="scene")
nodes=set(scene.graph.nodes)
required={
    "hair_01","hair_02","hair_03","hair_04","hair_05",
    "cape","cape_left","cape_center","cape_right",
    "hat_tip","broom_handle","broom_bristles"
}
missing=sorted(required-nodes)
assert not missing, f"missing required roots: {missing}"

names=set(scene.geometry.keys()) | nodes
for bad in ("braid","rope","hair_strand","hair_curl","cape_wedge"):
    assert not any(bad in n.lower() for n in names), f"forbidden legacy geometry token {bad}"

bristles=sorted(n for n in nodes if re.fullmatch(r"bristle_\d{3}",n))
assert len(bristles)>=144, f"bristles {len(bristles)}"
folds=sorted(n for n in nodes if re.fullmatch(r"cape_fold_[1-3]",n))
assert len(folds)==3, folds
mane=sorted(n for n in nodes if re.fullmatch(r"mane_lock_[1-5]",n))
assert len(mane)==5, mane
for expected in ["ribcage","waist","pelvis","shoulder_bar","thigh_L","thigh_R","calf_L","calf_R",
                 "boot_shaft_L","boot_shaft_R","hand_L","hand_R","hat_brim","hat_crown"]:
    assert expected in nodes, f"missing {expected}"

# All primary broad forms must be closed, finite and correctly oriented enough for PlayCanvas.
for n in folds+mane+["ribcage","waist","pelvis","hat_brim","hat_crown"]:
    T,gn=scene.graph[n]
    m=scene.geometry[gn].copy()
    m.apply_transform(T)
    assert len(m.faces)>0 and len(m.vertices)>0, n
    assert np.isfinite(m.vertices).all(), n
    assert np.isfinite(m.face_normals).all(), n
    assert m.is_watertight, f"{n} must be closed/watertight"

# Camera safety: chase camera is at world z=11.8 and close review camera at z=7.65.
# Witch entity sits at world z=2, so the closest review plane is local z=5.65.
# Keep the entire mesh, including straw, safely in front of that camera and
# keep shoulder/hair/cape volumes far from it.
b=np.asarray(scene.bounds,float)
assert b[1,2] < 4.10, f"mesh projects into close camera safety zone: zmax={b[1,2]:.3f}"
assert b[0,2] < -2.20, f"broom handle not extended forward enough: zmin={b[0,2]:.3f}"
assert b[1,0]-b[0,0] >= 2.6, f"rider/broom silhouette too narrow: {b}"
assert b[1,1]-b[0,1] >= 5.8, f"rider silhouette too short: {b}"

# Explicit hair/cape rear-depth gate. These forms caused prior camera penetration.
for n in folds+mane+["shoulder_bar","shoulder_L","shoulder_R"]:
    T,gn=scene.graph[n]
    m=scene.geometry[gn].copy(); m.apply_transform(T)
    assert m.bounds[1,2] < 1.05, f"{n} too far toward chase camera: {m.bounds[1,2]:.3f}"

# Human proportions / readable seated straddle.
def center(node):
    T,gn=scene.graph[node]; m=scene.geometry[gn].copy(); m.apply_transform(T); return m.bounds.mean(axis=0)
rib=center("ribcage"); waist=center("waist"); pelvis=center("pelvis")
assert rib[1] > waist[1] > pelvis[1], (rib,waist,pelvis)
assert rib[2] < waist[2] < pelvis[2]+0.10, (rib,waist,pelvis)  # forward lean
for side in ("L","R"):
    thigh=center(f"thigh_{side}"); calf=center(f"calf_{side}")
    if side=="L":
        assert thigh[0] < -0.40 and calf[0] < -0.55, (thigh,calf)
    else:
        assert thigh[0] > 0.40 and calf[0] > 0.55, (thigh,calf)

# Neutral clay review only: no metallic/gloss production tuning.
for g in scene.geometry.values():
    mat=getattr(getattr(g,"visual",None),"material",None)
    if mat is None: continue
    metallic=getattr(mat,"metallicFactor",0.0)
    rough=getattr(mat,"roughnessFactor",1.0)
    if metallic is not None:
        assert float(metallic) <= 0.01, f"metallic material in mesh-only pass: {metallic}"
    if rough is not None:
        assert float(rough) >= 0.95, f"non-clay roughness in mesh-only pass: {rough}"

print(json.dumps({
    "ok":True,
    "bytes":GLB.stat().st_size,
    "nodes":len(nodes),
    "geometries":len(scene.geometry),
    "bristles":len(bristles),
    "cape_folds":len(folds),
    "mane_locks":len(mane),
    "bounds":b.tolist(),
},indent=2))
