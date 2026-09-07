import json, math
from pathlib import Path
import numpy as np
import trimesh
from trimesh.visual.material import PBRMaterial
from trimesh.transformations import translation_matrix

ROOT = Path(__file__).resolve().parents[1] if Path(__file__).resolve().parent.name == 'tools' else Path('/mnt/data/pass14_test')
OUT = ROOT / 'assets' / 'models'
OUT.mkdir(parents=True, exist_ok=True)
META = ROOT / 'assets' / 'witch-mesh-pass14.json'
RNG = np.random.default_rng(2609071408)

# Neutral clay only: this pass is geometry review, not final materials.
def clay(name, rgb, rough=.94):
    return PBRMaterial(
        name=name,
        baseColorFactor=np.array([rgb[0], rgb[1], rgb[2], 1.0], dtype=float),
        metallicFactor=0.0,
        roughnessFactor=rough,
        doubleSided=True,
    )

M = {
    'body': clay('mesh review clay body', (.46,.45,.48)),
    'detail': clay('mesh review clay detail', (.39,.38,.42)),
    'cloth': clay('mesh review clay cloth', (.31,.30,.34)),
    'hair': clay('mesh review clay hair', (.24,.22,.25)),
    'broom': clay('mesh review clay broom', (.30,.27,.25)),
    'straw': clay('mesh review clay straw', (.36,.32,.27)),
}

scene = trimesh.Scene()
scene.graph.update(frame_from=scene.graph.base_frame, frame_to='Witch Rig', matrix=np.eye(4))


def add_root(name, parent='Witch Rig'):
    scene.graph.update(frame_from=parent, frame_to=name, matrix=np.eye(4))


def add_mesh(name, mesh, material, parent='Witch Rig'):
    mesh = mesh.copy()
    mesh.visual = trimesh.visual.TextureVisuals(material=material)
    scene.add_geometry(mesh, geom_name=name, node_name=name, parent_node_name=parent)
    return mesh


def ellipsoid(name, center, scale, material, parent='Witch Rig', subdivisions=2):
    m = trimesh.creation.icosphere(subdivisions=subdivisions, radius=1.0)
    m.apply_scale(scale)
    m.apply_translation(center)
    return add_mesh(name, m, material, parent)


def tube_mesh(points, radii, sides=12, caps=True):
    pts = np.asarray(points, dtype=float)
    radii = np.asarray(radii, dtype=float)
    assert len(pts) == len(radii) and len(pts) >= 2
    rings=[]
    prev_u=None
    for i,p in enumerate(pts):
        if i==0: t=pts[1]-pts[0]
        elif i==len(pts)-1: t=pts[-1]-pts[-2]
        else: t=pts[i+1]-pts[i-1]
        t=t/(np.linalg.norm(t)+1e-12)
        ref=np.array([0.,1.,0.])
        if abs(np.dot(t,ref))>.88: ref=np.array([1.,0.,0.])
        u=np.cross(t,ref); u=u/(np.linalg.norm(u)+1e-12)
        if prev_u is not None and np.dot(u,prev_u)<0: u=-u
        v=np.cross(t,u); v=v/(np.linalg.norm(v)+1e-12)
        prev_u=u
        ring=[]
        for s in range(sides):
            a=2*math.pi*s/sides
            ring.append(p + radii[i]*(math.cos(a)*u + math.sin(a)*v))
        rings.append(ring)
    verts=np.array([q for ring in rings for q in ring],dtype=float)
    faces=[]
    for i in range(len(rings)-1):
        a=i*sides; b=(i+1)*sides
        for s in range(sides):
            n=(s+1)%sides
            faces.append([a+s,b+s,b+n]); faces.append([a+s,b+n,a+n])
    if caps:
        start=len(verts); end=start+1
        verts=np.vstack([verts,pts[0],pts[-1]])
        for s in range(sides):
            n=(s+1)%sides
            faces.append([start,n,s])
            a=(len(rings)-1)*sides
            faces.append([end,a+s,a+n])
    return trimesh.Trimesh(vertices=verts, faces=np.asarray(faces), process=False)


