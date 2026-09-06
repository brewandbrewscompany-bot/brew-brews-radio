import os, math, json
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter, ImageDraw
import trimesh
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

def mat(name, color, metallic=0.0, rough=0.8, emissive=None, double=False):
    em=None
    if emissive:
        em=np.array(rgba(emissive)[:3],dtype=float)/255.0
    return PBRMaterial(name=name, baseColorFactor=np.array(rgba(color),dtype=float)/255.0,
                       metallicFactor=metallic, roughnessFactor=rough,
                       emissiveFactor=em, doubleSided=double)

M={
'cloth':mat('weathered black wool','#151316',0,.82),
'burgundy':mat('oxblood cape','#4a0c12',0,.76,double=True),
'hair':mat('auburn hair','#6f240d',0,.48),
'skin':mat('moonlit skin','#8f6250',0,.68),
'leather':mat('aged black leather','#171518',0,.58),
'wood':mat('old broom wood','#5a3419',0,.73),
'bristle':mat('burnt broom straw','#6b3d16',0,.88),
'ember':mat('ember coal','#2c1205',0,.45,'#ff6a14'),
'carpaint':mat('aged black lacquer','#10161c',.52,.22),
'chrome':mat('pitted chrome','#8b9193',.9,.18),
'glass':PBRMaterial(name='smoky glass',baseColorFactor=np.array([.045,.08,.095,.62]),metallicFactor=.04,roughnessFactor=.12,alphaMode='BLEND',doubleSided=True),
'tire':mat('period rubber','#111112',0,.95),
'headlamp':mat('warm headlamp','#6f330b',.05,.2,'#ff9a31'),
'bark':mat('dead bark','#38271f',0,.97),
'bean':mat('roasted coffee','#5a1e08',0,.38,'#d23b08'),
'bean_dark':mat('bean seam','#180804',0,.7),
'iron':mat('oxidized iron','#332721',.55,.7),
'wood_fence':mat('weathered fence wood','#4a3a2d',0,.91),
'pumpkin':mat('old pumpkin','#7e3109',0,.72,'#351003'),
'stem':mat('dry stem','#2f2c16',0,.9),
'brick':mat('soot brick','#241c1a',0,.9),
'window':mat('warm factory window','#2d1505',0,.4,'#ff8d2c'),
'roof':mat('blackened metal roof','#17191b',.45,.55),
}

def frustum(r0,r1,h,sections=24):
    ang=np.linspace(0,2*math.pi,sections,endpoint=False)
    v=[]
    for y,r in [(-h/2,r0),(h/2,r1)]:
        for a in ang:v.append([math.cos(a)*r,y,math.sin(a)*r])
    faces=[]
    for i in range(sections):
        j=(i+1)%sections
        faces += [[i,j,sections+i],[j,sections+j,sections+i]]
    v.append([0,-h/2,0]); cb=len(v)-1
    v.append([0,h/2,0]); ct=len(v)-1
    for i in range(sections):
        j=(i+1)%sections
        faces += [[cb,j,i],[ct,sections+i,sections+j]]
    return trimesh.Trimesh(vertices=np.array(v),faces=np.array(faces),process=True)

def add(scene, mesh, name, material, T=None):
    mesh=mesh.copy(); mesh.visual.material=material
    scene.add_geometry(mesh, node_name=name, geom_name=name, transform=np.eye(4) if T is None else T)

def T(pos=(0,0,0), rot=None, scale=None):
    Mx=np.eye(4)
    if scale is not None: Mx=scale_matrix(scale)@Mx if np.isscalar(scale) else np.diag([*scale,1])@Mx
    if rot:
        for axis,ang in rot:
            vec={'x':[1,0,0],'y':[0,1,0],'z':[0,0,1]}[axis]
            Mx=rotation_matrix(math.radians(ang),vec)@Mx
    Mx=translation_matrix(pos)@Mx
    return Mx

def export_scene(scene, filename):
    data=scene.export(file_type='glb')
    (OUT/filename).write_bytes(data)
    return {'file':filename,'bytes':len(data),'nodes':len(scene.graph.nodes_geometry)}

def cylinder_between(a,b,r,sections=20):
    a=np.array(a,float); b=np.array(b,float); v=b-a; L=np.linalg.norm(v)
    mesh=trimesh.creation.cylinder(radius=r,height=L,sections=sections)
    z=np.array([0,0,1.]); n=v/L
    axis=np.cross(z,n); dot=np.clip(np.dot(z,n),-1,1)
    R=np.eye(4)
    if np.linalg.norm(axis)>1e-8: R=rotation_matrix(math.acos(dot),axis/np.linalg.norm(axis))
    elif dot<0: R=rotation_matrix(math.pi,[1,0,0])
    return mesh, translation_matrix((a+b)/2)@R

