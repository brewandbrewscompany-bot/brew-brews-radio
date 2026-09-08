from __future__ import annotations
import json, math
from pathlib import Path
import numpy as np
import trimesh
from trimesh.visual.material import PBRMaterial

ROOT = Path(__file__).resolve().parents[1] if 'tools' in str(Path(__file__).resolve()) else Path('/mnt/data/pass14_v23/work')
OUT = ROOT / 'assets' / 'models' / 'witch-rider.glb'
MANIFEST = ROOT / 'assets' / 'witch-mesh-pass14.json'
OUT.parent.mkdir(parents=True, exist_ok=True)

CLAY = PBRMaterial(name='neutral_clay_mesh_review', baseColorFactor=[0.47,0.45,0.43,1.0], metallicFactor=0.0, roughnessFactor=1.0)
scene = trimesh.Scene()
scene.metadata.update({'pass':'pass-14-mesh-only-v23','review':'neutral-clay-mesh-review-only','intent':'full silhouette rebuild from pre-v21 basis'})

def clean(m: trimesh.Trimesh):
    m.remove_unreferenced_vertices()
    try: m.merge_vertices()
    except Exception: pass
    try: m.fix_normals(multibody=True)
    except TypeError: m.fix_normals()
    m.visual.material = CLAY
    return m

def add(m,name,parent=None):
    clean(m)
    scene.add_geometry(m,node_name=name,geom_name=name,parent_node_name=parent)
    return m

def ellipsoid(scale, center, name, parent=None, subdivisions=4):
    m=trimesh.creation.icosphere(subdivisions=subdivisions,radius=1.0)
    T=np.eye(4); T[:3,:3]=np.diag(scale); T[:3,3]=center; m.apply_transform(T)
    return add(m,name,parent)

def tube_loft(points, rx, rz, name, parent=None, sections=28, caps=True):
    pts=np.asarray(points,float); n=len(pts)
    rx=np.asarray(rx if hasattr(rx,'__len__') else [rx]*n,float)
    rz=np.asarray(rz if hasattr(rz,'__len__') else [rz]*n,float)
    verts=[]
    frames=[]
    prev_n=None
    for i,p in enumerate(pts):
        if i==0: t=pts[1]-pts[0]
        elif i==n-1: t=pts[-1]-pts[-2]
        else: t=pts[i+1]-pts[i-1]
        t=t/np.linalg.norm(t)
        ref=np.array([0.,0.,1.]) if abs(t[2])<0.85 else np.array([1.,0.,0.])
        n1=np.cross(t,ref); n1/=np.linalg.norm(n1)
        if prev_n is not None and np.dot(n1,prev_n)<0: n1=-n1
        n2=np.cross(t,n1); n2/=np.linalg.norm(n2)
        prev_n=n1; frames.append((n1,n2))
        for j in range(sections):
            a=2*math.pi*j/sections
            verts.append(p + math.cos(a)*rx[i]*n1 + math.sin(a)*rz[i]*n2)
    faces=[]
    for i in range(n-1):
        a0=i*sections; b0=(i+1)*sections
        for j in range(sections):
            k=(j+1)%sections
            faces += [[a0+j,b0+j,a0+k],[a0+k,b0+j,b0+k]]
    if caps:
        c0=len(verts); verts.append(pts[0])
        c1=len(verts); verts.append(pts[-1])
        for j in range(sections):
            k=(j+1)%sections
            faces.append([c0,k,j]); a=(n-1)*sections
            faces.append([c1,a+j,a+k])
    m=trimesh.Trimesh(vertices=np.asarray(verts),faces=np.asarray(faces),process=True)
    return add(m,name,parent)

def torso_loft():
    rings=[
        ((0,0.56,-0.01),0.72,0.44),
        ((0,0.83,-0.10),0.67,0.40),
        ((0,1.16,-0.25),0.50,0.31),
        ((0,1.48,-0.40),0.62,0.36),
        ((0,1.80,-0.56),0.77,0.42),
        ((0,2.08,-0.68),0.88,0.40),
        ((0,2.20,-0.72),0.80,0.34),
    ]
    sections=40; verts=[]
    for (cx,cy,cz),rx,rz in rings:
        for j in range(sections):
            a=2*math.pi*j/sections
            x=cx+rx*math.cos(a)*(1+0.035*math.sin(3*a+cy))
            z=cz+rz*math.sin(a)*(1+0.05*math.cos(2*a+cy))
            verts.append([x,cy,z])
    faces=[]; nr=len(rings)
    for i in range(nr-1):
        a0=i*sections; b0=(i+1)*sections
        for j in range(sections):
            k=(j+1)%sections
            faces += [[a0+j,b0+j,a0+k],[a0+k,b0+j,b0+k]]
    verts.append([0,rings[0][0][1],rings[0][0][2]]); c0=len(verts)-1
    verts.append([0,rings[-1][0][1],rings[-1][0][2]]); c1=len(verts)-1
    for j in range(sections):
        k=(j+1)%sections
        faces.append([c0,j,k]); a=(nr-1)*sections; faces.append([c1,a+k,a+j])
    return add(trimesh.Trimesh(vertices=np.asarray(verts),faces=np.asarray(faces),process=True),'torso_core')

