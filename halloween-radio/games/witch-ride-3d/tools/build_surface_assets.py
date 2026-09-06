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
TEX=ROOT/'assets'/'textures'/'surfaces'
TEX.mkdir(parents=True, exist_ok=True)
RNG=np.random.default_rng(1941)
S=256

def save(name, arr, mode='RGB'):
    arr=np.clip(arr,0,255).astype(np.uint8)
    im=Image.fromarray(arr,mode)
    im.save(TEX/name,optimize=True)
    return im

def normal_from_height(h,strength=2.0):
    h=h.astype(np.float32)/255.0
    gy,gx=np.gradient(h)
    nx=-gx*strength; ny=-gy*strength; nz=np.ones_like(h)
    n=np.stack([nx,ny,nz],axis=-1); n/=np.linalg.norm(n,axis=-1,keepdims=True)+1e-8
    return ((n*.5+.5)*255).astype(np.uint8)

def weave(base, accent, freq=18, noise=9):
    y,x=np.mgrid[0:S,0:S]
    w=(np.sin(x*math.pi*2/freq)+np.sin(y*math.pi*2/(freq+3)))*0.5
    grain=RNG.normal(0,noise,(S,S))
    t=np.clip(.50+w*.10+grain/255,0,1)[...,None]
    a=np.array(base)[None,None,:]; b=np.array(accent)[None,None,:]
    rgb=a*(1-t)+b*t
    h=np.clip(125+w*25+grain*1.2,0,255)
    return rgb,h

