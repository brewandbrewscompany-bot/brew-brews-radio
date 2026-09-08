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

    # Broom-tail-only pass. Preserve all approved Pass 14 systems exactly in spirit.
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

    # Realtime hierarchy: 8 primary directional masses, 32 secondary clumps, 16 edge
    # clumps. The first 28% stays compressed behind/between the boots; the middle opens
    # early into a packed overlapping body; the final third breaks into six grouped length
    # families with intentionally asymmetric curved flow.
    base = np.array([0.14, -0.22, 1.56], dtype=float)
    group_x = np.array([-0.76, -0.59, -0.43, -0.18, 0.10, 0.31, 0.54, 0.79], dtype=float)
    group_drift = np.array([-0.22, 0.07, -0.15, 0.08, -0.05, 0.16, -0.07, 0.20], dtype=float)
    group_curve = np.array([-0.10, 0.06, -0.13, 0.08, -0.05, 0.11, -0.06, 0.13], dtype=float)
    group_tip_z = np.array([3.08, 2.99, 3.26, 3.10, 3.31, 3.02, 3.23, 3.15], dtype=float)
    group_length_family = np.array([3, 1, 5, 2, 4, 0, 5, 2], dtype=int)
    length_y = np.array([-2.28, -2.48, -2.72, -2.94, -3.15, -3.38], dtype=float)
    local_length = np.array([-0.07, 0.03, -0.02, 0.00, 0.07, -0.04, 0.11], dtype=float)

    role_counts = {'primary': 0, 'secondary': 0, 'edge': 0}
    straw_index = 0
    for group in range(8):
        gx = float(group_x[group])
        drift = float(group_drift[group])
        curve = float(group_curve[group])
        family = int(group_length_family[group])
        for local in range(7):
            straw_index += 1
            role = clump_role(local)
            role_counts[role] += 1
            spread = (local - 3) / 3.0
            phase = group * 0.79 + local * 0.93

            # Role-specific envelope: primary clumps carry the body, secondary clumps
            # overlap/fill it, edge clumps are slimmer and supply silhouette breakup.
            if role == 'primary':
                lateral_scale = 0.030
                radii_x = np.array([0.015, 0.019, 0.025, 0.033, 0.032, 0.022, 0.0016])
                radii_z = np.array([0.013, 0.017, 0.022, 0.029, 0.028, 0.019, 0.0014])
            elif role == 'secondary':
                lateral_scale = 0.058
                radii_x = np.array([0.013, 0.017, 0.023, 0.029, 0.028, 0.019, 0.0015])
                radii_z = np.array([0.011, 0.015, 0.020, 0.025, 0.024, 0.016, 0.0013])
            else:
                lateral_scale = 0.095
                radii_x = np.array([0.011, 0.015, 0.020, 0.025, 0.024, 0.016, 0.0013])
                radii_z = np.array([0.010, 0.013, 0.017, 0.021, 0.020, 0.014, 0.0011])

            target_y = float(length_y[family] + local_length[local] + 0.020 * math.sin(phase * 1.21))
            target_x = (
                base[0]
                + gx
                + drift
                + lateral_scale * spread
                + 0.018 * math.sin(phase * 1.47)
            )
            target_z = float(group_tip_z[group] + 0.055 * spread + 0.030 * math.cos(phase))

            root = base + np.array([0.012 * math.sin(phase), 0.006 * math.cos(phase), 0.0])
            neck = np.array([
                base[0] + 0.045 * gx + 0.008 * spread,
                -0.46 + 0.012 * math.sin(phase),
                1.79 + 0.014 * math.cos(phase),
            ])
            shoulder = np.array([
                base[0] + 0.30 * gx + 0.030 * curve + 0.020 * spread,
                -0.72 + 0.022 * math.cos(phase),
                2.06 + 0.022 * math.sin(phase),
            ])
            body1 = np.array([
                base[0] + 0.68 * gx + 0.14 * drift + 0.10 * curve + 0.035 * spread,
                -1.08 + 0.035 * math.sin(phase * 1.13),
                2.34 + 0.035 * math.cos(phase * 0.91),
            ])
            body2 = np.array([
                base[0] + 0.91 * gx + 0.42 * drift + 0.22 * curve + 0.045 * spread,
                -1.52 + 0.050 * math.cos(phase * 0.87),
                2.60 + 0.045 * math.sin(phase * 1.07),
            ])
            pretip = np.array([
                0.58 * body2[0] + 0.42 * target_x + 0.055 * curve,
                0.48 * body2[1] + 0.52 * target_y + 0.035 * math.sin(phase),
                0.52 * body2[2] + 0.48 * target_z + 0.035 * math.cos(phase),
            ])
            tip_center = np.array([target_x, target_y, target_z])

            components = []
            for sub in range(4):
                sub_spread = (sub - 1.5) / 1.5
                sub_phase = phase + sub * 0.63
                # Four slim closed straw bodies form each named clump. They remain packed
                # through the middle and only separate in the final third.
                p0 = root + np.array([0.003 * sub_spread, 0.002 * math.sin(sub_phase), 0.002 * math.cos(sub_phase)])
                p1 = neck + np.array([0.007 * sub_spread, 0.004 * math.sin(sub_phase), 0.004 * math.cos(sub_phase)])
                p2 = shoulder + np.array([0.012 * sub_spread, 0.007 * math.sin(sub_phase), 0.006 * math.cos(sub_phase)])
                p3 = body1 + np.array([0.020 * sub_spread, 0.010 * math.sin(sub_phase), 0.009 * math.cos(sub_phase)])
                p4 = body2 + np.array([0.030 * sub_spread, 0.018 * math.sin(sub_phase), 0.013 * math.cos(sub_phase)])
                p5 = pretip + np.array([0.040 * sub_spread, 0.028 * math.sin(sub_phase), 0.018 * math.cos(sub_phase)])
                p6 = tip_center + np.array([
                    0.052 * sub_spread,
                    0.050 * math.sin(sub_phase * 1.19),
                    0.026 * math.cos(sub_phase * 1.11),
                ])
                size_bias = 1.0 + 0.065 * math.sin(sub_phase)
                components.append(tube_mesh(
                    [tuple(p0), tuple(p1), tuple(p2), tuple(p3), tuple(p4), tuple(p5), tuple(p6)],
                    radii_x * size_bias,
                    radii_z * size_bias,
                    sections=10,
                ))

            bundle = trimesh.util.concatenate(components)
            add(scene, bundle, f'straw_mass_{straw_index:02d}', 'broom_bristles')

    assert role_counts == {'primary': 8, 'secondary': 32, 'edge': 16}, role_counts

    # 240 fine bristles are tertiary detail. Only 20% travel from the bound root; most
    # emerge deeper in the middle/final third. Only 1/6 become perimeter flyaways.
    bristle_index = 0
    full_root_bristles = 0
    flyaway_bristles = 0
    for group in range(8):
        gx = float(group_x[group])
        drift = float(group_drift[group])
        curve = float(group_curve[group])
        family = int(group_length_family[group])
        for local in range(30):
            bristle_index += 1
            phase = group * 0.71 + local * 0.47
            spread = (local - 14.5) / 14.5
            start_mode = local % 5
            flyaway = (local % 6) == 0
            if start_mode == 0:
                full_root_bristles += 1
            if flyaway:
                flyaway_bristles += 1

            base_target_y = float(length_y[family])
            if flyaway:
                tip_y = base_target_y - 0.10 - 0.035 * (local % 3)
                edge_push = 0.10 * (1.0 if spread >= 0 else -1.0)
            else:
                tip_y = base_target_y + 0.16 + 0.06 * (local % 4)
                edge_push = 0.0

            tip_x = (
                base[0]
                + gx
                + 0.82 * drift
                + 0.080 * spread
                + edge_push
                + 0.018 * math.sin(phase * 1.37)
            )
            tip_z = float(group_tip_z[group] + 0.060 * spread + 0.040 * math.sin(phase))

            root = base + np.array([0.010 * math.sin(phase), 0.005 * math.cos(phase), 0.0])
            neck = np.array([
                base[0] + 0.045 * gx + 0.006 * spread,
                -0.46,
                1.79,
            ])
            shoulder = np.array([
                base[0] + 0.30 * gx + 0.025 * curve + 0.016 * spread,
                -0.72 + 0.018 * math.sin(phase),
                2.06,
            ])
            body1 = np.array([
                base[0] + 0.68 * gx + 0.14 * drift + 0.09 * curve + 0.030 * spread,
                -1.08 + 0.028 * math.sin(phase),
                2.34 + 0.025 * math.cos(phase),
            ])
            body2 = np.array([
                base[0] + 0.91 * gx + 0.42 * drift + 0.20 * curve + 0.040 * spread,
                -1.52 + 0.040 * math.cos(phase),
                2.60 + 0.032 * math.sin(phase),
            ])
            pretip = np.array([
                0.57 * body2[0] + 0.43 * tip_x + 0.040 * curve,
                0.50 * body2[1] + 0.50 * tip_y,
                0.54 * body2[2] + 0.46 * tip_z,
            ])
            tip = np.array([tip_x, tip_y, tip_z])

            full_path = [root, neck, shoulder, body1, body2, pretip, tip]
            if start_mode == 0:
                path = full_path
            elif start_mode == 1:
                path = full_path[1:]
            elif start_mode == 2:
                path = full_path[2:]
            else:
                path = full_path[3:]

            count = len(path)
            rx = np.linspace(0.0052, 0.00075, count)
            rz = np.linspace(0.0044, 0.00062, count)
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
        'broom_full_root_bristles': 48,
        'broom_flyaway_bristles': 40,
        'broom_primary_group_length_families': group_length_family.tolist(),
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
        'broom_full_root_bristles': 48,
        'broom_flyaway_bristles': 40,
        'broom_primary_group_length_families': group_length_family.tolist(),
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
