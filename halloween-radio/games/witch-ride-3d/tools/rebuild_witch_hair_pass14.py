from __future__ import annotations
import json, math, re
from pathlib import Path
import numpy as np
import trimesh
from trimesh.visual.material import PBRMaterial

ROOT = Path(__file__).resolve().parents[1]
GLB = ROOT / 'assets' / 'models' / 'witch-rider.glb'
MANIFEST = ROOT / 'assets' / 'witch-mesh-pass14.json'

CLAY = PBRMaterial(
    name='neutral_clay_mesh_review',
    baseColorFactor=[0.47, 0.45, 0.43, 1.0],
    metallicFactor=0.0,
    roughnessFactor=1.0,
)

assert GLB.exists(), GLB
scene = trimesh.load(GLB, force='scene')
assert isinstance(scene, trimesh.Scene)

def clean(mesh):
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

def add(mesh, name, parent):
    clean(mesh)
    scene.add_geometry(mesh, node_name=name, geom_name=name, parent_node_name=parent)
    return mesh

def remove_old_hair():
    old_geometry = [
        name for name in list(scene.geometry.keys())
        if re.fullmatch(r'mane_lock_\d{2}', name)
        or re.fullmatch(r'mane_shoulder_\d{2}', name)
        or re.fullmatch(r'hair_main_\d{2}', name)
        or re.fullmatch(r'hair_overlap_\d{2}', name)
        or name == 'hair_cap'
    ]
    scene.delete_geometry(old_geometry)
    old_nodes = [
        name for name in list(scene.graph.nodes)
        if re.fullmatch(r'mane_lock_\d{2}', name)
        or re.fullmatch(r'mane_shoulder_\d{2}', name)
        or re.fullmatch(r'hair_main_\d{2}', name)
        or re.fullmatch(r'hair_overlap_\d{2}', name)
        or name == 'hair_cap'
    ]
    for name in old_nodes:
        scene.graph.transforms.remove_node(name)

def ensure_roots():
    for i in range(1, 6):
        name = f'hair_{i:02d}'
        if name not in scene.graph.nodes:
            scene.graph.update(
                frame_to=name,
                frame_from=scene.graph.base_frame,
                matrix=np.eye(4),
            )

def leaf_shell(path, widths, depths, name, parent, across=19, edge_phase=0.0):
    pts = np.asarray(path, float)
    widths = np.asarray(widths, float)
    depths = np.asarray(depths, float)
    rows = len(pts)
    front, back = [], []
    for i, p in enumerate(pts):
        t = i / max(1, rows - 1)
        for j in range(across):
            u = j / (across - 1) * 2 - 1
            edge = 1.0 - 0.06 * math.cos(math.pi * u) + 0.025 * math.sin(4.5 * u + edge_phase + i * 0.45)
            x = p[0] + u * widths[i] * edge
            relief = depths[i] * (0.68 + 0.32 * math.cos(math.pi * u))
            wave = 0.022 * math.sin(2.2 * math.pi * t + 2.3 * u + edge_phase)
            y = p[1] - 0.018 * u * u * (0.25 + t)
            front.append([x, y, p[2] + relief + wave])
            back.append([x, y, p[2] - relief * 0.58 + wave * 0.35])

    verts = front + back
    layer = rows * across
    faces = []
    for side in range(2):
        off = side * layer
        for i in range(rows - 1):
            for j in range(across - 1):
                a = off + i * across + j
                b = a + 1
                c = off + (i + 1) * across + j
                d = c + 1
                faces += ([[a, c, b], [b, c, d]] if side == 0 else [[a, b, c], [b, d, c]])
    for i in range(rows - 1):
        for j in (0, across - 1):
            a = i * across + j
            b = (i + 1) * across + j
            c = layer + a
            d = layer + b
            faces += ([[a, c, b], [b, c, d]] if j == 0 else [[a, b, c], [b, d, c]])
    for i in (0, rows - 1):
        for j in range(across - 1):
            a = i * across + j
            b = a + 1
            c = layer + a
            d = layer + b
            faces += ([[a, b, c], [b, d, c]] if i == 0 else [[a, c, b], [b, c, d]])

    mesh = trimesh.Trimesh(vertices=np.asarray(verts), faces=np.asarray(faces), process=True)
    return add(mesh, name, parent)

def add_hair_cap():
    mesh = trimesh.creation.icosphere(subdivisions=4, radius=1.0)
    transform = np.eye(4)
    transform[:3, :3] = np.diag([0.58, 0.35, 0.34])
    transform[:3, 3] = [0.0, 2.82, -0.79]
    mesh.apply_transform(transform)
    return add(mesh, 'hair_cap', 'hair_01')

