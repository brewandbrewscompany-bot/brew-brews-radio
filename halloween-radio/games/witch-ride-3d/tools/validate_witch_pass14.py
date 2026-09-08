from __future__ import annotations
import json,re
from pathlib import Path
import numpy as np
import trimesh

ROOT=Path(__file__).resolve().parents[1]
GLB=ROOT/'assets'/'models'/'witch-rider.glb'
MANIFEST=ROOT/'assets'/'witch-mesh-pass14.json'
GAME=ROOT/'game.js'

assert GLB.exists() and MANIFEST.exists() and GAME.exists()
assert GLB.stat().st_size>=540_000,GLB.stat().st_size
meta=json.loads(MANIFEST.read_text(encoding='utf-8'))
assert meta['pass']=='pass-14-mesh-only-v24'
assert meta['review']=='neutral-clay-mesh-review-only'
assert meta['materials_applied'] is False
assert meta['geometry_strategy']=='full organic lofted silhouette; no visible primitive columns'
assert 12<=meta['hair_main_locks']<=16,meta['hair_main_locks']
assert 6<=meta['hair_overlap_locks']<=10,meta['hair_overlap_locks']
assert meta['hair_main_locks']==14 and meta['hair_overlap_locks']==8
assert meta['mane_primary_locks']==14 and meta['mane_shoulder_locks']==8
assert meta['hair_cap'] is True
assert meta['hair_root_motion']=='anchored'
assert meta['hair_mid_motion']=='mild lag'
assert meta['hair_tip_motion']=='highest secondary motion'
assert meta['hat_motion']=='locked'
assert 'pre-swept backward' in meta['hair_workflow']
assert 'smooth cards' in meta['hair_workflow']
assert 3<=meta['cape_primary_folds']<=5
assert meta['broom_bristles']==240,meta['broom_bristles']
assert meta['broom_straw_clumps']==56,meta['broom_straw_clumps']
assert meta['lower_body_workflow']=='authored narrow straddle; no runtime physics pose correction'
assert meta['lower_body_pose']=='pelvis seated; inner thighs grip broom; knees tucked; boots trail close'
assert meta['lower_body_leg_mass']=='fuller human thighs and calves'
assert meta['lower_body_runtime_physics'] is False
assert meta['lower_body_max_knee_center_x']<=.60,meta['lower_body_max_knee_center_x']
assert meta['lower_body_ankle_center_x']<=.48,meta['lower_body_ankle_center_x']

scene=trimesh.load(GLB,force='scene')
nodes=set(scene.graph.nodes)
required={'hair_01','hair_02','hair_03','hair_04','hair_05','cape','cape_left','cape_center','cape_right','hat_tip','broom_handle','broom_bristles'}
assert not(required-nodes),sorted(required-nodes)
for n in ['torso_core','arm_L','arm_R','leg_L','leg_R','boot_L','boot_R','hand_L','hand_R','hat_brim','hat_crown','broom_shaft','seat_wrap','hair_cap']:
    assert n in nodes,n

main=sorted(n for n in nodes if re.fullmatch(r'hair_main_\d{2}',n)); assert len(main)==14,main
overlap=sorted(n for n in nodes if re.fullmatch(r'hair_overlap_\d{2}',n)); assert len(overlap)==8,overlap
old_mane=sorted(n for n in nodes if re.fullmatch(r'mane_(?:lock|shoulder)_\d{2}',n)); assert not old_mane,old_mane
folds=sorted(n for n in nodes if re.fullmatch(r'cape_fold_[1-4]',n)); assert len(folds)==4
bristles=sorted(n for n in nodes if re.fullmatch(r'bristle_\d{3}',n)); assert len(bristles)==240,len(bristles)
straw_names=sorted(n for n in nodes if re.fullmatch(r'straw_mass_\d{2}',n)); assert len(straw_names)==56,len(straw_names)
bad=('braid','hair_strand','hair_curl','hair_tube','dangling','spike','cape_wedge','shoulder_bar','upper_arm_','forearm_','thigh_','calf_','coat_skirt')
assert not any(any(tok in n.lower() for tok in bad) for n in nodes)

