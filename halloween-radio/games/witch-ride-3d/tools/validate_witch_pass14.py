from __future__ import annotations
import json, re
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
assert meta["pass"]=="pass-14-mesh-only-v22", meta
assert meta["review"]=="neutral-clay-mesh-review-only", meta
assert meta["geometry_strategy"]=="camera-safe large forms", meta
assert meta["cape_primary_folds"]==4, meta
assert meta["mane_primary_locks"]==5, meta
assert meta["hair_topology"]=="single-broad-mane-shell", meta
assert meta["cape_topology"]=="single-corrugated-cape-shell", meta
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

# v22 specifically removes the physical rope/panel construction. Fold counts are
# sculpted into two single continuous shells instead of overlapping child pieces.
assert "torso_body" in nodes, "missing continuous torso body"
assert "mane_mass" in nodes, "missing single broad mane shell"
assert "cape_shell" in nodes, "missing single cape shell"
assert not any(re.fullmatch(r"mane_lock_\d+", n) for n in nodes), "separate mane locks returned"
assert not any(re.fullmatch(r"cape_fold_\d+", n) for n in nodes), "separate cape fold panels returned"

bristles=sorted(n for n in nodes if re.fullmatch(r"bristle_\d{3}",n))
assert len(bristles)>=144, f"bristles {len(bristles)}"
for expected in ["ribcage","waist","pelvis","shoulder_bar","shoulder_L","shoulder_R",
                 "thigh_L","thigh_R","calf_L","calf_R","boot_shaft_L","boot_shaft_R",
                 "hand_L","hand_R","hat_brim","hat_crown"]:
    assert expected in nodes, f"missing {expected}"

def world_mesh(node):
    T,gn=scene.graph[node]
    m=scene.geometry[gn].copy()
    m.apply_transform(T)
    return m

# Broad visible forms must be closed and finite so PlayCanvas cannot expose broken
# backfaces at the chase/close viewpoints.
for n in ["torso_body","mane_mass","cape_shell","hat_brim","hat_crown"]:
    m=world_mesh(n)
    assert len(m.faces)>0 and len(m.vertices)>0, n
    assert np.isfinite(m.vertices).all(), n
    assert np.isfinite(m.face_normals).all(), n
    assert m.is_watertight, f"{n} must be closed/watertight"
    assert bool(m.is_winding_consistent), f"{n} has inconsistent winding"

# Camera safety. Chase camera is at world z=11.8 and close review camera z=7.65;
# witch entity sits at world z=2. Keep all rear geometry far in front of both.
b=np.asarray(scene.bounds,float)
assert b[1,2] < 4.10, f"mesh projects into close camera safety zone: zmax={b[1,2]:.3f}"
assert b[0,2] < -2.20, f"broom handle not extended forward enough: zmin={b[0,2]:.3f}"
assert b[1,0]-b[0,0] >= 2.6, f"rider/broom silhouette too narrow: {b}"
assert b[1,1]-b[0,1] >= 5.8, f"rider silhouette too short: {b}"
for n in ["cape_shell","mane_mass","shoulder_bar","shoulder_L","shoulder_R"]:
    m=world_mesh(n)
    assert m.bounds[1,2] < 1.05, f"{n} too far toward chase camera: {m.bounds[1,2]:.3f}"

# The single mane should read as a broad shoulder/back mass rather than rope strands.
mane=world_mesh("mane_mass")
mane_ext=mane.extents
assert mane_ext[0] >= 1.55, f"mane too narrow: {mane_ext}"
assert mane_ext[1] >= 1.10, f"mane too short: {mane_ext}"
assert mane_ext[2] <= 0.55, f"mane too deep/rope-like: {mane_ext}"

# Cape is one broad drape with a readable lower flare but not a full torso-obscuring slab.
cape=world_mesh("cape_shell")
cape_ext=cape.extents
assert cape_ext[0] >= 1.55, f"cape too narrow: {cape_ext}"
assert cape_ext[1] >= 1.25, f"cape too short: {cape_ext}"
assert cape_ext[2] <= 0.75, f"cape too deep: {cape_ext}"

# Human proportions / forward lean / readable seated straddle.
def center(node):
    return world_mesh(node).bounds.mean(axis=0)
rib=center("ribcage"); waist=center("waist"); pelvis=center("pelvis")
assert rib[1] > waist[1] > pelvis[1], (rib,waist,pelvis)
assert rib[2] < waist[2] < pelvis[2]+0.10, (rib,waist,pelvis)
torso=world_mesh("torso_body")
assert torso.extents[1] >= 1.45, f"torso not elongated: {torso.extents}"
for side in ("L","R"):
    thigh=center(f"thigh_{side}"); calf=center(f"calf_{side}")
    if side=="L":
        assert thigh[0] < -0.40 and calf[0] < -0.55, (thigh,calf)
    else:
        assert thigh[0] > 0.40 and calf[0] > 0.55, (thigh,calf)

# Broom must visibly pass under the seated pelvis and hands should be forward of body.
for side in ("L","R"):
    hand=center(f"hand_{side}")
    assert hand[2] < -1.20, f"{side} hand not reaching broom grip: {hand}"

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
    "cape_topology":meta["cape_topology"],
    "hair_topology":meta["hair_topology"],
    "mane_extents":mane_ext.tolist(),
    "cape_extents":cape_ext.tolist(),
    "bounds":b.tolist(),
},indent=2))
