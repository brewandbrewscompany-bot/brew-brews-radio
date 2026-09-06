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

def rgba(h,a=255):
    h=h.lstrip('#');return [int(h[i:i+2],16) for i in (0,2,4)]+[a]

def normal_from_height(im,strength=2.5):
    h=np.asarray(im,dtype=float)/255.0
    gy,gx=np.gradient(h);nx=-gx*strength;ny=-gy*strength;nz=np.ones_like(nx)
    n=np.sqrt(nx*nx+ny*ny+nz*nz)+1e-9
    return Image.fromarray(np.dstack([(nx/n*.5+.5)*255,(ny/n*.5+.5)*255,(nz/n*.5+.5)*255]).astype(np.uint8),'RGB')

def multiscale_noise(size,seed):
    rr=np.random.default_rng(seed);out=np.zeros((size,size),float)
    for scale,amp in [(2,.7),(6,1.2),(18,2.2),(48,3.0)]:
        small=max(2,size//scale)
        raw=Image.fromarray(np.uint8(rr.random((small,small))*255)).resize((size,size),Image.Resampling.BICUBIC).filter(ImageFilter.GaussianBlur(scale*.12))
        a=np.asarray(raw,float);a=(a-a.mean())/(a.std()+1e-9);out+=a*amp
    return out

def build_asphalt(size=512):
    rr=np.random.default_rng(4101);noise=multiscale_noise(size,4101);yy,xx=np.mgrid[0:size,0:size]
    aggregate=rr.normal(0,3.0,(size,size));lane=(-5*np.exp(-((xx-size*.33)/(size*.075))**2)-5*np.exp(-((xx-size*.67)/(size*.075))**2));base=31+noise+aggregate+lane
    img=Image.fromarray(np.uint8(np.clip(np.dstack([base*.92,base*.98,base*1.02]),0,255)),'RGB');draw=ImageDraw.Draw(img);cracks=[]
    for _ in range(26):
        x=float(rr.integers(0,size));y=float(rr.integers(0,size));pts=[(x,y)]
        for k in range(int(rr.integers(3,8))):x=np.clip(x+rr.normal(0,15),0,size-1);y=np.clip(y+rr.uniform(8,25),0,size-1);pts.append((x,y))
        cracks.append(pts);draw.line(pts,fill=(9,10,11),width=int(rr.integers(1,3)))
        if rr.random()<.45:draw.line([(p[0]+1,p[1]) for p in pts],fill=(43,43,42),width=1)
    for _ in range(9):
        x=int(rr.integers(0,size-65));y=int(rr.integers(0,size-90));w=int(rr.integers(28,80));h=int(rr.integers(45,120));draw.rounded_rectangle((x,y,x+w,y+h),radius=5,outline=(20,21,22),fill=(27,28,29),width=2)
    height=Image.fromarray(np.uint8(np.clip(128+noise*3+aggregate*1.8,0,255)),'L');hd=ImageDraw.Draw(height)
    for pts in cracks:hd.line(pts,fill=80,width=2)
    normal=normal_from_height(height.filter(ImageFilter.GaussianBlur(.45)),3.4);puddle=np.zeros((size,size),np.uint8)
    for cx,cy,rx,ry in [(int(size*.24),int(size*.20),60,34),(int(size*.73),int(size*.56),80,42),(int(size*.46),int(size*.80),52,30)]:
        Y,X=np.ogrid[:size,:size];mask=((X-cx)/rx)**2+((Y-cy)/ry)**2<1;puddle[mask]=np.maximum(puddle[mask],np.uint8(180))
    streak=(np.sin(xx*.045)+1)*.5;wet=np.clip(42+noise*2+streak*25+puddle*.68,0,255).astype(np.uint8)
    return img,normal,Image.fromarray(wet,'L'),Image.fromarray(puddle,'L')

def build_mud(size=256):
    rr=np.random.default_rng(4102);noise=multiscale_noise(size,4102);yy,xx=np.mgrid[0:size,0:size]
    ruts=-13*np.exp(-((xx-size*.27)/(size*.055))**2)-10*np.exp(-((xx-size*.73)/(size*.06))**2);base=np.clip(49+noise*2+ruts+rr.normal(0,2,(size,size)),0,255)
    img=Image.fromarray(np.uint8(np.clip(np.dstack([base*.78,base*.64,base*.51]),0,255)),'RGB');h=Image.fromarray(np.uint8(np.clip(128+noise*5+ruts*1.5,0,255)),'L');gloss=Image.fromarray(np.uint8(np.clip(25+(noise-noise.min())/(noise.max()-noise.min()+1e-9)*45-ruts*.5,0,255)),'L')
    return img,normal_from_height(h,3.0),gloss

def bark_maps(size=192):
    rr=np.random.default_rng(4103);yy,xx=np.mgrid[0:size,0:size];ridges=np.sin(xx*.22+np.sin(yy*.045)*2.4)*10+np.sin(xx*.53)*4;noise=multiscale_noise(size,4103)*1.7;val=50+ridges+noise+rr.normal(0,2,(size,size))
    img=Image.fromarray(np.uint8(np.clip(np.dstack([val*.72,val*.58,val*.46]),0,255)),'RGB');d=ImageDraw.Draw(img)
    for _ in range(22):x=int(rr.integers(0,size));d.line((x,0,x+int(rr.integers(-8,9)),size),fill=(22,17,14),width=int(rr.integers(1,3)))
    return img,normal_from_height(Image.fromarray(np.uint8(np.clip(128+ridges*3+noise*4,0,255)),'L'),3.2)

def wood_maps(size=192):
    rr=np.random.default_rng(4104);yy,xx=np.mgrid[0:size,0:size];grain=np.sin(yy*.17+np.sin(xx*.04)*2)*7+np.sin(yy*.045)*4+multiscale_noise(size,4104);val=72+grain
    img=Image.fromarray(np.uint8(np.clip(np.dstack([val*.86,val*.64,val*.43]),0,255)),'RGB');d=ImageDraw.Draw(img)
    for _ in range(16):y=int(rr.integers(0,size));d.line((0,y,size,y+int(rr.integers(-5,6))),fill=(39,28,20),width=1)
    return img,normal_from_height(Image.fromarray(np.uint8(np.clip(128+grain*4,0,255)),'L'),2.8)

def pumpkin_maps(size=192):
    yy,xx=np.mgrid[0:size,0:size];ribs=np.cos(xx/size*math.pi*12)*7;spots=multiscale_noise(size,4105)*2;r=116+ribs+spots;g=46+ribs*.25+spots*.4;b=10+spots*.2
    img=Image.fromarray(np.uint8(np.clip(np.dstack([r,g,b]),0,255)),'RGB');h=Image.fromarray(np.uint8(np.clip(128+ribs*4+spots*3,0,255)),'L');return img,normal_from_height(h,2.6)

def save_pair(prefix,pair):
    a,n=pair;a.save(TEX/f'{prefix}-albedo.png',optimize=True);n.save(TEX/f'{prefix}-normal.png',optimize=True);return a,n

asphalt_a,asphalt_n,asphalt_g,asphalt_p=build_asphalt();asphalt_a.save(TEX/'asphalt-albedo.png',optimize=True);asphalt_n.save(TEX/'asphalt-normal.png',optimize=True);asphalt_g.save(TEX/'asphalt-gloss.png',optimize=True);asphalt_p.save(TEX/'asphalt-puddles.png',optimize=True)
mud_a,mud_n,mud_g=build_mud();mud_a.save(TEX/'shoulder-mud-albedo.png',optimize=True);mud_n.save(TEX/'shoulder-mud-normal.png',optimize=True);mud_g.save(TEX/'shoulder-mud-gloss.png',optimize=True)
bark_a,bark_n=save_pair('dead-bark',bark_maps());wood_a,wood_n=save_pair('fence-wood',wood_maps());pump_a,pump_n=save_pair('pumpkin-skin',pumpkin_maps())

def pbr(name,color,rough,metal=0,base=None,normal=None,double=False,em=None):
    return PBRMaterial(name=name,baseColorFactor=np.array(rgba(color),float)/255,metallicFactor=metal,roughnessFactor=rough,baseColorTexture=base,normalTexture=normal,doubleSided=double,emissiveFactor=None if em is None else np.array(rgba(em)[:3],float)/255)
BARK=pbr('split dead bark','#3b2a20',.94,base=bark_a,normal=bark_n);WOOD=pbr('rain silvered fence wood','#5b4635',.91,base=wood_a,normal=wood_n);IRON=pbr('rusted square nail','#3b302b',.82,.58);PUMP=pbr('weathered pumpkin skin','#8a3510',.79,base=pump_a,normal=pump_n);STEM=pbr('dry pumpkin stem','#3b321e',.95);GLOW=pbr('carved pumpkin glow','#411006',.45,em='#ff741c')

def T(pos=(0,0,0),rot=None,scale=None):
    m=np.eye(4)
    if scale is not None:m=(scale_matrix(scale) if np.isscalar(scale) else np.diag([*scale,1]))@m
    if rot:
        for axis,ang in rot:m=rotation_matrix(math.radians(ang),{'x':[1,0,0],'y':[0,1,0],'z':[0,0,1]}[axis])@m
    return translation_matrix(pos)@m

def uv_for(mesh,axes=(0,2),scale=(.7,.7)):
    v=np.asarray(mesh.vertices,float);uv=v[:,list(axes)].copy();uv[:,0]*=scale[0];uv[:,1]*=scale[1];uv-=np.floor(uv);return uv

def add(s,mesh,name,mat,tr=None,axes=(0,2),uvscale=(.8,.8)):
    mesh=mesh.copy()
    try:mesh.visual=TextureVisuals(uv=uv_for(mesh,axes,uvscale),material=mat)
    except Exception:mesh.visual.material=mat
    s.add_geometry(mesh,node_name=name,geom_name=name,transform=np.eye(4) if tr is None else tr)

def cylinder_between(a,b,r,sections=12):
    a=np.array(a,float);b=np.array(b,float);v=b-a;L=np.linalg.norm(v);mesh=trimesh.creation.cylinder(radius=r,height=L,sections=sections);z=np.array([0,0,1.]);n=v/L;axis=np.cross(z,n);dot=np.clip(np.dot(z,n),-1,1);R=np.eye(4)
    if np.linalg.norm(axis)>1e-8:R=rotation_matrix(math.acos(dot),axis/np.linalg.norm(axis))
    elif dot<0:R=rotation_matrix(math.pi,[1,0,0])
    return mesh,translation_matrix((a+b)/2)@R

st=trimesh.Scene();add(st,trimesh.creation.cylinder(radius=.62,height=6.8,sections=20),'trunk',BARK,T((0,3.22,0),rot=[('x',90)]),axes=(1,2),uvscale=(.8,2.8))
for i,a in enumerate(np.linspace(0,2*math.pi,7,endpoint=False)):
    m,tr=cylinder_between([0,.12,0],[math.cos(a)*(1.45+.18*(i%2)),.02,math.sin(a)*(1.45+.18*((i+1)%2))],.16 if i%2 else .19,12);add(st,m,f'root_flare_{i}',BARK,tr,axes=(1,2),uvscale=(1.2,2))
branches=[([0,5.4,0],[-1.65,7.3,.35],.23),([0,5.0,0],[1.75,6.85,-.25],.25),([0,4.2,0],[-1.25,5.55,-.85],.19),([0,4.7,0],[1.15,5.8,1.0],.20)]
for i,(a,b,r) in enumerate(branches):
    m,tr=cylinder_between(a,b,r,14);add(st,m,f'branch_{i}',BARK,tr,axes=(1,2),uvscale=(1,2.4))
    for k in range(3):
        aa=np.array(a)+(np.array(b)-np.array(a))*(.56+.12*k);out=np.array(b)+np.array([(-1)**(i+k)*(.45+.18*k),.65+.18*k,(-1)**k*(.28+.14*i)]);m2,tr2=cylinder_between(aa,out,r*.42,10);add(st,m2,f'twig_{i}_{k}',BARK,tr2,axes=(1,2),uvscale=(1.3,2.2))
for i,(x,y,z) in enumerate([(.35,3.4,.54),(-.42,4.2,.40),(.28,5.1,-.53)]):add(st,trimesh.creation.torus(major_radius=.13,minor_radius=.035,major_sections=18,minor_sections=8),f'bark_knot_{i}',BARK,T((x,y,z),rot=[('x',90)]))
(OUT/'dead-tree.glb').write_bytes(gltf.export_glb(st,include_normals=True,unitize_normals=True))

sf=trimesh.Scene()
for i,x in enumerate((-1.75,1.75)):
    add(sf,trimesh.creation.box([.28,2.65,.32]),f'post_{i}',WOOD,T((x,1.25,0),rot=[('z',(-1)**i*2.5)]),axes=(1,2),uvscale=(1.4,2.5));add(sf,trimesh.creation.cone(radius=.24,height=.36,sections=4),f'post_cap_{i}',WOOD,T((x,2.75,0),rot=[('z',45)]))
for i,y in enumerate((.74,1.55,2.26)):
    angle=[-2.1,1.4,-3.2][i];add(sf,trimesh.creation.box([3.95,.24,.18]),f'rail_{i}',WOOD,T((0,y,0),rot=[('z',angle)]),axes=(0,1),uvscale=(2.8,.8))
    for j,x in enumerate((-1.5,-.7,.15,.95,1.55)):add(sf,trimesh.creation.cylinder(radius=.035,height=.10,sections=8),f'nail_{i}_{j}',IRON,T((x,y,-.12),rot=[('x',90)]))
add(sf,trimesh.creation.box([.58,.20,.15]),'broken_splinter',WOOD,T((1.36,1.55,.02),rot=[('z',16)]),axes=(0,1));(OUT/'haunted-fence.glb').write_bytes(gltf.export_glb(sf,include_normals=True,unitize_normals=True))

sp=trimesh.Scene()
for i,a in enumerate(np.linspace(0,2*math.pi,8,endpoint=False)):
    add(sp,trimesh.creation.icosphere(subdivisions=3,radius=1),f'pumpkin_lobe_{i}',PUMP,T((math.cos(a)*.16,.62,math.sin(a)*.10),scale=(.58,.69,.52)),axes=(0,1),uvscale=(1.6,1.6))
add(sp,trimesh.creation.cylinder(radius=.12,height=.44,sections=12),'pumpkin_stem',STEM,T((0,1.28,0),rot=[('z',-8)]))
for i,(x,y) in enumerate(((-.20,.75),(.20,.75))):add(sp,trimesh.creation.cone(radius=.12,height=.06,sections=3),f'jack_eye_{i}',GLOW,T((x,y,-.54),rot=[('x',90),('z',180)]))
for i,x in enumerate(np.linspace(-.25,.25,5)):add(sp,trimesh.creation.box([.09,.07,.055]),f'jack_mouth_{i}',GLOW,T((x,.48+(.04 if i%2 else 0),-.55),rot=[('z',(i-2)*4)]))
(OUT/'jack-o-lantern.glb').write_bytes(gltf.export_glb(sp,include_normals=True,unitize_normals=True))

manifest={'version':'environment-material-pass-v4','models':{'dead-tree.glb':len(st.graph.nodes_geometry),'haunted-fence.glb':len(sf.graph.nodes_geometry),'jack-o-lantern.glb':len(sp.graph.nodes_geometry)},'textures':['asphalt-albedo.png','asphalt-normal.png','asphalt-gloss.png','asphalt-puddles.png','shoulder-mud-albedo.png','shoulder-mud-normal.png','shoulder-mud-gloss.png','dead-bark-albedo.png','dead-bark-normal.png','fence-wood-albedo.png','fence-wood-normal.png','pumpkin-skin-albedo.png','pumpkin-skin-normal.png'],'features':['512px multi-scale asphalt','cracks and patch repairs','wetness variation','mud ruts','split bark normals','root flares and branch detail','splintered fence rails','rusted nails','ribbed pumpkin geometry','emissive carved face']}
(ROOT/'assets'/'environment-material-pass.json').write_text(json.dumps(manifest,indent=2));print(json.dumps(manifest,indent=2))