def mw(n):
    T,g=scene.graph[n]
    m=scene.geometry[g].copy()
    m.apply_transform(T)
    return m

def center(n): return mw(n).bounds.mean(axis=0)
def dims(n):
    b=mw(n).bounds
    return b[1]-b[0]

solid_names=['torso_core','arm_L','arm_R','leg_L','leg_R','boot_L','boot_R','hat_brim','hat_crown','broom_shaft','hair_cap']+main+overlap+folds
for n in solid_names:
    m=mw(n)
    assert len(m.vertices)>30 and len(m.faces)>40,n
    assert np.isfinite(m.vertices).all() and np.isfinite(m.face_normals).all(),n
    assert m.is_watertight,f'{n} is not closed'

t=mw('torso_core'); v=t.vertices
def band(y0,y1):
    q=v[(v[:,1]>=y0)&(v[:,1]<=y1)]
    assert len(q)>12
    return np.ptp(q[:,0]),q[:,2].mean()
pelvis_w,pz=band(.55,.86); waist_w,wz=band(1.13,1.34); rib_w,rz=band(1.75,2.12)
assert pelvis_w>=1.42 and rib_w>=1.70 and waist_w<=1.18,(pelvis_w,waist_w,rib_w)
assert rib_w>=waist_w*1.45 and pelvis_w>=waist_w*1.20
assert rz < wz-0.28 and wz < pz-0.12,(pz,wz,rz)

for side,sgn in [('L',-1),('R',1)]:
    av=mw(f'arm_{side}').vertices
    assert (av[:,0].max()>1.05 if sgn==1 else av[:,0].min()<-1.05),side
    h=center(f'hand_{side}')
    assert abs(h[0])<0.32 and .45<h[1]<.82 and h[2]<-1.48,h

# Lower body is authored as a narrow riding straddle.  These gates explicitly
# reject the old wide-splayed pose while also requiring more human thigh/calf mass.
leg_meshes={side:mw(f'leg_{side}') for side in ('L','R')}
boot_meshes={side:mw(f'boot_{side}') for side in ('L','R')}
all_legs=np.vstack([leg_meshes['L'].vertices,leg_meshes['R'].vertices])
all_boots=np.vstack([boot_meshes['L'].vertices,boot_meshes['R'].vertices])
leg_span=np.ptp(all_legs,axis=0)
boot_span=np.ptp(all_boots,axis=0)
assert 1.70<=leg_span[0]<=1.90,leg_span
assert 1.36<=boot_span[0]<=1.50,boot_span
assert all_legs[:,0].min()>-.95 and all_legs[:,0].max()<.95,(all_legs[:,0].min(),all_legs[:,0].max())

leg_centers={}
boot_centers={}
for side,sgn in [('L',-1),('R',1)]:
    lm=leg_meshes[side]; lv=lm.vertices; ld=dims(f'leg_{side}'); lc=center(f'leg_{side}')
    leg_centers[side]=lc
    assert .47<=abs(lc[0])<=.58,(side,lc)
    assert .72<=ld[0]<=.84 and 1.58<=ld[1]<=1.75 and ld[2]>=1.00,(side,ld)
    assert abs(float(lm.volume))>=.49,(side,lm.volume)
    assert (lv[:,0].min()>-.95 if sgn==-1 else lv[:,0].max()<.95),(side,lm.bounds)
    assert (lv[:,0].max()>-.18 if sgn==-1 else lv[:,0].min()<.18),(side,lm.bounds)
    seat_band=lv[(lv[:,1]>=.45)&(lv[:,1]<=.82)&(lv[:,2]>=-.20)&(lv[:,2]<=.28)]
    assert len(seat_band)>20,(side,len(seat_band))
    assert float(np.abs(seat_band[:,0]).min())<.18,(side,float(np.abs(seat_band[:,0]).min()))

    bm=boot_meshes[side]; bd=dims(f'boot_{side}'); bc=center(f'boot_{side}')
    boot_centers[side]=bc
    assert .40<=abs(bc[0])<=.50 and bc[1]<-.93,(side,bc)
    assert .48<=bd[0]<=.58 and .54<=bd[1]<=.66 and .54<=bd[2]<=.67,(side,bd)
    assert (bm.vertices[:,0].max()>-.20 if sgn==-1 else bm.vertices[:,0].min()<.20),(side,bm.bounds)

