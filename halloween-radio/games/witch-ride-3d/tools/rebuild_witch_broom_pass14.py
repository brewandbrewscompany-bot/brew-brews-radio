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


def main() -> None:
    assert MODEL.exists(), MODEL
    assert MANIFEST.exists(), MANIFEST

    scene = trimesh.load(MODEL, force='scene', process=False)
    nodes_before = set(scene.graph.nodes)

    # Broom-tail-only pass. Preserve all already-approved Pass 14 systems.
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

    # Eight overlapping directional groups establish the broad broom silhouette.
    # The root remains compact below the boots, then the bundle opens through the
    # middle body. Each of the 56 named straw clumps is itself FOUR slim closed straw
    # bodies, so the neutral-clay render reads as clustered straw rather than fat fingers.
    base = np.array([0.14, -0.35, 1.54], dtype=float)
    group_x = np.array([-0.84, -0.63, -0.42, -0.17, 0.14, 0.39, 0.61, 0.82], dtype=float)
    group_y = np.array([-2.12, -2.30, -2.03, -2.38, -2.18, -2.33, -2.06, -2.24], dtype=float)
    group_z = np.array([3.02, 3.18, 3.08, 3.28, 3.13, 3.25, 3.04, 3.20], dtype=float)

    straw_index = 0
    for group in range(8):
        gx = group_x[group]
        for local in range(7):
            straw_index += 1
            spread = (local - 3) / 3.0
            phase = group * 0.73 + local * 0.91
            lateral = 0.082 * spread + 0.018 * math.sin(phase)
            length_jitter = 0.145 * math.sin(phase * 1.37) + 0.055 * spread
            depth_jitter = 0.055 * math.cos(phase * 0.83)

            root = base + np.array([0.014 * math.sin(phase), 0.008 * math.cos(phase), 0.0])
            neck = np.array([
                base[0] + 0.055 * gx + 0.010 * spread,
                -0.56 + 0.018 * math.sin(phase),
                1.82 + 0.018 * math.sin(phase),
            ])
            shoulder = np.array([
                base[0] + 0.24 * gx + 0.025 * spread,
                -0.82 + 0.025 * math.cos(phase),
                2.12 + 0.025 * math.cos(phase),
            ])
            body = np.array([
                base[0] + 0.70 * gx + 0.045 * spread,
                -1.22 + 0.045 * math.sin(phase * 1.2),
                2.53 + 0.040 * math.sin(phase * 1.2),
            ])
            pretip = np.array([
                base[0] + 0.96 * gx + 0.065 * spread,
                -1.72 + 0.070 * math.cos(phase * 0.9),
                2.88 + 0.055 * math.cos(phase * 0.9),
            ])
            tip_center = np.array([
                base[0] + gx + lateral,
                group_y[group] + length_jitter,
                group_z[group] + depth_jitter,
            ])

            components = []
            for sub in range(4):
                sub_spread = (sub - 1.5) / 1.5
                sub_phase = phase + sub * 0.61
                # Sub-strands share a clustered trajectory but split gradually after the
                # compressed root. Their tips are tiny and staggered instead of rounded plugs.
                p0 = root + np.array([0.004 * sub_spread, 0.003 * math.sin(sub_phase), 0.002 * math.cos(sub_phase)])
                p1 = neck + np.array([0.010 * sub_spread, 0.006 * math.sin(sub_phase), 0.005 * math.cos(sub_phase)])
                p2 = shoulder + np.array([0.018 * sub_spread, 0.010 * math.sin(sub_phase), 0.009 * math.cos(sub_phase)])
                p3 = body + np.array([0.030 * sub_spread, 0.018 * math.sin(sub_phase), 0.014 * math.cos(sub_phase)])
                p4 = pretip + np.array([0.040 * sub_spread, 0.030 * math.sin(sub_phase), 0.020 * math.cos(sub_phase)])
                p5 = tip_center + np.array([
                    0.045 * sub_spread,
                    0.055 * math.sin(sub_phase * 1.21),
                    0.028 * math.cos(sub_phase * 1.13),
                ])
                size_bias = 1.0 + 0.08 * math.sin(sub_phase)
                components.append(tube_mesh(
                    [tuple(p0), tuple(p1), tuple(p2), tuple(p3), tuple(p4), tuple(p5)],
                    np.array([0.014, 0.018, 0.024, 0.030, 0.020, 0.0018]) * size_bias,
                    np.array([0.012, 0.016, 0.021, 0.026, 0.017, 0.0015]) * size_bias,
                    sections=10,
                ))

            bundle = trimesh.util.concatenate(components)
            add(scene, bundle, f'straw_mass_{straw_index:02d}', 'broom_bristles')

    # 240 fine bristles add surface breakup and stray edge detail. They follow the same
    # eight grouped envelopes but vary in length so they never become a uniform comb.
    bristle_index = 0
    for group in range(8):
        gx = group_x[group]
        for local in range(30):
            bristle_index += 1
            spread = (local - 14.5) / 14.5
            tier = local % 6
            phase = group * 0.67 + local * 0.49
            tip = np.array([
                base[0] + gx + 0.115 * spread + 0.022 * math.sin(phase),
                group_y[group] + 0.145 * spread + 0.175 * math.sin(phase * 1.31) + 0.030 * (tier - 2.5),
                group_z[group] + 0.090 * math.sin(phase * 1.17) + 0.020 * tier,
            ])
            root = base + np.array([0.014 * math.sin(phase), 0.008 * math.cos(phase), 0.0])
            compress = np.array([
                base[0] + 0.052 * gx + 0.008 * spread,
                -0.56,
                1.82,
            ])
            middle = np.array([
                base[0] + 0.66 * gx + 0.052 * spread,
                -1.18 + 0.035 * math.sin(phase),
                2.48 + 0.030 * math.sin(phase),
            ])
            pretip = np.array([
                base[0] + 0.94 * gx + 0.075 * spread,
                -1.70 + 0.060 * math.cos(phase),
                2.86 + 0.040 * math.cos(phase),
            ])
            organic_tube(
                scene,
                [tuple(root), tuple(compress), tuple(middle), tuple(pretip), tuple(tip)],
                [0.0058, 0.0061, 0.0064, 0.0047, 0.0014],
                [0.0049, 0.0052, 0.0054, 0.0040, 0.0012],
                f'bristle_{bristle_index:03d}',
                sections=8,
            )

    nodes_after = set(scene.graph.nodes)
    assert straw_index == 56
    assert bristle_index == 240
    assert len([n for n in nodes_after if re.fullmatch(r'straw_mass_\d{2}', n)]) == 56
    assert len([n for n in nodes_after if re.fullmatch(r'bristle_\d{3}', n)]) == 240
    assert len([n for n in nodes_after if re.fullmatch(r'hair_main_\d{2}', n)]) == 14
    assert len([n for n in nodes_after if re.fullmatch(r'hair_overlap_\d{2}', n)]) == 8

    scene.metadata.update({
        'broom_straw_workflow': 'grouped authored straw mass first; fine bristles are secondary breakup only',
        'broom_primary_groups': 8,
        'broom_root_compression_fraction': 0.28,
        'broom_straw_shape': 'tight bound root; dense middle body; gradual flare; clustered tapered tips',
        'broom_straw_substrands_per_clump': 4,
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
        'broom_straw_substrands_per_clump': 4,
        'broom_root_compression_fraction': 0.28,
        'broom_straw_shape': manifest['broom_straw_shape'],
        'hair_main_locks': 14,
        'hair_overlap_locks': 8,
    }, indent=2))


if __name__ == '__main__':
    main()