def torso_loft():
    # Continuous ribcage -> waist -> pelvis volume. Upper rings move forward (-Z).
    rows=[
        (0.90, .73, .50, .68),
        (1.10, .70, .48, .64),
        (1.34, .56, .40, .53),
        (1.55, .50, .36, .43),
        (1.78, .61, .42, .31),
        (2.02, .76, .49, .18),
        (2.22, .84, .51, .06),
        (2.36, .70, .44, -.02),
    ]
    sides=24; verts=[]
    for y,rx,rz,zc in rows:
        for s in range(sides):
            a=2*math.pi*s/sides
            # Slight asymmetric human contour, not a perfect mannequin cylinder.
            x=rx*math.cos(a)*(1.0 + .025*math.sin(3*a))
            z=zc+rz*math.sin(a)*(1.0 + .035*math.cos(2*a))
            verts.append([x,y,z])
    faces=[]
    for r in range(len(rows)-1):
        a=r*sides;b=(r+1)*sides
        for s in range(sides):
            n=(s+1)%sides
            faces += [[a+s,b+s,b+n],[a+s,b+n,a+n]]
    # caps
    verts += [[0,rows[0][0],rows[0][3]],[0,rows[-1][0],rows[-1][3]]]
    bi=len(verts)-2; ti=len(verts)-1
    for s in range(sides):
        n=(s+1)%sides
        faces += [[bi,s,n],[ti,(len(rows)-1)*sides+n,(len(rows)-1)*sides+s]]
    return trimesh.Trimesh(vertices=np.asarray(verts),faces=np.asarray(faces),process=False)


def cloth_panel(name, x_top, x_low, width_top, width_low, y_bottom, z_low, phase, parent):
    rows=9; cols=7; verts=[]
    y_top=2.17; z_top=.28
    for r in range(rows):
        t=r/(rows-1)
        # Weighted easing keeps the waist narrow, lower folds flare later.
        flare=t*t
        y=y_top*(1-t)+y_bottom*t
        xc=x_top*(1-t)+x_low*t
        width=width_top*(1-flare)+width_low*flare
        zc=z_top*(1-t)+z_low*t + .06*math.sin(t*math.pi+phase)
        for c in range(cols):
            u=c/(cols-1)*2-1
            # Deep lengthwise folds and irregular lower hem.
            z=zc + (.075+.095*t)*math.sin(u*math.pi*2.0+phase) + .035*math.sin((u*3.0+t*2.0)*math.pi)
            yy=y
            if r==rows-1:
                yy += .08*math.sin((u+phase)*4.1) + .045*math.cos(u*7.3+phase)
            x=xc + u*width*.5*(1+.035*math.sin(t*4+u*2))
            verts.append([x,yy,z])
    faces=[]
    for r in range(rows-1):
        for c in range(cols-1):
            a=r*cols+c;b=a+1;d=(r+1)*cols+c;e=d+1
            faces += [[a,d,e],[a,e,b]]
    m=trimesh.Trimesh(vertices=np.asarray(verts),faces=np.asarray(faces),process=False)
    add_mesh(name,m,M['cloth'],parent)


def irregular_brim():
    seg=48; verts=[]; faces=[]
    base_y=2.98
    for layer,th in enumerate([0.0,-.055]):
        for ring in [0,1]:
            for i in range(seg):
                a=2*math.pi*i/seg
                if ring==0:
                    rx=.43;rz=.37
                else:
                    wob=1+.07*math.sin(3*a+.4)+.035*math.sin(7*a-1.2)
                    rx=.93*wob;rz=.73*(1+.05*math.sin(5*a+.8))
                # Uneven brim edges with side/rear droop.
                y=base_y+th + (0 if ring==0 else (-.09*abs(math.cos(a))-.055*math.sin(a+.6)))
                verts.append([rx*math.cos(a),y,-.06+rz*math.sin(a)])
    # layer/ring indexing: top inner, top outer, bottom inner, bottom outer
    def idx(layer,ring,i): return layer*seg*2+ring*seg+(i%seg)
    for i in range(seg):
        n=(i+1)%seg
        faces += [[idx(0,0,i),idx(0,1,i),idx(0,1,n)],[idx(0,0,i),idx(0,1,n),idx(0,0,n)]]
        faces += [[idx(1,0,i),idx(1,1,n),idx(1,1,i)],[idx(1,0,i),idx(1,0,n),idx(1,1,n)]]
        faces += [[idx(0,1,i),idx(1,1,i),idx(1,1,n)],[idx(0,1,i),idx(1,1,n),idx(0,1,n)]]
        faces += [[idx(0,0,i),idx(1,0,n),idx(1,0,i)],[idx(0,0,i),idx(0,0,n),idx(1,0,n)]]
    return trimesh.Trimesh(vertices=np.asarray(verts),faces=np.asarray(faces),process=False)


