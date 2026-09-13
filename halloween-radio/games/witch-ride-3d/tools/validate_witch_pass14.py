from __future__ import annotations
import json,re
from pathlib import Path
import numpy as np
import trimesh
ROOT=Path(__file__).resolve().parents[1]
GLB=ROOT/'assets'/'models'/'witch-rider.glb'; MANIFEST=ROOT/'assets'/'witch-mesh-pass14.json'
assert GLB.exists() and MANIFEST.exists()
assert GLB.stat().st_size>=540_000,GLB.stat().st_size
meta=json.loads(MANIFEST.read_text())
assert meta['pass']=='pass-14-mesh-only-v24'
assert meta['review']=='neutral-clay-mesh-review-only'
assert meta['materials_applied'] is False
assert meta['geometry_strategy']=='full organic lofted silhouette; no visible primitive columns'
assert meta['mane_primary_locks']==9 and meta['mane_shoulder_locks']>=7
assert 3<=meta['cape_primary_folds']<=5
assert meta['broom_bristles']>=216 and meta['broom_straw_clumps']>=48
scene=trimesh.load(GLB,force='scene'); nodes=set(scene.graph.nodes)
required={'hair_01','hair_02','hair_03','hair_04','hair_05','cape','cape_left','cape_center','cape_right','hat_tip','broom_handle','broom_bristles'}
assert not(required-nodes),sorted(required-nodes)
for n in ['torso_core','arm_L','arm_R','leg_L','leg_R','boot_L','boot_R','hand_L','hand_R','hat_brim','hat_crown','broom_shaft','seat_wrap']:
    assert n in nodes,n
mane=sorted(n for n in nodes if re.fullmatch(r'mane_lock_\d{2}',n)); assert len(mane)==9,mane
shoulder=sorted(n for n in nodes if re.fullmatch(r'mane_shoulder_\d{2}',n)); assert len(shoulder)>=7
folds=sorted(n for n in nodes if re.fullmatch(r'cape_fold_[1-4]',n)); assert len(folds)==4
bristles=sorted(n for n in nodes if re.fullmatch(r'bristle_\d{3}',n)); assert len(bristles)>=240
bad=('braid','hair_strand','hair_curl','cape_wedge','shoulder_bar','upper_arm_','forearm_','thigh_','calf_','coat_skirt')
assert not any(any(tok in n.lower() for tok in bad) for n in nodes)
def mw(n):
    T,g=scene.graph[n]; m=scene.geometry[g].copy(); m.apply_transform(T); return m
def center(n): return mw(n).bounds.mean(axis=0)
def dims(n): b=mw(n).bounds; return b[1]-b[0]
for n in ['torso_core','arm_L','arm_R','leg_L','leg_R','boot_L','boot_R','hat_brim','hat_crown','broom_shaft']+mane+folds:
    m=mw(n); assert len(m.vertices)>30 and len(m.faces)>40,n
    assert np.isfinite(m.vertices).all() and np.isfinite(m.face_normals).all(),n
    assert m.is_watertight,f'{n} is not closed'
t=mw('torso_core'); v=t.vertices
def band(y0,y1):
    q=v[(v[:,1]>=y0)&(v[:,1]<=y1)]; assert len(q)>12; return np.ptp(q[:,0]),q[:,2].mean()
pelvis_w,pz=band(.55,.86); waist_w,wz=band(1.13,1.34); rib_w,rz=band(1.75,2.12)
assert pelvis_w>=1.42 and rib_w>=1.70 and waist_w<=1.18,(pelvis_w,waist_w,rib_w)
assert rib_w>=waist_w*1.45 and pelvis_w>=waist_w*1.20
assert rz < wz-0.28 and wz < pz-0.12,(pz,wz,rz)
for side,sgn in [('L',-1),('R',1)]:
    av=mw(f'arm_{side}').vertices
    assert sgn*av[:,0].max()>1.05 if sgn==1 else sgn*av[:,0].min()>1.05
    h=center(f'hand_{side}'); assert abs(h[0])<0.32 and .45<h[1]<.82 and h[2]<-1.48,h
for side,sgn in [('L',-1),('R',1)]:
    lv=mw(f'leg_{side}').vertices; assert (lv[:,0].max()>1.10 if sgn==1 else lv[:,0].min()<-1.10),side
    b=center(f'boot_{side}'); assert b[1]<-0.92 and abs(b[0])>.60,b
sv=mw('broom_shaft').vertices
for side in ('L','R'):
    hv=mw(f'hand_{side}').vertices
    d=float(np.linalg.norm(hv[:,None,:]-sv[None,:,:],axis=2).min()); assert d<.16,(side,d)
allh=np.vstack([mw(n).vertices for n in mane+shoulder]); hs=np.ptp(allh,axis=0)
assert hs[0]>=1.95 and hs[1]>=1.20 and hs[2]>=.45,hs
for n in mane:
    d=dims(n); assert d[0]>=.42 and d[1]>=.80 and d[2]>=.14,(n,d)
allc=np.vstack([mw(n).vertices for n in folds]); cs=np.ptp(allc,axis=0)
assert cs[0]>=2.35 and cs[1]>=1.60 and cs[2]>=.55,cs
for n in folds:
    d=dims(n); assert d[0]>=.54 and d[1]>=1.35 and d[2]>=.18,(n,d)
hd=dims('hat_brim'); assert hd[0]>=2.45 and hd[1]>=.30 and hd[2]>=1.45,hd
sb=mw('broom_shaft').bounds; assert sb[0,2]<-3.1 and sb[1,2]>1.50,sb
straw_names=[n for n in nodes if n.startswith('straw_mass_')]; assert len(straw_names)>=56
st=np.vstack([mw(n).vertices for n in straw_names]); ss=np.ptp(st,axis=0)
assert ss[0]>=1.25 and ss[1]>=.85 and ss[2]>=1.35,ss
assert st[:,1].min()<-0.90 and st[:,1].max()<0.50,'bundle must visibly trail downward'
for n in mane+folds+['torso_core','arm_L','arm_R']:
    assert mw(n).bounds[1,2] < 1.10,(n,mw(n).bounds[1,2])
bounds=np.asarray(scene.bounds,float); assert bounds[1,2]<3.65,bounds
for g in scene.geometry.values():
    mat=getattr(getattr(g,'visual',None),'material',None)
    if mat is None: continue
    met=getattr(mat,'metallicFactor',0.0); rough=getattr(mat,'roughnessFactor',1.0)
    if met is not None: assert float(met)<=.01
    if rough is not None: assert float(rough)>=.95
print(json.dumps({'ok':True,'pass':meta['pass'],'bytes':GLB.stat().st_size,'nodes':len(nodes),'geometries':len(scene.geometry),'bristles':len(bristles),'torso_widths':[pelvis_w,waist_w,rib_w],'mane_span':hs.tolist(),'cape_span':cs.tolist(),'straw_span':ss.tolist(),'bounds':bounds.tolist()},indent=2))
