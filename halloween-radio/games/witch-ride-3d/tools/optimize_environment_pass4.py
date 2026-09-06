import json
from pathlib import Path
import numpy as np
import trimesh
from trimesh.exchange import gltf
from trimesh.visual.texture import TextureVisuals

ROOT=Path(__file__).resolve().parents[1]
MODELS=ROOT/'assets'/'models'
MANIFEST=ROOT/'assets'/'environment-material-pass.json'

ALIASES={
    'dead-tree.glb':{
        'split dead bark':'root_flare_bark_knot_combined'
    },
    'haunted-fence.glb':{
        'rain silvered fence wood':'broken_splinter_wood_combined',
        'rusted square nail':'nail_rusted_combined'
    },
    'jack-o-lantern.glb':{
        'weathered pumpkin skin':'pumpkin_lobe_combined',
        'dry pumpkin stem':'pumpkin_stem_combined',
        'carved pumpkin glow':'jack_eye_jack_mouth_glow_combined'
    }
}

def material_name(mesh):
    mat=getattr(getattr(mesh,'visual',None),'material',None)
    return getattr(mat,'name',None) or 'default'

def merge_model(filename):
    path=MODELS/filename
    src=trimesh.load(path,force='scene',process=False)
    groups={}
    for node in src.graph.nodes_geometry:
        transform,geom_name=src.graph[node]
        mesh=src.geometry[geom_name].copy()
        mesh.apply_transform(transform)
        groups.setdefault(material_name(mesh),[]).append(mesh)
    out=trimesh.Scene()
    aliases=ALIASES.get(filename,{})
    for key,meshes in groups.items():
        first_material=getattr(meshes[0].visual,'material',None)
        uv_parts=[getattr(m.visual,'uv',None) for m in meshes]
        combined=trimesh.util.concatenate(meshes)
        if first_material is not None and all(u is not None for u in uv_parts):
            combined.visual=TextureVisuals(uv=np.vstack(uv_parts),material=first_material)
        elif first_material is not None:
            try: combined.visual.material=first_material
            except Exception: pass
        name=aliases.get(key,'combined_'+''.join(ch if ch.isalnum() else '_' for ch in key).strip('_'))
        out.add_geometry(combined,node_name=name,geom_name=name)
    path.write_bytes(gltf.export_glb(out,include_normals=True,unitize_normals=True))
    return len(out.graph.nodes_geometry),sorted(groups)

counts={};materials={}
for filename in ALIASES:
    counts[filename],materials[filename]=merge_model(filename)

manifest=json.loads(MANIFEST.read_text())
manifest['models']=counts
manifest['optimization']={
    'mode':'merged-static-material-batches',
    'goal':'preserve detailed geometry while reducing mobile draw calls and shadow cost',
    'materials':materials
}
features=manifest.setdefault('features',[])
if 'static geometry merged for mobile draw calls' not in features:
    features.append('static geometry merged for mobile draw calls')
MANIFEST.write_text(json.dumps(manifest,indent=2))
print(json.dumps(manifest,indent=2))