def ribbon_loft(points,widths,depths,name,parent=None,sections=22):
    return tube_loft(points,widths,depths,name,parent,sections=sections)

def cape_panel(center_x, width_top, width_mid, width_bottom, y_top, y_bottom, z_top, z_bottom, name, parent, phase):
    ny=13; nx=17; thick=0.08
    verts=[]
    rows=[]
    for iy in range(ny):
        t=iy/(ny-1)
        y=y_top+(y_bottom-y_top)*t
        w=(1-t)**2*width_top + 2*(1-t)*t*width_mid + t*t*width_bottom
        zc=z_top+(z_bottom-z_top)*t + 0.05*math.sin(math.pi*t+phase)
        row=[]
        for ix in range(nx):
            u=ix/(nx-1)*2-1
            x=center_x + u*w
            fold=0.13*math.sin((u*1.35+phase)*math.pi)*(0.45+0.55*t)
            droop=-0.06*(u*u)*t
            z=zc + fold + 0.035*math.sin(2*math.pi*t+u+phase)
            row.append((x,y+droop,z))
        rows.append(row)
    for side in (+1,-1):
        for row in rows:
            for x,y,z in row: verts.append([x,y,z+side*thick/2])
    faces=[]; layer=ny*nx
    for s in range(2):
        off=s*layer
        for iy in range(ny-1):
            for ix in range(nx-1):
                a=off+iy*nx+ix; b=a+1; c=off+(iy+1)*nx+ix; d=c+1
                if s==0: faces += [[a,c,b],[b,c,d]]
                else: faces += [[a,b,c],[b,d,c]]
    for iy in range(ny-1):
        for ix in (0,nx-1):
            a=iy*nx+ix; b=(iy+1)*nx+ix; c=layer+a; d=layer+b
            if ix==0: faces += [[a,c,b],[b,c,d]]
            else: faces += [[a,b,c],[b,d,c]]
    for iy in (0,ny-1):
        for ix in range(nx-1):
            a=iy*nx+ix; b=a+1; c=layer+a; d=layer+b
            if iy==0: faces += [[a,b,c],[b,d,c]]
            else: faces += [[a,c,b],[b,c,d]]
    return add(trimesh.Trimesh(vertices=np.asarray(verts),faces=np.asarray(faces),process=True),name,parent)

def wavy_brim():
    N=56; ro=1.34; ri=0.34
    verts=[]
    for yoff in (+0.055,-0.055):
        for radius in (ro,ri):
            for i in range(N):
                a=2*math.pi*i/N
                rr=radius*(1+0.07*math.sin(3*a+0.4)+0.025*math.sin(7*a))
                x=rr*math.cos(a)
                z=-0.72 + (0.79 if radius==ro else 0.22)*math.sin(a)
                y=3.16 + 0.10*math.sin(2*a+0.2) - 0.10*max(0,math.cos(a-0.25)) + yoff
                verts.append([x,y,z])
    faces=[]
    for i in range(N):
        j=(i+1)%N
        to=i; ti=N+i; bo=2*N+i; bi=3*N+i
        toj=j; tij=N+j; boj=2*N+j; bij=3*N+j
        faces += [[to,toj,ti],[toj,tij,ti]]
        faces += [[bo,bi,boj],[boj,bi,bij]]
        faces += [[to,bo,toj],[toj,bo,boj]]
        faces += [[ti,tij,bi],[tij,bij,bi]]
    return add(trimesh.Trimesh(vertices=np.asarray(verts),faces=np.asarray(faces),process=True),'hat_brim')

def crown():
    pts=[(0,3.18,-0.72),(0.00,3.50,-0.76),(0.06,3.81,-0.83),(0.18,4.10,-0.92),(0.33,4.34,-1.02),(0.46,4.51,-1.12),(0.52,4.62,-1.18)]
    return tube_loft(pts,[0.54,0.48,0.40,0.31,0.22,0.13,0.04],[0.38,0.34,0.29,0.23,0.17,0.10,0.035],'hat_crown','hat_tip',sections=36)

for root in ['hair_01','hair_02','hair_03','hair_04','hair_05','cape','cape_left','cape_center','cape_right','hat_tip','broom_handle','broom_bristles']:
    scene.graph.update(frame_to=root,frame_from=scene.graph.base_frame,matrix=np.eye(4))