def ring_mesh(name, center_y, rx, rz, thickness, material, parent='Witch Rig'):
    seg=36; verts=[]; faces=[]
    for y in [center_y-thickness*.5,center_y+thickness*.5]:
        for ring in [0,1]:
            rr=.90 if ring==0 else 1.0
            for i in range(seg):
                a=2*math.pi*i/seg
                verts.append([rx*rr*math.cos(a), y, -.06+rz*rr*math.sin(a)])
    def idx(l,r,i): return l*seg*2+r*seg+(i%seg)
    for i in range(seg):
        n=i+1
        faces += [[idx(0,0,i),idx(0,1,i),idx(0,1,n)],[idx(0,0,i),idx(0,1,n),idx(0,0,n)]]
        faces += [[idx(1,0,i),idx(1,1,n),idx(1,1,i)],[idx(1,0,i),idx(1,0,n),idx(1,1,n)]]
        faces += [[idx(0,1,i),idx(1,1,i),idx(1,1,n)],[idx(0,1,i),idx(1,1,n),idx(0,1,n)]]
    add_mesh(name,trimesh.Trimesh(vertices=np.asarray(verts),faces=np.asarray(faces),process=False),material,parent)


# Required animation roots.
for root in ['cape','hair_01','hair_02','hair_03','hair_04','hair_05','hat_tip','broom_handle','broom_bristles']:
    add_root(root)
for root,parent in [('cape_left','cape'),('cape_center','cape'),('cape_right','cape')]:
    add_root(root,parent)

# Human rider: continuous torso, neck/head, shoulder structure.
add_mesh('body_core',torso_loft(),M['body'])
ellipsoid('pelvis_volume',(0,1.00,.67),(.69,.43,.50),M['body'])
ellipsoid('ribcage_volume',(0,1.98,.17),(.76,.62,.48),M['body'])
add_mesh('neck',tube_mesh([(0,2.29,-.00),(0,2.56,-.06)],[.27,.25],14),M['body'])
ellipsoid('head',(0,2.70,-.08),(.43,.47,.40),M['body'])
for side in [-1,1]:
    ellipsoid(f'shoulder_{side}',(side*.70,2.18,.10),(.31,.30,.34),M['body'])

# Arms reach forward and inward to a visible two-hand broom grip.
for side in [-1,1]:
    pts=[
        (side*.72,2.18,.06),
        (side*.86,1.87,-.28),
        (side*.76,1.54,-.70),
        (side*.54,1.26,-1.07),
        (side*.24,.98,-1.48),
    ]
    add_mesh(f'arm_{side}',tube_mesh(pts,[.24,.235,.205,.175,.145],14),M['body'])
    ellipsoid(f'hand_{side}',(side*.19,.92,-1.54),(.18,.17,.22),M['detail'])

# Believable seated straddle: thighs originate at pelvis, knees splay around shaft, calves/boots follow angles.
for side in [-1,1]:
    thigh=[(side*.48,1.03,.66),(side*.65,.82,.82),(side*.78,.56,1.06)]
    calf=[(side*.78,.56,1.06),(side*.69,.25,1.34),(side*.56,-.02,1.58)]
    add_mesh(f'thigh_{side}',tube_mesh(thigh,[.30,.29,.245],16),M['body'])
    ellipsoid(f'knee_{side}',thigh[-1],(.26,.24,.27),M['detail'])
    add_mesh(f'calf_{side}',tube_mesh(calf,[.235,.205,.17],14),M['detail'])
    # Boot shaft and foot continue the calf line rather than hanging vertically.
    add_mesh(f'boot_shaft_{side}',tube_mesh([(side*.58,.08,1.50),(side*.52,-.14,1.76),(side*.49,-.27,2.02)],[.21,.20,.18],14),M['detail'])
    add_mesh(f'boot_foot_{side}',tube_mesh([(side*.49,-.27,2.02),(side*.48,-.31,2.30),(side*.46,-.28,2.55)],[.20,.19,.11],14),M['detail'])

