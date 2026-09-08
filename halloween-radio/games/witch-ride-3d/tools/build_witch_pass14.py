from __future__ import annotations
import json, math
from pathlib import Path
import numpy as np
import trimesh
from trimesh.visual.material import PBRMaterial

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets' / 'models' / 'witch-rider.glb'
MANIFEST = ROOT / 'assets' / 'witch-mesh-pass14.json'
OUT.parent.mkdir(parents=True, exist_ok=True)

CLAY = PBRMaterial(name='neutral_clay_mesh_review', baseColorFactor=[0.47,0.45,0.43,1.0], metallicFactor=0.0, roughnessFactor=1.0)
scene = trimesh.Scene()
scene.metadata.update({'pass':'pass-14-mesh-only-v24','review':'neutral-clay-mesh-review-only','intent':'full organic rear-view rider silhouette with readable body mane cape and broom'})

def clean(m):
    m.remove_unreferenced_vertices()
    try: m.merge_vertices()
    except Exception: pass
    try: m.fix_normals(multibody=True)
    except TypeError: m.fix_normals()
    m.visual.material=CLAY
    return m

def add(m,name,parent=None):
    clean(m); scene.add_geometry(m,node_name=name,geom_name=name,parent_node_name=parent); return m

def ellipsoid(scale,center,name,parent=None,subdivisions=3):
    m=trimesh.creation.icosphere(subdivisions=subdivisions,radius=1.0)
    T=np.eye(4); T[:3,:3]=np.diag(scale); T[:3,3]=center; m.apply_transform(T)
    return add(m,name,parent)

def organic_tube(points,rx,rz,name,parent=None,sections=30):
    pts=np.asarray(points,float); n=len(pts)
    rx=np.asarray(rx if hasattr(rx,'__len__') else [rx]*n,float); rz=np.asarray(rz if hasattr(rz,'__len__') else [rz]*n,float)
    verts=[]; prev_n=None
    for i,p in enumerate(pts):
        if i==0: tangent=pts[1]-pts[0]
        elif i==n-1: tangent=pts[-1]-pts[-2]
        else: tangent=pts[i+1]-pts[i-1]
        tangent=tangent/np.linalg.norm(tangent)
        ref=np.array([0.,0.,1.]) if abs(tangent[2])<0.82 else np.array([1.,0.,0.])
        n1=np.cross(tangent,ref); n1/=np.linalg.norm(n1)
        if prev_n is not None and np.dot(n1,prev_n)<0: n1=-n1
        n2=np.cross(tangent,n1); n2/=np.linalg.norm(n2); prev_n=n1
        for j in range(sections):
            a=2*math.pi*j/sections; scallop=1.0+0.035*math.sin(3*a+i*0.6)
            verts.append(p+math.cos(a)*rx[i]*scallop*n1+math.sin(a)*rz[i]*n2)
    faces=[]
    for i in range(n-1):
        a0=i*sections; b0=(i+1)*sections
        for j in range(sections):
            k=(j+1)%sections; faces += [[a0+j,b0+j,a0+k],[a0+k,b0+j,b0+k]]
    c0=len(verts); verts.append(pts[0]); c1=len(verts); verts.append(pts[-1])
    for j in range(sections):
        k=(j+1)%sections; faces.append([c0,k,j]); a=(n-1)*sections; faces.append([c1,a+j,a+k])
    return add(trimesh.Trimesh(vertices=np.asarray(verts),faces=np.asarray(faces),process=True),name,parent)