torso_loft()
scene.graph.update(frame_to='pelvis',frame_from=scene.graph.base_frame,matrix=trimesh.transformations.translation_matrix([0,0.65,-0.03]))
scene.graph.update(frame_to='waist',frame_from=scene.graph.base_frame,matrix=trimesh.transformations.translation_matrix([0,1.18,-0.25]))
scene.graph.update(frame_to='ribcage',frame_from=scene.graph.base_frame,matrix=trimesh.transformations.translation_matrix([0,1.82,-0.56]))
ellipsoid((0.31,0.34,0.27),(0,2.55,-0.88),'head',subdivisions=4)
tube_loft([(0,2.18,-0.70),(0,2.38,-0.82)],[0.15,0.13],[0.14,0.12],'neck',sections=24)

arms={
 'L':[(-0.72,2.08,-0.64),(-0.93,1.75,-0.86),(-0.98,1.42,-1.08),(-0.76,1.08,-1.33),(-0.43,0.78,-1.58),(-0.31,0.64,-1.66)],
 'R':[(0.72,2.08,-0.64),(0.93,1.75,-0.86),(0.98,1.42,-1.08),(0.76,1.08,-1.33),(0.43,0.78,-1.58),(0.31,0.64,-1.66)]}
for side,pts in arms.items():
    tube_loft(pts,[0.17,0.17,0.15,0.14,0.125,0.11],[0.15,0.15,0.135,0.12,0.11,0.10],f'arm_{side}',sections=26)
    hand=pts[-1]
    ellipsoid((0.16,0.13,0.18),hand,f'hand_{side}',subdivisions=3)
    sign=-1 if side=='L' else 1
    for j,dx in enumerate((-0.055,0.0,0.055)):
        p0=(hand[0]+dx,hand[1]-0.01,hand[2]+0.005)
        p1=(hand[0]+dx+0.01*sign,0.50,-1.65)
        tube_loft([p0,p1],[0.032,0.028],[0.028,0.025],f'finger_{side}_{j+1}',sections=10)

legs={
 'L':[(-0.39,0.66,-0.02),(-0.65,0.51,0.08),(-0.93,0.23,0.25),(-0.98,0.05,0.36),(-0.86,-0.39,0.53),(-0.77,-0.72,0.57)],
 'R':[(0.39,0.66,-0.02),(0.65,0.51,0.08),(0.93,0.23,0.25),(0.98,0.05,0.36),(0.86,-0.39,0.53),(0.77,-0.72,0.57)]}
for side,pts in legs.items():
    tube_loft(pts,[0.25,0.26,0.25,0.23,0.20,0.17],[0.22,0.23,0.22,0.21,0.18,0.15],f'leg_{side}',sections=28)
    ankle=np.asarray(pts[-1]); toe=ankle+np.array([0,-0.14,-0.42]); heel=ankle+np.array([0,-0.34,0.10])
    tube_loft([tuple(ankle),tuple(heel),tuple(toe)],[0.21,0.23,0.20],[0.18,0.20,0.17],f'boot_{side}',sections=28)

hair_specs=[
 ('hair_01',[(-0.72,2.80,-0.63),(-0.78,2.55,-0.42),(-0.82,2.28,-0.23),(-0.80,1.98,-0.08),(-0.72,1.72,0.01)],[0.26,0.33,0.36,0.31,0.20]),
 ('hair_02',[(-0.38,2.86,-0.60),(-0.43,2.58,-0.38),(-0.44,2.28,-0.18),(-0.40,1.96,-0.02),(-0.31,1.64,0.08)],[0.32,0.40,0.43,0.36,0.22]),
 ('hair_03',[(0,2.89,-0.59),(0.02,2.60,-0.35),(0.02,2.28,-0.13),(0.00,1.94,0.03),(-0.02,1.58,0.12)],[0.35,0.46,0.50,0.42,0.25]),
 ('hair_04',[(0.38,2.86,-0.60),(0.43,2.58,-0.38),(0.44,2.28,-0.18),(0.40,1.96,-0.02),(0.31,1.64,0.08)],[0.32,0.40,0.43,0.36,0.22]),
 ('hair_05',[(0.72,2.80,-0.63),(0.78,2.55,-0.42),(0.82,2.28,-0.23),(0.80,1.98,-0.08),(0.72,1.72,0.01)],[0.26,0.33,0.36,0.31,0.20]),
]
for idx,(parent,pts,widths) in enumerate(hair_specs,1):
    ribbon_loft(pts,widths,[0.15,0.19,0.20,0.18,0.12],f'mane_lock_{idx}',parent,sections=32)