# Witch rider: separated nodes are intentionally preserved for secondary motion.
s=trimesh.Scene()
add(s,trimesh.creation.capsule(height=1.05,radius=.38,count=[10,20]),'body_core',M['cloth'],T((0,.35,0),scale=(1.15,1.15,.92)))
add(s,frustum(.72,.32,1.15,24),'coat_skirt',M['cloth'],T((0,-.25,.10)))
add(s,trimesh.creation.cylinder(radius=.43,height=.10,sections=24),'belt',M['leather'],T((0,.17,0)))
add(s,trimesh.creation.cylinder(radius=.13,height=.24,sections=16),'neck',M['skin'],T((0,1.09,-.04)))
add(s,trimesh.creation.icosphere(subdivisions=3,radius=.34),'head',M['skin'],T((0,1.45,-.08),scale=(.92,1.08,.94)))
add(s,trimesh.creation.cylinder(radius=.72,height=.065,sections=40),'hat_brim',M['cloth'],T((0,1.80,-.08),rot=[('z',2)]))
add(s,trimesh.creation.cone(radius=.40,height=1.05,sections=32),'hat_crown',M['cloth'],T((0,2.28,-.08),rot=[('z',-5)]))
add(s,trimesh.creation.cone(radius=.22,height=.55,sections=24),'hat_tip',M['cloth'],T((-.12,2.82,-.06),rot=[('z',-24),('x',5)]))
add(s,trimesh.creation.cylinder(radius=.42,height=.07,sections=32),'hat_band',M['burgundy'],T((0,1.91,-.08)))
for side in (-1,1):
    a=(side*.33,.82,-.03); b=(side*.62,.20,-.42)
    mesh,tr=cylinder_between(a,b,.13); add(s,mesh,f'arm_{"L" if side<0 else "R"}',M['cloth'],tr)
    c=(side*.38,-.12,-.55); mesh,tr=cylinder_between(b,c,.105); add(s,mesh,f'forearm_{"L" if side<0 else "R"}',M['leather'],tr)
    add(s,trimesh.creation.icosphere(subdivisions=2,radius=.12),f'hand_{"L" if side<0 else "R"}',M['skin'],T(c))
xs=np.linspace(-.78,.78,7); zs=np.linspace(.18,1.75,7); verts=[]
for j,z in enumerate(zs):
    frac=j/(len(zs)-1); y=.62-frac*1.13 + .08*np.cos(np.linspace(-math.pi,math.pi,len(xs)))
    for i,x in enumerate(xs): verts.append([x*(1+.24*frac), y[i], z + .08*math.sin(i*1.2+j*.7)])
faces=[]; w=len(xs)
for j in range(len(zs)-1):
    for i in range(w-1):
        a=j*w+i; b=a+1; c=a+w; d=c+1; faces += [[a,c,b],[b,c,d],[b,c,a],[d,c,b]]
add(s,trimesh.Trimesh(np.array(verts),np.array(faces),process=False),'cape',M['burgundy'])
for i,x in enumerate(np.linspace(-.34,.34,5)):
    length=1.0+(.2 if i in [0,4] else .35 if i in [1,3] else .5)
    add(s,trimesh.creation.cone(radius=.10 if i!=2 else .12,height=length,sections=16),f'hair_{i+1:02d}',M['hair'],T((x,1.03,.38+i*.025),rot=[('x',67+(i-2)*3),('z',(i-2)*5)]))
add(s,trimesh.creation.cylinder(radius=.055,height=5.15,sections=18),'broom_handle',M['wood'],T((0,-.82,.05)))
add(s,trimesh.creation.cone(radius=.43,height=1.35,sections=28),'broom_bristles',M['bristle'],T((0,-.82,2.88)))
for k in range(4): add(s,trimesh.creation.icosphere(subdivisions=1,radius=.12-.018*k),f'ember_{k}',M['ember'],T(((-.12+.08*k),-.82,3.55+.22*k),scale=(1,.55,1.6)))
witch_meta=export_scene(s,'witch-rider.glb')

