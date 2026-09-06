import math, json
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter, ImageDraw
import trimesh
from trimesh.exchange import gltf
from trimesh.transformations import translation_matrix, rotation_matrix, scale_matrix
from trimesh.visual.material import PBRMaterial

ROOT=Path(__file__).resolve().parents[1]
MODEL_OUT=ROOT/'assets'/'models'
TEX_OUT=ROOT/'assets'/'textures'
MODEL_OUT.mkdir(parents=True, exist_ok=True)
TEX_OUT.mkdir(parents=True, exist_ok=True)
OUT=MODEL_OUT
np.random.seed(13)

def rgba(hexstr, a=255):
    h=hexstr.lstrip('#'); return [int(h[i:i+2],16) for i in (0,2,4)]+[a]

def mat(name, color, metallic=0.0, rough=0.8, emissive=None, double=False, alpha=255):
    em=None
    if emissive:
        em=np.array(rgba(emissive)[:3],dtype=float)/255.0
    return PBRMaterial(name=name, baseColorFactor=np.array(rgba(color,alpha),dtype=float)/255.0,
                       metallicFactor=metallic, roughnessFactor=rough,
                       emissiveFactor=em, doubleSided=double,
                       alphaMode='BLEND' if alpha<255 else 'OPAQUE')

M={
'cloth':mat('weathered black wool','#151316',0,.86,double=True),
'cloth_edge':mat('worn wool edge','#272026',0,.78,double=True),
'burgundy':mat('oxblood cape lining','#4a0c12',0,.72,double=True),
'burgundy_dark':mat('aged burgundy trim','#2c080c',0,.82,double=True),
'hair':mat('auburn hair','#64200d',0,.48),
'hair_high':mat('copper hair highlight','#8b3214',0,.44),
'skin':mat('moonlit skin','#8f6250',0,.68),
'leather':mat('aged black leather','#171518',0,.54),
'boot':mat('scuffed riding boot','#0d0d0e',0,.46),
'brass':mat('tarnished brass','#705126',.72,.34),
'wood':mat('old broom wood','#5a3419',0,.72),
'bristle':mat('burnt broom straw','#6b3d16',0,.9),
'ember':mat('ember coal','#2c1205',0,.42,'#ff6a14'),
'carpaint':mat('aged black lacquer','#10161c',.52,.2),
'carpaint_worn':mat('worn lacquer','#2a2523',.26,.48),
'chrome':mat('pitted chrome','#8b9193',.9,.17),
'glass':PBRMaterial(name='smoky glass',baseColorFactor=np.array([.045,.08,.095,.62]),metallicFactor=.04,roughnessFactor=.1,alphaMode='BLEND',doubleSided=True),
'tire':mat('period rubber','#111112',0,.95),
'whitewall':mat('aged whitewall','#b9b4a3',0,.7),
'headlamp':mat('warm headlamp','#6f330b',.05,.18,'#ff9a31'),
'taillamp':mat('ruby tail lamp','#3b0604',.02,.22,'#b5190d'),
'bark':mat('dead bark','#38271f',0,.97),
'bark_light':mat('split bark','#594033',0,.94),
'bean':mat('roasted coffee','#5a1e08',0,.36,'#a52e08'),
'bean_dark':mat('bean seam','#180804',0,.7),
'iron':mat('oxidized iron','#332721',.55,.7),
'wood_fence':mat('weathered fence wood','#4a3a2d',0,.91),
'wood_split':mat('split fence grain','#6a5540',0,.88),
'nail':mat('rusted square nail','#3a241a',.65,.62),
'pumpkin':mat('old pumpkin','#7e3109',0,.72),
'pumpkin_dark':mat('pumpkin crease','#4b1a05',0,.82),
'stem':mat('dry stem','#2f2c16',0,.9),
'jackglow':mat('jack o lantern glow','#4a1602',0,.32,'#ff7b17'),
'brick':mat('soot brick','#241c1a',0,.9),
'brick_warm':mat('aged red brick','#3a2420',0,.88),
'window':mat('warm factory window','#2d1505',0,.35,'#ff8d2c'),
'roof':mat('blackened metal roof','#17191b',.45,.55),
'soot':mat('chimney soot','#111214',0,.98),
}

