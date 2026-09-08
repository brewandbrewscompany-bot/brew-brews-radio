from __future__ import annotations
import json, re
from pathlib import Path
import numpy as np
import trimesh

ROOT=Path(__file__).resolve().parents[1]
GLB=ROOT/'assets'/'models'/'witch-rider.glb'
MANIFEST=ROOT/'assets'/'witch-mesh-pass14.json'
assert GLB.exists() and MANIFEST.exists()
assert GLB.stat().st_size >= 500_000, GLB.stat().st_size
meta=json.loads(MANIFEST.read_text())
assert meta['pass']=='pass-14-mesh-only-v23'
assert meta['review']=='neutral-clay-mesh-review-only'
assert meta['materials_applied'] is False
assert meta['geometry_strategy']=='full organic lofts from fuller pre-v21 silhouette'
assert meta['mane_primary_locks']==5 and meta['mane_fillers']>=6
assert 3 <= meta['cape_primary_folds'] <= 5
assert meta['broom_bristles']>=144 and meta['broom_straw_clumps']>=30

scene=trimesh.load(GLB,force='scene')
nodes=set(scene.graph.nodes)
required={'hair_01','hair_02','hair_03','hair_04','hair_05','cape','cape_left','cape_center','cape_right','hat_tip','broom_handle','broom_bristles'}
assert not (required-nodes), sorted(required-nodes)
for n in ['torso_core','arm_L','arm_R','leg_L','leg_R','boot_L','boot_R','hand_L','hand_R','hat_brim','hat_crown','broom_shaft','seat_wrap']:
    assert n in nodes, n
for i in range(1,6): assert f'mane_lock_{i}' in nodes
for i in range(1,5): assert f'cape_fold_{i}' in nodes
bristles=sorted(n for n in nodes if re.fullmatch(r'bristle_\d{3}',n))
assert len(bristles)>=216, len(bristles)
assert not any(any(tok in n.lower() for tok in ('braid','hair_strand','hair_curl','cape_wedge','shoulder_bar','upper_arm_','forearm_','thigh_','calf_')) for n in nodes)

def mesh_world(node):
    T,gn=scene.graph[node]; m=scene.geometry[gn].copy(); m.apply_transform(T); return m

def center(node): return mesh_world(node).bounds.mean(axis=0)

def dims(node):
    b=mesh_world(node).bounds; return b[1]-b[0]

for n in ['torso_core','arm_L','arm_R','leg_L','leg_R','boot_L','boot_R','hat_brim','hat_crown','broom_shaft']+[f'mane_lock_{i}' for i in range(1,6)]+[f'cape_fold_{i}' for i in range(1,5)]:
    m=mesh_world(n)
    assert len(m.vertices)>30 and len(m.faces)>40, n
    assert np.isfinite(m.vertices).all() and np.isfinite(m.face_normals).all(), n
    assert m.is_watertight, f'{n} open/backface shell'

m=mesh_world('torso_core'); b=m.bounds; d=b[1]-b[0]
assert d[0] >= 1.65 and d[1] >= 1.55 and d[2] >= 0.70, d
v=m.vertices
widths=[]
for y0,y1 in [(0.48,0.92),(1.04,1.32),(1.68,2.12)]:
    q=v[(v[:,1]>=y0)&(v[:,1]<=y1)]
    assert len(q)>10
    widths.append(float(np.ptp(q[:,0])))
pelvis_w, waist_w, rib_w=widths
assert pelvis_w >= 1.20 and rib_w >= 1.45 and waist_w <= min(pelvis_w,rib_w)*0.88, widths
low=v[(v[:,1]>.55)&(v[:,1]<.9),2].mean(); high=v[(v[:,1]>1.85)&(v[:,1]<2.15),2].mean()
assert high < low-0.35,(low,high)

for side,sgn in [('L',-1),('R',1)]:
    lc=center(f'leg_{side}'); bc=center(f'boot_{side}')
    assert sgn*lc[0] > 0.52, (side,lc)
    assert lc[1] < 0.35 and bc[1] < -0.55, (lc,bc)
for side in ('L','R'):
    hand=center(f'hand_{side}')
    assert abs(hand[0]) < 0.48 and 0.45 < hand[1] < 0.85 and hand[2] < -1.35, hand

shaft=mesh_world('broom_shaft').vertices
for side in ('L','R'):
    hp=mesh_world(f'hand_{side}').vertices
    ds=np.linalg.norm(hp[:,None,:]-shaft[None,:,:],axis=2)
    assert float(ds.min()) < 0.13, (side,float(ds.min()))

allm=np.vstack([mesh_world(f'mane_lock_{i}').vertices for i in range(1,6)])
span=np.ptp(allm,axis=0)
assert span[0] >= 1.45 and span[1] >= 1.15 and span[2] >= 0.40, span
for i in range(1,6):
    dm=dims(f'mane_lock_{i}')
    assert dm[0] >= 0.38 and dm[1] >= 0.85 and dm[2] >= 0.20, (i,dm)

cap=np.vstack([mesh_world(f'cape_fold_{i}').vertices for i in range(1,5)])
cspan=np.ptp(cap,axis=0)
assert cspan[0] >= 2.05 and cspan[1] >= 1.75 and cspan[2] >= 0.55, cspan
for i in range(1,5):
    dc=dims(f'cape_fold_{i}')
    assert dc[0] >= 0.70 and dc[1] >= 1.70 and dc[2] >= 0.20, (i,dc)

hd=dims('hat_brim'); assert hd[0] >= 2.35 and hd[2] >= 1.35, hd
assert hd[0]/rib_w < 1.8, (hd[0],rib_w)

shaftm=mesh_world('broom_shaft'); sb=shaftm.bounds
assert sb[0,2] < -2.9 and sb[1,2] > 1.65, sb
assert sb[0,1] < 0.38 and sb[1,1] > 0.65, sb
straw=np.vstack([mesh_world(n).vertices for n in nodes if n.startswith('straw_mass_')])
ss=np.ptp(straw,axis=0)
assert ss[0] >= 1.20 and ss[1] >= 0.85 and ss[2] >= 1.20, ss

bounds=np.asarray(scene.bounds,float)
assert bounds[1,2] < 4.25, bounds
for n in [f'mane_lock_{i}' for i in range(1,6)]+[f'cape_fold_{i}' for i in range(1,5)]+['torso_core']:
    assert mesh_world(n).bounds[1,2] < 1.15, (n,mesh_world(n).bounds[1,2])

for g in scene.geometry.values():
    mat=getattr(getattr(g,'visual',None),'material',None)
    if mat is None: continue
    met=getattr(mat,'metallicFactor',0.0); rough=getattr(mat,'roughnessFactor',1.0)
    if met is not None: assert float(met)<=0.01
    if rough is not None: assert float(rough)>=0.95

print(json.dumps({'ok':True,'pass':meta['pass'],'bytes':GLB.stat().st_size,'nodes':len(nodes),'geometries':len(scene.geometry),'bristles':len(bristles),'torso_widths':widths,'mane_span':span.tolist(),'cape_span':cspan.tolist(),'straw_span':ss.tolist(),'bounds':bounds.tolist()},indent=2))
