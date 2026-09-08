from __future__ import annotations

import json
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

assert meta['broom_bristles'] == 240
assert meta['broom_straw_clumps'] == 56
assert meta['broom_primary_groups'] == 8
assert meta['broom_geometry_workflow_version'] == 'hierarchy-v4-rearward-camera-flow'
assert meta['broom_flow_axis'] == '+Z toward chase camera/player'
assert meta['broom_flow_authored'] is True
assert meta['broom_straw_substrands_per_clump'] == 1
assert meta['broom_straw_role_counts'] == {'primary': 8, 'secondary': 56, 'tertiary': 240}
assert meta['broom_length_clusters'] == 6
assert len(meta['broom_length_family_counts']) == 6
assert sum(meta['broom_length_family_counts']) == 56
assert min(meta['broom_length_family_counts']) >= 8
assert meta['broom_full_root_clumps'] == 8
assert meta['broom_full_root_bristles'] == 48
assert meta['broom_flyaway_bristles'] == 40
assert 0.26 <= meta['broom_root_compression_fraction'] <= 0.30
assert meta['broom_material_ready'] is False
assert meta['broom_straw_workflow'] == 'grouped authored straw mass first; fine bristles are secondary breakup only'
assert meta['broom_straw_shape'] == 'tight bound root; dense middle body; rearward flare toward player; clustered tapered tips; shallow secondary sag'

scene = trimesh.load(MODEL, force='scene')
nodes = set(scene.graph.nodes)
primary_names = sorted(n for n in nodes if re.fullmatch(r'straw_primary_\d{2}', n))
straw_names = sorted(n for n in nodes if re.fullmatch(r'straw_mass_\d{2}', n))
bristle_names = sorted(n for n in nodes if re.fullmatch(r'bristle_\d{3}', n))
assert len(primary_names) == 8, len(primary_names)
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


primary_meshes = [mesh_world(n) for n in primary_names]
straw_meshes = [mesh_world(n) for n in straw_names]
bristle_meshes = [mesh_world(n) for n in bristle_names]

for name, mesh in zip(primary_names, primary_meshes):
    assert mesh.is_watertight, name
    assert len(mesh.vertices) >= 24, (name, len(mesh.vertices))
    assert len(mesh.faces) >= 45, (name, len(mesh.faces))
    assert np.isfinite(mesh.vertices).all(), name
    span = np.ptp(mesh.vertices, axis=0)
    assert float(span[2]) >= float(span[1]) * 4.0, (name, span)

for name, mesh in zip(straw_names, straw_meshes):
    assert mesh.is_watertight, name
    assert len(mesh.vertices) >= 12, (name, len(mesh.vertices))
    assert len(mesh.faces) >= 20, (name, len(mesh.faces))
    assert np.isfinite(mesh.vertices).all(), name
    span = np.ptp(mesh.vertices, axis=0)
    assert float(span[2]) >= float(span[1]) * 4.0, (name, span)
    zmax = float(mesh.vertices[:, 2].max())
    tip = mesh.vertices[mesh.vertices[:, 2] >= zmax - 0.045]
    assert len(tip) >= 4, (name, len(tip))
    assert float(np.ptp(tip[:, 0])) <= 0.020, (name, np.ptp(tip[:, 0]))
    assert float(np.ptp(tip[:, 1])) <= 0.016, (name, np.ptp(tip[:, 1]))

for name, mesh in zip(bristle_names, bristle_meshes):
    assert mesh.is_watertight, name
    assert len(mesh.vertices) >= 25, (name, len(mesh.vertices))
    assert len(mesh.faces) >= 45, (name, len(mesh.faces))
    assert np.isfinite(mesh.vertices).all(), name
    span = np.ptp(mesh.vertices, axis=0)
    assert float(span[2]) >= float(span[1]) * 3.8, (name, span)