def frustum(r0,r1,h,sections=24):
    ang=np.linspace(0,2*math.pi,sections,endpoint=False); v=[]
    for y,r in [(-h/2,r0),(h/2,r1)]:
        for a in ang:v.append([math.cos(a)*r,y,math.sin(a)*r])
    faces=[]
    for i in range(sections):
        j=(i+1)%sections; faces += [[i,j,sections+i],[j,sections+j,sections+i]]
    v.append([0,-h/2,0]); cb=len(v)-1; v.append([0,h/2,0]); ct=len(v)-1
    for i in range(sections):
        j=(i+1)%sections; faces += [[cb,j,i],[ct,sections+i,sections+j]]
    return trimesh.Trimesh(vertices=np.array(v),faces=np.array(faces),process=True)

def add(scene, mesh, name, material, T=None):
    mesh=mesh.copy(); mesh.visual.material=material
    scene.add_geometry(mesh,node_name=name,geom_name=name,transform=np.eye(4) if T is None else T)

def T(pos=(0,0,0),rot=None,scale=None):
    Mx=np.eye(4)
    if scale is not None: Mx=scale_matrix(scale)@Mx if np.isscalar(scale) else np.diag([*scale,1])@Mx
    if rot:
        for axis,ang in rot:
            vec={'x':[1,0,0],'y':[0,1,0],'z':[0,0,1]}[axis]; Mx=rotation_matrix(math.radians(ang),vec)@Mx
    return translation_matrix(pos)@Mx

def export_scene(scene,filename):
    data=gltf.export_glb(scene,include_normals=True,unitize_normals=True)
    (OUT/filename).write_bytes(data)
    return {'file':filename,'bytes':len(data),'nodes':len(scene.graph.nodes_geometry)}

def cylinder_between(a,b,r,sections=20):
    a=np.array(a,float); b=np.array(b,float); v=b-a; L=np.linalg.norm(v)
    mesh=trimesh.creation.cylinder(radius=r,height=L,sections=sections)
    z=np.array([0,0,1.]); n=v/L; axis=np.cross(z,n); dot=np.clip(np.dot(z,n),-1,1); R=np.eye(4)
    if np.linalg.norm(axis)>1e-8:R=rotation_matrix(math.acos(dot),axis/np.linalg.norm(axis))
    elif dot<0:R=rotation_matrix(math.pi,[1,0,0])
    return mesh,translation_matrix((a+b)/2)@R

def tapered_tube(points,radii,radial=10):
    p=np.asarray(points,float); radii=np.asarray(radii,float); verts=[]
    for i,pt in enumerate(p):
        if i==0:t=p[1]-p[0]
        elif i==len(p)-1:t=p[-1]-p[-2]
        else:t=p[i+1]-p[i-1]
        t=t/(np.linalg.norm(t)+1e-9); ref=np.array([0,1,0.])
        if abs(np.dot(t,ref))>.88:ref=np.array([1,0,0.])
        u=np.cross(t,ref);u/=np.linalg.norm(u)+1e-9;v=np.cross(t,u);v/=np.linalg.norm(v)+1e-9
        for a in np.linspace(0,2*math.pi,radial,endpoint=False):verts.append(pt+(u*math.cos(a)+v*math.sin(a))*radii[i])
    faces=[]
    for i in range(len(p)-1):
        for j in range(radial):
            k=(j+1)%radial;a=i*radial+j;b=i*radial+k;c=(i+1)*radial+j;d=(i+1)*radial+k
            faces += [[a,c,b],[b,c,d]]
    return trimesh.Trimesh(np.array(verts),np.array(faces),process=True)

def cloth_grid(widths,ys,zs,cols=9,tatter=None):
    verts=[]; rows=len(zs)
    for j,(w,y,z) in enumerate(zip(widths,ys,zs)):
        for i,x in enumerate(np.linspace(-w,w,cols)):
            jitter=0 if j<rows-1 else (tatter[i] if tatter is not None else 0)
            verts.append([x,y+jitter,z])
    faces=[]
    for j in range(rows-1):
        for i in range(cols-1):
            a=j*cols+i;b=a+1;c=a+cols;d=c+1;faces += [[a,c,b],[b,c,d],[b,c,a],[d,c,b]]
    return trimesh.Trimesh(np.array(verts),np.array(faces),process=False)

