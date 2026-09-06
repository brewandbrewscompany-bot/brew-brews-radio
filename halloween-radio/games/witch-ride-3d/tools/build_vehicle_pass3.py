import math, json
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter, ImageDraw
import trimesh
from trimesh.exchange import gltf
from trimesh.transformations import translation_matrix, rotation_matrix, scale_matrix
from trimesh.visual.material import PBRMaterial
from trimesh.visual.texture import TextureVisuals

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'assets'/'models';TEX=ROOT/'assets'/'textures'
OUT.mkdir(parents=True,exist_ok=True);TEX.mkdir(parents=True,exist_ok=True)
rng=np.random.default_rng(3906)

def rgba(h,a=255):
    h=h.lstrip('#');return [int(h[i:i+2],16) for i in (0,2,4)]+[a]

def normal_from_height(h,strength=2.4):
    a=np.asarray(h,dtype=float)/255;gy,gx=np.gradient(a);nx=-gx*strength;ny=-gy*strength;nz=np.ones_like(nx);n=np.sqrt(nx*nx+ny*ny+nz*nz)+1e-9
    return Image.fromarray(np.dstack([(nx/n*.5+.5)*255,(ny/n*.5+.5)*255,(nz/n*.5+.5)*255]).astype(np.uint8),'RGB')

def paint_maps(size=192):
    rr=np.random.default_rng(31);base=np.zeros((size,size,3),float);base[:]=[13,18,23]
    fine=rr.normal(0,2.4,(size,size));low=np.asarray(Image.fromarray(np.uint8(rr.random((size,size))*255)).filter(ImageFilter.GaussianBlur(14)),float);low=(low-low.min())/(low.max()-low.min()+1e-9)
    for c in range(3):base[:,:,c]+=fine+(low-.5)*7
    img=Image.fromarray(np.uint8(np.clip(base,0,255)),'RGB');d=ImageDraw.Draw(img)
    for _ in range(42):
        x=int(rr.integers(0,size));y=int(rr.integers(0,size));ln=int(rr.integers(4,28));d.line((x,y,min(size-1,x+ln),max(0,min(size-1,y+int(rr.integers(-3,4))))),fill=(45,43,39),width=1)
    for _ in range(70):
        x=int(rr.integers(0,size));y=int(rr.integers(0,size));r=int(rr.integers(1,4));d.ellipse((x-r,y-r,x+r,y+r),fill=(65+int(rr.integers(0,25)),33+int(rr.integers(0,14)),16))
    height=np.asarray(img.convert('L'),float);norm=normal_from_height(Image.fromarray(np.uint8(height),'L').filter(ImageFilter.GaussianBlur(.7)),1.8)
    mr=np.zeros((size,size,3),np.uint8);mr[:,:,1]=np.uint8(60+80*low);mr[:,:,2]=np.uint8(155+40*(1-low));mr[:,:,0]=255
    return img,norm,Image.fromarray(mr,'RGB')

def chrome_maps(size=128):
    rr=np.random.default_rng(32);base=np.full((size,size,3),150,dtype=np.float32);pits=rr.random((size,size));base-=np.where(pits>.955,55,0)[...,None];base+=rr.normal(0,3,(size,size))[...,None]
    img=Image.fromarray(np.uint8(np.clip(base,0,255)),'RGB');h=np.uint8(np.clip(145-np.where(pits>.955,60,0)+rr.normal(0,4,(size,size)),0,255))
    mr=np.zeros((size,size,3),np.uint8);mr[:,:,0]=255;mr[:,:,1]=np.uint8(np.clip(45+np.where(pits>.955,80,0),0,255));mr[:,:,2]=238
    return img,normal_from_height(Image.fromarray(h,'L'),2.2),Image.fromarray(mr,'RGB')

def rubber_maps(size=128):
    rr=np.random.default_rng(33);yy,xx=np.mgrid[0:size,0:size];grooves=(np.sin(xx*.38)+np.sin((xx+yy)*.17))*7;noise=rr.normal(0,1.8,(size,size));val=18+noise+grooves*.18
    img=Image.fromarray(np.uint8(np.clip(np.dstack([val,val,val]),0,255)),'RGB');h=np.uint8(np.clip(128+grooves*5+noise*3,0,255));return img,normal_from_height(Image.fromarray(h,'L'),2.8)