primary = np.vstack([m.vertices for m in primary_meshes])
straw = np.vstack([m.vertices for m in straw_meshes])
bristles = np.vstack([m.vertices for m in bristle_meshes])
all_straw = np.vstack([primary, straw])
primary_span = np.ptp(primary, axis=0)
straw_span = np.ptp(straw, axis=0)
bristle_span = np.ptp(bristles, axis=0)

# Primary core becomes broad quickly but its dominant authored direction is rearward +Z.
assert primary_span[0] >= 1.85, primary_span
assert primary_span[2] >= 2.15, primary_span
assert primary_span[1] <= 0.48, primary_span
assert primary_span[2] >= primary_span[1] * 5.0, primary_span

# Secondary ribbons and tertiary bristles carry a long camera-facing tail with shallow sag.
assert straw_span[0] >= 2.55, straw_span
assert straw_span[2] >= 5.05, straw_span
assert straw_span[1] <= 0.82, straw_span
assert bristle_span[0] >= 2.45, bristle_span
assert bristle_span[2] >= 5.05, bristle_span
assert bristle_span[1] <= 0.86, bristle_span
assert straw_span[2] >= straw_span[1] * 6.0, straw_span
assert bristle_span[2] >= bristle_span[1] * 6.0, bristle_span
assert bristle_span[0] <= straw_span[0] * 1.18, (straw_span, bristle_span)
assert bristle_span[2] <= straw_span[2] * 1.14, (straw_span, bristle_span)
assert float(all_straw[:, 1].min()) > -1.08, all_straw[:, 1].min()

# Tight compressed root stays centered between the approved two-boot silhouette.
root_band = all_straw[
    (all_straw[:, 2] >= 1.48)
    & (all_straw[:, 2] <= 1.98)
    & (all_straw[:, 1] >= -0.52)
    & (all_straw[:, 1] <= -0.22)
]
assert len(root_band) >= 100, len(root_band)
root_width = float(np.ptp(root_band[:, 0]))
root_center_x = float(np.mean(root_band[:, 0]))
assert root_width <= 0.34, root_width
assert -0.02 <= root_center_x <= 0.28, root_center_x

boot_l = mesh_world('boot_L')
boot_r = mesh_world('boot_R')
boot_l_x = float(boot_l.centroid[0])
boot_r_x = float(boot_r.centroid[0])
assert boot_l_x < -0.25 and boot_r_x > 0.25
assert boot_r_x - boot_l_x >= 0.70
assert boot_l_x < root_center_x < boot_r_x

# The middle body must become broad and dense early, not branch into isolated fingers.
mid_band = all_straw[
    (all_straw[:, 2] >= 2.35)
    & (all_straw[:, 2] <= 4.15)
    & (all_straw[:, 1] >= -0.78)
    & (all_straw[:, 1] <= -0.25)
]
assert len(mid_band) >= 450, len(mid_band)
mid_width = float(np.ptp(mid_band[:, 0]))
assert mid_width >= 1.80, mid_width
assert mid_width >= root_width * 5.5, (root_width, mid_width)

# Six terminal rearward-length families break the camera-facing edge; no even comb line.
length_targets = np.array([5.02, 5.34, 5.68, 6.04, 6.39, 6.76], dtype=float)
clump_high_z = np.asarray([float(m.vertices[:, 2].max()) for m in straw_meshes])
nearest_family = np.argmin(np.abs(clump_high_z[:, None] - length_targets[None, :]), axis=1)
nearest_error = np.min(np.abs(clump_high_z[:, None] - length_targets[None, :]), axis=1)
assert float(np.max(nearest_error)) <= 0.17, float(np.max(nearest_error))
family_counts = np.bincount(nearest_family, minlength=6)
assert np.all(family_counts >= 7), family_counts
assert float(np.ptp(clump_high_z)) >= 1.60, np.ptp(clump_high_z)
assert float(np.std(clump_high_z)) >= 0.50, np.std(clump_high_z)

