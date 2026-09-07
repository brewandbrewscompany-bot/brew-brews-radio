import json
from pathlib import Path
import numpy as np
import trimesh

ROOT = Path(__file__).resolve().parents[1] if Path(__file__).resolve().parent.name == 'tools' else Path('/mnt/data/pass14_test')
GLB = ROOT / 'assets' / 'models' / 'witch-rider.glb'
META = ROOT / 'assets' / 'witch-mesh-pass14.json'

required = ['cape','cape_left','cape_center','cape_right','hair_01','hair_02','hair_03','hair_04','hair_05','hat_tip','broom_handle','broom_bristles']
expected_materials = {
    'mesh review clay body','mesh review clay detail','mesh review clay cloth',
    'mesh review clay hair','mesh review clay broom','mesh review clay straw'
}

assert GLB.exists(), GLB
assert META.exists(), META
assert GLB.stat().st_size >= 500_000, GLB.stat().st_size
raw = GLB.read_bytes()
assert raw[:4] == b'glTF', raw[:4]
assert int.from_bytes(raw[4:8], 'little') == 2

meta = json.loads(META.read_text())
assert meta['version'] == 'witch-mesh-pass-v14', meta
assert meta['build'] == 'pass-14-human-seated-rebuild-v8', meta
assert meta['material_phase'] == 'neutral-clay-mesh-review-only', meta
assert meta['broom_bristle_count'] >= 144, meta
assert meta['hair_animated_roots'] == 5, meta
assert meta['hair_clumps_per_root'] >= 4, meta
assert meta['hair_under_clumps'] >= 8, meta
assert meta['cape_motion_roots'] == 3, meta
assert meta['cape_panel_meshes'] >= 6, meta
assert set(required).issubset(meta['required_motion_nodes']), meta

scene = trimesh.load(GLB, force='scene', process=False)
nodes = set(scene.graph.nodes)
missing = [n for n in required if n not in nodes]
assert not missing, missing
assert len(scene.geometry) >= 210, len(scene.geometry)

# No final PBR/textured material phase is allowed in the mesh-only gate.
materials = {}
for geom in scene.geometry.values():
    mat = getattr(getattr(geom, 'visual', None), 'material', None)
    if mat is None:
        continue
    materials[mat.name] = mat
assert set(materials) == expected_materials, set(materials)
for mat in materials.values():
    assert float(getattr(mat, 'metallicFactor', 0.0) or 0.0) == 0.0, mat.name
    assert float(getattr(mat, 'roughnessFactor', 0.0) or 0.0) >= .90, mat.name
    assert getattr(mat, 'baseColorTexture', None) is None, mat.name
    assert getattr(mat, 'normalTexture', None) is None, mat.name


def verts(node):
    T, geom_name = scene.graph[node]
    assert geom_name is not None, node
    v = np.asarray(scene.geometry[geom_name].vertices, dtype=float)
    vh = np.c_[v, np.ones(len(v))]
    return (np.asarray(T) @ vh.T).T[:, :3]


def bounds(node):
    v = verts(node)
    return v.min(axis=0), v.max(axis=0)


def center(node):
    lo, hi = bounds(node)
    return (lo + hi) * .5

# Human proportions: continuous elongated torso and readable waist/pelvis.
body_lo, body_hi = bounds('body_core')
assert body_hi[1] - body_lo[1] >= 1.40, (body_lo, body_hi)
assert body_hi[0] - body_lo[0] >= 1.60, (body_lo, body_hi)
pel_lo, pel_hi = bounds('pelvis_volume')
rib_lo, rib_hi = bounds('ribcage_volume')
assert .85 <= center('pelvis_volume')[1] <= 1.15
assert center('ribcage_volume')[1] - center('pelvis_volume')[1] >= .85
assert (rib_hi[0]-rib_lo[0]) > (body_hi[0]-body_lo[0])*.82
assert (body_hi[0]-body_lo[0]) > (pel_hi[0]-pel_lo[0])

# Forward riding reach: both hands are visibly forward and converge around shaft.
for side in (-1,1):
    h = center(f'hand_{side}')
    assert h[2] < -1.30, h
    assert .72 < h[1] < 1.12, h
    assert abs(h[0]) < .30, h
    arm_lo, arm_hi = bounds(f'arm_{side}')
    assert arm_lo[2] < -1.55 and arm_hi[1] > 2.20, (arm_lo, arm_hi)