# 1930s coupe with separate chrome, glass, wheel, fender and lamp meshes.
s=trimesh.Scene()
add(s,trimesh.creation.box([2.45,.72,4.85]),'body_shell',M['carpaint'],T((0,.83,0)))
add(s,trimesh.creation.icosphere(subdivisions=2,radius=1),'rear_round',M['carpaint'],T((0,.92,-1.63),scale=(1.25,.62,.92)))
add(s,trimesh.creation.box([2.15,.48,1.75]),'hood',M['carpaint'],T((0,1.30,1.56),rot=[('x',-2)]))
add(s,trimesh.creation.box([1.88,1.02,2.05]),'cabin',M['carpaint'],T((0,1.78,-.53),rot=[('x',1)]))
add(s,trimesh.creation.icosphere(subdivisions=2,radius=1),'roof',M['carpaint'],T((0,2.36,-.62),scale=(1.03,.38,1.05)))
add(s,trimesh.creation.box([1.72,.67,.045]),'windshield',M['glass'],T((0,1.96,.55),rot=[('x',-20)]))
add(s,trimesh.creation.box([1.66,.61,.045]),'rear_window',M['glass'],T((0,1.93,-1.58),rot=[('x',20)]))
for side in (-1,1): add(s,trimesh.creation.box([.045,.62,.92]),f'side_glass_{side}',M['glass'],T((side*.96,1.98,-.55)))
for side in (-1,1):
  for idx,z in enumerate((-1.58,1.58)):
    add(s,trimesh.creation.cylinder(radius=.48,height=.31,sections=30),f'wheel_{side}_{idx}',M['tire'],T((side*1.28,.49,z),rot=[('y',90)]))
    add(s,trimesh.creation.cylinder(radius=.25,height=.33,sections=26),f'hub_{side}_{idx}',M['chrome'],T((side*1.29,.49,z),rot=[('y',90)]))
    add(s,trimesh.creation.torus(major_radius=.52,minor_radius=.10,major_sections=28,minor_sections=10),f'fender_{side}_{idx}',M['carpaint'],T((side*1.20,.62,z),rot=[('y',90)],scale=(1,1.04,1.0)))
add(s,trimesh.creation.box([1.18,.80,.08]),'grille_back',M['iron'],T((0,1.02,2.47)))
for x in np.linspace(-.48,.48,9): add(s,trimesh.creation.box([.028,.72,.055]),f'grille_bar_{x:.2f}',M['chrome'],T((x,1.03,2.54)))
add(s,trimesh.creation.box([2.35,.10,.13]),'front_bumper',M['chrome'],T((0,.58,2.68)))
add(s,trimesh.creation.box([2.26,.09,.12]),'rear_bumper',M['chrome'],T((0,.58,-2.65)))
for x in (-.74,.74):
    add(s,trimesh.creation.cylinder(radius=.23,height=.16,sections=24),f'lamp_mount_{x}',M['chrome'],T((x,1.24,2.47),rot=[('x',90)]))
    add(s,trimesh.creation.uv_sphere(radius=.20,count=[16,16]),f'headlamp_{x}',M['headlamp'],T((x,1.24,2.60),scale=(1,1,.55)))
add(s,trimesh.creation.cone(radius=.05,height=.28,sections=16),'hood_ornament',M['chrome'],T((0,1.63,1.98),rot=[('x',-90)]))
for side in (-1,1): add(s,trimesh.creation.box([.12,.04,.035]),f'door_handle_{side}',M['chrome'],T((side*1.08,1.72,-.75)))
car_meta=export_scene(s,'vintage-car.glb')

# Haunted dead tree.
s=trimesh.Scene(); add(s,frustum(.72,.38,6.2,16),'trunk',M['bark'],T((0,3.1,0)))
for i,a in enumerate(np.linspace(0,2*math.pi,7,endpoint=False)):
    b=(math.cos(a)*1.3,.12,math.sin(a)*1.3); mesh,tr=cylinder_between((0,.32,0),b,.16,12); add(s,mesh,f'root_{i}',M['bark'],tr)
branches=[((0,5.4,0),(1.9,7.0,.2),.27),((0,5.2,0),(-1.7,6.8,-.15),.25),((.7,6.1,.1),(2.55,7.8,.5),.16),((-.65,5.9,-.1),(-2.35,7.5,-.5),.15),((1.85,7,.2),(2.65,8.2,.05),.10),((-1.7,6.8,-.15),(-2.1,8.1,.25),.10),((.2,5.8,0),(.45,8.1,-.2),.19)]
for i,(a,b,r) in enumerate(branches): mesh,tr=cylinder_between(a,b,r,12); add(s,mesh,f'branch_{i}',M['bark'],tr)
tree_meta=export_scene(s,'dead-tree.glb')

# Coffee bean collectible.
s=trimesh.Scene(); add(s,trimesh.creation.icosphere(subdivisions=3,radius=1),'bean_body',M['bean'],T((0,0,0),rot=[('z',24)],scale=(.38,.55,.25)))
add(s,trimesh.creation.capsule(height=.58,radius=.025,count=[8,12]),'bean_seam',M['bean_dark'],T((0,0,.236),rot=[('z',18)])); bean_meta=export_scene(s,'coffee-bean.glb')

# Fence.
s=trimesh.Scene()
for x in (-1.6,1.6):
    add(s,trimesh.creation.box([.24,2.6,.24]),f'post_{x}',M['wood_fence'],T((x,1.3,0)))
    add(s,trimesh.creation.cone(radius=.24,height=.38,sections=4),f'postcap_{x}',M['wood_fence'],T((x,2.79,0),rot=[('y',45)]))