assert abs(leg_centers['L'][0]+leg_centers['R'][0])<.03,leg_centers
assert abs(boot_centers['L'][0]+boot_centers['R'][0])<.03,boot_centers
assert abs(boot_centers['L'][0])<abs(leg_centers['L'][0]) and abs(boot_centers['R'][0])<abs(leg_centers['R'][0]),(leg_centers,boot_centers)

sv=mw('broom_shaft').vertices
for side in ('L','R'):
    hv=mw(f'hand_{side}').vertices
    d=float(np.linalg.norm(hv[:,None,:]-sv[None,:,:],axis=2).min())
    assert d<.16,(side,d)

# Hair shape is authored, not solved by runtime wind.  The whole mass must be
# broad over the shoulders, shallow in vertical drop, and much longer aft.  This
# rejects both dangling hair and the flat chase-view shelf seen in earlier tries.
hair_names=main+overlap+['hair_cap']
allh=np.vstack([mw(n).vertices for n in hair_names]); hs=np.ptp(allh,axis=0)
assert hs[0]>=2.28 and .86<=hs[1]<=1.08 and hs[2]>=3.25,hs
assert hs[2]>=hs[1]*3.0,hs
cap=dims('hair_cap')
assert cap[0]>=1.15 and cap[1]>=.68 and cap[2]>=.66,cap
cap_bounds=mw('hair_cap').bounds
hat_bounds=mw('hat_brim').bounds
assert cap_bounds[1,1]<=hat_bounds[1,1]+.04,(cap_bounds,hat_bounds)
assert cap_bounds[0,1]>=2.42,cap_bounds

# Each main lock is now a smooth, narrow card instead of a large pointed leaf.
for n in main:
    m=mw(n); d=dims(n); b=m.bounds
    assert len(m.vertices)>700 and len(m.faces)>1300,(n,len(m.vertices),len(m.faces))
    assert .32<=d[0]<=.62 and .56<=d[1]<=.78 and d[2]>=2.42,(n,d)
    assert d[2]>=d[1]*3.20,(n,d)
    assert b[0,2]<-.60 and b[1,2]>1.70,(n,b)
for n in overlap:
    m=mw(n); d=dims(n); b=m.bounds
    assert len(m.vertices)>500 and len(m.faces)>900,(n,len(m.vertices),len(m.faces))
    assert .25<=d[0]<=.50 and .47<=d[1]<=.59 and d[2]>=1.70,(n,d)
    assert d[2]>=d[1]*2.90,(n,d)
    assert b[0,2]<-.60 and b[1,2]>.95,(n,b)

mainv=np.vstack([mw(n).vertices for n in main])
shoulder_band=mainv[(mainv[:,2]>=-.38)&(mainv[:,2]<=.30)]
tip_band=mainv[mainv[:,2]>=1.45]
assert len(shoulder_band)>200 and len(tip_band)>100,(len(shoulder_band),len(tip_band))
shoulder_w=float(np.ptp(shoulder_band[:,0])); tip_w=float(np.ptp(tip_band[:,0]))
assert shoulder_w>=2.28,(shoulder_w,tip_w)
assert shoulder_w>=tip_w*1.18,(shoulder_w,tip_w)
# Roots begin directly beneath the brim.  Tips move strongly aft but only drop
# into the upper-back zone; if they fall lower than this, the mane becomes a collar.
roots=mainv[(mainv[:,1]>=2.88)&(mainv[:,2]<=-.55)]
assert len(roots)>120,len(roots)
assert mainv[:,2].max()>=2.18,mainv[:,2].max()
assert 2.20<=mainv[:,1].min()<=2.30,mainv[:,1].min()