# Secondary clumps fill a continuous width rather than collapsing into eight branch axes.
tip_x = []
for mesh in straw_meshes:
    zmax = float(mesh.vertices[:, 2].max())
    tip = mesh.vertices[mesh.vertices[:, 2] >= zmax - 0.045]
    tip_x.append(float(np.mean(tip[:, 0])))
tip_x = np.asarray(tip_x)
quantized_tip_bins = len(set(np.round(tip_x / 0.06).astype(int).tolist()))
assert float(np.ptp(tip_x)) >= 2.45, np.ptp(tip_x)
assert quantized_tip_bins >= 30, quantized_tip_bins

# Hierarchy is physical: broad core > flattened clumps > fine tertiary bristles.
primary_volumes = np.asarray([abs(float(m.volume)) for m in primary_meshes])
straw_volumes = np.asarray([abs(float(m.volume)) for m in straw_meshes])
bristle_volumes = np.asarray([abs(float(m.volume)) for m in bristle_meshes])
primary_median = float(np.median(primary_volumes))
straw_median = float(np.median(straw_volumes))
bristle_median = float(np.median(bristle_volumes))
assert primary_median >= straw_median * 2.5, (primary_median, straw_median)
assert straw_median >= bristle_median * 6.0, (straw_median, bristle_median)

# Only the intended minority of tertiary bristles may originate at the bound root.
full_root_count = sum(float(m.vertices[:, 2].min()) < 1.70 for m in bristle_meshes)
assert 45 <= full_root_count <= 51, full_root_count

# Large tail silhouette stays broad while its dominant displacement points toward player/camera.
tail = np.vstack([straw[straw[:, 2] >= 4.80], bristles[bristles[:, 2] >= 4.80]])
assert len(tail) >= 900, len(tail)
tail_width = float(np.ptp(tail[:, 0]))
assert tail_width >= 2.50, tail_width
rearward_span = float(max(straw[:, 2].max(), bristles[:, 2].max()) - min(straw[:, 2].min(), bristles[:, 2].min()))
vertical_span = float(max(straw[:, 1].max(), bristles[:, 1].max()) - min(straw[:, 1].min(), bristles[:, 1].min()))
assert rearward_span >= 5.05, rearward_span
assert vertical_span <= 0.88, vertical_span
assert rearward_span >= vertical_span * 6.0, (rearward_span, vertical_span)
readability_band = all_straw[
    (all_straw[:, 2] >= 1.48)
    & (all_straw[:, 2] <= 2.02)
    & (all_straw[:, 1] >= -0.54)
]
readability_width = float(np.ptp(readability_band[:, 0]))
assert readability_width <= 0.36, readability_width

# No materials yet: every authored straw mesh stays neutral clay.
for mesh in primary_meshes + straw_meshes + bristle_meshes:
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
    'workflow': meta['broom_geometry_workflow_version'],
    'flow_axis': meta['broom_flow_axis'],
    'broom_primary_groups': len(primary_names),
    'broom_straw_clumps': len(straw_names),
    'broom_bristles': len(bristle_names),
    'primary_span': primary_span.tolist(),
    'straw_span': straw_span.tolist(),
    'bristle_span': bristle_span.tolist(),
    'rearward_span': rearward_span,
    'vertical_span': vertical_span,
    'rearward_to_vertical_ratio': rearward_span / max(vertical_span, 1e-6),
    'root_width': root_width,
    'root_center_x': root_center_x,
    'mid_width': mid_width,
    'tail_width': tail_width,
    'length_family_counts': family_counts.tolist(),
    'tip_length_range': float(np.ptp(clump_high_z)),
    'tip_length_std': float(np.std(clump_high_z)),
    'tip_x_span': float(np.ptp(tip_x)),
    'tip_x_bins': quantized_tip_bins,
    'primary_median_volume': primary_median,
    'straw_median_volume': straw_median,
    'bristle_median_volume': bristle_median,
    'full_root_bristles_geometry': full_root_count,
    'readability_width': readability_width,
    'boot_centers_x': [boot_l_x, boot_r_x],
}, indent=2))