def loft_body(sections,radial=18):
    verts=[]
    for z,w,h,yc in sections:
        for a in np.linspace(0,2*math.pi,radial,endpoint=False):
            verts.append([math.cos(a)*w,yc+math.sin(a)*h,z])
    faces=[]
    for i in range(len(sections)-1):
        for j in range(radial):
            k=(j+1)%radial;a=i*radial+j;b=i*radial+k;c=(i+1)*radial+j;d=(i+1)*radial+k;faces += [[a,c,b],[b,c,d]]
    return trimesh.Trimesh(np.array(verts),np.array(faces),process=True)

def triangle(points):
    return trimesh.Trimesh(np.array(points,float),np.array([[0,1,2]]),process=False)

# --- Witch rider cinematic-detail rig ---
s=trimesh.Scene()
add(s,trimesh.creation.capsule(height=1.0,radius=.38,count=[12,24]),'body_core',M['cloth'],T((0,.38,0),scale=(1.18,1.18,.90)))
add(s,frustum(.76,.35,1.28,28),'coat_skirt',M['cloth'],T((0,-.30,.10)))
for side in (-1,1):
    add(s,trimesh.creation.icosphere(subdivisions=2,radius=.26),f'shoulder_{side}',M['cloth_edge'],T((side*.42,.78,-.02),scale=(1.15,.75,.9)))
add(s,trimesh.creation.cylinder(radius=.44,height=.105,sections=28),'belt',M['leather'],T((0,.16,0)))
add(s,trimesh.creation.box([.20,.16,.07]),'belt_buckle',M['brass'],T((0,.16,-.40)))
add(s,trimesh.creation.cylinder(radius=.17,height=.10,sections=24),'collar',M['burgundy_dark'],T((0,1.08,-.03)))
add(s,trimesh.creation.cylinder(radius=.13,height=.24,sections=18),'neck',M['skin'],T((0,1.15,-.04)))
add(s,trimesh.creation.icosphere(subdivisions=3,radius=.34),'head',M['skin'],T((0,1.49,-.08),scale=(.92,1.08,.94)))
add(s,trimesh.creation.cylinder(radius=.72,height=.055,sections=44),'hat_brim',M['cloth'],T((0,1.82,-.08),rot=[('z',2)],scale=(1.0,1,.88)))
add(s,frustum(.40,.23,.74,32),'hat_crown',M['cloth'],T((-.02,2.18,-.08),rot=[('z',-6)]))
hat_tip=tapered_tube([[0,0,0],[-.04,.18,.01],[-.11,.34,.03],[-.22,.48,.05],[-.34,.57,.06]],[.23,.19,.15,.10,.035],16)
add(s,hat_tip,'hat_tip',M['cloth'],T((.02,2.47,-.08),rot=[('z',-4)]))
add(s,trimesh.creation.cylinder(radius=.42,height=.07,sections=34),'hat_band',M['burgundy'],T((0,1.94,-.08)))
add(s,trimesh.creation.box([.16,.14,.055]),'hat_buckle',M['brass'],T((.28,1.95,-.34),rot=[('z',-8)]))
for side in (-1,1):
    a=(side*.34,.84,-.03); b=(side*.63,.24,-.40); mesh,tr=cylinder_between(a,b,.14,20); add(s,mesh,f'arm_{"L" if side<0 else "R"}',M['cloth'],tr)
    add(s,trimesh.creation.cylinder(radius=.145,height=.12,sections=18),f'cuff_{"L" if side<0 else "R"}',M['burgundy_dark'],T(b,rot=[('x',70)]))
    c=(side*.38,-.12,-.56); mesh,tr=cylinder_between(b,c,.105,18); add(s,mesh,f'forearm_{"L" if side<0 else "R"}',M['leather'],tr)
    add(s,trimesh.creation.icosphere(subdivisions=2,radius=.12),f'glove_{"L" if side<0 else "R"}',M['leather'],T(c,scale=(1.0,.8,1.15)))
    hip=(side*.28,-.42,.05); knee=(side*.46,-.88,.36); ankle=(side*.34,-1.08,-.08)
    mesh,tr=cylinder_between(hip,knee,.16,18); add(s,mesh,f'thigh_{side}',M['cloth'],tr)
    mesh,tr=cylinder_between(knee,ankle,.13,18); add(s,mesh,f'shin_{side}',M['leather'],tr)
    add(s,trimesh.creation.capsule(height=.36,radius=.13,count=[8,14]),f'boot_{side}',M['boot'],T((ankle[0],ankle[1]-.10,ankle[2]-.16),rot=[('x',78)],scale=(1.0,1.0,1.45)))