fill_specs=[(-0.55,2.67,1.84,0.23),(-0.18,2.72,1.70,0.28),(0.18,2.72,1.69,0.28),(0.55,2.67,1.83,0.23),(-0.70,2.42,1.62,0.20),(0.70,2.42,1.62,0.20)]
for i,(x,yt,yb,w) in enumerate(fill_specs,1):
    pts=[(x,yt,-0.33),(x+0.05*math.sin(i),(yt+yb)/2,-0.05),(x+0.02*math.cos(i),yb,0.10)]
    ribbon_loft(pts,[w,w*1.18,w*0.62],[0.13,0.16,0.10],f'mane_fill_{i}',hair_specs[(i-1)%5][0],sections=28)

cape_panel(-0.63,0.28,0.42,0.58,1.96,0.02,-0.02,0.70,'cape_fold_1','cape_left',0.25)
cape_panel(-0.20,0.30,0.40,0.52,2.00,-0.06,-0.01,0.78,'cape_fold_2','cape_center',0.75)
cape_panel(0.20,0.30,0.40,0.52,2.00,-0.08,-0.01,0.80,'cape_fold_3','cape_center',1.30)
cape_panel(0.63,0.28,0.42,0.58,1.96,0.00,-0.02,0.72,'cape_fold_4','cape_right',1.85)
cape_panel(-0.43,0.22,0.28,0.24,2.18,1.72,-0.17,0.02,'cape_yoke_L','cape',0.4)
cape_panel(0.43,0.22,0.28,0.24,2.18,1.72,-0.17,0.02,'cape_yoke_R','cape',1.5)

wavy_brim(); crown()

shaft_pts=[(0.03,0.53,-3.05),(-0.04,0.55,-2.15),(0.02,0.54,-1.65),(0.00,0.53,-0.55),(0.02,0.51,0.20),(-0.03,0.50,1.15),(0.04,0.52,1.75)]
tube_loft(shaft_pts,[0.105,0.12,0.135,0.15,0.145,0.13,0.11],[0.10,0.11,0.125,0.135,0.13,0.12,0.10],'broom_shaft','broom_handle',sections=28)
ellipsoid((0.40,0.11,0.26),(0,0.57,-0.03),'seat_wrap',subdivisions=3)

straw_base=np.array([0.02,0.51,1.55])
for i in range(40):
    a=2*math.pi*i/40
    ring=(i%8)/7
    tip=np.array([0.72*math.cos(a)*(0.55+0.45*ring),0.50+0.54*math.sin(a)*(0.45+0.55*ring),3.08+0.34*math.cos(2*a+0.3*i)])
    mid=(straw_base*0.48+tip*0.52)+np.array([0.06*math.sin(i),0.03*math.cos(i*1.7),-0.05])
    tube_loft([tuple(straw_base+np.array([0.06*math.cos(a),0.05*math.sin(a),0])),tuple(mid),tuple(tip)],[0.085,0.11,0.035],[0.075,0.095,0.03],f'straw_mass_{i+1:02d}','broom_bristles',sections=16)
for i in range(216):
    a=2*math.pi*(i%36)/36 + 0.055*(i//36)
    layer=i//36
    r=0.30+0.105*layer
    start=straw_base+np.array([0.05*math.cos(a),0.04*math.sin(a),0])
    tip=np.array([r*math.cos(a),0.50+(0.30+0.09*layer)*math.sin(a),3.18+0.20*math.sin(3*a+layer)])
    mid=0.42*start+0.58*tip+np.array([0.03*math.sin(i*0.7),0.02*math.cos(i*0.5),-0.06])
    tube_loft([tuple(start),tuple(mid),tuple(tip)],[0.020,0.015,0.008],[0.018,0.014,0.007],f'bristle_{i+1:03d}','broom_bristles',sections=12)

OUT.write_bytes(scene.export(file_type='glb'))
manifest={'pass':'pass-14-mesh-only-v23','review':'neutral-clay-mesh-review-only','geometry_strategy':'full organic lofts from fuller pre-v21 silhouette','torso':'single ribcage-waist-pelvis loft','arms':'continuous bent organic lofts','legs':'continuous seated-straddle organic lofts','mane_primary_locks':5,'mane_fillers':6,'cape_primary_folds':4,'broom_bristles':216,'broom_straw_clumps':40,'camera_clearance':'reformed depth, no scale/material hacks','materials_applied':False,'required_animation_roots':['hair_01','hair_02','hair_03','hair_04','hair_05','cape','cape_left','cape_center','cape_right','hat_tip','broom_handle','broom_bristles'],'bytes':OUT.stat().st_size,'nodes':len(scene.graph.nodes),'geometries':len(scene.geometry)}
MANIFEST.write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
print(json.dumps(manifest,indent=2))
