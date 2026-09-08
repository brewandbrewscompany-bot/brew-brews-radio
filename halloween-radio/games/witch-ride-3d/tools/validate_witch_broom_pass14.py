from __future__ import annotations

import json
import math
import re
from pathlib import Path

import numpy as np
import trimesh

ROOT = Path(__file__).resolve().parents[1]
MODEL = ROOT / 'assets' / 'models' / 'witch-rider.glb'
MANIFEST = ROOT / 'assets' / 'witch-mesh-pass14.json'

assert MODEL.exists(), MODEL
assert MANIFEST.exists(), MANIFEST
meta = json.loads(MANIFEST.read_text(encoding='utf-8'))

assert meta['broom_bristles'] == 240, meta['broom_bristles']
assert meta['broom_straw_clumps'] == 56, meta['broom_straw_clumps']
assert meta['broom_primary_groups'] == 8, meta['broom_primary_groups']
assert meta['broom_straw_substrands_per_clump'] == 4, meta['broom_straw_substrands_per_clump']
assert meta['broom_straw_role_counts'] == {'primary': 8, 'secondary': 32, 'edge': 16}, meta['broom_straw_role_counts']
assert meta['broom_length_clusters'] == 6, meta['broom_length_clusters']
assert meta['broom_full_root_bristles'] == 48, meta['broom_full_root_bristles']
assert meta['broom_flyaway_bristles'] == 40, meta['broom_flyaway_bristles']
assert 0.26 <= meta['broom_root_compression_fraction'] <= 0.30, meta['broom_root_compression_fraction']
assert meta['broom_material_ready'] is False
assert meta['broom_straw_workflow'] == 'grouped authored straw mass first; fine bristles are secondary breakup only'
assert meta['broom_straw_shape'] == 'tight bound root; dense middle body; gradual flare; clustered tapered tips'

family_matrix = np.asarray(meta['broom_length_family_matrix'], dtype=int)
assert family_matrix.shape == (8, 7), family_matrix.shape
assert np.all((family_matrix >= 0) & (family_matrix <= 5)), family_matrix
assert np.array_equal(np.bincount(family_matrix.ravel(), minlength=6), np.array([5, 8, 13, 12, 9, 9]))

scene = trimesh.load(MODEL, force='scene')
nodes = set(scene.graph.nodes)
straw_names = sorted(n for n in nodes if re.fullmatch(r'straw_mass_\d{2}', n))
bristle_names = sorted(n for n in nodes if re.fullmatch(r'bristle_\d{3}', n))
assert len(straw_names) == 56, len(straw_names)
assert len(bristle_names) == 240, len(bristle_names)

for required in (
    'hair_01', 'hair_02', 'hair_03', 'hair_04', 'hair_05',
    'cape', 'cape_left', 'cape_center', 'cape_right',
    'hat_tip', 'broom_handle', 'broom_bristles', 'broom_shaft',
    'leg_L', 'leg_R', 'boot_L', 'boot_R',
):
    assert required in nodes, required

assert len([n for n in nodes if re.fullmatch(r'hair_main_\d{2}', n)]) == 14
assert len([n for n in nodes if re.fullmatch(r'hair_overlap_\d{2}', n)]) == 8


def mesh_world(name: str) -> trimesh.Trimesh:
    transform, geometry = scene.graph[name]
    mesh = scene.geometry[geometry].copy()
    mesh.apply_transform(transform)
    return mesh


def clump_role(index_zero: int) -> str:
    local = index_zero % 7
    if local == 3:
        return 'primary'
    if local in (1, 2, 4, 5):
        return 'secondary'
    return 'edge'


straw_meshes = [mesh_world(name) for name in straw_names]
bristle_meshes = [mesh_world(name) for name in bristle_names]

component_radii = []
component_volumes = []
role_volumes = {'primary': [], 'secondary': [], 'edge': []}
for index, (name, mesh) in enumerate(zip(straw_names, straw_meshes)):
    assert mesh.is_watertight, name
    assert len(mesh.vertices) >= 300, (name, len(mesh.vertices))
    assert len(mesh.faces) >= 600, (name, len(mesh.faces))
    assert np.isfinite(mesh.vertices).all(), name
    parts = mesh.split(only_watertight=False)
    assert len(parts) == 4, (name, len(parts))
    role = clump_role(index)
    role_volumes[role].append(abs(float(mesh.volume)))
    for part in parts:
        assert part.is_watertight, name
        dims = np.ptp(part.vertices, axis=0)
        length = float(np.max(dims))
        volume = abs(float(part.volume))
        assert length >= 2.10, (name, dims)
        equiv_radius = math.sqrt(max(volume, 1e-12) / (math.pi * max(length, 1e-9)))
        component_radii.append(equiv_radius)
        component_volumes.append(volume)
        assert equiv_radius <= 0.036, (name, equiv_radius, volume, length)
        assert volume <= 0.015, (name, volume)