def torso_shell():
    rings=[
        (0.00,0.56,-0.02,0.76,0.44),(0.00,0.78,-0.08,0.78,0.43),(0.00,1.03,-0.18,0.62,0.36),
        (0.00,1.24,-0.30,0.52,0.32),(0.00,1.48,-0.43,0.62,0.36),(0.00,1.76,-0.58,0.78,0.42),
        (0.00,1.98,-0.70,0.90,0.43),(0.00,2.13,-0.76,0.94,0.39),(0.00,2.27,-0.80,0.58,0.31),(0.00,2.36,-0.83,0.38,0.26)]
    sections=48; verts=[]
    for r,(cx,y,cz,wx,dz) in enumerate(rings):
        for j in range(sections):
            a=2*math.pi*j/sections; shoulder_bias=1+0.035*math.cos(2*a+r*0.4)
            x=cx+wx*math.cos(a)*shoulder_bias; z=cz+dz*math.sin(a)*(1+0.025*math.sin(3*a+r)); verts.append([x,y,z])
    faces=[]
    for r in range(len(rings)-1):
        a0=r*sections; b0=(r+1)*sections
        for j in range(sections):
            k=(j+1)%sections; faces += [[a0+j,b0+j,a0+k],[a0+k,b0+j,b0+k]]
    c0=len(verts); verts.append([0,rings[0][1],rings[0][2]]); c1=len(verts); verts.append([0,rings[-1][1],rings[-1][2]])
    for j in range(sections):
        k=(j+1)%sections; faces.append([c0,j,k]); a=(len(rings)-1)*sections; faces.append([c1,a+k,a+j])
    return add(trimesh.Trimesh(vertices=np.asarray(verts),faces=np.asarray(faces),process=True),'torso_core')

def leaf_shell(path,widths,depths,name,parent=None,across=19,edge_phase=0.0):
    pts=np.asarray(path,float); widths=np.asarray(widths,float); depths=np.asarray(depths,float); rows=len(pts)
    front=[]; back=[]
    for i,p in enumerate(pts):
        t=i/max(1,rows-1)
        for j in range(across):
            u=j/(across-1)*2-1
            edge=1.0-0.06*math.cos(math.pi*u)+0.025*math.sin(4.5*u+edge_phase+i*0.45)
            x=p[0]+u*widths[i]*edge; relief=depths[i]*(0.68+0.32*math.cos(math.pi*u)); wave=0.035*math.sin(2.2*math.pi*t+2.3*u+edge_phase)
            y=p[1]-0.025*u*u*(0.3+t); front.append([x,y,p[2]+relief+wave]); back.append([x,y,p[2]-relief*0.58+wave*0.35])
    verts=front+back; layer=rows*across; faces=[]
    for side in range(2):
        off=side*layer
        for i in range(rows-1):
            for j in range(across-1):
                a=off+i*across+j; b=a+1; c=off+(i+1)*across+j; d=c+1
                faces += ([[a,c,b],[b,c,d]] if side==0 else [[a,b,c],[b,d,c]])
    for i in range(rows-1):
        for j in (0,across-1):
            a=i*across+j; b=(i+1)*across+j; c=layer+a; d=layer+b
            faces += ([[a,c,b],[b,c,d]] if j==0 else [[a,b,c],[b,d,c]])
    for i in (0,rows-1):
        for j in range(across-1):
            a=i*across+j; b=a+1; c=layer+a; d=layer+b
            faces += ([[a,b,c],[b,d,c]] if i==0 else [[a,c,b],[b,c,d]])
    return add(trimesh.Trimesh(vertices=np.asarray(verts),faces=np.asarray(faces),process=True),name,parent)

def cape_fold(cx_top,cx_mid,cx_bottom,y_top,y_bottom,w_top,w_mid,w_bottom,z_top,z_bottom,name,parent,phase):
    n=12; path=[]; widths=[]; depths=[]
    for i in range(n):
        t=i/(n-1); cx=(1-t)**2*cx_top+2*(1-t)*t*cx_mid+t*t*cx_bottom+0.025*math.sin(math.pi*t+phase)
        y=y_top+(y_bottom-y_top)*t; z=z_top+(z_bottom-z_top)*t+0.055*math.sin(2*math.pi*t+phase)
        w=(1-t)**2*w_top+2*(1-t)*t*w_mid+t*t*w_bottom; path.append((cx,y,z)); widths.append(w); depths.append(0.11+0.07*t)
    return leaf_shell(path,widths,depths,name,parent,across=23,edge_phase=phase)

