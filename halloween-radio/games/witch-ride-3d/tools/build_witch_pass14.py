from __future__ import annotations
import json, math
from pathlib import Path
import numpy as np
import trimesh
from trimesh.visual.material import PBRMaterial

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "models" / "witch-rider.glb"
MANIFEST = ROOT / "assets" / "witch-mesh-pass14.json"

CLAY = PBRMaterial(
    name="neutral_clay_mesh_review",
    baseColorFactor=[0.48, 0.46, 0.44, 1.0],
    metallicFactor=0.0,
    roughnessFactor=1.0,
)

scene = trimesh.Scene()
scene.metadata["pass"] = "pass-14-mesh-only-v20"
scene.metadata["review"] = "neutral-clay-mesh-review-only"
scene.metadata["intent"] = "camera-safe large-form seated rider rebuild"

def clean(mesh: trimesh.Trimesh) -> trimesh.Trimesh:
    mesh.remove_unreferenced_vertices()
    try:
        mesh.fix_normals(multibody=True)
    except TypeError:
        mesh.fix_normals()
    mesh.visual.material = CLAY
    return mesh

def ellipsoid(scale, center, name, parent=None, subdivisions=3):
    m = trimesh.creation.icosphere(subdivisions=subdivisions, radius=1.0)
    T = np.eye(4)
    T[:3,:3] = np.diag(scale)
    T[:3,3] = center
    m.apply_transform(T)
    clean(m)
    scene.add_geometry(m, node_name=name, geom_name=name, parent_node_name=parent)
    return m

def cylinder_between(a, b, radius, name, parent=None, sections=20):
    a=np.asarray(a,float); b=np.asarray(b,float)
    v=b-a; L=float(np.linalg.norm(v))
    m=trimesh.creation.cylinder(radius=radius, height=L, sections=sections)
    T=trimesh.geometry.align_vectors([0,0,1], v/L)
    if T is None: T=np.eye(4)
    T[:3,3]=(a+b)/2.0
    m.apply_transform(T)
    clean(m)
    scene.add_geometry(m, node_name=name, geom_name=name, parent_node_name=parent)
    return m

def capsule_between(a, b, radius, name, parent=None, sections=20):
    meshes=[]
    a=np.asarray(a,float); b=np.asarray(b,float)
    v=b-a; L=float(np.linalg.norm(v))
    c=trimesh.creation.cylinder(radius=radius, height=L, sections=sections)
    T=trimesh.geometry.align_vectors([0,0,1], v/L)
    if T is None: T=np.eye(4)
    T[:3,3]=(a+b)/2.0
    c.apply_transform(T); meshes.append(c)
    for p in (a,b):
        s=trimesh.creation.icosphere(subdivisions=2,radius=radius)
        s.apply_translation(p); meshes.append(s)
    m=trimesh.util.concatenate(meshes)
    clean(m)
    scene.add_geometry(m,node_name=name,geom_name=name,parent_node_name=parent)
    return m

def tapered_prism(rings, name, parent=None, thickness=0.12):
    verts=[]
    for cx,y,z,hw in rings:
        verts.extend([
            [cx-hw,y,z+thickness/2],
            [cx+hw,y,z+thickness/2],
            [cx-hw,y,z-thickness/2],
            [cx+hw,y,z-thickness/2],
        ])
    faces=[]
    n=len(rings)
    for i in range(n-1):
        a=4*i; b=4*(i+1)
        faces += [[a,b,a+1],[a+1,b,b+1]]
        faces += [[a+2,a+3,b+2],[a+3,b+3,b+2]]
        faces += [[a,a+2,b],[a+2,b+2,b]]
        faces += [[a+1,b+1,a+3],[a+3,b+1,b+3]]
    faces += [[0,1,2],[1,3,2]]
    e=4*(n-1)
    faces += [[e,e+2,e+1],[e+1,e+2,e+3]]
    m=trimesh.Trimesh(vertices=np.asarray(verts), faces=np.asarray(faces), process=True)
    clean(m)
    scene.add_geometry(m,node_name=name,geom_name=name,parent_node_name=parent)
    return m