widths=[.54,.64,.76,.88,1.00,1.08,1.14,1.18]; ys=[0,-.06,-.16,-.29,-.44,-.61,-.80,-1.02]; zs=[0,.22,.47,.75,1.05,1.36,1.68,2.02]
tatter=np.array([-.18,.03,-.12,.08,-.24,.05,-.15,.02,-.20])
cape_mesh=cloth_grid(widths,ys,zs,9,tatter)
add(s,cape_mesh,'cape',M['cloth'],T((0,.88,.24)))
lining=cape_mesh.copy(); lining.apply_translation([0,-.018,.025]); lining.apply_scale([.96,.98,.985])
add(s,lining,'cape_lining',M['burgundy'],T((0,.88,.24)))
for i,x in enumerate(np.linspace(-.34,.34,5)):
    length=1.35+(.1 if i in [0,4] else .28 if i in [1,3] else .42)
    pts=[]
    for j in range(8):
        f=j/7; pts.append([math.sin(f*math.pi*1.25+i*.8)*(.05+.06*f),-.10*f-.34*f*f,length*f])
    lock=tapered_tube(pts,np.linspace(.105 if i!=2 else .12,.022,8),10)
    add(s,lock,f'hair_{i+1:02d}',M['hair_high'] if i in (1,3) else M['hair'],T((x,1.57,.20+(i%2)*.025),rot=[('z',(i-2)*3)]))
add(s,trimesh.creation.cylinder(radius=.052,height=5.3,sections=20),'broom_handle',M['wood'],T((0,-.82,.18)))
add(s,trimesh.creation.torus(major_radius=.10,minor_radius=.025,major_sections=20,minor_sections=8),'broom_binding',M['brass'],T((0,-.82,2.80),rot=[('x',90)]))
straw=[]
for i in range(18):
    a=2*math.pi*i/18; start=np.array([math.cos(a)*.075,math.sin(a)*.055,0]); end=np.array([math.cos(a)*(.25+.05*(i%3)),math.sin(a)*(.18+.035*(i%4)),1.23+.08*math.sin(i)])
    straw.append(tapered_tube([start,start*.8+end*.2,start*.45+end*.55,end],[.036,.031,.022,.009],7))
add(s,trimesh.util.concatenate(straw),'broom_bristles',M['bristle'],T((0,-.82,2.78)))
for k in range(6):
    add(s,trimesh.creation.icosphere(subdivisions=1,radius=.13-.013*k),f'ember_{k}',M['ember'],T(((-.13+.05*k),-.82,4.10+.23*k),scale=(1,.55,1.7)))
witch_meta=export_scene(s,'witch-rider.glb')

# --- 1930s coupe cinematic-detail hazard ---
s=trimesh.Scene()
body_sections=[(-2.45,.92,.36,.82),(-2.15,1.16,.44,.84),(-1.20,1.28,.48,.88),(.15,1.30,.47,.87),(1.35,1.18,.39,.86),(2.18,.94,.31,.83),(2.48,.66,.24,.82)]
add(s,loft_body(body_sections,20),'body_shell',M['carpaint'])
add(s,trimesh.creation.icosphere(subdivisions=3,radius=1),'rear_round',M['carpaint'],T((0,1.02,-1.67),scale=(1.20,.60,.92)))
add(s,trimesh.creation.icosphere(subdivisions=3,radius=1),'hood',M['carpaint'],T((0,1.28,1.50),scale=(1.10,.28,.95)))
add(s,trimesh.creation.icosphere(subdivisions=3,radius=1),'cabin',M['carpaint'],T((0,1.88,-.52),scale=(.98,.76,1.04)))
add(s,trimesh.creation.icosphere(subdivisions=3,radius=1),'roof',M['carpaint'],T((0,2.40,-.60),scale=(1.03,.38,1.08)))
add(s,trimesh.creation.box([1.72,.67,.045]),'windshield',M['glass'],T((0,1.99,.55),rot=[('x',-20)]))
add(s,trimesh.creation.box([1.66,.61,.045]),'rear_window',M['glass'],T((0,1.97,-1.58),rot=[('x',20)]))
for side in (-1,1):
    add(s,trimesh.creation.box([.045,.62,.92]),f'side_glass_{side}',M['glass'],T((side*.97,1.99,-.55)))
    add(s,trimesh.creation.box([.13,.055,3.32]),f'running_board_{side}',M['carpaint_worn'],T((side*1.28,.52,-.05)))
    add(s,trimesh.creation.box([.035,.05,3.05]),f'chrome_trim_{side}',M['chrome'],T((side*1.255,1.25,-.20)))
