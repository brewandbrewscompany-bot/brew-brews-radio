from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import trimesh
from trimesh.visual.material import PBRMaterial
from trimesh.visual.texture import TextureVisuals

ROOT = Path(__file__).resolve().parents[1]
MODEL = ROOT / 'assets' / 'models' / 'witch-rider.glb'
MANIFEST = ROOT / 'assets' / 'witch-mesh-pass14.json'
TMP = MODEL.with_suffix('.uvtmp.glb')

CLAY = PBRMaterial(
    name='neutral_clay_mesh_review',
    baseColorFactor=[0.47, 0.45, 0.43, 1.0],
    metallicFactor=0.0,
    roughnessFactor=1.0,
)


def planar_uv(mesh: trimesh.Trimesh) -> tuple[np.ndarray, tuple[int, int]]:
    """Generate deterministic local planar UVs without changing vertex positions."""
    vertices = np.asarray(mesh.vertices, dtype=np.float64)
    if len(vertices) == 0:
        return np.zeros((0, 2), dtype=np.float64), (0, 1)

    mins = vertices.min(axis=0)
    maxs = vertices.max(axis=0)
    spans = maxs - mins
    axes = np.argsort(spans)[::-1][:2]
    a0, a1 = int(axes[0]), int(axes[1])

    denom0 = spans[a0] if spans[a0] > 1e-8 else 1.0
    denom1 = spans[a1] if spans[a1] > 1e-8 else 1.0
    u = (vertices[:, a0] - mins[a0]) / denom0
    v = (vertices[:, a1] - mins[a1]) / denom1
    uv = np.column_stack((u, v))
    return np.clip(uv, 0.0, 1.0), (a0, a1)


def main() -> None:
    assert MODEL.exists(), MODEL
    assert MANIFEST.exists(), MANIFEST

    scene = trimesh.load(MODEL, force='scene')
    assert isinstance(scene, trimesh.Scene)

    geometry_count = 0
    vertex_count = 0
    axis_counts: dict[str, int] = {}

    for name, mesh in scene.geometry.items():
        assert isinstance(mesh, trimesh.Trimesh), name
        before = np.asarray(mesh.vertices).copy()
        uv, axes = planar_uv(mesh)
        assert len(uv) == len(mesh.vertices), name
        mesh.visual = TextureVisuals(uv=uv, material=CLAY)
        assert np.array_equal(before, np.asarray(mesh.vertices)), f'UV prep moved vertices: {name}'
        geometry_count += 1
        vertex_count += len(mesh.vertices)
        key = f'{axes[0]}{axes[1]}'
        axis_counts[key] = axis_counts.get(key, 0) + 1

    assert geometry_count >= 350, geometry_count
    assert vertex_count > 0

    TMP.write_bytes(scene.export(file_type='glb'))
    reloaded = trimesh.load(TMP, force='scene')
    assert isinstance(reloaded, trimesh.Scene)
    assert len(reloaded.geometry) == geometry_count

    uv_geometry_count = 0
    for name, mesh in reloaded.geometry.items():
        uv = getattr(mesh.visual, 'uv', None)
        assert uv is not None and len(uv) == len(mesh.vertices), f'UV missing after GLB round-trip: {name}'
        uv_geometry_count += 1

    assert uv_geometry_count == geometry_count
    TMP.replace(MODEL)

    manifest = json.loads(MANIFEST.read_text(encoding='utf-8'))
    manifest.update({
        'material_uv_ready': True,
        'material_uv_workflow': 'largest-axis-planar-uv-v1',
        'material_uv_geometry_count': geometry_count,
        'material_uv_vertex_count': vertex_count,
        'material_uv_axis_counts': axis_counts,
        'material_uv_preserves_geometry': True,
    })
    MANIFEST.write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')

    print(json.dumps({
        'ok': True,
        'workflow': manifest['material_uv_workflow'],
        'geometry_count': geometry_count,
        'vertex_count': vertex_count,
        'axis_counts': axis_counts,
        'bytes': MODEL.stat().st_size,
    }, indent=2))


if __name__ == '__main__':
    main()