for name, mesh in zip(bristle_names, bristle_meshes):
    assert mesh.is_watertight, name
    assert len(mesh.vertices) >= 30, (name, len(mesh.vertices))
    assert len(mesh.faces) >= 55, (name, len(mesh.faces))
    assert np.isfinite(mesh.vertices).all(), name

primary_median = float(np.median(role_volumes['primary']))
secondary_median = float(np.median(role_volumes['secondary']))
edge_median = float(np.median(role_volumes['edge']))
assert primary_median >= secondary_median * 1.10, (primary_median, secondary_median)
assert secondary_median >= edge_median * 1.06, (secondary_median, edge_median)

straw = np.vstack([mesh.vertices for mesh in straw_meshes])
bristles = np.vstack([mesh.vertices for mesh in bristle_meshes])
straw_span = np.ptp(straw, axis=0)
bristle_span = np.ptp(bristles, axis=0)

# Reject short/tassel proportions. The reference target requires a large long broom tail.
assert straw_span[0] >= 2.55, straw_span
assert straw_span[1] >= 4.00, straw_span
assert straw_span[2] >= 1.75, straw_span
assert bristle_span[0] >= 2.45, bristle_span
assert bristle_span[1] >= 3.75, bristle_span
assert bristle_span[2] >= 1.65, bristle_span
assert bristle_span[0] <= straw_span[0] * 1.20, (straw_span, bristle_span)
assert bristle_span[1] <= straw_span[1] * 1.14, (straw_span, bristle_span)

# Compressed root wraps the existing broom neck and remains between the two boots.
root_band = straw[
    (straw[:, 1] >= -0.56)
    & (straw[:, 1] <= -0.26)
    & (straw[:, 2] >= 1.48)
    & (straw[:, 2] <= 1.98)
]
assert len(root_band) > 1800, len(root_band)
root_width = float(np.ptp(root_band[:, 0]))
root_center_x = float(np.mean(root_band[:, 0]))
assert root_width <= 0.36, root_width
assert -0.02 <= root_center_x <= 0.28, root_center_x

boot_l = mesh_world('boot_L')
boot_r = mesh_world('boot_R')
boot_l_x = float(boot_l.centroid[0])
boot_r_x = float(boot_r.centroid[0])
assert boot_l_x < -0.25, boot_l_x
assert boot_r_x > 0.25, boot_r_x
assert boot_r_x - boot_l_x >= 0.70, (boot_l_x, boot_r_x)
assert boot_l_x < root_center_x < boot_r_x, (boot_l_x, root_center_x, boot_r_x)

# The broom must become broad and packed early, not stay a skinny stem before exploding.
mid_band = straw[
    (straw[:, 1] >= -1.58)
    & (straw[:, 1] <= -0.82)
    & (straw[:, 2] >= 2.18)
    & (straw[:, 2] <= 2.88)
]
assert len(mid_band) > 2200, len(mid_band)
mid_width = float(np.ptp(mid_band[:, 0]))
assert mid_width >= 2.00, mid_width
assert mid_width >= root_width * 5.5, (root_width, mid_width)

# Large lower envelope, but not one clean fan edge.
tail_band = straw[straw[:, 1] <= -2.62]
assert len(tail_band) > 2200, len(tail_band)
tail_width = float(np.ptp(tail_band[:, 0]))
assert tail_width >= 2.45, tail_width

# Six staggered terminal families are enforced from the actual mesh. Because every
# named clump contains four individually staggered tips, the clump minimum sits about
# 0.16 below its family's center.
length_targets = np.array([-2.84, -3.12, -3.41, -3.72, -4.06, -4.42], dtype=float)
clump_low_y = np.asarray([float(mesh.vertices[:, 1].min()) for mesh in straw_meshes])
nearest_family = np.argmin(np.abs(clump_low_y[:, None] - length_targets[None, :]), axis=1)
nearest_error = np.min(np.abs(clump_low_y[:, None] - length_targets[None, :]), axis=1)
assert float(np.max(nearest_error)) <= 0.21, float(np.max(nearest_error))
family_counts = np.bincount(nearest_family, minlength=6)
assert np.all(family_counts >= 4), family_counts
assert float(np.ptp(clump_low_y)) >= 1.40, np.ptp(clump_low_y)
for family in range(6):
    values = clump_low_y[nearest_family == family]
    assert len(values) >= 4
    assert float(np.ptp(values)) <= 0.36, (family, np.ptp(values))

# No directional group may terminate as one blunt tassel finger: each group's seven
# clumps must occupy at least four different terminal families.
for group in range(8):
    group_families = nearest_family[group * 7:(group + 1) * 7]
    assert len(set(group_families.tolist())) >= 4, (group, group_families)