for side in (-1,1):
  for idx,z in enumerate((-1.58,1.58)):
    add(s,trimesh.creation.cylinder(radius=.48,height=.31,sections=32),f'wheel_{side}_{idx}',M['tire'],T((side*1.29,.49,z),rot=[('y',90)]))
    add(s,trimesh.creation.cylinder(radius=.37,height=.325,sections=30),f'whitewall_{side}_{idx}',M['whitewall'],T((side*1.292,.49,z),rot=[('y',90)]))
    add(s,trimesh.creation.cylinder(radius=.27,height=.335,sections=28),f'hub_{side}_{idx}',M['chrome'],T((side*1.295,.49,z),rot=[('y',90)]))
    add(s,trimesh.creation.torus(major_radius=.52,minor_radius=.105,major_sections=30,minor_sections=10),f'fender_{side}_{idx}',M['carpaint'],T((side*1.20,.63,z),rot=[('y',90)],scale=(1,1.04,1)))
add(s,trimesh.creation.box([1.24,.83,.08]),'grille_back',M['iron'],T((0,1.02,2.48)))
for x in np.linspace(-.52,.52,11):add(s,trimesh.creation.box([.025,.75,.055]),f'grille_bar_{x:.2f}',M['chrome'],T((x,1.04,2.55)))
for y in (.75,1.02,1.29):add(s,trimesh.creation.box([1.16,.025,.055]),f'grille_cross_{y}',M['chrome'],T((0,y,2.56)))
add(s,trimesh.creation.box([2.35,.10,.13]),'front_bumper',M['chrome'],T((0,.58,2.69)))
add(s,trimesh.creation.box([2.26,.09,.12]),'rear_bumper',M['chrome'],T((0,.58,-2.66)))
for x in (-.74,.74):
    add(s,trimesh.creation.cylinder(radius=.24,height=.16,sections=26),f'lamp_mount_{x}',M['chrome'],T((x,1.24,2.47),rot=[('x',90)]))
    add(s,trimesh.creation.uv_sphere(radius=.205,count=[18,18]),f'headlamp_{x}',M['headlamp'],T((x,1.24,2.61),scale=(1,1,.55)))
for x in (-.72,.72):add(s,trimesh.creation.uv_sphere(radius=.105,count=[12,12]),f'taillamp_{x}',M['taillamp'],T((x,.88,-2.47),scale=(1,.8,.45)))
add(s,trimesh.creation.cone(radius=.05,height=.28,sections=18),'hood_ornament',M['chrome'],T((0,1.62,1.99),rot=[('x',-90)]))
for side in (-1,1):
    add(s,trimesh.creation.box([.12,.04,.035]),f'door_handle_{side}',M['chrome'],T((side*1.08,1.72,-.74)))
    add(s,trimesh.creation.cylinder(radius=.028,height=.32,sections=10),f'mirror_stalk_{side}',M['chrome'],T((side*1.08,1.78,.48),rot=[('z',90)]))
    add(s,trimesh.creation.icosphere(subdivisions=2,radius=.13),f'mirror_{side}',M['chrome'],T((side*1.24,1.83,.48),scale=(.45,1,.75)))
add(s,trimesh.creation.box([.58,.22,.035]),'license_plate',M['whitewall'],T((0,.72,-2.68)))
for i,z in enumerate((-1.85,-.95,.55,1.42)):add(s,trimesh.creation.box([.16,.025,.32]),f'worn_patch_{i}',M['carpaint_worn'],T(((-1)**i*.94,.92,z),rot=[('y',6*(-1)**i)]))
car_meta=export_scene(s,'vintage-car.glb')