def irregular_brim():
    N=64; outer=1.38; inner=0.34; verts=[]
    for layer_y in (+0.06,-0.06):
        for radius in (outer,inner):
            for i in range(N):
                a=2*math.pi*i/N; rr=radius*(1+0.075*math.sin(3*a+0.6)+0.03*math.sin(7*a-0.3))
                x=rr*math.cos(a); z=-0.76+(0.82 if radius==outer else 0.22)*math.sin(a)
                droop=-0.18*(abs(math.cos(a))**1.6)+0.10*math.sin(2*a+0.45)+0.05*math.sin(5*a); tilt=0.08*math.sin(a-0.35)
                verts.append([x,3.18+droop+tilt+layer_y,z])
    faces=[]
    for i in range(N):
        j=(i+1)%N; to=i; ti=N+i; bo=2*N+i; bi=3*N+i; toj=j; tij=N+j; boj=2*N+j; bij=3*N+j
        faces += [[to,toj,ti],[toj,tij,ti],[bo,bi,boj],[boj,bi,bij],[to,bo,toj],[toj,bo,boj],[ti,tij,bi],[tij,bij,bi]]
    return add(trimesh.Trimesh(vertices=np.asarray(verts),faces=np.asarray(faces),process=True),'hat_brim')

def crooked_crown():
    pts=[(0.00,3.18,-0.78),(0.00,3.46,-0.81),(0.05,3.73,-0.86),(0.15,4.00,-0.95),(0.29,4.24,-1.06),(0.43,4.43,-1.16),(0.50,4.57,-1.22)]
    return organic_tube(pts,[0.55,0.50,0.43,0.34,0.24,0.14,0.035],[0.39,0.36,0.31,0.25,0.18,0.10,0.03],'hat_crown','hat_tip',sections=40)

for root in ['hair_01','hair_02','hair_03','hair_04','hair_05','cape','cape_left','cape_center','cape_right','hat_tip','broom_handle','broom_bristles']:
    scene.graph.update(frame_to=root,frame_from=scene.graph.base_frame,matrix=np.eye(4))

torso_shell()
scene.graph.update(frame_to='pelvis',frame_from=scene.graph.base_frame,matrix=trimesh.transformations.translation_matrix([0,0.68,-0.04]))
scene.graph.update(frame_to='waist',frame_from=scene.graph.base_frame,matrix=trimesh.transformations.translation_matrix([0,1.23,-0.30]))
scene.graph.update(frame_to='ribcage',frame_from=scene.graph.base_frame,matrix=trimesh.transformations.translation_matrix([0,1.82,-0.62]))
ellipsoid((0.31,0.35,0.28),(0,2.58,-0.91),'head',subdivisions=4)
organic_tube([(0,2.28,-0.82),(0,2.43,-0.88)],[0.15,0.13],[0.14,0.12],'neck',sections=24)

arms={
'L':[(-0.78,2.08,-0.73),(-0.96,1.94,-0.79),(-1.18,1.68,-0.92),(-1.20,1.43,-1.08),(-1.02,1.18,-1.27),(-0.61,0.94,-1.47),(-0.35,0.76,-1.61),(-0.20,0.64,-1.68)],
'R':[(0.78,2.08,-0.73),(0.96,1.94,-0.79),(1.18,1.68,-0.92),(1.20,1.43,-1.08),(1.02,1.18,-1.27),(0.61,0.94,-1.47),(0.35,0.76,-1.61),(0.20,0.64,-1.68)]}
for side,pts in arms.items():
    organic_tube(pts,[0.18,0.185,0.18,0.16,0.145,0.13,0.115,0.095],[0.16,0.16,0.155,0.14,0.125,0.115,0.105,0.09],f'arm_{side}',sections=30)
    hand=pts[-1]; ellipsoid((0.15,0.13,0.18),hand,f'hand_{side}',subdivisions=3); sign=-1 if side=='L' else 1
    for j,dx in enumerate((-0.055,-0.018,0.018,0.055)):
        p0=(hand[0]+dx,hand[1]-0.01,hand[2]+0.02); p1=(hand[0]+dx+0.012*sign,0.52,-1.66)
        organic_tube([p0,p1],[0.028,0.022],[0.025,0.020],f'finger_{side}_{j+1}',sections=10)

