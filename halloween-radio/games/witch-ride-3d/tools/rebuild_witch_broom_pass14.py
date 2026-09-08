from __future__ import annotations

import json
import math
import re
from pathlib import Path

import numpy as np
import trimesh
from trimesh.visual.material import PBRMaterial

ROOT = Path(__file__).resolve().parents[1]
MODEL = ROOT / 'assets' / 'models' / 'witch-rider.glb'
MANIFEST = ROOT / 'assets' / 'witch-mesh-pass14.json'

CLAY = PBRMaterial(
    name='neutral_clay_mesh_review',
    baseColorFactor=[0.47, 0.45, 0.43, 1.0],
    metallicFactor=0.0,
    roughnessFactor=1.0,
)


def clean(mesh: trimesh.Trimesh) -> trimesh.Trimesh:
    mesh.remove_unreferenced_vertices()
    try:
        mesh.merge_vertices()
    except Exception:
        pass
    try:
        mesh.fix_normals(multibody=True)
    except TypeError:
        mesh.fix_normals()
    mesh.visual.material = CLAY
    return mesh


def add(scene: trimesh.Scene, mesh: trimesh.Trimesh, name: str, parent: str = 'broom_bristles') -> trimesh.Trimesh:
    clean(mesh)
    scene.add_geometry(mesh, node_name=name, geom_name=name, parent_node_name=parent)
    return mesh


def remove_named(scene: trimesh.Scene, name: str) -> None:
    if name in scene.geometry:
        scene.delete_geometry(name)
    try:
        if name in scene.graph.nodes:
            scene.graph.transforms.remove_node(name)
    except Exception:
        pass


def ribbon_shell(points, widths, depths) -> trimesh.Trimesh:
    """Broad flattened lock with its cross-section perpendicular to rearward +Z flow."""
    pts = np.asarray(points, dtype=float)
    widths = np.asarray(widths, dtype=float)
    depths = np.asarray(depths, dtype=float)
    assert len(pts) == len(widths) == len(depths)
    verts = []
    for p, w, d in zip(pts, widths, depths):
        x, y, z = p
        verts.extend([
            [x - w, y - d, z],
            [x + w, y - d, z],
            [x + w, y + d, z],
            [x - w, y + d, z],
        ])
    faces = []
    for i in range(len(pts) - 1):
        a = i * 4
        b = (i + 1) * 4
        for j in range(4):
            n = (j + 1) % 4
            faces.extend([[a + j, b + j, a + n], [a + n, b + j, b + n]])
    faces.extend([[0, 2, 1], [0, 3, 2]])
    q = (len(pts) - 1) * 4
    faces.extend([[q, q + 1, q + 2], [q, q + 2, q + 3]])
    return trimesh.Trimesh(vertices=np.asarray(verts), faces=np.asarray(faces), process=True)


def tube_mesh(points, radii, sections: int = 8) -> trimesh.Trimesh:
    pts = np.asarray(points, dtype=float)
    radii = np.asarray(radii, dtype=float)
    verts = []
    previous_normal = None
    for i, point in enumerate(pts):
        if i == 0:
            tangent = pts[1] - pts[0]
        elif i == len(pts) - 1:
            tangent = pts[-1] - pts[-2]
        else:
            tangent = pts[i + 1] - pts[i - 1]
        tangent /= np.linalg.norm(tangent)
        ref = np.array([0.0, 1.0, 0.0]) if abs(tangent[1]) < 0.84 else np.array([1.0, 0.0, 0.0])
        n1 = np.cross(tangent, ref)
        n1 /= np.linalg.norm(n1)
        if previous_normal is not None and np.dot(n1, previous_normal) < 0:
            n1 = -n1
        n2 = np.cross(tangent, n1)
        n2 /= np.linalg.norm(n2)
        previous_normal = n1
        for j in range(sections):
            a = 2.0 * math.pi * j / sections
            verts.append(point + radii[i] * (math.cos(a) * n1 + math.sin(a) * n2))
    faces = []
    for i in range(len(pts) - 1):
        a0 = i * sections
        b0 = (i + 1) * sections
        for j in range(sections):
            n = (j + 1) % sections
            faces.extend([[a0 + j, b0 + j, a0 + n], [a0 + n, b0 + j, b0 + n]])
    first = len(verts)
    verts.append(pts[0])
    last = len(verts)
    verts.append(pts[-1])
    for j in range(sections):
        n = (j + 1) % sections
        faces.append([first, n, j])
        base = (len(pts) - 1) * sections
        faces.append([last, base + j, base + n])
    return trimesh.Trimesh(vertices=np.asarray(verts), faces=np.asarray(faces), process=True)