for y in (.85,1.75): add(s,trimesh.creation.box([3.7,.23,.17]),f'rail_{y}',M['wood_fence'],T((0,y,0),rot=[('z',2 if y<1 else -3)]))
fence_meta=export_scene(s,'haunted-fence.glb')

# Pumpkin.
s=trimesh.Scene()
for i,a in enumerate(np.linspace(0,2*math.pi,8,endpoint=False)): add(s,trimesh.creation.icosphere(subdivisions=2,radius=1),f'pumpkin_lobe_{i}',M['pumpkin'],T((math.cos(a)*.13,.55,math.sin(a)*.13),scale=(.56,.58,.56)))
add(s,trimesh.creation.cylinder(radius=.11,height=.45,sections=12),'pumpkin_stem',M['stem'],T((0,1.23,0),rot=[('z',-9)])); pumpkin_meta=export_scene(s,'jack-o-lantern.glb')

# Haunted Brew & Brews roasting building.
s=trimesh.Scene(); add(s,trimesh.creation.box([9,4.8,5]),'factory_body',M['brick'],T((0,2.4,0)))
add(s,trimesh.creation.box([9.6,.28,5.5]),'roof',M['roof'],T((0,4.9,0),rot=[('z',-2)])); add(s,trimesh.creation.box([1.1,5.7,1.1]),'chimney',M['brick'],T((-2.7,5.4,-.8)))
for row,y in enumerate((1.4,2.8)):
  for col,x in enumerate(np.linspace(-3.1,3.1,5)): add(s,trimesh.creation.box([.82,.68,.05]),f'window_{row}_{col}',M['window'],T((x,y,2.53)))
add(s,trimesh.creation.box([1.4,2.4,.08]),'loading_door',M['iron'],T((0,1.2,2.54))); roastery_meta=export_scene(s,'haunted-roastery.glb')

# 256px asphalt albedo + tangent normal + gloss maps for mobile PBR.
size=256; rng=np.random.default_rng(90210); noise=rng.normal(0,1,(size,size))
lo=np.array(Image.fromarray(np.uint8(np.clip((noise-noise.min())/(noise.max()-noise.min())*255,0,255))).filter(ImageFilter.GaussianBlur(5)),dtype=float)/255
fine=rng.random((size,size)); base=20 + 18*lo + 7*fine; rgb=np.dstack([base*.83,base*.91,base])
for _ in range(1500):
    y=rng.integers(0,size); x=rng.integers(0,size); r=rng.integers(1,3); val=rng.integers(18,55)
    rgb[max(0,y-r):min(size,y+r+1),max(0,x-r):min(size,x+r+1),:]=val*np.array([.85,.9,1])
img=Image.fromarray(np.uint8(np.clip(rgb,0,255)),'RGB'); d=ImageDraw.Draw(img)
for _ in range(18):
    x=int(rng.integers(0,size)); y=int(rng.integers(0,size)); pts=[(x,y)]
    for __ in range(int(rng.integers(3,7))): x+=int(rng.integers(-28,29)); y+=int(rng.integers(8,36)); pts.append((x%size,y%size))
    d.line(pts, fill=(8,10,12), width=1)
img.save(TEX_OUT/'asphalt-albedo.png',optimize=True); height=np.array(img.convert('L').filter(ImageFilter.GaussianBlur(1.2)),dtype=float)/255
gy,gx=np.gradient(height); strength=5.5; nx=-gx*strength; ny=-gy*strength; nz=np.ones_like(nx); norm=np.sqrt(nx*nx+ny*ny+nz*nz); nx/=norm; ny/=norm; nz/=norm
normal=np.dstack([(nx*.5+.5)*255,(ny*.5+.5)*255,(nz*.5+.5)*255]).astype(np.uint8); Image.fromarray(normal,'RGB').save(TEX_OUT/'asphalt-normal.png',optimize=True)
wet=np.array(Image.fromarray(np.uint8(rng.random((size,size))*255)).filter(ImageFilter.GaussianBlur(16)),dtype=float)/255; wet=(wet-wet.min())/(wet.max()-wet.min()+1e-9)
Image.fromarray((90+110*wet).astype(np.uint8),'L').save(TEX_OUT/'asphalt-gloss.png',optimize=True)
meta={'generated':'Witch Ride 3D PBR starter assets','assets':[witch_meta,car_meta,tree_meta,bean_meta,fence_meta,pumpkin_meta,roastery_meta], 'textures':[]}
for p in ['asphalt-albedo.png','asphalt-normal.png','asphalt-gloss.png']: meta['textures'].append({'file':p,'bytes':(TEX_OUT/p).stat().st_size})
(ROOT/'assets'/'manifest.json').write_text(json.dumps(meta,indent=2)); print(json.dumps(meta,indent=2))