legs={
'L':[(-0.38,0.69,-0.02),(-0.58,0.62,0.02),(-0.78,0.45,0.12),(-0.98,0.20,0.28),(-1.04,-0.02,0.39),(-0.97,-0.30,0.51),(-0.84,-0.62,0.61),(-0.78,-0.82,0.64)],
'R':[(0.38,0.69,-0.02),(0.58,0.62,0.02),(0.78,0.45,0.12),(0.98,0.20,0.28),(1.04,-0.02,0.39),(0.97,-0.30,0.51),(0.84,-0.62,0.61),(0.78,-0.82,0.64)]}
for side,pts in legs.items():
    organic_tube(pts,[0.27,0.28,0.275,0.25,0.23,0.205,0.18,0.16],[0.23,0.24,0.235,0.22,0.205,0.18,0.16,0.145],f'leg_{side}',sections=32)
    ankle=np.asarray(pts[-1]); heel=ankle+np.array([0,-0.32,0.08]); toe=heel+np.array([0,-0.02,-0.46])
    organic_tube([tuple(ankle),tuple(heel),tuple(toe)],[0.205,0.225,0.18],[0.18,0.195,0.155],f'boot_{side}',sections=30)

mane_specs=[
(-0.78,2.72,1.84,0.24,0.38,0.11,-0.14,0.05),(-0.60,2.80,1.72,0.28,0.43,0.12,-0.18,0.08),
(-0.41,2.84,1.62,0.31,0.47,0.13,-0.19,0.10),(-0.21,2.88,1.54,0.33,0.49,0.14,-0.18,0.11),
(0.00,2.90,1.50,0.35,0.51,0.15,-0.17,0.12),(0.21,2.88,1.55,0.33,0.49,0.14,-0.18,0.11),
(0.41,2.84,1.63,0.31,0.47,0.13,-0.19,0.10),(0.60,2.80,1.73,0.28,0.43,0.12,-0.18,0.08),
(0.78,2.72,1.85,0.24,0.38,0.11,-0.14,0.05)]
for idx,(x,yt,yb,wt,wm,wb,zt,zb) in enumerate(mane_specs,1):
    n=9; path=[]; widths=[]; depths=[]
    for k in range(n):
        t=k/(n-1); xw=x+0.045*math.sin(math.pi*t*1.4+idx*0.65)*(0.25+0.75*t); y=yt+(yb-yt)*t
        z=zt+(zb-zt)*t+0.035*math.sin(math.pi*t+idx*0.4); w=(1-t)**2*wt+2*(1-t)*t*wm+t*t*wb
        path.append((xw,y,z)); widths.append(w); depths.append(0.09+0.055*math.sin(math.pi*t))
    parent=f'hair_{min(5,max(1,round((idx-1)/2)+1)):02d}'
    leaf_shell(path,widths,depths,f'mane_lock_{idx:02d}',parent,across=21,edge_phase=idx*0.55)
shoulder_specs=[(-0.90,2.54,2.05,0.30),(-0.68,2.61,2.02,0.34),(-0.34,2.66,2.00,0.38),(0.0,2.68,1.98,0.40),(0.34,2.66,2.00,0.38),(0.68,2.61,2.02,0.34),(0.90,2.54,2.05,0.30)]
for i,(x,yt,yb,w) in enumerate(shoulder_specs,1):
    path=[(x,yt,-0.22),(x+0.03*math.sin(i),(yt+yb)/2,-0.10),(x+0.06*math.cos(i*0.7),yb,0.00)]
    leaf_shell(path,[w*0.72,w,w*0.45],[0.09,0.12,0.07],f'mane_shoulder_{i:02d}',f'hair_{min(5,max(1,(i+1)//2)):02d}',across=17,edge_phase=i)