def leather(base=(21,18,20)):
    grain=RNG.normal(0,14,(S,S)); low=Image.fromarray(np.clip(grain+128,0,255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(3))
    h=np.array(low,dtype=np.float32)-128
    cracks=np.zeros((S,S),np.float32)
    for _ in range(24):
        x0=int(RNG.integers(0,S)); y0=int(RNG.integers(0,S)); ln=int(RNG.integers(16,52)); ang=float(RNG.random()*math.tau)
        for k in range(ln):
            xx=int(x0+math.cos(ang)*k+math.sin(k*.5)*1.5); yy=int(y0+math.sin(ang)*k)
            if 1<=xx<S-1 and 1<=yy<S-1: cracks[yy-1:yy+2,xx]=-42
    h=np.clip(128+h*.7+cracks,0,255)
    rgb=np.zeros((S,S,3),np.float32)+np.array(base)
    rgb+=((h-128)*.12)[...,None]
    return np.clip(rgb,0,255),h

def hair_tex():
    y,x=np.mgrid[0:S,0:S]
    lines=(np.sin(x*.47+y*.03)+np.sin(x*.91+y*.05)*.55+np.sin(x*1.83)*.23)
    grain=RNG.normal(0,6,(S,S))
    h=np.clip(128+lines*31+grain,0,255)
    base=np.array([74,22,8.]); hi=np.array([143,53,17.])
    t=np.clip((h-75)/160,0,1)[...,None]
    rgb=base*(1-t)+hi*t
    return rgb,h

def wood_tex(base=(74,43,21), light=(126,77,33), vertical=True):
    y,x=np.mgrid[0:S,0:S]; axis=y if vertical else x
    grain=np.sin(axis*.12 + np.sin((x if vertical else y)*.08)*2.5)+np.sin(axis*.37)*.30
    n=RNG.normal(0,8,(S,S)); h=np.clip(128+grain*36+n,0,255)
    t=np.clip((h-55)/180,0,1)[...,None]
    rgb=np.array(base)*(1-t)+np.array(light)*t
    return rgb,h

def carpaint():
    cloud=np.array(Image.fromarray(RNG.integers(0,256,(S,S),dtype=np.uint8)).filter(ImageFilter.GaussianBlur(8)),dtype=np.float32)
    scratches=np.zeros((S,S),np.float32)
    for _ in range(55):
        y0=int(RNG.integers(0,S)); x0=int(RNG.integers(0,S)); ln=int(RNG.integers(8,45))
        scratches[max(0,y0-1):min(S,y0+1),x0:min(S,x0+ln)]+=float(RNG.integers(20,65))
    wear=np.clip((cloud-110)*.10+scratches,0,65)
    rgb=np.zeros((S,S,3),np.float32)+np.array([9,12,15.])
    rgb+=wear[...,None]*np.array([.32,.22,.16])
    h=np.clip(128+scratches*.45+RNG.normal(0,3,(S,S)),0,255)
    return rgb,h,wear

def make_maps():
    maps={}
    for key,base,accent,freq in [('wool',(16,15,17),(38,33,39),15),('burgundy',(48,5,10),(91,16,22),17),('whitewall',(145,140,126),(205,198,175),24),('brick',(27,19,17),(61,38,31),22),('pumpkin',(91,30,5),(160,67,10),26)]:
        rgb,h=weave(base,accent,freq,8 if key!='brick' else 14); maps[key]=(save(f'{key}-albedo.png',rgb),save(f'{key}-normal.png',normal_from_height(h,2.0)))
    rgb,h=leather(); maps['leather']=(save('leather-albedo.png',rgb),save('leather-normal.png',normal_from_height(h,2.8)))
    rgb,h=hair_tex(); maps['hair']=(save('hair-albedo.png',rgb),save('hair-normal.png',normal_from_height(h,2.3)))
    for key,base,light in [('wood',(65,35,16),(126,75,32)),('bark',(41,28,21),(93,66,48)),('fence',(67,51,38),(117,91,66)),('bristle',(72,39,14),(142,85,27))]:
        rgb,h=wood_tex(base,light,True); maps[key]=(save(f'{key}-albedo.png',rgb),save(f'{key}-normal.png',normal_from_height(h,2.5)))
    rgb,h,wear=carpaint(); maps['carpaint']=(save('carpaint-albedo.png',rgb),save('carpaint-normal.png',normal_from_height(h,2.0)))
    rough=np.clip(47+wear*2.4+RNG.normal(0,9,(S,S)),25,195).astype(np.uint8)
    metal=np.full((S,S),180,dtype=np.uint8); mr=np.zeros((S,S,3),dtype=np.uint8); mr[...,1]=rough; mr[...,2]=metal
    save('carpaint-metalrough.png',mr)
    chrome_pit=np.clip(42+RNG.normal(0,18,(S,S)),12,110).astype(np.uint8); cmr=np.zeros((S,S,3),dtype=np.uint8);cmr[...,1]=chrome_pit;cmr[...,2]=235;save('chrome-metalrough.png',cmr)
    tire=np.clip(205+RNG.normal(0,18,(S,S)),135,245).astype(np.uint8); tmr=np.zeros((S,S,3),dtype=np.uint8);tmr[...,1]=tire;tmr[...,2]=0;save('tire-metalrough.png',tmr)
    return maps

MAPS=make_maps()

def uv_project(mesh,scale=1.0):
    v=np.asarray(mesh.vertices,float); ext=np.ptp(v,axis=0); axes=np.argsort(ext)[-2:]
    uv=v[:,axes].copy(); lo=uv.min(axis=0); span=np.maximum(uv.max(axis=0)-lo,1e-6); uv=(uv-lo)/span; uv*=scale
    return uv

def load_img(name): return Image.open(TEX/name).convert('RGB')

def material_for(name):
    n=(name or '').lower(); preset=None
    if 'wool' in n: preset=('wool',0.0,.86)
    elif 'burgundy' in n or 'oxblood' in n: preset=('burgundy',0.0,.72)
    elif 'auburn' in n or 'hair' in n: preset=('hair',0.0,.48)
    elif 'leather' in n or 'boot' in n: preset=('leather',0.0,.55)
    elif 'broom wood' in n: preset=('wood',0.0,.73)
    elif 'broom straw' in n: preset=('bristle',0.0,.91)
    elif 'lacquer' in n: preset=('carpaint',.52,.22)
    elif 'chrome' in n: preset=('chrome',.92,.18)
    elif 'rubber' in n: preset=('tire',0.0,.94)
    elif 'whitewall' in n: preset=('whitewall',0.0,.72)
    elif 'bark' in n: preset=('bark',0.0,.97)
    elif 'fence wood' in n or 'fence grain' in n: preset=('fence',0.0,.91)
    elif 'pumpkin' in n: preset=('pumpkin',0.0,.74)
    elif 'brick' in n: preset=('brick',0.0,.90)
    if not preset:return None
    key,metal,rough=preset
    kwargs=dict(name=name,metallicFactor=metal,roughnessFactor=rough,doubleSided=True)
    if key in MAPS:
        kwargs['baseColorTexture']=MAPS[key][0];kwargs['normalTexture']=MAPS[key][1]
    if key=='carpaint': kwargs['metallicRoughnessTexture']=load_img('carpaint-metalrough.png')
    elif key=='chrome': kwargs['metallicRoughnessTexture']=load_img('chrome-metalrough.png')
    elif key=='tire': kwargs['metallicRoughnessTexture']=load_img('tire-metalrough.png')
    return PBRMaterial(**kwargs), 3.0 if key in ('hair','wood','bristle') else 2.0

def patch_glb(path):
    scene=trimesh.load(path,force='scene',process=False); patched=0
    for geom in scene.geometry.values():
        old=getattr(geom.visual,'material',None); name=getattr(old,'name',''); p=material_for(name)
        if not p: continue
        material,scale=p; geom.visual=TextureVisuals(uv=uv_project(geom,scale),material=material); patched+=1
    data=gltf.export_glb(scene,include_normals=True,unitize_normals=True); path.write_bytes(data)
    return {'file':path.name,'patched':patched,'bytes':len(data)}

results=[]
for filename in ['witch-rider.glb','vintage-car.glb','dead-tree.glb','haunted-fence.glb','jack-o-lantern.glb','haunted-roastery.glb']:
    p=MODEL/filename
    if p.exists(): results.append(patch_glb(p))
manifest={'version':'surface-realism-v1','textures':sorted(x.name for x in TEX.glob('*.png')),'models':results}
(ROOT/'assets'/'surface-manifest.json').write_text(json.dumps(manifest,indent=2))
print(json.dumps(manifest,indent=2))