def wavy_brim(name="hat_brim"):
    N=40
    top=[]; bottom=[]
    for i in range(N):
        a=2*math.pi*i/N
        rx=1.28*(1+0.09*math.sin(3*a+0.6)+0.04*math.sin(7*a))
        rz=0.78*(1+0.07*math.sin(4*a-0.3))
        y=3.18 + 0.10*math.sin(2*a+0.4) - 0.11*max(0, math.cos(a-0.45))
        z=-0.60 + rz*math.sin(a)
        x=rx*math.cos(a)
        top.append([x,y+0.055,z])
        bottom.append([x,y-0.055,z])
    verts=top+bottom+[[0,3.23,-0.60],[0,3.13,-0.60]]
    topc=2*N; botc=2*N+1
    faces=[]
    for i in range(N):
        j=(i+1)%N
        faces += [[topc,i,j],[botc,N+j,N+i],[i,N+i,j],[j,N+i,N+j]]
    m=trimesh.Trimesh(vertices=np.array(verts),faces=np.array(faces),process=True)
    clean(m)
    scene.add_geometry(m,node_name=name,geom_name=name)
    return m

def cone_y(radius, height, center, name, parent=None, tilt=(0,0,0), sections=32):
    m=trimesh.creation.cone(radius=radius,height=height,sections=sections)
    R=trimesh.transformations.rotation_matrix(-math.pi/2,[1,0,0])
    m.apply_transform(R)
    c=m.bounds.mean(axis=0)
    m.apply_translation(np.asarray(center)-c)
    if any(abs(v)>1e-8 for v in tilt):
        Rx=trimesh.transformations.rotation_matrix(tilt[0],[1,0,0],point=center)
        Ry=trimesh.transformations.rotation_matrix(tilt[1],[0,1,0],point=center)
        Rz=trimesh.transformations.rotation_matrix(tilt[2],[0,0,1],point=center)
        m.apply_transform(Rz@Ry@Rx)
    clean(m)
    scene.add_geometry(m,node_name=name,geom_name=name,parent_node_name=parent)
    return m

def crooked_crown(name="hat_crown", parent="hat_tip"):
    rings=[
        (0.00,3.19,-0.60,0.56,0.42),
        (0.02,3.55,-0.63,0.47,0.35),
        (0.08,3.88,-0.68,0.38,0.29),
        (0.18,4.18,-0.76,0.29,0.22),
        (0.32,4.43,-0.86,0.20,0.15),
        (0.44,4.62,-0.96,0.10,0.08),
    ]
    N=32
    verts=[]
    for cx,y,cz,rx,rz in rings:
        for i in range(N):
            a=2*math.pi*i/N
            verts.append([cx+rx*math.cos(a),y,cz+rz*math.sin(a)])
    verts.append([rings[-1][0]+0.07,rings[-1][1]+0.16,rings[-1][2]-0.05])
    tip=len(verts)-1
    faces=[]
    for r in range(len(rings)-1):
        a0=r*N; b0=(r+1)*N
        for i in range(N):
            j=(i+1)%N
            faces += [[a0+i,b0+i,a0+j],[a0+j,b0+i,b0+j]]
    base_center=len(verts); verts.append([rings[0][0],rings[0][1],rings[0][2]])
    for i in range(N):
        j=(i+1)%N
        faces.append([base_center,j,i])
    top0=(len(rings)-1)*N
    for i in range(N):
        j=(i+1)%N
        faces.append([top0+i,tip,top0+j])
    m=trimesh.Trimesh(vertices=np.asarray(verts),faces=np.asarray(faces),process=True)
    clean(m)
    scene.add_geometry(m,node_name=name,geom_name=name,parent_node_name=parent)
    return m

for root in ["hair_01","hair_02","hair_03","hair_04","hair_05",
             "cape","cape_left","cape_center","cape_right",
             "hat_tip","broom_handle","broom_bristles"]:
    scene.graph.update(frame_to=root, frame_from=scene.graph.base_frame, matrix=np.eye(4))

