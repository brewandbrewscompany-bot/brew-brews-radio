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
TEX=ROOT/'assets'/'textures'/'environment'
TEX.mkdir(parents=True,exist_ok=True)
RNG=np.random.default_rng(19401031)
S=192

def save(name,arr):
    im=Image.fromarray(np.clip(arr,0,255).astype(np.uint8),'RGB')
    im.save(TEX/name,optimize=True)
    return im

def normal_from_height(h,strength=2.2):
    h=h.astype(np.float32)/255.0
    gy,gx=np.gradient(h);nx=-gx*strength;ny=-gy*strength;nz=np.ones_like(h)
    n=np.dstack([nx,ny,nz]);n/=np.linalg.norm(n,axis=2,keepdims=True)+1e-8
    return ((n*.5+.5)*255).astype(np.uint8)

def linear_grain(base,light,scale=.13,noise=1.0):
    y,x=np.mgrid[0:S,0:S]
    g=np.sin(y*scale+np.sin(x*.055)*2.0)+.35*np.sin(y*scale*2.9)+RNG.normal(0,noise,(S,S))
    h=np.clip(128+g*32,0,255);t=np.clip((h-55)/175,0,1)[...,None]
    return np.array(base)*(1-t)+np.array(light)*t,h

def mottled(base,light,blur=7,cracks=0):
    raw=RNG.integers(0,256,(S,S),dtype=np.uint8)
    cloud=np.asarray(Image.fromarray(raw).filter(ImageFilter.GaussianBlur(blur)),dtype=np.float32)
    cloud=(cloud-cloud.min())/max(1,cloud.max()-cloud.min());h=102+cloud*76+RNG.normal(0,5,(S,S))
    for _ in range(cracks):
        x0=int(RNG.integers(3,S-18));y0=int(RNG.integers(3,S-3));ln=int(RNG.integers(8,38));ang=float(RNG.uniform(-.18,.18))
        for k in range(ln):
            x=min(S-2,max(1,x0+k));y=min(S-2,max(1,int(y0+math.sin(k*.27)*1.5+ang*k)))
            h[y-1:y+1,x]-=28
    t=np.clip((h-65)/150,0,1)[...,None]
    return np.array(base)*(1-t)+np.array(light)*t,np.clip(h,0,255)

def maps():
    out={}
    specs={
      'bark':('grain',(31,23,19),(91,66,49),0),
      'fence':('grain',(51,40,32),(117,86,59),0),
      'pumpkin':('mottle',(88,28,5),(173,72,10),10),
      'brick':('mottle',(27,20,18),(72,42,34),16),
      'coffee':('mottle',(52,14,4),(133,48,9),3),
      'mud':('mottle',(24,19,16),(58,44,31),14)}
    for key,(kind,b,l,c) in specs.items():
        rgb,h=linear_grain(b,l,.12,1.05) if kind=='grain' else mottled(b,l,7,c)
        out[key]=(save(f'{key}-albedo.png',rgb),save(f'{key}-normal.png',normal_from_height(h,2.7 if key in ('bark','fence') else 2.1)))
    iron=np.zeros((S,S,3),dtype=np.uint8);iron[...,1]=np.clip(154+RNG.normal(0,30,(S,S)),65,228);iron[...,2]=150;save('iron-metalrough.png',iron)
    return out
MAPS=maps();CACHE={}

def uv_project(mesh,scale=2.0):
    v=np.asarray(mesh.vertices,dtype=float);ext=np.ptp(v,axis=0);axes=np.argsort(ext)[-2:];u=v[:,axes].copy();lo=u.min(0);span=np.maximum(u.max(0)-lo,1e-6);return ((u-lo)/span)*scale

def img(name):return Image.open(TEX/name).convert('RGB')
def classify(name):
    n=(name or '').lower()
    if 'bark' in n:return ('bark',0,.97,2.7)
    if 'fence wood' in n or 'fence grain' in n:return ('fence',0,.92,2.5)
    if 'rusted' in n or 'oxidized iron' in n or n=='iron':return ('iron',.58,.68,1.0)
    if 'pumpkin' in n:return ('pumpkin',0,.76,2.1)
    if 'brick' in n:return ('brick',0,.91,2.3)
    if 'roasted coffee' in n:return ('coffee',0,.38,2.2)
    return None

def material(key,metal,rough):
    ck=(key,metal,rough)
    if ck in CACHE:return CACHE[ck]
    kw={'name':'environment '+key,'metallicFactor':metal,'roughnessFactor':rough,'doubleSided':True}
    if key in MAPS:kw['baseColorTexture']=MAPS[key][0];kw['normalTexture']=MAPS[key][1]
    if key=='iron':kw['metallicRoughnessTexture']=img('iron-metalrough.png')
    CACHE[ck]=PBRMaterial(**kw);return CACHE[ck]

def patch(path):
    scene=trimesh.load(path,force='scene',process=False);patched=0;summary={}
    for geom in scene.geometry.values():
        old=getattr(geom.visual,'material',None);p=classify(getattr(old,'name',''))
        if not p:continue
        key,metal,rough,scale=p
        geom.visual=TextureVisuals(uv=uv_project(geom,scale),material=material(key,metal,rough));patched+=1;summary[key]=summary.get(key,0)+1
    data=gltf.export_glb(scene,include_normals=True,unitize_normals=True);path.write_bytes(data)
    return {'file':path.name,'patched':patched,'materials':summary,'bytes':len(data)}

results=[]
# Character and vehicle are intentionally excluded: their dedicated passes are authoritative.
for filename in ['dead-tree.glb','coffee-bean.glb','haunted-fence.glb','jack-o-lantern.glb','haunted-roastery.glb']:
    p=MODEL/filename
    if p.exists():results.append(patch(p))
manifest={
  'version':'environment-material-pass-v4',
  'authoritativeWitch':'witch-material-pass-v2',
  'authoritativeVehicle':'vehicle-material-pass-v3',
  'textureSize':S,
  'textures':sorted(p.name for p in TEX.glob('*.png')),
  'models':results
}
(ROOT/'assets'/'environment-material-pass.json').write_text(json.dumps(manifest,indent=2))
print(json.dumps(manifest,indent=2))