def flow_points(tip_x: float, tip_y: float, tip_z: float, curve: float, root_jitter: float = 0.0):
    """Author the broom already streaming toward the chase camera (+Z); Y is secondary sag only."""
    root_x = 0.14 + root_jitter
    root_y = -0.34
    root_z = 1.58
    dx = tip_x - root_x
    dy = tip_y - root_y
    dz = tip_z - root_z
    return np.asarray([
        [root_x, root_y, root_z],
        [root_x + 0.08 * dx, root_y + 0.05 * dy, root_z + 0.10 * dz],
        [root_x + 0.24 * dx + 0.03 * curve, root_y + 0.13 * dy, root_z + 0.25 * dz],
        [root_x + 0.48 * dx + 0.08 * curve, root_y + 0.27 * dy, root_z + 0.45 * dz],
        [root_x + 0.72 * dx + 0.12 * curve, root_y + 0.48 * dy, root_z + 0.66 * dz],
        [root_x + 0.90 * dx + 0.10 * curve, root_y + 0.74 * dy, root_z + 0.84 * dz],
        [tip_x, tip_y, tip_z],
    ], dtype=float)


def main() -> None:
    assert MODEL.exists(), MODEL
    assert MANIFEST.exists(), MANIFEST
    scene = trimesh.load(MODEL, force='scene', process=False)
    before = set(scene.graph.nodes)

    assert 'broom_bristles' in before and 'broom_shaft' in before
    assert len([n for n in before if re.fullmatch(r'bristle_\d{3}', n)]) == 240
    assert len([n for n in before if re.fullmatch(r'straw_mass_\d{2}', n)]) == 56
    assert len([n for n in before if re.fullmatch(r'hair_main_\d{2}', n)]) == 14
    assert len([n for n in before if re.fullmatch(r'hair_overlap_\d{2}', n)]) == 8
    for required in ('leg_L', 'leg_R', 'boot_L', 'boot_R', 'hat_tip', 'cape'):
        assert required in before, required

    for name in list(before):
        if (
            re.fullmatch(r'bristle_\d{3}', name)
            or re.fullmatch(r'straw_mass_\d{2}', name)
            or re.fullmatch(r'straw_primary_\d{2}', name)
        ):
            remove_named(scene, name)

    # Eight broad core locks establish the silhouette immediately behind the bound root.
    lane_x = np.array([-0.96, -0.70, -0.45, -0.17, 0.12, 0.40, 0.69, 0.98], dtype=float)
    lane_drift = np.array([-0.08, 0.05, -0.06, 0.04, -0.03, 0.07, -0.04, 0.09], dtype=float)
    for i, (lane, drift) in enumerate(zip(lane_x, lane_drift), start=1):
        yoff = 0.035 * math.sin(i * 0.91)
        path = np.asarray([
            [0.14 + 0.018 * lane, -0.34 + yoff * 0.10, 1.58],
            [0.14 + 0.070 * lane, -0.35 + yoff * 0.20, 1.88],
            [0.14 + 0.26 * lane, -0.38 + yoff * 0.35, 2.25],
            [0.14 + 0.56 * lane + 0.03 * drift, -0.42 + yoff * 0.55, 2.68],
            [0.14 + 0.82 * lane + 0.07 * drift, -0.48 + yoff * 0.75, 3.10],
            [0.14 + 0.98 * lane + 0.11 * drift, -0.55 + yoff, 3.48],
            [0.14 + 1.02 * lane + 0.13 * drift, -0.62 + 0.025 * math.sin(i), 3.78],
        ])
        widths = np.array([0.050, 0.075, 0.135, 0.220, 0.260, 0.205, 0.055])
        depths = np.array([0.016, 0.020, 0.028, 0.038, 0.044, 0.032, 0.010])
        add(scene, ribbon_shell(path, widths, depths), f'straw_primary_{i:02d}')

    # Six rearward length families make clustered irregular tips without a downward tassel.
    length_z = np.array([5.02, 5.34, 5.68, 6.04, 6.39, 6.76], dtype=float)
    sag_y = np.array([-0.62, -0.68, -0.73, -0.79, -0.85, -0.91], dtype=float)
    family_counts = np.zeros(6, dtype=int)
    full_root_clumps = 0
    for i in range(56):
        u = -1.0 + 2.0 * (i + 0.5) / 56.0
        phase = i * 1.173
        family = i % 6
        family_counts[family] += 1
        curve = 0.18 * math.sin(phase * 0.73) + 0.06 * math.sin(phase * 1.91)
        tip_x = 0.14 + 1.30 * u + 0.11 * math.sin(phase)
        tip_y = sag_y[family] + 0.045 * math.sin(phase * 1.29) + 0.018 * ((i % 3) - 1)
        tip_z = length_z[family] + 0.075 * math.sin(phase * 0.61) + 0.05 * (1.0 - abs(u))
        path = flow_points(tip_x, tip_y, tip_z, curve, root_jitter=0.012 * math.sin(phase))
        start_mode = i % 7
        start_index = 0 if start_mode == 0 else (1 if start_mode in (1, 2) else (2 if start_mode in (3, 4) else 3))
        if start_index == 0:
            full_root_clumps += 1
        path = path[start_index:]
        full_w = np.array([0.020, 0.030, 0.046, 0.058, 0.052, 0.030, 0.0026])
        full_d = np.array([0.006, 0.008, 0.011, 0.014, 0.013, 0.008, 0.0015])
        width_bias = 0.88 + 0.18 * (1.0 - abs(u)) + 0.05 * math.sin(phase)
        add(scene, ribbon_shell(path, full_w[start_index:] * width_bias, full_d[start_index:] * width_bias), f'straw_mass_{i + 1:02d}')

    full_root_bristles = 0
    flyaway_bristles = 0
    for i in range(240):
        perm = (i * 97) % 240
        u = -1.0 + 2.0 * (perm + 0.5) / 240.0
        phase = i * 0.437
        family = (i * 7 + i // 17) % 6
        start_mode = i % 5
        flyaway = (i % 6) == 0
        if start_mode == 0:
            full_root_bristles += 1
        if flyaway:
            flyaway_bristles += 1
        curve = 0.13 * math.sin(phase * 0.83) + 0.04 * math.sin(phase * 1.77)
        edge_push = (0.08 + 0.035 * (i % 3)) * (1.0 if u >= 0 else -1.0) if flyaway else 0.0
        tip_x = 0.14 + 1.28 * u + edge_push + 0.045 * math.sin(phase)
        tip_y = sag_y[family] + 0.035 * (i % 4) + 0.025 * math.sin(phase * 1.31)
        tip_z = length_z[family] - 0.08 + 0.08 * (i % 4) + 0.035 * math.sin(phase * 1.31)
        if flyaway:
            tip_x += 0.055 * (1.0 if u >= 0 else -1.0)
            tip_y -= 0.045 + 0.015 * (i % 3)
            tip_z += 0.18 + 0.035 * (i % 3)
        path = flow_points(tip_x, tip_y, tip_z, curve, root_jitter=0.008 * math.sin(phase))
        start_index = 0 if start_mode == 0 else (1 if start_mode == 1 else (2 if start_mode == 2 else 3))
        path = path[start_index:]
        radii = np.linspace(0.0036 if start_index <= 1 else 0.0030, 0.00055, len(path))
        add(scene, tube_mesh(path, radii, sections=8), f'bristle_{i + 1:03d}')

    assert int(family_counts.sum()) == 56
    assert np.all(family_counts >= 8), family_counts
    assert full_root_clumps == 8, full_root_clumps
    assert full_root_bristles == 48
    assert flyaway_bristles == 40

    after = set(scene.graph.nodes)
    assert len([n for n in after if re.fullmatch(r'straw_primary_\d{2}', n)]) == 8
    assert len([n for n in after if re.fullmatch(r'straw_mass_\d{2}', n)]) == 56
    assert len([n for n in after if re.fullmatch(r'bristle_\d{3}', n)]) == 240
    assert len([n for n in after if re.fullmatch(r'hair_main_\d{2}', n)]) == 14
    assert len([n for n in after if re.fullmatch(r'hair_overlap_\d{2}', n)]) == 8

    broom_meta = {
        'broom_straw_workflow': 'grouped authored straw mass first; fine bristles are secondary breakup only',
        'broom_geometry_workflow_version': 'hierarchy-v4-rearward-camera-flow',
        'broom_primary_groups': 8,
        'broom_root_compression_fraction': 0.28,
        'broom_straw_shape': 'tight bound root; dense middle body; rearward flare toward player; clustered tapered tips; shallow secondary sag',
        'broom_flow_axis': '+Z toward chase camera/player',
        'broom_flow_authored': True,
        'broom_straw_substrands_per_clump': 1,
        'broom_straw_role_counts': {'primary': 8, 'secondary': 56, 'tertiary': 240},
        'broom_length_clusters': 6,
        'broom_length_family_counts': family_counts.tolist(),
        'broom_full_root_clumps': full_root_clumps,
        'broom_full_root_bristles': 48,
        'broom_flyaway_bristles': 40,
        'broom_material_ready': False,
    }
    scene.metadata.update(broom_meta)

    blob = scene.export(file_type='glb')
    MODEL.write_bytes(blob)
    manifest = json.loads(MANIFEST.read_text(encoding='utf-8'))
    manifest.update({
        'broom_bristles': 240,
        'broom_straw_clumps': 56,
        **broom_meta,
        'bytes': len(blob),
        'nodes': len(after),
        'geometries': len(scene.geometry),
    })
    MANIFEST.write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({
        'ok': True,
        'bytes': len(blob),
        'broom_primary_groups': 8,
        'broom_straw_clumps': 56,
        'broom_bristles': 240,
        'broom_flow_axis': '+Z toward chase camera/player',
        'broom_length_family_counts': family_counts.tolist(),
        'broom_full_root_clumps': full_root_clumps,
        'broom_full_root_bristles': full_root_bristles,
        'broom_flyaway_bristles': flyaway_bristles,
        'hair_main_locks': 14,
        'hair_overlap_locks': 8,
    }, indent=2))


if __name__ == '__main__':
    main()