# --- Haunted dead tree with secondary twigs and split bark ---
s=trimesh.Scene();add(s,frustum(.74,.36,6.3,18),'trunk',M['bark'],T((0,3.15,0)))
for i,a in enumerate(np.linspace(0,2*math.pi,8,endpoint=False)):
    b=(math.cos(a)*(1.25+.18*(i%2)),.10,math.sin(a)*(1.25+.12*(i%3)));mesh,tr=cylinder_between((0,.34,0),b,.16 if i%2 else .19,12);add(s,mesh,f'root_{i}',M['bark'],tr)
branches=[((0,5.4,0),(1.9,7.0,.2),.27),((0,5.2,0),(-1.7,6.8,-.15),.25),((.7,6.1,.1),(2.55,7.8,.5),.16),((-.65,5.9,-.1),(-2.35,7.5,-.5),.15),((1.85,7,.2),(2.65,8.2,.05),.10),((-1.7,6.8,-.15),(-2.1,8.1,.25),.10),((.2,5.8,0),(.45,8.1,-.2),.19)]
ends=[]
for i,(a,b,r) in enumerate(branches):mesh,tr=cylinder_between(a,b,r,14);add(s,mesh,f'branch_{i}',M['bark'],tr);ends.append(np.array(b,float))
for i,end in enumerate(ends):
    for j in range(3):
        off=np.array([(-1)**(i+j)*(.42+.18*j),.56+.18*j,math.sin(i*1.7+j)*.42]);b=end+off;mesh,tr=cylinder_between(end,b,.055+.01*(j==0),9);add(s,mesh,f'twig_{i}_{j}',M['bark_light'] if j==1 else M['bark'],tr)
for i in range(7):
    y=.8+i*.72;add(s,trimesh.creation.icosphere(subdivisions=2,radius=.17),f'bark_knot_{i}',M['bark_light'],T((.34*math.sin(i*2.1),y,.33*math.cos(i*1.7)),scale=(1,.42,.45)))
tree_meta=export_scene(s,'dead-tree.glb')

# Coffee bean collectible.
s=trimesh.Scene();add(s,trimesh.creation.icosphere(subdivisions=3,radius=1),'bean_body',M['bean'],T((0,0,0),rot=[('z',24)],scale=(.38,.55,.25)))
add(s,trimesh.creation.capsule(height=.58,radius=.025,count=[8,12]),'bean_seam',M['bean_dark'],T((0,0,.236),rot=[('z',18)]));bean_meta=export_scene(s,'coffee-bean.glb')

# Weathered fence with broken rails, split grain and rusted nails.
s=trimesh.Scene()
for idx,x in enumerate((-1.7,0,1.7)):
    angle=(-5,4,-7)[idx];add(s,trimesh.creation.box([.24,2.65,.24]),f'post_{idx}',M['wood_fence'],T((x,1.32,0),rot=[('z',angle)]));add(s,trimesh.creation.cone(radius=.24,height=.38,sections=4),f'postcap_{idx}',M['wood_split'],T((x,2.79,0),rot=[('y',45),('z',angle)]))
for idx,(y,ang,dx) in enumerate(((.84,3,-.12),(1.72,-4,.10))):
    add(s,trimesh.creation.box([3.72,.22,.17]),f'rail_{idx}',M['wood_fence'],T((dx,y,0),rot=[('z',ang)]));add(s,trimesh.creation.box([.52,.23,.18]),f'rail_split_{idx}',M['wood_split'],T((1.45*(-1 if idx else 1),y+.03,.01),rot=[('z',ang+8)]))
for i,(x,y) in enumerate(((-1.52,.83),(1.52,.91),(-1.60,1.70),(1.56,1.66))):add(s,trimesh.creation.cylinder(radius=.035,height=.07,sections=8),f'nail_{i}',M['nail'],T((x,y,.13),rot=[('x',90)]))
fence_meta=export_scene(s,'haunted-fence.glb')