cape_fold(-0.72,-0.55,-0.96,2.05,0.28,0.32,0.21,0.49,-0.03,0.43,'cape_fold_1','cape_left',0.25)
cape_fold(-0.28,-0.25,-0.42,1.98,0.55,0.28,0.18,0.31,-0.01,0.36,'cape_fold_2','cape_center',0.85)
cape_fold(0.28,0.25,0.42,1.98,0.53,0.28,0.18,0.31,-0.01,0.38,'cape_fold_3','cape_center',1.45)
cape_fold(0.72,0.55,0.96,2.05,0.26,0.32,0.21,0.49,-0.03,0.45,'cape_fold_4','cape_right',2.05)
leaf_shell([(-0.58,2.20,-0.18),(-0.63,2.06,-0.10),(-0.62,1.92,-0.03)],[0.28,0.32,0.22],[0.08,0.10,0.06],'cape_yoke_L','cape',across=19,edge_phase=0.3)
leaf_shell([(0.58,2.20,-0.18),(0.63,2.06,-0.10),(0.62,1.92,-0.03)],[0.28,0.32,0.22],[0.08,0.10,0.06],'cape_yoke_R','cape',across=19,edge_phase=1.4)

irregular_brim(); crooked_crown()
shaft_pts=[(0.02,0.57,-3.28),(-0.05,0.58,-2.60),(0.03,0.57,-2.05),(0.00,0.56,-1.68),(0.01,0.54,-0.92),(-0.02,0.52,-0.18),(0.04,0.49,0.55),(0.10,0.43,1.18),(0.14,0.35,1.58)]
organic_tube(shaft_pts,[0.105,0.115,0.13,0.15,0.16,0.16,0.15,0.135,0.115],[0.095,0.105,0.12,0.14,0.145,0.145,0.135,0.12,0.10],'broom_shaft','broom_handle',sections=30)
ellipsoid((0.42,0.12,0.28),(0,0.57,-0.04),'seat_wrap',subdivisions=3)
base=np.array([0.14,0.35,1.54])
for i in range(56):
    a=2*math.pi*i/56; layer=i%7; frac=layer/6
    tip=np.array([0.22+(0.50+0.20*frac)*math.cos(a),-0.62+(0.25+0.13*frac)*math.sin(a),3.06+0.24*math.sin(2*a+i*0.17)])
    mid=base*0.46+tip*0.54+np.array([0.035*math.sin(i*0.7),-0.08,-0.04])
    organic_tube([tuple(base+np.array([0.04*math.cos(a),0.025*math.sin(a),0])),tuple(mid),tuple(tip)],[0.074,0.092,0.024],[0.060,0.078,0.020],f'straw_mass_{i+1:02d}','broom_bristles',sections=14)
for i in range(240):
    a=2*math.pi*(i%40)/40+0.045*(i//40); layer=i//40; frac=layer/5; start=base+np.array([0.045*math.cos(a),0.025*math.sin(a),0])
    tip=np.array([0.22+(0.48+0.22*frac)*math.cos(a),-0.64+(0.24+0.15*frac)*math.sin(a),3.18+0.18*math.sin(3*a+layer*0.65)])
    mid=0.44*start+0.56*tip+np.array([0.028*math.sin(i*0.43),-0.07,-0.055])
    organic_tube([tuple(start),tuple(mid),tuple(tip)],[0.017,0.012,0.0065],[0.014,0.010,0.0055],f'bristle_{i+1:03d}','broom_bristles',sections=10)

OUT.write_bytes(scene.export(file_type='glb'))
manifest={'pass':'pass-14-mesh-only-v24','review':'neutral-clay-mesh-review-only','geometry_strategy':'full organic lofted silhouette; no visible primitive columns','torso':'single pelvis-waist-ribcage-shoulder shell with forward lean','arms':'continuous bent organic lofts to visible central grip','legs':'continuous seated straddle with bent knees and aligned boots','mane_primary_locks':9,'mane_shoulder_locks':7,'cape_primary_folds':4,'broom_bristles':240,'broom_straw_clumps':56,'camera_clearance':'volume reformed and layered without scale/material hacks','materials_applied':False,'required_animation_roots':['hair_01','hair_02','hair_03','hair_04','hair_05','cape','cape_left','cape_center','cape_right','hat_tip','broom_handle','broom_bristles'],'bytes':OUT.stat().st_size,'nodes':len(scene.graph.nodes),'geometries':len(scene.geometry)}
MANIFEST.write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
print(json.dumps(manifest,indent=2))
