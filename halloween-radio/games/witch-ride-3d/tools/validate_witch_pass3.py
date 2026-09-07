import json, struct
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
MODEL=ROOT/'assets/models/witch-rider.glb'
MANIFEST=ROOT/'assets/witch-material-pass.json'
RUNTIME=ROOT/'witch-centerpiece-pass.js'


def fail(msg):
    raise SystemExit('WITCH PASS 12 VALIDATION FAILED: '+msg)

if not MODEL.is_file() or MODEL.stat().st_size < 900_000:
    fail('production witch GLB missing or unexpectedly small')
b=MODEL.read_bytes()
if b[:4] != b'glTF': fail('invalid GLB magic')
magic,version,total=struct.unpack_from('<4sII',b,0)
if version != 2 or total != len(b): fail('invalid GLB header')
off=12; chunk_len,chunk_type=struct.unpack_from('<II',b,off); off+=8
if chunk_type != 0x4E4F534A: fail('first GLB chunk is not JSON')
gltf=json.loads(b[off:off+chunk_len].decode('utf-8').rstrip('\x00 '))

nodes=gltf.get('nodes',[])
names=[n.get('name','') for n in nodes]
index={n:i for i,n in enumerate(names) if n}
parents={}
for i,n in enumerate(nodes):
    for c in n.get('children',[]): parents[c]=i

required=[
    'cape','cape_left','cape_center','cape_right','cape_weighted_hem',
    'hair_01','hair_02','hair_03','hair_04','hair_05',
    'hat_tip','hat_tip_mesh','hat_brim','hat_brim_edge','hat_crown','hat_band',
    'high_collar','head_shadow','body_core','torso_taper','coat_skirt',
    'glove_-1','glove_1','boot_-1','boot_1',
    'broom_handle','broom_shaft','broom_bristles'
]
missing=[n for n in required if n not in index]
if missing: fail('missing nodes: '+', '.join(missing))
if 'head' in index: fail('legacy exposed head node still present')
for child in ['cape_left','cape_center','cape_right']:
    if parents.get(index[child]) != index['cape']:
        fail(f'{child} is not parented to cape motion root')
if parents.get(index['broom_bristles']) != index['broom_handle']:
    fail('broom_bristles is not parented to broom_handle')
if parents.get(index['hat_tip_mesh']) != index['hat_tip']:
    fail('hat_tip_mesh is not parented to hat_tip motion root')

bristles=[n for n in names if n.startswith('broom_bristle_')]
if len(bristles) < 72: fail(f'expected >=72 broom bristles, found {len(bristles)}')
hair_locks=[n for n in names if n.startswith('hair_') and len(n)==7 and n[-2:].isdigit()]
if len(hair_locks) != 5: fail(f'expected 5 animated hair locks, found {len(hair_locks)}')
root_hair=[n for n in names if n.startswith('hair_root_') or n.startswith('hair_under_')]
if len(root_hair) < 24: fail(f'expected >=24 skull/nape hair coverage elements, found {len(root_hair)}')
flyaways=[n for n in names if n.startswith('hair_flyaway_')]
if len(flyaways) < 8: fail(f'expected >=8 restrained hair flyaways, found {len(flyaways)}')

materials={m.get('name','') for m in gltf.get('materials',[])}
required_mats={
    'aged black felt','heavy charcoal wool','oxblood wool lining',
    'deep auburn hair','copper auburn hair','aged crooked ash broom',
    'dark broom straw','tarnished brass'
}
if not required_mats.issubset(materials):
    fail('missing PBR materials: '+', '.join(sorted(required_mats-materials)))
for mesh in gltf.get('meshes',[]):
    for prim in mesh.get('primitives',[]):
        attrs=prim.get('attributes',{})
        if 'POSITION' not in attrs or 'NORMAL' not in attrs:
            fail('mesh primitive lacks explicit POSITION/NORMAL')
if len(gltf.get('images',[])) < 30:
    fail('expected embedded PBR image maps in GLB')

if not MANIFEST.is_file(): fail('witch manifest missing')
manifest=json.loads(MANIFEST.read_text())
if manifest.get('version')!='witch-material-pass-v2':
    fail('compatibility manifest version changed unexpectedly')
if manifest.get('build_version')!='witch-realism-pass-v3':
    fail('production witch build_version missing')
if manifest.get('build')!='pass-12-witch-silhouette-correction':
    fail('Pass 12 silhouette build marker missing')
if manifest.get('broom_bristle_count',0)<72:
    fail('manifest broom bristle count below 72')
if manifest.get('cape_panel_count')!=3 or manifest.get('hair_lock_count')!=5:
    fail('manifest cape/hair motion counts incorrect')
if manifest.get('hair_root_tube_count',0)<24:
    fail('manifest skull/nape hair coverage below 24')
if manifest.get('bytes') != len(b):
    fail('manifest GLB byte count does not match production file')
features=set(manifest.get('features',[]))
for feature in [
    'broad overlapping auburn lock clusters','heavy narrow wool cape',
    'weighted irregular hem','human rider proportions','crooked thick wood handle'
]:
    if feature not in features: fail('missing Pass 12 silhouette feature marker: '+feature)

if not RUNTIME.is_file(): fail('centerpiece runtime missing')
rt=RUNTIME.read_text()
for marker in ['witch-centerpiece-pass-v12','witch-realism-pass-v3','pass-12-silhouette-correction-v1']:
    if marker not in rt: fail('runtime pass version marker missing: '+marker)
for banned in ['localStorage','sessionStorage','Audio(','new Audio','playback','shuffle','favorites','Ghost Tune','Haunted Auto Tune']:
    if banned in rt: fail('runtime pass must not touch radio behavior: '+banned)

print(json.dumps({
    'ok':True,
    'pass':'12-silhouette-correction',
    'glb_bytes':len(b),
    'nodes':len(nodes),
    'meshes':len(gltf.get('meshes',[])),
    'materials':len(materials),
    'images':len(gltf.get('images',[])),
    'hair_locks':len(hair_locks),
    'hair_coverage':len(root_hair),
    'flyaways':len(flyaways),
    'bristles':len(bristles),
    'cape_panels':3
},indent=2))