paint_a,paint_n,paint_mr=paint_maps();paint_a.save(TEX/'car-paint-albedo.png',optimize=True);paint_n.save(TEX/'car-paint-normal.png',optimize=True);paint_mr.save(TEX/'car-paint-metalrough.png',optimize=True)
chrome_a,chrome_n,chrome_mr=chrome_maps();chrome_a.save(TEX/'car-chrome-albedo.png',optimize=True);chrome_n.save(TEX/'car-chrome-normal.png',optimize=True);chrome_mr.save(TEX/'car-chrome-metalrough.png',optimize=True)
rub_a,rub_n=rubber_maps();rub_a.save(TEX/'car-tire-albedo.png',optimize=True);rub_n.save(TEX/'car-tire-normal.png',optimize=True)

def pbr(name,color,rough,metal=0,base=None,normal=None,mr=None,double=False,alpha=255,em=None):
    return PBRMaterial(name=name,baseColorFactor=np.array(rgba(color,alpha),float)/255,metallicFactor=metal,roughnessFactor=rough,baseColorTexture=base,normalTexture=normal,metallicRoughnessTexture=mr,doubleSided=double,alphaMode='BLEND' if alpha<255 else 'OPAQUE',emissiveFactor=None if em is None else np.array(rgba(em)[:3],float)/255)
M={'paint':pbr('weathered black lacquer','#111820',.28,.62,paint_a,paint_n,paint_mr),'worn':pbr('oxidized worn lacquer','#3b2d28',.58,.30),'chrome':pbr('pitted period chrome','#a1a6a8',.22,.94,chrome_a,chrome_n,chrome_mr),'glass':pbr('smoky laminated glass','#13202a',.12,.04,double=True,alpha=150),'tire':pbr('dirty bias ply rubber','#151414',.92,.0,rub_a,rub_n),'whitewall':pbr('aged ivory whitewall','#b7ae97',.74,.0),'iron':pbr('dark oxidized grille','#302b29',.78,.58),'rust':pbr('surface rust','#6b3217',.86,.08),'head':pbr('warm tungsten lens','#7b3d11',.22,.06,em='#ff9c35'),'tail':pbr('ruby tail lens','#410706',.25,.02,em='#b31d12')}

def T(pos=(0,0,0),rot=None,scale=None):
    m=np.eye(4)
    if scale is not None:m=(scale_matrix(scale) if np.isscalar(scale) else np.diag([*scale,1]))@m
    if rot:
        for axis,ang in rot:m=rotation_matrix(math.radians(ang),{'x':[1,0,0],'y':[0,1,0],'z':[0,0,1]}[axis])@m
    return translation_matrix(pos)@m

def uv_for(mesh,axes=(0,2),scale=(.7,.7)):
    v=np.asarray(mesh.vertices,float);uv=v[:,list(axes)].copy();uv[:,0]*=scale[0];uv[:,1]*=scale[1];uv-=np.floor(uv);return uv

def add(s,mesh,name,mat,tr=None,axes=(0,2),uvscale=(.7,.7)):
    mesh=mesh.copy()
    try:mesh.visual=TextureVisuals(uv=uv_for(mesh,axes,uvscale),material=mat)
    except Exception:mesh.visual.material=mat
    s.add_geometry(mesh,node_name=name,geom_name=name,transform=np.eye(4) if tr is None else tr)

def loft_body(sections,radial=28):
    verts=[]
    for z,w,h,yc in sections:
        for a in np.linspace(0,2*math.pi,radial,endpoint=False):verts.append([math.cos(a)*w,yc+math.sin(a)*h,z])
    faces=[]
    for i in range(len(sections)-1):
        for j in range(radial):
            k=(j+1)%radial;a=i*radial+j;b=i*radial+k;c=(i+1)*radial+j;d=(i+1)*radial+k;faces += [[a,c,b],[b,c,d]]
    return trimesh.Trimesh(np.array(verts),np.array(faces),process=True)

