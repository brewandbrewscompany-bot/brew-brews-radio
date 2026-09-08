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
assert meta['broom_bristles'] == 240, meta['broom_bristles']
assert meta['broom_straw_clumps'] == 56, meta['broom_straw_clumps']
assert meta['broom_primary_groups'] == 8, meta['broom_primary_groups']
assert 0.26 <= meta['broom_root_compression_fraction'] <= 0.30, meta['broom_root_compression_fraction']
assert meta['broom_material_ready'] is False
assert meta['broom_straw_workflow'] == 'grouped authored straw mass first; fine bristles are secondary breakup only'
assert meta['broom_straw_shape'] == 'tight bound root; full dense middle body; broad gradual flare; irregular clustered tapered tips'

scene = trimesh.load(MODEL, force='scene')
nodes = set(scene.graph.nodes)
straw_names = sorted(n for n in nodes if re.fullmatch(r'straw_mass_\d{2}', n))
bristle_names = sorted(n for n in nodes if re.fullmatch(r'bristle_\d{3}', n))
assert len(straw_names) == 56, len(straw_names)
assert len(bristle_names) == 240, len(bristle_names)
assert 'broom_bristles' in nodes
assert 'broom_shaft' in nodes
assert len([n for n in nodes if re.fullmatch(r'hair_main_\d{2}', n)]) == 14
assert len([n for n in nodes if re.fullmatch(r'hair_overlap_\d{2}', n)]) == 8
for required in ('leg_L', 'leg_R', 'boot_L', 'boot_R', 'hat_tip', 'cape'):
    assert required in nodes, required


def mesh_world(name: str) -> trimesh.Trimesh:
    transform, geometry = scene.graph[name]
    mesh = scene.geometry[geometry].copy()
    mesh.apply_transform(transform)
    return mesh


straw_meshes = [mesh_world(name) for name in straw_names]
bristle_meshes = [mesh_world(name) for name in bristle_names]

for name, mesh in zip(straw_names, straw_meshes):
    assert mesh.is_watertight, name
    assert len(mesh.vertices) >= 80, (name, len(mesh.vertices))
    assert len(mesh.faces) >= 150, (name, len(mesh.faces))
    assert np.isfinite(mesh.vertices).all(), name

for name, mesh in zip(bristle_names, bristle_meshes):
    assert mesh.is_watertight, name
    assert len(mesh.vertices) >= 38, (name, len(mesh.vertices))
    assert len(mesh.faces) >= 70, (name, len(mesh.faces))
    assert np.isfinite(mesh.vertices).all(), name

straw = np.vstack([mesh.vertices for mesh in straw_meshes])
bristles = np.vstack([mesh.vertices for mesh in bristle_meshes])
straw_span = np.ptp(straw, axis=0)
bristle_span = np.ptp(bristles, axis=0)

# The tail must have the large, full silhouette visible in the supplied rear-view
# reference. A narrow tassel or wire spray is rejected even if strand counts are high.
assert straw_span[0] >= 1.70, straw_span
assert straw_span[1] >= 1.75, straw_span
assert straw_span[2] >= 1.55, straw_span
assert bristle_span[0] >= 1.70, bristle_span
assert bristle_span[1] >= 1.75, bristle_span
assert bristle_span[2] >= 1.55, bristle_span

# Root compression gate: directly below the binding, the tail stays narrow so the
# legs and two boots remain readable before the straw fan opens.
root_band = straw[(straw[:, 2] >= 1.48) & (straw[:, 2] <= 1.96)]
assert len(root_band) > 500, len(root_band)
root_width = float(np.ptp(root_band[:, 0]))
assert root_width <= 0.48, root_width

# The middle body must become substantial after the compact root. This prevents the
# previous cone/tassel result and forces a strong broom-shaped body.
mid_band = straw[(straw[:, 2] >= 2.20) & (straw[:, 2] <= 2.72)]
assert len(mid_band) > 600, len(mid_band)
mid_width = float(np.ptp(mid_band[:, 0]))
assert mid_width >= 1.15, mid_width
assert mid_width >= root_width * 3.5, (root_width, mid_width)

# Tips remain broad, but their lengths are intentionally irregular and clustered.
tip_band = straw[straw[:, 2] >= 2.88]
assert len(tip_band) > 400, len(tip_band)
tip_width = float(np.ptp(tip_band[:, 0]))
assert tip_width >= 1.60, tip_width
assert tip_width >= mid_width * 1.18, (mid_width, tip_width)
clump_low_y = np.asarray([float(mesh.vertices[:, 1].min()) for mesh in straw_meshes])
assert float(np.ptp(clump_low_y)) >= 0.34, np.ptp(clump_low_y)
assert float(np.std(clump_low_y)) >= 0.10, np.std(clump_low_y)

# Broad straw clumps must carry the visible mass. Fine bristles are secondary breakup.
straw_volumes = np.asarray([abs(float(mesh.volume)) for mesh in straw_meshes])
bristle_volumes = np.asarray([abs(float(mesh.volume)) for mesh in bristle_meshes])
assert np.median(straw_volumes) >= np.median(bristle_volumes) * 14.0, (
    float(np.median(straw_volumes)),
    float(np.median(bristle_volumes)),
)
assert np.percentile(straw_volumes, 25) > 0.0025, np.percentile(straw_volumes, 25)

# Protect lower-body chase readability: only the compressed root occupies this zone.
readability_band = straw[(straw[:, 1] >= -0.50) & (straw[:, 1] <= -0.15) & (straw[:, 2] <= 2.08)]
assert len(readability_band) > 300, len(readability_band)
readability_width = float(np.ptp(readability_band[:, 0]))
assert readability_width <= 0.52, readability_width

# Material work remains blocked; this is still neutral-clay geometry review.
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
    'root_width': root_width,
    'mid_width': mid_width,
    'tip_width': tip_width,
    'tip_length_range': float(np.ptp(clump_low_y)),
    'tip_length_std': float(np.std(clump_low_y)),
    'straw_span': straw_span.tolist(),
    'bristle_span': bristle_span.tolist(),
    'median_straw_volume': float(np.median(straw_volumes)),
    'median_bristle_volume': float(np.median(bristle_volumes)),
    'readability_width': readability_width,
}, indent=2))