ellipsoid((0.82,0.74,0.40),(0,1.86,-0.42),"ribcage",subdivisions=4)
ellipsoid((0.52,0.50,0.31),(0,1.22,-0.22),"waist",subdivisions=4)
ellipsoid((0.74,0.48,0.41),(0,0.72,-0.02),"pelvis",subdivisions=4)
capsule_between((-0.72,2.10,-0.42),(0.72,2.10,-0.42),0.18,"shoulder_bar")
ellipsoid((0.18,0.22,0.19),(-0.76,2.05,-0.41),"shoulder_L",subdivisions=3)
ellipsoid((0.18,0.22,0.19),(0.76,2.05,-0.41),"shoulder_R",subdivisions=3)
ellipsoid((0.28,0.33,0.25),(0,2.55,-0.76),"head",subdivisions=3)
capsule_between((0,2.26,-0.60),(0,2.43,-0.72),0.13,"neck",sections=18)

arm_data = {
    "L": [(-0.66,2.02,-0.45),(-0.94,1.48,-0.80),(-0.30,0.72,-1.46)],
    "R": [( 0.66,2.02,-0.45),( 0.94,1.48,-0.80),( 0.30,0.72,-1.46)],
}
for side,(shoulder,elbow,hand) in arm_data.items():
    capsule_between(shoulder,elbow,0.145,f"upper_arm_{side}",sections=20)
    capsule_between(elbow,hand,0.125,f"forearm_{side}",sections=20)
    ellipsoid((0.18,0.14,0.17),hand,f"hand_{side}",subdivisions=2)
    sign=-1 if side=="L" else 1
    for j,dx in enumerate((-0.06,0.0,0.06)):
        capsule_between((hand[0]+dx,0.72,-1.48),(hand[0]+dx+0.015*sign,0.56,-1.45),0.032,
                        f"finger_{side}_{j+1}",sections=10)

legs = {
    "L":[(-0.42,0.67,0.02),(-0.96,0.16,0.28),(-0.78,-0.62,0.74)],
    "R":[( 0.42,0.67,0.02),( 0.96,0.16,0.28),( 0.78,-0.62,0.74)]
}
for side,(hip,knee,ankle) in legs.items():
    capsule_between(hip,knee,0.22,f"thigh_{side}",sections=22)
    ellipsoid((0.24,0.22,0.25),knee,f"knee_{side}",subdivisions=2)
    capsule_between(knee,ankle,0.19,f"calf_{side}",sections=22)
    boot_top=ankle
    boot_bottom=(ankle[0],ankle[1]-0.38,ankle[2]+0.18)
    capsule_between(boot_top,boot_bottom,0.21,f"boot_shaft_{side}",sections=22)
    toe=(boot_bottom[0],boot_bottom[1]-0.03,boot_bottom[2]-0.34)
    capsule_between(boot_bottom,toe,0.22,f"boot_foot_{side}",sections=22)

cape_specs=[
    ([
        (-0.78,1.30,0.24,0.17),(-0.82,1.04,0.34,0.18),(-0.87,0.78,0.45,0.20),
        (-0.94,0.52,0.56,0.22),(-1.00,0.26,0.66,0.24)
    ], "cape_left"),
    ([
        (-0.43,1.22,0.25,0.13),(-0.45,0.99,0.35,0.14),(-0.47,0.76,0.45,0.15),
        (-0.50,0.54,0.55,0.16),(-0.54,0.34,0.63,0.17)
    ], "cape_center"),
    ([
        (0.43,1.22,0.25,0.13),(0.45,0.99,0.35,0.14),(0.47,0.76,0.45,0.15),
        (0.50,0.54,0.55,0.16),(0.54,0.34,0.63,0.17)
    ], "cape_center"),
    ([
        (0.78,1.30,0.24,0.17),(0.82,1.04,0.34,0.18),(0.87,0.78,0.45,0.20),
        (0.94,0.52,0.56,0.22),(1.00,0.26,0.66,0.24)
    ], "cape_right"),
]
for i,(rings,parent) in enumerate(cape_specs,1):
    tapered_prism(rings,f"cape_fold_{i}",parent=parent,thickness=0.16)

tapered_prism([
    (-0.63,1.86,0.08,0.15),(-0.68,1.68,0.13,0.17),(-0.72,1.50,0.19,0.15)
],"cape_shoulder_L",parent="cape",thickness=0.10)
tapered_prism([
    (0.63,1.86,0.08,0.15),(0.68,1.68,0.13,0.17),(0.72,1.50,0.19,0.15)
],"cape_shoulder_R",parent="cape",thickness=0.10)