def add_main_locks():
    cluster_centers = [
        (-0.62, 2.36, 1.00),
        (-0.31, 2.30, 1.17),
        (0.00, 2.24, 1.33),
        (0.31, 2.30, 1.19),
        (0.62, 2.36, 1.03),
    ]
    root_xs = np.linspace(-0.78, 0.78, 14)
    for i, root_x in enumerate(root_xs):
        s = root_x / 0.78 if abs(root_x) > 0.001 else 0.0
        sign = -1.0 if root_x < 0 else 1.0
        group = round(i * 4 / 13)
        cluster_x, tip_y, tip_z = cluster_centers[group]
        tip_x = cluster_x + (-0.045, 0.0, 0.045)[i % 3]
        shoulder_x = root_x * 1.10 + sign * (0.06 + 0.04 * (1.0 - abs(s)))

        path = [
            (root_x * 0.90, 2.99 - 0.035 * abs(s), -0.73 + 0.025 * math.cos(i * 0.70)),
            (root_x * 0.98, 2.80 - 0.025 * abs(s), -0.54 + 0.025 * math.sin(i * 0.80)),
            (shoulder_x, 2.60 - 0.035 * abs(s), -0.22 + 0.025 * math.cos(i * 0.55)),
            (shoulder_x * 0.98, 2.48 - 0.025 * abs(s), 0.18 + 0.045 * math.sin(i * 0.60)),
            ((shoulder_x + tip_x) * 0.50, 2.38 + (tip_y - 2.38) * 0.35, 0.62 + (tip_z - 0.62) * 0.38),
            (tip_x, tip_y, tip_z),
        ]
        parent = 'hair_05' if abs(s) < 0.34 else ('hair_04' if abs(s) < 0.72 else 'hair_03')
        leaf_shell(
            path,
            [0.12, 0.22, 0.30, 0.235, 0.135, 0.036],
            [0.050, 0.072, 0.092, 0.076, 0.050, 0.022],
            f'hair_main_{i + 1:02d}',
            parent,
            across=19,
            edge_phase=0.45 + i * 0.51,
        )

def add_overlap_locks():
    root_xs = np.array([-0.70, -0.50, -0.29, -0.09, 0.10, 0.31, 0.52, 0.71])
    for i, root_x in enumerate(root_xs):
        s = root_x / 0.72
        sign = -1.0 if root_x < 0 else 1.0
        shoulder_x = root_x * 1.08 + sign * 0.045
        tip_x = root_x * 0.84 + 0.035 * math.sin(i * 1.30)
        tip_z = 0.42 + 0.12 * (i % 3) + 0.05 * math.cos(i * 0.90)
        path = [
            (root_x * 0.92, 3.01 - 0.03 * abs(s), -0.75 + 0.02 * math.sin(i)),
            (root_x, 2.80 - 0.02 * abs(s), -0.50),
            (shoulder_x, 2.62 - 0.03 * abs(s), -0.20 + 0.025 * math.cos(i)),
            (shoulder_x * 0.94, 2.52, 0.12 + 0.03 * math.sin(i * 1.10)),
            (tip_x, 2.44 + 0.025 * math.cos(i * 0.70), tip_z),
        ]
        leaf_shell(
            path,
            [0.105, 0.175, 0.225, 0.145, 0.032],
            [0.045, 0.065, 0.080, 0.055, 0.018],
            f'hair_overlap_{i + 1:02d}',
            'hair_02',
            across=17,
            edge_phase=1.10 + i * 0.63,
        )

remove_old_hair()
ensure_roots()
add_hair_cap()
add_main_locks()
add_overlap_locks()

scene.metadata.update({
    'hair_workflow': 'pre-swept backward mane authored in mesh; runtime motion is secondary only',
    'hair_shape': 'widest at upper back and shoulders, tapered clustered trailing ends',
    'hair_main_locks': 14,
    'hair_overlap_locks': 8,
    'hair_cap': 'dense hidden cap under locked hat brim',
})

GLB.write_bytes(scene.export(file_type='glb'))

manifest = json.loads(MANIFEST.read_text(encoding='utf-8')) if MANIFEST.exists() else {}
manifest.update({
    'mane_primary_locks': 14,
    'mane_shoulder_locks': 8,
    'hair_main_locks': 14,
    'hair_overlap_locks': 8,
    'hair_cap': True,
    'hair_workflow': 'pre-swept backward cards; physics/runtime only adds secondary trailing motion',
    'hair_root_motion': 'anchored',
    'hair_mid_motion': 'mild lag',
    'hair_tip_motion': 'highest secondary motion',
    'hat_motion': 'locked',
    'bytes': GLB.stat().st_size,
    'nodes': len(scene.graph.nodes),
    'geometries': len(scene.geometry),
})
MANIFEST.write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
print(json.dumps({
    'ok': True,
    'hair_main_locks': 14,
    'hair_overlap_locks': 8,
    'hair_cap': True,
    'bytes': GLB.stat().st_size,
}, indent=2))
