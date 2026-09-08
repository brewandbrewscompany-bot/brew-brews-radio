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


def organic_tube(
    scene: trimesh.Scene,
    points,
    rx,
    rz,
    name: str,
    parent: str = 'broom_bristles',
    sections: int = 14,
) -> trimesh.Trimesh:
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
            scallop = 1.0 + 0.018 * math.sin(3.0 * angle + i * 0.51)
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

    mesh = trimesh.Trimesh(vertices=np.asarray(verts), faces=np.asarray(faces), process=True)
    return add(scene, mesh, name, parent)


def main() -> None:
    assert MODEL.exists(), MODEL
    assert MANIFEST.exists(), MANIFEST

    scene = trimesh.load(MODEL, force='scene', process=False)
    nodes_before = set(scene.graph.nodes)

    # This pass is broom-tail only. Everything already approved must survive unchanged.
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

    # Eight primary directional groups define the readable broom silhouette. The first
    # 28% remains compressed beneath the binding, then the mass opens gradually.
    base = np.array([0.14, 0.35, 1.54], dtype=float)
    group_x = np.array([-0.60, -0.44, -0.28, -0.10, 0.10, 0.28, 0.44, 0.60], dtype=float)
    group_y = np.array([-0.73, -0.82, -0.88, -0.92, -0.91, -0.86, -0.80, -0.72], dtype=float)
    group_z = np.array([2.99, 3.08, 3.16, 3.22, 3.20, 3.14, 3.06, 2.97], dtype=float)

    straw_index = 0
    for group in range(8):
        gx = group_x[group]
        for local in range(7):
            straw_index += 1
            spread = (local - 3) / 3.0
            phase = group * 0.73 + local * 0.91
            lateral = 0.026 * spread + 0.010 * math.sin(phase)
            vertical = 0.035 * math.sin(phase * 1.37)
            tip = np.array([
                base[0] + gx + lateral,
                group_y[group] + 0.045 * spread + 0.018 * math.sin(phase * 1.9),
                group_z[group] + vertical + 0.050 * math.cos(phase * 0.83),
            ])

            root = base + np.array([0.020 * math.sin(phase), 0.010 * math.cos(phase), 0.0])
            neck = base + np.array([0.055 * gx + 0.012 * spread, -0.105, 0.265 + 0.018 * math.sin(phase)])
            shoulder = base + np.array([0.18 * gx + 0.018 * spread, -0.225, 0.535 + 0.020 * math.cos(phase)])
            body = base + np.array([0.52 * gx + 0.020 * spread, -0.455, 0.930 + 0.030 * math.sin(phase * 1.2)])
            pretip = base + np.array([0.82 * gx + 0.022 * spread, -0.690, 1.315 + 0.040 * math.cos(phase * 0.9)])

            # Broad clumps carry the form. They swell through the body, then taper into
            # clustered ends instead of reading as identical wires.
            size_bias = 1.0 + 0.07 * math.sin(phase)
            organic_tube(
                scene,
                [tuple(root), tuple(neck), tuple(shoulder), tuple(body), tuple(pretip), tuple(tip)],
                np.array([0.046, 0.052, 0.066, 0.086, 0.062, 0.015]) * size_bias,
                np.array([0.038, 0.044, 0.056, 0.072, 0.052, 0.012]) * size_bias,
                f'straw_mass_{straw_index:02d}',
                sections=14,
            )

    # Fine bristles remain at the proven count, but they follow the eight grouped paths
    # and stay thin enough that the broad straw masses dominate the neutral-clay read.
    bristle_index = 0
    for group in range(8):
        gx = group_x[group]
        for local in range(30):
            bristle_index += 1
            spread = (local - 14.5) / 14.5
            ring = local % 6
            phase = group * 0.67 + local * 0.49
            tip = np.array([
                base[0] + gx + 0.045 * spread + 0.014 * math.sin(phase),
                group_y[group] + 0.070 * spread + 0.022 * math.cos(phase * 1.31),
                group_z[group] + 0.075 * math.sin(phase * 1.17) + 0.018 * ring,
            ])
            root = base + np.array([0.018 * math.sin(phase), 0.010 * math.cos(phase), 0.0])
            compress = base + np.array([0.050 * gx + 0.008 * spread, -0.105, 0.270])
            middle = base + np.array([0.42 * gx + 0.024 * spread, -0.405, 0.835 + 0.020 * math.sin(phase)])
            pretip = base + np.array([0.78 * gx + 0.034 * spread, -0.650, 1.245 + 0.030 * math.cos(phase)])
            organic_tube(
                scene,
                [tuple(root), tuple(compress), tuple(middle), tuple(pretip), tuple(tip)],
                [0.0072, 0.0075, 0.0078, 0.0060, 0.0028],
                [0.0060, 0.0063, 0.0065, 0.0050, 0.0023],
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
        'broom_root_compression_fraction': 0.28,
        'broom_straw_shape': manifest['broom_straw_shape'],
        'hair_main_locks': 14,
        'hair_overlap_locks': 8,
    }, indent=2))


if __name__ == '__main__':
    main()