hair_specs=[
    (-0.66,2.70,2.02,0.18,0.22,-0.04),
    (-0.34,2.74,1.78,0.21,0.25, 0.00),
    ( 0.00,2.78,1.56,0.25,0.30, 0.05),
    ( 0.34,2.72,1.80,0.21,0.25, 0.00),
    ( 0.66,2.68,2.05,0.18,0.22,-0.03),
]
for i,(x,ytop,ybottom,hw0,hwm,zoff) in enumerate(hair_specs,1):
    span=ytop-ybottom
    rings=[
        (x,ytop,-0.08+zoff,hw0),
        (x+0.035*math.sin(i),ytop-span*0.24,0.00+zoff,hwm),
        (x-0.045*math.sin(i*1.4),ytop-span*0.50,0.08+zoff,hwm*1.02),
        (x+0.035*math.sin(i*1.9),ytop-span*0.76,0.16+zoff,hwm*0.90),
        (x+0.045*math.sin(i*2.2),ybottom,0.22+zoff,hw0*0.62),
    ]
    tapered_prism(rings,f"mane_lock_{i}",parent=f"hair_{i:02d}",thickness=0.14)

wavy_brim()
crooked_crown()

shaft=[(0.00,0.70,-2.45),(0.01,0.66,-1.55),(-0.02,0.55,-0.55),(0.00,0.48,0.40),(0.06,0.43,1.35),(0.02,0.40,2.10)]
for i,(a,b) in enumerate(zip(shaft,shaft[1:]),1):
    cylinder_between(a,b,0.095,f"broom_shaft_{i}",parent="broom_handle",sections=24)

for j,z in enumerate((1.72,1.90),1):
    ellipsoid((0.34,0.28,0.09),(0.02,0.40,z),f"broom_bind_{j}",subdivisions=2)

rng=np.random.default_rng(1416)
for i in range(18):
    ang=2*math.pi*i/18
    x=0.34*math.cos(ang)*(0.72+0.25*rng.random())
    y=0.40+0.27*math.sin(ang)*(0.70+0.20*rng.random())
    a=(0.02 + x*0.18, 0.40 + (y-0.40)*0.18, 1.90)
    b=(0.02 + x*0.72, 0.40 + (y-0.40)*0.72, 2.85)
    c=(0.02 + x, y, 3.38 + 0.15*rng.random())
    capsule_between(a,b,0.045,f"straw_clump_{i+1}_a",parent="broom_bristles",sections=10)
    capsule_between(b,c,0.032,f"straw_clump_{i+1}_b",parent="broom_bristles",sections=9)

for i in range(144):
    a=2*math.pi*(i/144.0) + rng.normal(0,0.06)
    r=(0.08+0.52*math.sqrt((i+0.5)/144.0))*(0.85+0.20*rng.random())
    tipx=0.02+r*math.cos(a)
    tipy=0.40+0.78*r*math.sin(a)
    tipz=3.20+0.46*rng.random()
    base=(0.02+r*0.10*math.cos(a),0.40+0.10*r*math.sin(a),1.90)
    cylinder_between(base,(tipx,tipy,tipz),0.0105,f"bristle_{i+1:03d}",parent="broom_bristles",sections=8)

OUT.parent.mkdir(parents=True,exist_ok=True)
blob=scene.export(file_type="glb")
OUT.write_bytes(blob)
manifest={
    "pass":"pass-14-mesh-only-v20",
    "review":"neutral-clay-mesh-review-only",
    "geometry_strategy":"camera-safe large forms",
    "required_roots":["hair_01","hair_02","hair_03","hair_04","hair_05","cape","cape_left","cape_center","cape_right","hat_tip","broom_handle","broom_bristles"],
    "cape_primary_folds":4,
    "mane_primary_locks":5,
    "broom_bristles":144,
    "broom_straw_clumps":18,
    "file_bytes":OUT.stat().st_size,
}
MANIFEST.write_text(json.dumps(manifest,indent=2)+"\n",encoding="utf-8")
print(json.dumps(manifest,indent=2))
