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


def add(scene: trimesh.Scene, mesh: trimesh.Trimesh, name: str) -> trimesh.Trimesh:
    clean(mesh)
    scene.add_geometry(mesh, node_name=name, geom_name=name)
    return mesh


def remove_named(scene: trimesh.Scene, name: str) -> None:
    if name in scene.geometry:
        scene.delete_geometry(name)
    try:
        if name in scene.graph.nodes:
            scene.graph.transforms.remove_node(name)
    except Exception:
        pass


def organic_tube(scene: trimesh.Scene, points, rx, rz, name: str, sections: int = 40) -> trimesh.Trimesh:
    pts = np.asarray(points, dtype=float)
    count = len(pts)
    rx = np.asarray(rx if hasattr(rx, '__len__') else [rx] * count, dtype=float)
    rz = np.asarray(rz if hasattr(rz, '__len__') else [rz] * count, dtype=float)
    verts = []
    previous_normal = None
    for i, point in enumerate(pts):
        if i == 0:
            tangent = pts[1] - pts[0]
        elif i == count - 1:
            tangent = pts[-1] - pts[-2]
        else:
            tangent = pts[i + 1] - pts[i - 1]
        tangent /= np.linalg.norm(tangent)
        ref = np.array([0.0, 0.0, 1.0]) if abs(tangent[2]) < 0.82 else np.array([1.0, 0.0, 0.0])
        n1 = np.cross(tangent, ref)
        n1 /= np.linalg.norm(n1)
        if previous_normal is not None and np.dot(n1, previous_normal) < 0:
            n1 = -n1
        n2 = np.cross(tangent, n1)
        n2 /= np.linalg.norm(n2)
        previous_normal = n1
        for j in range(sections):
            angle = 2.0 * math.pi * j / sections
            scallop = 1.0 + 0.018 * math.sin(3.0 * angle + i * 0.57)
            verts.append(point + math.cos(angle) * rx[i] * scallop * n1 + math.sin(angle) * rz[i] * n2)
    faces = []
    for i in range(count - 1):
        a0 = i * sections
        b0 = (i + 1) * sections
        for j in range(sections):
            nxt = (j + 1) % sections
            faces += [[a0 + j, b0 + j, a0 + nxt], [a0 + nxt, b0 + j, b0 + nxt]]
    first_cap = len(verts)
    verts.append(pts[0])
    last_cap = len(verts)
    verts.append(pts[-1])
    for j in range(sections):
        nxt = (j + 1) % sections
        faces.append([first_cap, nxt, j])
        base = (count - 1) * sections
        faces.append([last_cap, base + j, base + nxt])
    return add(scene, trimesh.Trimesh(vertices=np.asarray(verts), faces=np.asarray(faces), process=True), name)