# Seated straddle: thighs overlap pelvis and splay around broom; boots continue bent leg angle.
for side in (-1,1):
    thigh_lo, thigh_hi = bounds(f'thigh_{side}')
    calf_lo, calf_hi = bounds(f'calf_{side}')
    boot_lo, boot_hi = bounds(f'boot_foot_{side}')
    assert thigh_hi[1] > .98 and thigh_lo[1] < .62, (thigh_lo, thigh_hi)
    assert thigh_lo[2] < .48 and thigh_hi[2] > 1.18, (thigh_lo, thigh_hi)
    assert calf_lo[1] < .30 and calf_hi[2] > 1.55, (calf_lo, calf_hi)
    assert boot_lo[1] < -.05 and boot_hi[2] > 2.45, (boot_lo, boot_hi)
assert center('thigh_-1')[0] < -.45 and center('thigh_1')[0] > .45

# Broom visibly routes under pelvis and through seat relationship.
shaft_lo, shaft_hi = bounds('broom_shaft')
assert shaft_lo[2] < -2.30 and shaft_hi[2] > 3.00, (shaft_lo, shaft_hi)
assert shaft_lo[1] < .60 and shaft_hi[1] > .95, (shaft_lo, shaft_hi)
# Shaft y-range must overlap pelvis lower half and both hand y-ranges.
assert shaft_hi[1] >= pel_lo[1] and shaft_lo[1] <= pel_hi[1]
for side in (-1,1):
    h_lo,h_hi = bounds(f'hand_{side}')
    assert not (h_hi[1] < shaft_lo[1] or h_lo[1] > shaft_hi[1]), side

# Cape must stay narrow up high and flare only at the lower folds.
cape_nodes = sorted(n for n in nodes if n.startswith('cape_panel_'))
assert len(cape_nodes) >= 6, cape_nodes
cape_v = np.vstack([verts(n) for n in cape_nodes])
upper = cape_v[cape_v[:,1] > 1.90]
lower = cape_v[cape_v[:,1] < .60]
upper_width = float(np.ptp(upper[:,0])); lower_width = float(np.ptp(lower[:,0]))
assert upper_width < 1.80, upper_width
assert lower_width > 2.40, lower_width
assert lower_width > upper_width * 1.42, (upper_width, lower_width)
assert cape_v[:,1].min() < .20

# Hair is a broad mane mass, not sparse rope roots.
hair_nodes = sorted(n for n in nodes if n.startswith('hair_clump_'))
under_nodes = sorted(n for n in nodes if n.startswith('hair_under_'))
assert len(hair_nodes) >= 20, len(hair_nodes)
assert len(under_nodes) >= 8, len(under_nodes)
hair_v = np.vstack([verts(n) for n in hair_nodes + under_nodes + ['hair_mane_base']])
hair_span = np.ptp(hair_v, axis=0)
assert hair_span[0] > 1.95, hair_span
assert hair_span[1] > 1.20, hair_span
assert hair_v[:,1].min() < 1.55, hair_v[:,1].min()

# Hat stays subordinate to body/shoulders and has actual vertical droop thickness.
hat_lo,hat_hi = bounds('hat_brim')
hat_width = hat_hi[0]-hat_lo[0]
assert 1.65 < hat_width < 2.05, hat_width
assert hat_hi[1]-hat_lo[1] > .18, (hat_lo,hat_hi)
assert bounds('hat_crown_lower')[1][1] > 3.80
assert bounds('hat_tip_mesh')[1][1] > 3.95

# Straw bundle: 144+ true geometry nodes with substantial fan and length.
bristles = sorted(n for n in nodes if n.startswith('broom_bristle_'))
assert len(bristles) >= 144, len(bristles)
bristle_v = np.vstack([verts(n) for n in bristles])
straw_span = np.ptp(bristle_v, axis=0)
assert straw_span[0] > 3.10, straw_span
assert straw_span[1] > 1.55, straw_span
assert straw_span[2] > 3.40, straw_span
assert bristle_v[:,2].max() > 6.45, bristle_v[:,2].max()

report = {
    'ok': True,
    'pass': '14-human-seated-rebuild-v8',
    'bytes': GLB.stat().st_size,
    'nodes': len(nodes),
    'meshes': len(scene.geometry),
    'materials': sorted(materials),
    'bristles': len(bristles),
    'hair_clumps': len(hair_nodes),
    'hair_under': len(under_nodes),
    'cape_panels': len(cape_nodes),
    'torso_y_span': round(float(body_hi[1]-body_lo[1]),3),
    'rib_to_pelvis_y': round(float(center('ribcage_volume')[1]-center('pelvis_volume')[1]),3),
    'cape_upper_width': round(upper_width,3),
    'cape_lower_width': round(lower_width,3),
    'hair_span': [round(float(v),3) for v in hair_span],
    'hat_width': round(float(hat_width),3),
    'straw_span': [round(float(v),3) for v in straw_span],
}
print(json.dumps(report, indent=2))