# Jack-o-lantern with visible glowing carved face.
s=trimesh.Scene()
for i,a in enumerate(np.linspace(0,2*math.pi,9,endpoint=False)):
    add(s,trimesh.creation.icosphere(subdivisions=2,radius=1),f'pumpkin_lobe_{i}',M['pumpkin'] if i%2 else M['pumpkin_dark'],T((math.cos(a)*.13,.55,math.sin(a)*.13),scale=(.56,.58,.56)))
add(s,trimesh.creation.cylinder(radius=.11,height=.45,sections=12),'pumpkin_stem',M['stem'],T((0,1.23,0),rot=[('z',-9)]))
add(s,triangle([[-.32,.74,.555],[-.08,.83,.565],[-.15,.58,.57]]),'jack_eye_L',M['jackglow']);add(s,triangle([[.32,.74,.555],[.08,.83,.565],[.15,.58,.57]]),'jack_eye_R',M['jackglow'])
for i,x in enumerate(np.linspace(-.30,.24,5)):add(s,trimesh.creation.box([.16,.09,.025]),f'jack_mouth_{i}',M['jackglow'],T((x,.38+(.04 if i%2 else 0),.57),rot=[('z',(-1)**i*7)]))
pumpkin_meta=export_scene(s,'jack-o-lantern.glb')

# Haunted Brew & Brews roasting operation silhouette with industrial detail.
s=trimesh.Scene();add(s,trimesh.creation.box([9,4.8,5]),'factory_body',M['brick'],T((0,2.4,0)))
add(s,trimesh.creation.box([3.7,3.2,3.3]),'factory_annex',M['brick_warm'],T((5.3,1.6,.25)))
add(s,trimesh.creation.box([9.6,.28,5.5]),'roof',M['roof'],T((0,4.9,0),rot=[('z',-2)]));add(s,trimesh.creation.box([4.1,.25,3.7]),'annex_roof',M['roof'],T((5.3,3.3,.25),rot=[('z',2)]))
for i,(x,h,z) in enumerate(((-2.7,5.7,-.8),(2.7,4.9,-1.1))):
    add(s,trimesh.creation.box([1.05,h,1.05]),f'chimney_{i}',M['brick'],T((x,4.5+max(0,h-5)*.5,z)));add(s,trimesh.creation.cylinder(radius=.62,height=.18,sections=18),f'chimney_cap_{i}',M['soot'],T((x,7.4 if i==0 else 6.95,z)))
for row,y in enumerate((1.4,2.8)):
    for col,x in enumerate(np.linspace(-3.1,3.1,5)):add(s,trimesh.creation.box([.82,.68,.05]),f'window_{row}_{col}',M['window'],T((x,y,2.53)))
for col,x in enumerate((4.55,5.45,6.35)):add(s,trimesh.creation.box([.62,.72,.05]),f'annex_window_{col}',M['window'],T((x,1.75,1.92)))
add(s,trimesh.creation.box([1.4,2.4,.08]),'loading_door',M['iron'],T((0,1.2,2.54)))
add(s,trimesh.creation.box([4.1,.75,.12]),'bb_sign_plate',M['iron'],T((-2.15,4.05,2.56)))
for i,x in enumerate((-3.35,-2.10,-.86)):
    add(s,trimesh.creation.box([.13,.48,.08]),f'sign_stem_{i}',M['brass'],T((x,4.05,2.65)))
    if i!=1:
        for y in (3.88,4.22):add(s,trimesh.creation.box([.48,.10,.08]),f'sign_bar_{i}_{y}',M['brass'],T((x+.18,y,2.65)))
    else:
        add(s,trimesh.creation.box([.46,.10,.08]),'sign_plus_h',M['brass'],T((x,4.05,2.65)));add(s,trimesh.creation.box([.10,.44,.08]),'sign_plus_v',M['brass'],T((x,4.05,2.65)))
for i,x in enumerate((-3.6,-1.8,1.6,3.4)):
    add(s,trimesh.creation.cylinder(radius=.18,height=1.05,sections=14),f'roof_vent_{i}',M['roof'],T((x,5.45,-.6+(i%2)*1.1)))