s=trimesh.Scene();sections=[(-2.55,.72,.25,.83),(-2.33,1.00,.36,.84),(-1.95,1.20,.44,.86),(-1.15,1.31,.49,.88),(.05,1.34,.49,.88),(1.28,1.21,.40,.86),(2.15,.98,.32,.83),(2.55,.64,.22,.82)]
add(s,loft_body(sections,28),'body_shell',M['paint']);add(s,trimesh.creation.icosphere(subdivisions=3,radius=1),'rear_round',M['paint'],T((0,1.02,-1.72),scale=(1.22,.61,.96)));add(s,trimesh.creation.icosphere(subdivisions=3,radius=1),'hood',M['paint'],T((0,1.29,1.52),scale=(1.12,.29,.99)));add(s,trimesh.creation.box([.065,.10,1.78]),'hood_center_ridge',M['chrome'],T((0,1.58,1.40)));add(s,trimesh.creation.icosphere(subdivisions=3,radius=1),'cabin',M['paint'],T((0,1.90,-.54),scale=(1.0,.78,1.08)));add(s,trimesh.creation.icosphere(subdivisions=3,radius=1),'roof',M['paint'],T((0,2.42,-.60),scale=(1.05,.39,1.12)))
add(s,trimesh.creation.box([1.76,.69,.045]),'windshield',M['glass'],T((0,2.0,.57),rot=[('x',-20)]));add(s,trimesh.creation.box([1.70,.63,.045]),'rear_window',M['glass'],T((0,1.99,-1.62),rot=[('x',20)]))
for side in (-1,1):
    add(s,trimesh.creation.box([.045,.64,.96]),f'side_glass_{side}',M['glass'],T((side*.99,2.0,-.57)));add(s,trimesh.creation.box([.13,.055,3.38]),f'running_board_{side}',M['worn'],T((side*1.30,.52,-.04)));add(s,trimesh.creation.box([.035,.05,3.10]),f'chrome_trim_{side}',M['chrome'],T((side*1.27,1.25,-.18)));add(s,trimesh.creation.box([.025,.82,.035]),f'door_front_seam_{side}',M['rust'],T((side*1.285,1.43,.30)));add(s,trimesh.creation.box([.025,.82,.035]),f'door_rear_seam_{side}',M['rust'],T((side*1.285,1.43,-1.15)));add(s,trimesh.creation.box([.13,.045,.04]),f'door_handle_{side}',M['chrome'],T((side*1.09,1.72,-.72)))
for side in (-1,1):
  for idx,z in enumerate((-1.62,1.62)):
    add(s,trimesh.creation.cylinder(radius=.50,height=.32,sections=36),f'wheel_{side}_{idx}',M['tire'],T((side*1.31,.50,z),rot=[('y',90)]),axes=(1,2),uvscale=(1.4,1.4));add(s,trimesh.creation.cylinder(radius=.385,height=.325,sections=34),f'whitewall_{side}_{idx}',M['whitewall'],T((side*1.313,.50,z),rot=[('y',90)]));add(s,trimesh.creation.cylinder(radius=.275,height=.34,sections=32),f'hub_{side}_{idx}',M['chrome'],T((side*1.316,.50,z),rot=[('y',90)]));spokes=[]
    for a in np.linspace(0,2*math.pi,10,endpoint=False):
        p0=np.array([0,.07*math.sin(a),.07*math.cos(a)]);p1=np.array([0,.26*math.sin(a),.26*math.cos(a)]);v=p1-p0;L=np.linalg.norm(v);cyl=trimesh.creation.cylinder(radius=.012,height=L,sections=6);zz=np.array([0,0,1.]);n=v/L;axis=np.cross(zz,n);dot=np.clip(np.dot(zz,n),-1,1);R=np.eye(4)
        if np.linalg.norm(axis)>1e-8:R=rotation_matrix(math.acos(dot),axis/np.linalg.norm(axis))
        cyl.apply_transform(translation_matrix((p0+p1)/2)@R);spokes.append(cyl)
    add(s,trimesh.util.concatenate(spokes),f'spokes_{side}_{idx}',M['chrome'],T((side*1.32,.50,z),rot=[('y',90)]));add(s,trimesh.creation.torus(major_radius=.53,minor_radius=.11,major_sections=34,minor_sections=10),f'fender_{side}_{idx}',M['paint'],T((side*1.22,.65,z),rot=[('y',90)]))
