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

def smooth_profile(path, widths, depths, rounds=2):
    pts = [np.asarray(p, float) for p in path]
    ws = [float(v) for v in widths]
    ds = [float(v) for v in depths]
    for _ in range(rounds):
        npts, nws, nds = [pts[0]], [ws[0]], [ds[0]]
        for i in range(len(pts) - 1):
            p0, p1 = pts[i], pts[i + 1]
            w0, w1 = ws[i], ws[i + 1]
            d0, d1 = ds[i], ds[i + 1]
            npts.extend([p0 * .75 + p1 * .25, p0 * .25 + p1 * .75])
            nws.extend([w0 * .75 + w1 * .25, w0 * .25 + w1 * .75])
            nds.extend([d0 * .75 + d1 * .25, d0 * .25 + d1 * .75])
        npts.append(pts[-1]); nws.append(ws[-1]); nds.append(ds[-1])
        pts, ws, ds = npts, nws, nds
    return np.asarray(pts), np.asarray(ws), np.asarray(ds)

def leaf_shell(path, widths, depths, name, parent, across=17, edge_phase=0.0, smooth_rounds=2):
    pts, widths, depths = smooth_profile(path, widths, depths, rounds=smooth_rounds)
    rows = len(pts)
    front, back = [], []
    for i, p in enumerate(pts):
        t = i / max(1, rows - 1)
        for j in range(across):
            u = j / (across - 1) * 2 - 1
            edge = 1.0 - 0.035 * math.cos(math.pi * u) + 0.014 * math.sin(4.2 * u + edge_phase + i * 0.24)
            x = p[0] + u * widths[i] * edge
            relief = depths[i] * (0.70 + 0.30 * math.cos(math.pi * u))
            wave = 0.011 * math.sin(2.0 * math.pi * t + 2.0 * u + edge_phase)
            y = p[1] - 0.009 * u * u * (0.20 + t)
            front.append([x, y, p[2] + relief + wave])
            back.append([x, y, p[2] - relief * 0.55 + wave * 0.30])

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
    transform[:3, :3] = np.diag([0.60, 0.36, 0.35])
    transform[:3, 3] = [0.0, 2.82, -0.79]
    mesh.apply_transform(transform)
    return add(mesh, 'hair_cap', 'hair_01')

def add_main_locks():
    # Main cards are authored as smooth ribbons already bent by the airstream.
    # They fan widest over the shoulders, then converge into five irregular tip
    # clusters.  Depth travel is dominant; vertical drop is only enough to keep
    # the rear chase camera from foreshortening the mane into a shelf.
    cluster_centers = [
        (-0.76, 2.26, 1.78),
        (-0.40, 2.34, 1.98),
        (0.00, 2.42, 2.15),
        (0.40, 2.35, 2.00),
        (0.76, 2.27, 1.80),
    ]
    root_xs = np.linspace(-0.73, 0.73, 14)
    for i, root_x in enumerate(root_xs):
        s = root_x / 0.73 if abs(root_x) > 0.001 else 0.0
        sign = -1.0 if root_x < 0 else 1.0
        group = round(i * 4 / 13)
        cluster_x, cluster_y, cluster_z = cluster_centers[group]
        cluster_slot = (-0.030, 0.008, 0.035)[i % 3]
        tip_x = cluster_x + cluster_slot
        tip_y = cluster_y + (0.018, -0.012, 0.010)[i % 3]
        tip_z = cluster_z + (-0.055, 0.025, 0.065)[i % 3]
        shoulder_x = root_x * 1.31 + sign * (0.040 + 0.020 * (1.0 - abs(s)))
        return_x = shoulder_x + (tip_x - shoulder_x) * 0.34

        path = [
            (root_x * 0.90, 2.995 - 0.018 * abs(s), -0.73 + 0.012 * math.cos(i * .70)),
            (root_x * 0.97, 2.86 - 0.015 * abs(s), -0.52 + 0.012 * math.sin(i * .82)),
            (shoulder_x, 2.68 - 0.018 * abs(s), -0.17 + 0.014 * math.cos(i * .55)),
            (shoulder_x * 1.01, 2.56 - 0.014 * abs(s), 0.24 + 0.016 * math.sin(i * .64)),
            (shoulder_x * 0.98, 2.48 + 0.012 * math.sin(i * .51), 0.78 + 0.020 * math.cos(i * .61)),
            (return_x, 2.38 + (tip_y - 2.38) * .22, 1.35 + (tip_z - 1.35) * .18),
            (tip_x, tip_y, tip_z),
        ]
        parent = 'hair_05' if abs(s) < 0.34 else ('hair_04' if abs(s) < 0.72 else 'hair_03')
        leaf_shell(
            path,
            [0.072, 0.105, 0.158, 0.148, 0.116, 0.068, 0.018],
            [0.034, 0.044, 0.058, 0.054, 0.045, 0.030, 0.011],
            f'hair_main_{i + 1:02d}',
            parent,
            across=17,
            edge_phase=0.45 + i * 0.49,
            smooth_rounds=2,
        )

def add_overlap_locks():
    # Short cards overlap the crown, sides and shoulder fan.  They do not form a
    # second hanging hem; they disappear into the same rearward flow before the
    # clustered main tips, giving the mass density without rope-like strands.
    root_xs = np.array([-0.68, -0.49, -0.29, -0.09, 0.10, 0.30, 0.50, 0.69])
    for i, root_x in enumerate(root_xs):
        s = root_x / 0.70
        sign = -1.0 if root_x < 0 else 1.0
        shoulder_x = root_x * 1.26 + sign * 0.035
        tip_x = root_x * 1.00 + 0.022 * math.sin(i * 1.31)
        tip_y = 2.45 + 0.035 * (i % 3) + 0.010 * math.cos(i * .75)
        tip_z = 1.00 + 0.13 * (i % 3) + 0.028 * math.cos(i * .90)
        path = [
            (root_x * .92, 3.00 - .018 * abs(s), -.74 + .010 * math.sin(i)),
            (root_x, 2.86 - .014 * abs(s), -.50),
            (shoulder_x, 2.68 - .018 * abs(s), -.16 + .012 * math.cos(i)),
            (shoulder_x * .99, 2.56, .24 + .014 * math.sin(i * 1.10)),
            (shoulder_x * .92, 2.49, .66 + .016 * math.cos(i * .84)),
            (tip_x, tip_y, tip_z),
        ]
        leaf_shell(
            path,
            [0.064, 0.090, 0.126, 0.116, 0.074, 0.017],
            [0.030, 0.040, 0.050, 0.045, 0.030, 0.010],
            f'hair_overlap_{i + 1:02d}',
            'hair_02',
            across=15,
            edge_phase=1.10 + i * 0.61,
            smooth_rounds=2,
        )

remove_old_hair()
ensure_roots()
add_hair_cap()
add_main_locks()
add_overlap_locks()

scene.metadata.update({
    'hair_workflow': 'pre-swept smooth layered cards authored in mesh; runtime motion is secondary only',
    'hair_shape': 'dense shoulder fan converging into five irregular rearward tip clusters',
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
    'hair_workflow': 'pre-swept backward smooth cards; physics/runtime only adds secondary trailing motion',
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