add(s,trimesh.creation.cylinder(radius=.72,height=2.25,sections=24),'roast_tank',M['iron'],T((5.5,1.4,-2.0)))
add(s,trimesh.creation.cylinder(radius=.09,height=4.5,sections=12),'process_pipe',M['brass'],T((4.5,2.5,-2.0),rot=[('z',90)]))
roastery_meta=export_scene(s,'haunted-roastery.glb')

# --- 512px wet-road PBR maps: aggregate, cracks, worn wheel lanes and puddle gloss ---
size=512;rng=np.random.default_rng(90210);noise=rng.normal(0,1,(size,size))
lo=np.array(Image.fromarray(np.uint8(np.clip((noise-noise.min())/(noise.max()-noise.min())*255,0,255))).filter(ImageFilter.GaussianBlur(8)),dtype=float)/255
fine=rng.random((size,size));base=18+20*lo+8*fine;rgb=np.dstack([base*.82,base*.90,base])
for cx in (int(size*.33),int(size*.67)):
    xx=np.arange(size)[None,:];band=np.exp(-((xx-cx)/(size*.075))**2);rgb*=1-.16*band[...,None]
for _ in range(4200):
    y=int(rng.integers(0,size));x=int(rng.integers(0,size));r=int(rng.integers(1,3));val=int(rng.integers(15,58));rgb[max(0,y-r):min(size,y+r+1),max(0,x-r):min(size,x+r+1),:]=val*np.array([.84,.90,1])
img=Image.fromarray(np.uint8(np.clip(rgb,0,255)),'RGB');d=ImageDraw.Draw(img)
for _ in range(46):
    x=int(rng.integers(0,size));y=int(rng.integers(0,size));pts=[(x,y)]
    for __ in range(int(rng.integers(4,10))):x+=int(rng.integers(-42,43));y+=int(rng.integers(9,56));pts.append((x%size,y%size))
    d.line(pts,fill=(7,9,11),width=int(rng.integers(1,3)))
img.save(TEX_OUT/'asphalt-albedo.png',optimize=True)
height=np.array(img.convert('L').filter(ImageFilter.GaussianBlur(1.05)),dtype=float)/255;gy,gx=np.gradient(height);strength=6.5;nx=-gx*strength;ny=-gy*strength;nz=np.ones_like(nx);norm=np.sqrt(nx*nx+ny*ny+nz*nz);nx/=norm;ny/=norm;nz/=norm
normal=np.dstack([(nx*.5+.5)*255,(ny*.5+.5)*255,(nz*.5+.5)*255]).astype(np.uint8);Image.fromarray(normal,'RGB').save(TEX_OUT/'asphalt-normal.png',optimize=True)
wet=np.array(Image.fromarray(np.uint8(rng.random((size,size))*255)).filter(ImageFilter.GaussianBlur(28)),dtype=float)/255;wet=(wet-wet.min())/(wet.max()-wet.min()+1e-9)
Y,X=np.mgrid[0:size,0:size];lane=np.maximum(np.exp(-((X-size*.33)/(size*.08))**2),np.exp(-((X-size*.67)/(size*.08))**2));wet=np.clip(.48*wet+.52*lane,0,1)
for _ in range(17):
    cx=float(rng.integers(0,size));cy=float(rng.integers(0,size));rx=float(rng.integers(28,95));ry=float(rng.integers(10,42));wet=np.maximum(wet,np.exp(-(((X-cx)/rx)**2+((Y-cy)/ry)**2)*2.2))
Image.fromarray(np.uint8(72+165*np.clip(wet,0,1)),'L').save(TEX_OUT/'asphalt-gloss.png',optimize=True)
Image.fromarray(np.uint8(255*np.clip((wet-.58)*2.2,0,1)),'L').save(TEX_OUT/'asphalt-puddles.png',optimize=True)

meta={'generated':'Witch Ride 3D cinematic detail assets','version':'cinematic-detail-v2','assets':[witch_meta,car_meta,tree_meta,bean_meta,fence_meta,pumpkin_meta,roastery_meta],'textures':[]}
for p in ['asphalt-albedo.png','asphalt-normal.png','asphalt-gloss.png','asphalt-puddles.png']:meta['textures'].append({'file':p,'bytes':(TEX_OUT/p).stat().st_size})
(ROOT/'assets'/'manifest.json').write_text(json.dumps(meta,indent=2));print(json.dumps(meta,indent=2))