add(s,trimesh.creation.box([1.25,.86,.08]),'grille_back',M['iron'],T((0,1.04,2.51)))
for x in np.linspace(-.54,.54,13):add(s,trimesh.creation.box([.022,.78,.052]),f'grille_bar_{x:.2f}',M['chrome'],T((x,1.05,2.58)))
for y in (.75,1.01,1.28):add(s,trimesh.creation.box([1.18,.024,.052]),f'grille_cross_{y}',M['chrome'],T((0,y,2.59)))
add(s,trimesh.creation.box([2.42,.11,.14]),'front_bumper',M['chrome'],T((0,.57,2.73)));add(s,trimesh.creation.box([2.31,.10,.13]),'rear_bumper',M['chrome'],T((0,.57,-2.72)))
for x in (-.76,.76):add(s,trimesh.creation.cylinder(radius=.25,height=.17,sections=28),f'lamp_mount_{x}',M['chrome'],T((x,1.26,2.48),rot=[('x',90)]));add(s,trimesh.creation.uv_sphere(radius=.215,count=[20,20]),f'headlamp_{x}',M['head'],T((x,1.26,2.64),scale=(1,1,.54)))
for x in (-.73,.73):add(s,trimesh.creation.uv_sphere(radius=.11,count=[14,14]),f'taillamp_{x}',M['tail'],T((x,.89,-2.53),scale=(1,.8,.45)))
add(s,trimesh.creation.cone(radius=.052,height=.30,sections=20),'hood_ornament',M['chrome'],T((0,1.63,2.02),rot=[('x',-90)]))
for side in (-1,1):add(s,trimesh.creation.cylinder(radius=.028,height=.34,sections=10),f'mirror_stalk_{side}',M['chrome'],T((side*1.10,1.80,.49),rot=[('z',90)]));add(s,trimesh.creation.icosphere(subdivisions=2,radius=.14),f'mirror_{side}',M['chrome'],T((side*1.27,1.85,.49),scale=(.45,1,.75)))
add(s,trimesh.creation.box([.60,.23,.035]),'license_plate',M['whitewall'],T((0,.72,-2.73)));add(s,trimesh.creation.cylinder(radius=.055,height=.52,sections=12),'exhaust_tail',M['iron'],T((-.78,.35,-2.78),rot=[('x',90)]))
patches=[(-.96,.94,-1.85,.18,.30),(.94,.91,-.98,.16,.27),(-1.0,1.03,.58,.14,.24),(.91,1.11,1.46,.15,.26),(.52,.72,2.23,.10,.18)]
for i,(x,y,z,w,h) in enumerate(patches):add(s,trimesh.creation.box([w,.022,h]),f'rust_patch_{i}',M['rust'],T((x,y,z),rot=[('y',(-1)**i*5)]))

glb=gltf.export_glb(s,include_normals=True,unitize_normals=True);(OUT/'vintage-car.glb').write_bytes(glb)
manifest={'version':'vehicle-material-pass-v3','file':'vintage-car.glb','bytes':len(glb),'nodes':len(s.graph.nodes_geometry),'textures':['car-paint-albedo.png','car-paint-normal.png','car-paint-metalrough.png','car-chrome-albedo.png','car-chrome-normal.png','car-chrome-metalrough.png','car-tire-albedo.png','car-tire-normal.png'],'features':['aged lacquer PBR','oxidized chips','pitted chrome','dirty bias-ply rubber','whitewalls','wheel spokes','door seams','hood ridge','tungsten headlamps','exhaust detail','restrained rust']}
(ROOT/'assets'/'vehicle-material-pass.json').write_text(json.dumps(manifest,indent=2));print(json.dumps(manifest,indent=2))
