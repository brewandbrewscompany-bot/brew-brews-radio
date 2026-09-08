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


def add(scene: trimesh.Scene, mesh: trimesh.Trimesh, name: str, parent: str) -> trimesh.Trimesh:
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


def tube_mesh(points, rx, rz, sections: int = 10) -> trimesh.Trimesh:
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
            scallop = 1.0 + 0.012 * math.sin(3.0 * angle + i * 0.51)
            verts.append(
                point
                + math.cos(angle) * rx[i] * scallop * n1
                + math.sin(angle) * rz[i] * n2
            )

    faces = []
    for i in range(count - 1):
        a0 = i * sections
        b0 = (i + 1) * sections
        for j in range(sections):
            nxt = (j + 1) % sections
            faces += [
                [a0 + j, b0 + j, a0 + nxt],
                [a0 + nxt, b0 + j, b0 + nxt],
            ]

    first_cap = len(verts)
    verts.append(pts[0])
    last_cap = len(verts)
    verts.append(pts[-1])
    for j in range(sections):
        nxt = (j + 1) % sections
        faces.append([first_cap, nxt, j])
        base = (count - 1) * sections
        faces.append([last_cap, base + j, base + nxt])

    return trimesh.Trimesh(vertices=np.asarray(verts), faces=np.asarray(faces), process=True)


def organic_tube(scene, points, rx, rz, name, parent='broom_bristles', sections=10):
    return add(scene, tube_mesh(points, rx, rz, sections), name, parent)


def clump_role(local: int) -> str:
    if local == 3:
        return 'primary'
    if local in (1, 2, 4, 5):
        return 'secondary'
    return 'edge'