# Primary mass remains asymmetric and curved in the actual geometry.
primary_indices = [i for i in range(56) if clump_role(i) == 'primary']
assert len(primary_indices) == 8
primary_tip_x = []
primary_tip_y = []
primary_mid_x = []
for index in primary_indices:
    mesh = straw_meshes[index]
    ymin = float(mesh.vertices[:, 1].min())
    tip_slice = mesh.vertices[mesh.vertices[:, 1] <= ymin + 0.18]
    assert len(tip_slice) >= 12, (straw_names[index], len(tip_slice))
    primary_tip_x.append(float(np.mean(tip_slice[:, 0])))
    primary_tip_y.append(float(np.mean(tip_slice[:, 1])))
    middle_slice = mesh.vertices[(mesh.vertices[:, 1] >= -1.52) & (mesh.vertices[:, 1] <= -0.88)]
    assert len(middle_slice) >= 20, (straw_names[index], len(middle_slice))
    primary_mid_x.append(float(np.mean(middle_slice[:, 0])))

primary_tip_x = np.asarray(primary_tip_x)
primary_tip_y = np.asarray(primary_tip_y)
primary_mid_x = np.asarray(primary_mid_x)
assert float(np.ptp(primary_tip_y)) >= 1.20, np.ptp(primary_tip_y)
mirror_length_delta = np.asarray([
    abs(primary_tip_y[0] - primary_tip_y[7]),
    abs(primary_tip_y[1] - primary_tip_y[6]),
    abs(primary_tip_y[2] - primary_tip_y[5]),
    abs(primary_tip_y[3] - primary_tip_y[4]),
])
assert float(np.mean(mirror_length_delta)) >= 0.34, mirror_length_delta
curve_delta = primary_tip_x - primary_mid_x
assert float(np.std(curve_delta)) >= 0.10, curve_delta
assert np.any(curve_delta < -0.12), curve_delta
assert np.any(curve_delta > 0.12), curve_delta

# Only a minority of fine bristles may travel root-to-tip.
full_root_count = sum(float(mesh.vertices[:, 1].max()) > -0.40 for mesh in bristle_meshes)
assert 42 <= full_root_count <= 56, full_root_count

# Fine bristles remain tertiary detail; medium clumps still carry the body.
straw_volumes = np.asarray([abs(float(mesh.volume)) for mesh in straw_meshes])
bristle_volumes = np.asarray([abs(float(mesh.volume)) for mesh in bristle_meshes])
assert np.median(straw_volumes) >= np.median(bristle_volumes) * 14.0, (
    float(np.median(straw_volumes)),
    float(np.median(bristle_volumes)),
)
assert float(np.percentile(component_radii, 95)) <= 0.0345, np.percentile(component_radii, 95)
assert float(np.percentile(component_volumes, 95)) <= 0.0145, np.percentile(component_volumes, 95)

# The boot zone remains readable despite the larger broom.
readability_band = straw[
    (straw[:, 1] >= -0.58)
    & (straw[:, 1] <= -0.24)
    & (straw[:, 2] <= 2.02)
]
assert len(readability_band) > 1200, len(readability_band)
readability_width = float(np.ptp(readability_band[:, 0]))
assert readability_width <= 0.40, readability_width

# Materials remain blocked; this is neutral-clay geometry review only.
for mesh in straw_meshes + bristle_meshes:
    material = getattr(getattr(mesh, 'visual', None), 'material', None)
    if material is None:
        continue
    metallic = getattr(material, 'metallicFactor', 0.0)
    roughness = getattr(material, 'roughnessFactor', 1.0)
    if metallic is not None:
        assert float(metallic) <= 0.01
    if roughness is not None:
        assert float(roughness) >= 0.95

print(json.dumps({
    'ok': True,
    'broom_bristles': len(bristle_names),
    'broom_straw_clumps': len(straw_names),
    'broom_primary_groups': meta['broom_primary_groups'],
    'broom_straw_role_counts': meta['broom_straw_role_counts'],
    'broom_length_clusters': meta['broom_length_clusters'],
    'broom_straw_substrands_per_clump': meta['broom_straw_substrands_per_clump'],
    'root_width': root_width,
    'root_center_x': root_center_x,
    'mid_width': mid_width,
    'tail_width': tail_width,
    'length_family_counts': family_counts.tolist(),
    'tip_length_range': float(np.ptp(clump_low_y)),
    'primary_tip_x': primary_tip_x.tolist(),
    'primary_tip_y': primary_tip_y.tolist(),
    'primary_curve_delta': curve_delta.tolist(),
    'mirror_length_delta': mirror_length_delta.tolist(),
    'full_root_bristles_geometry': full_root_count,
    'straw_span': straw_span.tolist(),
    'bristle_span': bristle_span.tolist(),
    'primary_median_volume': primary_median,
    'secondary_median_volume': secondary_median,
    'edge_median_volume': edge_median,
    'median_bristle_volume': float(np.median(bristle_volumes)),
    'p95_component_equiv_radius': float(np.percentile(component_radii, 95)),
    'p95_component_volume': float(np.percentile(component_volumes, 95)),
    'readability_width': readability_width,
    'boot_centers_x': [boot_l_x, boot_r_x],
}, indent=2))