allc=np.vstack([mw(n).vertices for n in folds]); cs=np.ptp(allc,axis=0)
assert cs[0]>=2.35 and cs[1]>=1.60 and cs[2]>=.55,cs
for n in folds:
    d=dims(n)
    assert d[0]>=.54 and d[1]>=1.35 and d[2]>=.18,(n,d)
hd=dims('hat_brim'); assert hd[0]>=2.45 and hd[1]>=.30 and hd[2]>=1.45,hd
sb=mw('broom_shaft').bounds; assert sb[0,2]<-3.1 and sb[1,2]>1.50,sb

st=np.vstack([mw(n).vertices for n in straw_names]); ss=np.ptp(st,axis=0)
assert ss[0]>=1.25 and ss[1]>=.85 and ss[2]>=1.35,ss
assert st[:,1].min()<-0.90 and st[:,1].max()<0.50,'bundle must visibly trail downward'
# Keep the strengthened production density: never weaken this to the old 72-bristle minimum.
assert len(bristles)==240 and len(straw_names)==56
for n in folds+['torso_core','arm_L','arm_R']:
    assert mw(n).bounds[1,2] < 1.10,(n,mw(n).bounds[1,2])
for n in main:
    assert mw(n).bounds[1,2] < 2.30,(n,mw(n).bounds[1,2])
bounds=np.asarray(scene.bounds,float); assert bounds[1,2]<3.65,bounds

for g in scene.geometry.values():
    mat=getattr(getattr(g,'visual',None),'material',None)
    if mat is None: continue
    met=getattr(mat,'metallicFactor',0.0); rough=getattr(mat,'roughnessFactor',1.0)
    if met is not None: assert float(met)<=.01
    if rough is not None: assert float(rough)>=.95

runtime=GAME.read_text(encoding='utf-8')
assert 'const hairMotion=[' in runtime
assert "{bank:.02,kick:.04,wind:.10,wobble:.08,stiff:38,damp:11.5}" in runtime
assert "{bank:.14,kick:.30,wind:.82,wobble:.72,stiff:23,damp:7.1}" in runtime
assert 'const h=hairRig[i],m=h.motion||' in runtime
assert 'hatTip.node.setLocalEulerAngles(b.x,b.y,b.z)' in runtime
assert 'springRoll(hatTip' not in runtime
assert 'wind*(3.2+i*.42)' not in runtime

print(json.dumps({
    'ok':True,
    'pass':meta['pass'],
    'bytes':GLB.stat().st_size,
    'nodes':len(nodes),
    'geometries':len(scene.geometry),
    'hair_main_locks':len(main),
    'hair_overlap_locks':len(overlap),
    'hair_cap':True,
    'hair_span':hs.tolist(),
    'hair_shoulder_width':shoulder_w,
    'hair_tip_width':tip_w,
    'hair_lowest_chase_y':float(mainv[:,1].min()),
    'lower_body_leg_span':leg_span.tolist(),
    'lower_body_boot_span':boot_span.tolist(),
    'lower_body_leg_centers':{k:v.tolist() for k,v in leg_centers.items()},
    'lower_body_boot_centers':{k:v.tolist() for k,v in boot_centers.items()},
    'bristles':len(bristles),
    'straw_clumps':len(straw_names),
    'torso_widths':[pelvis_w,waist_w,rib_w],
    'cape_span':cs.tolist(),
    'straw_span':ss.tolist(),
    'bounds':bounds.tolist(),
},indent=2))
