import json, math
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter
import trimesh
from trimesh.exchange import gltf
from trimesh.visual.material import PBRMaterial
from trimesh.visual.texture import TextureVisuals

ROOT=Path(__file__).resolve().parents[1]
MODEL=ROOT/'assets'/'models'
TEX=ROOT/'assets'/'textures'/'world'
TEX.mkdir(parents=True,exist_ok=True)
RNG=np.random.default_rng(1940)
S=192

def save(name,arr):
    im=Image.fromarray(np.clip(arr,0,255).astype(np.uint8),'RGB');im.save(TEX/name,optimize=True);return im

def normal(h,strength=2.2):
    h=h.astype(float)/255.;gy,gx=np.gradient(h);nx=-gx*strength;ny=-gy*strength;nz=np.ones_like(h);n=np.dstack([nx,ny,nz]);n/=np.linalg.norm(n,axis=2,keepdims=True)+1e-8;return ((n*.5+.5)*255).astype(np.uint8)

def grain(base,light,axis='y',scale=.15,noise=7):
    y,x=np.mgrid[0:S,0:S];a=y if axis=='y' else x;cross=x if axis=='y' else y
    g=np.sin(a*scale+np.sin(cross*.055)*2.1)+.35*np.sin(a*scale*2.7)+RNG.normal(0,noise/10,(S,S));h=np.clip(128+g*35,0,255);t=np.clip((h-50)/180,0,1)[...,None];rgb=np.array(base)*(1-t)+np.array(light)*t;return rgb,h

def mottled(base,light,blur=7,wear=0):
    raw=RNG.integers(0,256,(S,S),dtype=np.uint8);cloud=np.asarray(Image.fromarray(raw).filter(ImageFilter.GaussianBlur(blur)),float);cloud=(cloud-cloud.min())/max(1,cloud.max()-cloud.min());h=100+cloud*80+RNG.normal(0,5,(S,S));
    if wear:
        for _ in range(wear):
            y=int(RNG.integers(2,S-2));x=int(RNG.integers(2,S-18));ln=int(RNG.integers(8,42));h[y-1:y+1,x:min(S,x+ln)]-=35
    t=np.clip((h-70)/150,0,1)[...,None];rgb=np.array(base)*(1-t)+np.array(light)*t;return rgb,np.clip(h,0,255)

def make_maps():
    maps={}
    specs={
      'carpaint':((7,10,13),(31,27,24),'mottle'),
      'whitewall':((124,120,107),(192,184,161),'mottle'),
      'bark':((35,25,20),(92,66,48),'grain'),
      'fence':((55,43,34),(118,88,60),'grain'),
      'pumpkin':((92,31,5),(171,74,11),'mottle'),
      'brick':((30,21,19),(76,43,35),'mottle'),
      'coffee':((58,16,5),(132,49,10),'mottle')}
    for key,(base,light,kind) in specs.items():
        rgb,h=(grain(base,light,'y',.12,8) if kind=='grain' else mottled(base,light,6,55 if key=='carpaint' else 8));maps[key]=(save(f'{key}-albedo.png',rgb),save(f'{key}-normal.png',normal(h,2.6 if key in ('bark','fence') else 2.0)))
    car_h=np.asarray(maps['carpaint'][1],dtype=np.uint8)[...,0];rough=np.clip(44+(255-car_h)*.42,25,180);mr=np.zeros((S,S,3),dtype=np.uint8);mr[...,1]=rough;mr[...,2]=178;save('carpaint-metalrough.png',mr)
    chrome=np.zeros((S,S,3),dtype=np.uint8);chrome[...,1]=np.clip(38+RNG.normal(0,17,(S,S)),12,100);chrome[...,2]=238;save('chrome-metalrough.png',chrome)
    tire=np.zeros((S,S,3),dtype=np.uint8);tire[...,1]=np.clip(218+RNG.normal(0,10,(S,S)),170,245);save('tire-metalrough.png',tire)
    iron=np.zeros((S,S,3),dtype=np.uint8);iron[...,1]=np.clip(155+RNG.normal(0,28,(S,S)),75,230);iron[...,2]=150;save('iron-metalrough.png',iron)
    return maps
MAPS=make_maps()
CACHE={}
def uv(mesh,scale=2.0):
    v=np.asarray(mesh.vertices,float);ext=np.ptp(v,axis=0);axes=np.argsort(ext)[-2:];u=v[:,axes].copy();lo=u.min(0);span=np.maximum(u.max(0)-lo,1e-6);u=(u-lo)/span;return u*scale

def img(name):return Image.open(TEX/name).convert('RGB')
def preset(name):
    n=(name or '').lower()
    if 'lacquer' in n:return ('carpaint',.50,.23,2.0)
    if 'chrome' in n:return ('chrome',.93,.17,1.0)
    if 'rubber' in n:return ('tire',0,.95,1.0)
    if 'whitewall' in n:return ('whitewall',0,.74,1.8)
    if 'bark' in n:return ('bark',0,.97,2.6)
    if 'fence wood' in n or 'fence grain' in n:return ('fence',0,.91,2.4)
    if 'rusted' in n or 'oxidized iron' in n:return ('iron',.58,.67,1.0)
    if 'pumpkin' in n:return ('pumpkin',0,.75,2.0)
    if 'brick' in n:return ('brick',0,.91,2.3)
    if 'roasted coffee' in n:return ('coffee',0,.37,2.2)
    return None

def material(key,metal,rough):
    ck=(key,metal,rough)
    if ck in CACHE:return CACHE[ck]
    kw=dict(name='world '+key,metallicFactor=metal,roughnessFactor=rough,doubleSided=True)
    if key in MAPS:kw['baseColorTexture']=MAPS[key][0];kw['normalTexture']=MAPS[key][1]
    if key=='carpaint':kw['metallicRoughnessTexture']=img('carpaint-metalrough.png')
    elif key=='chrome':kw['metallicRoughnessTexture']=img('chrome-metalrough.png')
    elif key=='tire':kw['metallicRoughnessTexture']=img('tire-metalrough.png')
    elif key=='iron':kw['metallicRoughnessTexture']=img('iron-metalrough.png')
    CACHE[ck]=PBRMaterial(**kw);return CACHE[ck]

def patch(path):
    scene=trimesh.load(path,force='scene',process=False);count=0;keys={}
    for geom in scene.geometry.values():
        old=getattr(geom.visual,'material',None);p=preset(getattr(old,'name',''))
        if not p:continue
        key,metal,rough,scale=p;geom.visual=TextureVisuals(uv=uv(geom,scale),material=material(key,metal,rough));count+=1;keys[key]=keys.get(key,0)+1
    data=gltf.export_glb(scene,include_normals=True,unitize_normals=True);path.write_bytes(data);return {'file':path.name,'patched':count,'materials':keys,'bytes':len(data)}

results=[]
# Intentionally do not patch witch-rider.glb: detailed Witch Material Pass v2 is authoritative.
for f in ['vintage-car.glb','dead-tree.glb','coffee-bean.glb','haunted-fence.glb','jack-o-lantern.glb','haunted-roastery.glb']:
    p=MODEL/f
    if p.exists():results.append(patch(p))
manifest={'version':'world-material-pass-v3','authoritativeWitch':'witch-material-pass-v2','textureSize':S,'textures':sorted(x.name for x in TEX.glob('*.png')),'models':results}
(ROOT/'assets'/'world-material-pass.json').write_text(json.dumps(manifest,indent=2))
print(json.dumps(manifest,indent=2))