def main() -> None:
    assert MODEL.exists(), MODEL
    assert MANIFEST.exists(), MANIFEST
    scene = trimesh.load(MODEL, force='scene', process=False)
    nodes_before = set(scene.graph.nodes)

    # Preserve every approved Pass 14 system. This pass touches lower-body geometry only.
    assert len([n for n in nodes_before if re.fullmatch(r'hair_main_\d{2}', n)]) == 14
    assert len([n for n in nodes_before if re.fullmatch(r'hair_overlap_\d{2}', n)]) == 8
    assert len([n for n in nodes_before if re.fullmatch(r'bristle_\d{3}', n)]) == 240
    assert len([n for n in nodes_before if re.fullmatch(r'straw_mass_\d{2}', n)]) == 56
    required_roots = {
        'hair_01', 'hair_02', 'hair_03', 'hair_04', 'hair_05',
        'cape', 'cape_left', 'cape_center', 'cape_right',
        'hat_tip', 'broom_handle', 'broom_bristles',
    }
    assert not (required_roots - nodes_before), sorted(required_roots - nodes_before)

    for name in ('leg_L', 'leg_R', 'boot_L', 'boot_R'):
        remove_named(scene, name)

    # Match the supplied rear chase reference: thighs still grip the central broom,
    # knees are compact, but the calves and boots open only enough to remain visibly
    # distinct on both sides of the shaft/bundle in the actual gameplay camera.
    legs = {
        'L': [
            (-0.30, 0.70, -0.01),
            (-0.31, 0.63, 0.03),
            (-0.33, 0.53, 0.10),
            (-0.35, 0.39, 0.19),
            (-0.37, 0.23, 0.30),
            (-0.38, 0.05, 0.40),
            (-0.39, -0.15, 0.50),
            (-0.39, -0.34, 0.56),
            (-0.38, -0.48, 0.57),
        ],
        'R': [
            (0.30, 0.70, -0.01),
            (0.31, 0.63, 0.03),
            (0.33, 0.53, 0.10),
            (0.35, 0.39, 0.19),
            (0.37, 0.23, 0.30),
            (0.38, 0.05, 0.40),
            (0.39, -0.15, 0.50),
            (0.39, -0.34, 0.56),
            (0.38, -0.48, 0.57),
        ],
    }

    # Full upper-leg mass with a clear knee and tapered calf. Keep the silhouette
    # human, not inflated tubes, while preserving the tight riding posture.
    leg_rx = [0.270, 0.282, 0.292, 0.286, 0.270, 0.246, 0.216, 0.186, 0.162]
    leg_rz = [0.258, 0.270, 0.280, 0.275, 0.260, 0.236, 0.208, 0.180, 0.158]

    boot_centers = {}
    for side, points in legs.items():
        organic_tube(scene, points, leg_rx, leg_rz, f'leg_{side}', sections=40)
        ankle = np.asarray(points[-1], dtype=float)
        sign = -1.0 if side == 'L' else 1.0

        # Do not tuck the boots behind the broom. They trail close and parallel,
        # but offset slightly outward so both remain readable from the chase camera.
        heel = ankle + np.array([0.030 * sign, -0.195, 0.050])
        sole = heel + np.array([0.018 * sign, -0.080, -0.060])
        toe = sole + np.array([0.012 * sign, 0.000, -0.285])
        boot = organic_tube(
            scene,
            [tuple(ankle), tuple(heel), tuple(sole), tuple(toe)],
            [0.184, 0.198, 0.192, 0.154],
            [0.178, 0.188, 0.174, 0.136],
            f'boot_{side}',
            sections=36,
        )
        boot_centers[side] = float(boot.bounds.mean(axis=0)[0])

    scene.metadata.update({
        'lower_body_workflow': 'reference-matched compact seated straddle authored in mesh; no runtime pose correction',
        'lower_body_pose': 'pelvis centered on broom; thighs grip; knees compact; two calves and boots remain readable beside broom',
        'lower_body_leg_mass': 'full thighs with tapered knees and calves; no column silhouette',
        'lower_body_runtime_physics': False,
    })

    nodes_after = set(scene.graph.nodes)
    assert all(name in nodes_after for name in ('leg_L', 'leg_R', 'boot_L', 'boot_R'))
    assert len([n for n in nodes_after if re.fullmatch(r'hair_main_\d{2}', n)]) == 14
    assert len([n for n in nodes_after if re.fullmatch(r'hair_overlap_\d{2}', n)]) == 8
    assert len([n for n in nodes_after if re.fullmatch(r'bristle_\d{3}', n)]) == 240
    assert len([n for n in nodes_after if re.fullmatch(r'straw_mass_\d{2}', n)]) == 56

    blob = scene.export(file_type='glb')
    MODEL.write_bytes(blob)

    manifest = json.loads(MANIFEST.read_text(encoding='utf-8'))
    manifest.update({
        'lower_body_workflow': 'reference-matched compact seated straddle authored in mesh; no runtime pose correction',
        'lower_body_pose': 'pelvis centered on broom; thighs grip; knees compact; two calves and boots remain readable beside broom',
        'lower_body_leg_mass': 'full thighs with tapered knees and calves; no column silhouette',
        'lower_body_runtime_physics': False,
        'lower_body_max_knee_center_x': 0.37,
        'lower_body_ankle_center_x': 0.38,
        'lower_body_boot_center_x': round(max(abs(v) for v in boot_centers.values()), 3),
        'lower_body_reference': 'approved rear chase reference: tight upper straddle with two distinct close parallel boots around central broom',
        'bytes': len(blob),
        'nodes': len(nodes_after),
        'geometries': len(scene.geometry),
    })
    MANIFEST.write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')

    print(json.dumps({
        'ok': True,
        'bytes': len(blob),
        'nodes': len(nodes_after),
        'geometries': len(scene.geometry),
        'lower_body_pose': manifest['lower_body_pose'],
        'max_knee_center_x': manifest['lower_body_max_knee_center_x'],
        'ankle_center_x': manifest['lower_body_ankle_center_x'],
        'boot_center_x': manifest['lower_body_boot_center_x'],
        'hair_main_locks': 14,
        'hair_overlap_locks': 8,
        'broom_bristles': 240,
        'broom_straw_clumps': 56,
    }, indent=2))


if __name__ == '__main__':
    main()