def main() -> None:
    assert MODEL.exists(), MODEL
    assert MANIFEST.exists(), MANIFEST

    scene = trimesh.load(MODEL, force='scene', process=False)
    nodes_before = set(scene.graph.nodes)

    # Broom-tail-only pass. Preserve approved witch, hair, lower body, cape and hat.
    assert 'broom_bristles' in nodes_before
    assert 'broom_shaft' in nodes_before
    assert len([n for n in nodes_before if re.fullmatch(r'bristle_\d{3}', n)]) == 240
    assert len([n for n in nodes_before if re.fullmatch(r'straw_mass_\d{2}', n)]) == 56
    assert len([n for n in nodes_before if re.fullmatch(r'hair_main_\d{2}', n)]) == 14
    assert len([n for n in nodes_before if re.fullmatch(r'hair_overlap_\d{2}', n)]) == 8
    for required in ('leg_L', 'leg_R', 'boot_L', 'boot_R', 'hat_tip', 'cape'):
        assert required in nodes_before, required

    for name in list(nodes_before):
        if re.fullmatch(r'bristle_\d{3}', name) or re.fullmatch(r'straw_mass_\d{2}', name):
            remove_named(scene, name)

    # Large handmade broom envelope. Eight overlapping directional masses establish
    # the broad shape, but each of their seven clumps belongs to a different length
    # family so no directional group terminates as a blunt tassel finger.
    base = np.array([0.14, -0.34, 1.58], dtype=float)
    group_x = np.array([-1.12, -0.84, -0.61, -0.30, 0.09, 0.41, 0.74, 1.04], dtype=float)
    group_drift = np.array([-0.24, 0.10, -0.18, 0.12, -0.07, 0.18, -0.10, 0.23], dtype=float)
    group_curve = np.array([-0.15, 0.09, -0.17, 0.11, -0.08, 0.15, -0.09, 0.17], dtype=float)
    group_tip_z = np.array([3.38, 3.14, 3.48, 3.22, 3.52, 3.18, 3.43, 3.28], dtype=float)
    length_y = np.array([-2.74, -2.96, -3.25, -3.56, -3.90, -4.26], dtype=float)
    length_family = np.array([
        [1, 2, 3, 4, 2, 5, 3],
        [2, 1, 4, 3, 5, 2, 0],
        [4, 3, 5, 2, 1, 4, 3],
        [0, 2, 3, 5, 4, 1, 2],
        [3, 4, 1, 2, 5, 3, 0],
        [5, 2, 4, 1, 3, 0, 2],
        [2, 5, 3, 4, 1, 2, 5],
        [1, 3, 0, 5, 2, 4, 3],
    ], dtype=int)
    local_length = np.array([-0.05, 0.04, -0.03, 0.00, 0.07, -0.04, 0.10], dtype=float)
    sub_length = np.array([-0.16, -0.05, 0.07, 0.16], dtype=float)

    role_counts = {'primary': 0, 'secondary': 0, 'edge': 0}
    straw_index = 0
    for group in range(8):
        gx = float(group_x[group])
        drift = float(group_drift[group])
        curve = float(group_curve[group])
        for local in range(7):
            straw_index += 1
            role = clump_role(local)
            role_counts[role] += 1
            spread = (local - 3) / 3.0
            phase = group * 0.81 + local * 0.97
            family = int(length_family[group, local])

            if role == 'primary':
                lateral_scale = 0.070
                radii_x = np.array([0.018, 0.022, 0.029, 0.036, 0.034, 0.024, 0.010, 0.0012])
                radii_z = np.array([0.012, 0.015, 0.019, 0.023, 0.022, 0.016, 0.007, 0.0009])
            elif role == 'secondary':
                lateral_scale = 0.105
                radii_x = np.array([0.016, 0.020, 0.027, 0.033, 0.031, 0.022, 0.009, 0.0011])
                radii_z = np.array([0.011, 0.014, 0.018, 0.021, 0.020, 0.015, 0.006, 0.0008])
            else:
                lateral_scale = 0.145
                radii_x = np.array([0.014, 0.018, 0.024, 0.029, 0.027, 0.019, 0.008, 0.0010])
                radii_z = np.array([0.010, 0.013, 0.016, 0.019, 0.018, 0.013, 0.0055, 0.00075])

            target_y_center = float(length_y[family] + local_length[local] + 0.025 * math.sin(phase * 1.17))
            target_x_center = (
                base[0]
                + gx
                + drift
                + lateral_scale * spread
                + 0.030 * math.sin(phase * 1.39)
            )
            target_z_center = float(group_tip_z[group] + 0.095 * spread + 0.045 * math.cos(phase))

            root = np.array([
                base[0] + 0.055 * gx + 0.026 * spread + 0.010 * math.sin(phase),
                -0.34 + 0.010 * math.cos(phase),
                1.58 + 0.035 * math.sin(group * 0.88) + 0.018 * spread,
            ])
            neck = np.array([
                base[0] + 0.13 * gx + 0.040 * spread + 0.020 * curve,
                -0.48 + 0.015 * math.sin(phase),
                1.82 + 0.040 * math.cos(phase),
            ])
            shoulder = np.array([
                base[0] + 0.42 * gx + 0.075 * drift + 0.090 * curve + 0.055 * spread,
                -0.68 + 0.025 * math.cos(phase),
                2.08 + 0.040 * math.sin(phase),
            ])
            body1 = np.array([
                base[0] + 0.77 * gx + 0.22 * drift + 0.16 * curve + 0.070 * spread,
                -0.96 + 0.040 * math.sin(phase * 1.11),
                2.38 + 0.050 * math.cos(phase * 0.93),
            ])
            body2 = np.array([
                base[0] + 0.98 * gx + 0.52 * drift + 0.26 * curve + 0.085 * spread,
                -1.42 + 0.055 * math.cos(phase * 0.89),
                2.72 + 0.055 * math.sin(phase * 1.05),
            ])
            pretip = np.array([
                0.62 * body2[0] + 0.38 * target_x_center + 0.075 * curve,
                0.58 * body2[1] + 0.42 * target_y_center + 0.045 * math.sin(phase),
                0.60 * body2[2] + 0.40 * target_z_center + 0.045 * math.cos(phase),
            ])

            components = []
            for sub in range(4):
                sub_spread = (sub - 1.5) / 1.5
                sub_phase = phase + sub * 0.67
                target_y = target_y_center + float(sub_length[sub]) + 0.025 * math.sin(sub_phase * 1.21)
                target_x = target_x_center + 0.075 * sub_spread + 0.022 * math.sin(sub_phase)
                target_z = target_z_center + 0.045 * sub_spread + 0.025 * math.cos(sub_phase)
                tip = np.array([target_x, target_y, target_z])
                taper = np.array([
                    0.28 * pretip[0] + 0.72 * tip[0] + 0.022 * sub_spread,
                    0.32 * pretip[1] + 0.68 * tip[1],
                    0.34 * pretip[2] + 0.66 * tip[2],
                ])

                p0 = root + np.array([0.006 * sub_spread, 0.003 * math.sin(sub_phase), 0.004 * math.cos(sub_phase)])
                p1 = neck + np.array([0.010 * sub_spread, 0.005 * math.sin(sub_phase), 0.006 * math.cos(sub_phase)])
                p2 = shoulder + np.array([0.016 * sub_spread, 0.008 * math.sin(sub_phase), 0.008 * math.cos(sub_phase)])
                p3 = body1 + np.array([0.025 * sub_spread, 0.012 * math.sin(sub_phase), 0.011 * math.cos(sub_phase)])
                p4 = body2 + np.array([0.036 * sub_spread, 0.020 * math.sin(sub_phase), 0.015 * math.cos(sub_phase)])
                p5 = pretip + np.array([0.048 * sub_spread, 0.030 * math.sin(sub_phase), 0.020 * math.cos(sub_phase)])
                p6 = taper
                p7 = tip
                size_bias = 1.0 + 0.060 * math.sin(sub_phase)
                components.append(tube_mesh(
                    [tuple(p0), tuple(p1), tuple(p2), tuple(p3), tuple(p4), tuple(p5), tuple(p6), tuple(p7)],
                    radii_x * size_bias,
                    radii_z * size_bias,
                    sections=10,
                ))

            bundle = trimesh.util.concatenate(components)
            add(scene, bundle, f'straw_mass_{straw_index:02d}', 'broom_bristles')

    assert role_counts == {'primary': 8, 'secondary': 32, 'edge': 16}, role_counts

    bristle_index = 0
    full_root_bristles = 0
    flyaway_bristles = 0
    for group in range(8):
        gx = float(group_x[group])
        drift = float(group_drift[group])
        curve = float(group_curve[group])
        for local in range(30):
            bristle_index += 1
            phase = group * 0.73 + local * 0.53
            spread = (local - 14.5) / 14.5
            start_mode = local % 5
            flyaway = (local % 6) == 0
            family = int(length_family[group, local % 7])
            if start_mode == 0:
                full_root_bristles += 1
            if flyaway:
                flyaway_bristles += 1

            tip_y = float(length_y[family] + 0.16 + 0.06 * (local % 4))
            edge_push = 0.0
            if flyaway:
                tip_y -= 0.22 + 0.045 * (local % 3)
                edge_push = 0.14 * (1.0 if spread >= 0 else -1.0)

            tip_x = (
                base[0]
                + gx
                + 0.88 * drift
                + 0.150 * spread
                + edge_push
                + 0.035 * math.sin(phase * 1.31)
            )
            tip_z = float(group_tip_z[group] + 0.100 * spread + 0.055 * math.sin(phase))

            root = np.array([
                base[0] + 0.050 * gx + 0.020 * spread,
                -0.34,
                1.58 + 0.025 * math.sin(group),
            ])
            neck = np.array([
                base[0] + 0.13 * gx + 0.032 * spread,
                -0.48,
                1.82,
            ])
            shoulder = np.array([
                base[0] + 0.42 * gx + 0.070 * drift + 0.075 * curve + 0.050 * spread,
                -0.68 + 0.018 * math.sin(phase),
                2.08,
            ])
            body1 = np.array([
                base[0] + 0.77 * gx + 0.21 * drift + 0.14 * curve + 0.065 * spread,
                -0.96 + 0.030 * math.sin(phase),
                2.38 + 0.030 * math.cos(phase),
            ])
            body2 = np.array([
                base[0] + 0.98 * gx + 0.50 * drift + 0.23 * curve + 0.080 * spread,
                -1.42 + 0.040 * math.cos(phase),
                2.72 + 0.038 * math.sin(phase),
            ])
            pretip = np.array([
                0.60 * body2[0] + 0.40 * tip_x + 0.050 * curve,
                0.56 * body2[1] + 0.44 * tip_y,
                0.58 * body2[2] + 0.42 * tip_z,
            ])
            taper = np.array([
                0.30 * pretip[0] + 0.70 * tip_x,
                0.30 * pretip[1] + 0.70 * tip_y,
                0.32 * pretip[2] + 0.68 * tip_z,
            ])
            tip = np.array([tip_x, tip_y, tip_z])

            full_path = [root, neck, shoulder, body1, body2, pretip, taper, tip]
            if start_mode == 0:
                path = full_path
            elif start_mode == 1:
                path = full_path[1:]
            elif start_mode == 2:
                path = full_path[2:]
            else:
                path = full_path[3:]

            count = len(path)
            rx = np.linspace(0.0072, 0.00070, count)
            rz = np.linspace(0.0052, 0.00052, count)
            organic_tube(
                scene,
                [tuple(p) for p in path],
                rx,
                rz,
                f'bristle_{bristle_index:03d}',
                sections=8,
            )

    assert straw_index == 56
    assert bristle_index == 240
    assert full_root_bristles == 48
    assert flyaway_bristles == 40

    nodes_after = set(scene.graph.nodes)
    assert len([n for n in nodes_after if re.fullmatch(r'straw_mass_\d{2}', n)]) == 56
    assert len([n for n in nodes_after if re.fullmatch(r'bristle_\d{3}', n)]) == 240
    assert len([n for n in nodes_after if re.fullmatch(r'hair_main_\d{2}', n)]) == 14
    assert len([n for n in nodes_after if re.fullmatch(r'hair_overlap_\d{2}', n)]) == 8

    hierarchy = {'primary': 8, 'secondary': 32, 'edge': 16}
    scene.metadata.update({
        'broom_straw_workflow': 'grouped authored straw mass first; fine bristles are secondary breakup only',
        'broom_primary_groups': 8,
        'broom_root_compression_fraction': 0.28,
        'broom_straw_shape': 'tight bound root; dense middle body; gradual flare; clustered tapered tips',
        'broom_straw_substrands_per_clump': 4,
        'broom_straw_role_counts': hierarchy,
        'broom_length_clusters': 6,
        'broom_length_family_matrix': length_family.tolist(),
        'broom_full_root_bristles': 48,
        'broom_flyaway_bristles': 40,
        'broom_material_ready': False,
    })

    blob = scene.export(file_type='glb')
    MODEL.write_bytes(blob)

    manifest = json.loads(MANIFEST.read_text(encoding='utf-8'))
    manifest.update({
        'broom_bristles': 240,
        'broom_straw_clumps': 56,
        'broom_straw_workflow': 'grouped authored straw mass first; fine bristles are secondary breakup only',
        'broom_primary_groups': 8,
        'broom_root_compression_fraction': 0.28,
        'broom_straw_shape': 'tight bound root; dense middle body; gradual flare; clustered tapered tips',
        'broom_straw_substrands_per_clump': 4,
        'broom_straw_role_counts': hierarchy,
        'broom_length_clusters': 6,
        'broom_length_family_matrix': length_family.tolist(),
        'broom_full_root_bristles': 48,
        'broom_flyaway_bristles': 40,
        'broom_material_ready': False,
        'bytes': len(blob),
        'nodes': len(nodes_after),
        'geometries': len(scene.geometry),
    })
    MANIFEST.write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')

    print(json.dumps({
        'ok': True,
        'bytes': len(blob),
        'broom_bristles': 240,
        'broom_straw_clumps': 56,
        'broom_primary_groups': 8,
        'broom_straw_role_counts': hierarchy,
        'broom_length_clusters': 6,
        'broom_full_root_bristles': 48,
        'broom_flyaway_bristles': 40,
        'broom_straw_substrands_per_clump': 4,
        'broom_root_compression_fraction': 0.28,
        'broom_straw_shape': manifest['broom_straw_shape'],
        'hair_main_locks': 14,
        'hair_overlap_locks': 8,
    }, indent=2))


if __name__ == '__main__':
    main()