# Waist belt ridge keeps ribcage -> waist -> pelvis transition readable.
ring_mesh('waist_belt',1.42,.53,.43,.12,M['detail'])

# Heavy overlapping cape panels: attached at shoulders, narrow through waist, only flare at lower folds.
panels=[
    ('cape_panel_L_outer',-.60,-.88,.38,.78,.18,1.56,.2,'cape_left'),
    ('cape_panel_L_mid',-.34,-.53,.36,.72,.30,1.40,1.1,'cape_left'),
    ('cape_panel_C_left',-.12,-.24,.26,.58,.42,1.24,2.0,'cape_center'),
    ('cape_panel_C_right',.12,.24,.26,.58,.38,1.28,2.8,'cape_center'),
    ('cape_panel_R_mid',.34,.53,.36,.72,.28,1.42,3.7,'cape_right'),
    ('cape_panel_R_outer',.60,.88,.38,.78,.15,1.58,4.5,'cape_right'),
]
for args in panels:
    cloth_panel(*args)
# Cape root yoke gives weight across shoulders but leaves torso sides/waist legible.
add_mesh('cape_yoke',tube_mesh([(-.72,2.17,.31),(-.35,2.24,.34),(0,2.25,.35),(.35,2.24,.34),(.72,2.17,.31)],[.12,.15,.16,.15,.12],12),M['cloth'],'cape')

# Dense broad mane: one under-mass plus 5 animated clusters of broad tapered clumps.
ellipsoid('hair_mane_base',(0,2.18,.30),(.72,.58,.37),M['hair'])
cluster_x=[-.62,-.31,0,.31,.62]
hair_clumps=0
for idx,x0 in enumerate(cluster_x,1):
    parent=f'hair_{idx:02d}'
    for j in range(4):
        ofs=(j-1.5)*.085
        x=x0+ofs
        end_y=1.48 + .10*((idx+j)%3)
        end_x=x*1.14 + (-.10 if j%2==0 else .08)
        pts=[
            (x,2.55,.08+.03*j),
            (x*.98 + .06*math.sin(j+idx),2.35,.31),
            (x*1.05 - .05*math.cos(j*1.7),2.08,.54),
            (end_x,1.78,.72+.05*math.sin(idx+j)),
            (end_x + .05*math.sin(j*2.1),end_y,.86+.06*math.cos(idx+j)),
        ]
        add_mesh(f'hair_clump_{idx}_{j}',tube_mesh(pts,[.16,.155,.135,.10,.025],12),M['hair'],parent)
        hair_clumps+=1
# Under-layer fills nape/shoulder silhouette without thin rope ends.
for j in range(8):
    x=-.52+j*(1.04/7)
    pts=[(x,2.47,.16),(x*1.10,2.14,.46),(x*1.18,1.83,.70),(x*1.22,1.56,.82)]
    add_mesh(f'hair_under_{j}',tube_mesh(pts,[.13,.13,.10,.022],10),M['hair'])

# Irregular drooping hat, balanced to the body rather than oversized.
add_mesh('hat_brim',irregular_brim(),M['cloth'])
ring_mesh('hat_band',3.09,.47,.39,.11,M['detail'])
hat_lower_pts=[(0,3.02,-.06),(-.02,3.28,-.05),(.03,3.52,-.01),(.10,3.72,.08),(.07,3.86,.20)]
add_mesh('hat_crown_lower',tube_mesh(hat_lower_pts,[.44,.39,.33,.25,.18],18),M['cloth'])
hat_tip_pts=[(.09,3.70,.08),(.08,3.86,.20),(-.02,3.99,.34),(-.18,4.03,.47),(-.31,3.98,.55)]
add_mesh('hat_tip_mesh',tube_mesh(hat_tip_pts,[.25,.19,.14,.08,.02],16),M['cloth'],'hat_tip')

# Thick crooked broom visibly runs under pelvis and between legs.
shaft_pts=[
    (-.08,.86,-2.35),(.07,.84,-1.65),(-.03,.82,-.80),(.03,.80,.05),(-.05,.78,.80),(.08,.75,1.65),(-.08,.72,2.45),(.03,.70,3.08)
]
add_mesh('broom_shaft',tube_mesh(shaft_pts,[.14,.145,.15,.155,.16,.165,.17,.17],16),M['broom'],'broom_handle')
# Binding collar at the base of straw.
add_mesh('broom_binding_core',tube_mesh([(0,.70,2.88),(0,.70,3.28)],[.29,.29],18),M['detail'],'broom_bristles')
for z in [2.97,3.08,3.19]:
    add_mesh(f'broom_binding_{z:.2f}',tube_mesh([(-.01,.70,z-.035),(.01,.70,z+.035)],[.31,.31],18),M['detail'],'broom_bristles')

# Large, dense, long full straw bundle: 144 individually modeled bristles.
bristle_count=144
for i in range(bristle_count):
    a=2*math.pi*(i/bristle_count) + RNG.normal(0,.045)
    ring=(i%12)/11
    base_r=.06+.20*ring+RNG.uniform(0,.035)
    bx=base_r*math.cos(a)
    by=.70+base_r*.65*math.sin(a)
    bz=3.12+RNG.uniform(-.055,.055)
    length=2.45+RNG.uniform(0,1.05)
    fan=0.42+RNG.uniform(.30,.72)
    ex=bx + fan*math.cos(a)*(1.0+RNG.uniform(.0,.55))
    ey=by + fan*.62*math.sin(a) + RNG.normal(0,.06)
    ez=bz+length
    bendx=RNG.normal(0,.12); bendy=RNG.normal(-.03,.08)
    pts=[
        (bx,by,bz),
        (bx*.95+bendx*.12,by+bendy*.10,bz+length*.16),
        (bx*.75+ex*.20+bendx*.35,by+(ey-by)*.18+bendy*.20,bz+length*.34),
        (bx*.50+ex*.46+bendx*.45,by+(ey-by)*.43+bendy*.25,bz+length*.54),
        (bx*.25+ex*.72+bendx*.30,by+(ey-by)*.69+bendy*.15,bz+length*.74),
        (ex,ey,ez),
    ]
    rr=.018+RNG.uniform(0,.010)
    add_mesh(f'broom_bristle_{i:03d}',tube_mesh(pts,[rr,rr*.96,rr*.82,rr*.62,rr*.38,.0045],32),M['straw'],'broom_bristles')

# Subtle geometry-only seams/fold ridges on cape lower half to create depth in phone silhouette.
for i,x in enumerate(np.linspace(-.74,.74,7)):
    add_mesh(f'cape_fold_ridge_{i}',tube_mesh([(x,1.30,.73+abs(x)*.12),(x*1.08,.82,1.05+abs(x)*.18),(x*1.16,.34,1.38+abs(x)*.16)],[.045,.055,.018],8),M['detail'],'cape')

# Export.
glb=scene.export(file_type='glb')
out=OUT/'witch-rider.glb'
out.write_bytes(glb)

meta={
    'version':'witch-mesh-pass-v14',
    'build':'pass-14-human-seated-rebuild-v8',
    'file':'witch-rider.glb',
    'bytes':len(glb),
    'material_phase':'neutral-clay-mesh-review-only',
    'required_motion_nodes':['cape','cape_left','cape_center','cape_right','hair_01','hair_02','hair_03','hair_04','hair_05','hat_tip','broom_handle','broom_bristles'],
    'broom_bristle_count':bristle_count,
    'hair_animated_roots':5,
    'hair_clumps_per_root':4,
    'hair_under_clumps':8,
    'cape_motion_roots':3,
    'cape_panel_meshes':6,
    'features':[
        'continuous elongated ribcage waist pelvis torso',
        'forward upper body riding lean built into geometry',
        'pelvis centered directly over broom shaft',
        'both arms bend forward inward to visible grip',
        'connected seated straddle thighs knees calves',
        'boots continue calf riding angles',
        'six overlapping shoulder-to-hip cape panels',
        'waist stays readable before lower cape flare',
        'broad layered nape shoulder mane with tapered clumps',
        'reduced irregular drooping witch hat',
        'thick crooked shaft routed through seated position',
        'large dense long straw bundle',
        '144 individually modeled tapered bristles',
        'neutral clay mesh review only'
    ]
}
META.parent.mkdir(parents=True,exist_ok=True)
META.write_text(json.dumps(meta,indent=2)+'\n')
print(json.dumps(meta,indent=2))
