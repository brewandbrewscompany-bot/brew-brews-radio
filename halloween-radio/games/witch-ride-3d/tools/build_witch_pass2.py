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
OUT=ROOT/'assets'/'models'
TEX=ROOT/'assets'/'textures'
OUT.mkdir(parents=True,exist_ok=True);TEX.mkdir(parents=True,exist_ok=True)
rng=np.random.default_rng(260906)

def rgba(h,a=255):
    h=h.lstrip('#'); return [int(h[i:i+2],16) for i in (0,2,4)]+[a]

def normal_from_height(height,strength=3.2):
    h=np.asarray(height,dtype=float)/255.0
    gy,gx=np.gradient(h);nx=-gx*strength;ny=-gy*strength;nz=np.ones_like(nx)
    n=np.sqrt(nx*nx+ny*ny+nz*nz)+1e-9
    return Image.fromarray(np.dstack([(nx/n*.5+.5)*255,(ny/n*.5+.5)*255,(nz/n*.5+.5)*255]).astype(np.uint8),'RGB')

def weave_texture(base,seed=1,size=128,contrast=18):
    rr=np.random.default_rng(seed);arr=np.zeros((size,size,3),dtype=float);base=np.array(base,float)
    noise=rr.normal(0,2.6,(size,size));yy,xx=np.mgrid[0:size,0:size]
    weave=np.sin(xx*np.pi/2.1)*2.4+np.sin(yy*np.pi/2.5)*2.0+np.sin((xx+yy)*np.pi/7.0)*1.2;value=noise+weave
    for c in range(3):arr[:,:,c]=base[c]+value
    img=Image.fromarray(np.uint8(np.clip(arr,0,255)),'RGB')
    height=Image.fromarray(np.uint8(np.clip(128+value*contrast/5,0,255)),'L').filter(ImageFilter.GaussianBlur(.35))
    return img,normal_from_height(height,2.8)

def leather_texture(base,seed=2,size=128):
    rr=np.random.default_rng(seed);base=np.array(base,float);raw=rr.random((size,size))*255
    grain=np.asarray(Image.fromarray(raw.astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.1)),dtype=float);grain=(grain-grain.mean())/max(1,grain.std())
    arr=np.zeros((size,size,3),float)
    for c in range(3):arr[:,:,c]=base[c]+grain*4.2
    img=Image.fromarray(np.uint8(np.clip(arr,0,255)),'RGB');d=ImageDraw.Draw(img)
    for _ in range(18):
        x=int(rr.integers(0,size));y=int(rr.integers(0,size));ln=int(rr.integers(5,22));d.line((x,y,min(size-1,x+ln),max(0,min(size-1,y+int(rr.integers(-4,5))))),fill=tuple(np.clip(base+12,0,255).astype(int)),width=1)
    return img,normal_from_height(Image.fromarray(np.uint8(np.clip(128+grain*18,0,255)),'L'),2.2)

def hair_texture(seed=3,size=128):
    rr=np.random.default_rng(seed);yy,xx=np.mgrid[0:size,0:size]
    strands=(np.sin(xx*.42)+np.sin(xx*.91+1.3)+np.sin(xx*1.62+.5))*4.5;vertical=6*np.sin(yy*.06);noise=rr.normal(0,1.6,(size,size));base=np.array([91,29,10],float)
    arr=np.zeros((size,size,3),float)
    for c in range(3):arr[:,:,c]=base[c]+strands+vertical+noise+(9 if c==0 else 2 if c==1 else 0)
    return Image.fromarray(np.uint8(np.clip(arr,0,255)),'RGB'),normal_from_height(Image.fromarray(np.uint8(np.clip(128+strands*4+noise*2,0,255)),'L'),2.6)

def wood_texture(seed=4,size=128):
    rr=np.random.default_rng(seed);yy,xx=np.mgrid[0:size,0:size];grain=np.sin(yy*.17+np.sin(xx*.08)*2.2)*6+np.sin(yy*.043)*5+rr.normal(0,1.7,(size,size));base=np.array([80,45,21],float);arr=np.zeros((size,size,3),float)
    for c in range(3):arr[:,:,c]=base[c]+grain
    return Image.fromarray(np.uint8(np.clip(arr,0,255)),'RGB'),normal_from_height(Image.fromarray(np.uint8(np.clip(128+grain*5,0,255)),'L'),2.0)

def save_tex(name,pair):
    a,n=pair;a.save(TEX/f'{name}-albedo.png',optimize=True);n.save(TEX/f'{name}-normal.png',optimize=True);return a,n

cloth_a,cloth_n=save_tex('witch-cloth',weave_texture([20,18,22],11));burg_a,burg_n=save_tex('witch-burgundy',weave_texture([70,10,17],12));leath_a,leath_n=save_tex('witch-leather',leather_texture([22,20,22],13));hair_a,hair_n=save_tex('witch-hair',hair_texture(14));wood_a,wood_n=save_tex('broom-wood',wood_texture(15))

def pbr(name,color,rough,metal=0,base=None,normal=None,double=False,em=None):
    return PBRMaterial(name=name,baseColorFactor=np.array(rgba(color),float)/255,metallicFactor=metal,roughnessFactor=rough,baseColorTexture=base,normalTexture=normal,doubleSided=double,emissiveFactor=None if em is None else np.array(rgba(em)[:3],float)/255)
M={'cloth':pbr('woven black wool','#242126',.88,base=cloth_a,normal=cloth_n,double=True),'edge':pbr('frayed wool edge','#342a31',.82,base=cloth_a,normal=cloth_n,double=True),'burg':pbr('oxblood woven lining','#5a0d17',.76,base=burg_a,normal=burg_n,double=True),'burgdark':pbr('aged burgundy trim','#32090e',.82,base=burg_a,normal=burg_n,double=True),'leather':pbr('creased black leather','#1a171a',.52,base=leath_a,normal=leath_n),'boot':pbr('scuffed riding leather','#111112',.49,base=leath_a,normal=leath_n),'hair':pbr('auburn strand cluster','#6a220e',.48,base=hair_a,normal=hair_n),'hairhi':pbr('copper auburn strand cluster','#8c3517',.44,base=hair_a,normal=hair_n),'wood':pbr('aged broom ash wood','#5a3419',.73,base=wood_a,normal=wood_n),'skin':pbr('moonlit skin','#936753',.67),'brass':pbr('tarnished brass','#715029',.34,.72),'bristle':pbr('burnt broom straw','#6e3d16',.93),'ember':pbr('ember coal','#311406',.43,em='#ff6a14')}

def T(pos=(0,0,0),rot=None,scale=None):
    m=np.eye(4)
    if scale is not None:m=(scale_matrix(scale) if np.isscalar(scale) else np.diag([*scale,1]))@m
    if rot:
        for axis,ang in rot:m=rotation_matrix(math.radians(ang),{'x':[1,0,0],'y':[0,1,0],'z':[0,0,1]}[axis])@m
    return translation_matrix(pos)@m

def uv_for(mesh,axes=(0,2),scale=(1.2,1.2)):
    v=np.asarray(mesh.vertices,float);uv=v[:,list(axes)].copy();uv[:,0]*=scale[0];uv[:,1]*=scale[1];uv-=np.floor(uv);return uv

def add(scene,mesh,name,material,transform=None,axes=(0,2),uvscale=(1.2,1.2)):
    mesh=mesh.copy()
    try:mesh.visual=TextureVisuals(uv=uv_for(mesh,axes,uvscale),material=material)
    except Exception:mesh.visual.material=material
    scene.add_geometry(mesh,node_name=name,geom_name=name,transform=np.eye(4) if transform is None else transform)

def frustum(r0,r1,h,sections=32):
    ang=np.linspace(0,2*math.pi,sections,endpoint=False);v=[]
    for y,r in [(-h/2,r0),(h/2,r1)]:
        for a in ang:v.append([math.cos(a)*r,y,math.sin(a)*r])
    faces=[]
    for i in range(sections):j=(i+1)%sections;faces += [[i,j,sections+i],[j,sections+j,sections+i]]
    return trimesh.Trimesh(np.array(v),np.array(faces),process=True)

def tapered_tube(points,radii,radial=10):
    p=np.asarray(points,float);radii=np.asarray(radii,float);verts=[]
    for i,pt in enumerate(p):
        t=(p[1]-p[0]) if i==0 else (p[-1]-p[-2]) if i==len(p)-1 else (p[i+1]-p[i-1]);t=t/(np.linalg.norm(t)+1e-9);ref=np.array([0,1,0.])
        if abs(np.dot(t,ref))>.88:ref=np.array([1,0,0.])
        u=np.cross(t,ref);u/=np.linalg.norm(u)+1e-9;v=np.cross(t,u);v/=np.linalg.norm(v)+1e-9
        for a in np.linspace(0,2*math.pi,radial,endpoint=False):verts.append(pt+(u*math.cos(a)+v*math.sin(a))*radii[i])
    faces=[]
    for i in range(len(p)-1):
        for j in range(radial):k=(j+1)%radial;a=i*radial+j;b=i*radial+k;c=(i+1)*radial+j;d=(i+1)*radial+k;faces += [[a,c,b],[b,c,d]]
    return trimesh.Trimesh(np.array(verts),np.array(faces),process=True)

def cylinder_between(a,b,r,sections=18):
    a=np.array(a,float);b=np.array(b,float);vec=b-a;L=np.linalg.norm(vec);mesh=trimesh.creation.cylinder(radius=r,height=L,sections=sections);z=np.array([0,0,1.]);n=vec/L;axis=np.cross(z,n);dot=np.clip(np.dot(z,n),-1,1);R=np.eye(4)
    if np.linalg.norm(axis)>1e-8:R=rotation_matrix(math.acos(dot),axis/np.linalg.norm(axis))
    elif dot<0:R=rotation_matrix(math.pi,[1,0,0])
    return mesh,translation_matrix((a+b)/2)@R

def detailed_cape():
    cols=13;rows=11;widths=np.linspace(.53,1.22,rows);trail=np.linspace(0,2.08,rows);drop=-.03*np.arange(rows)-.011*np.arange(rows)**2;verts=[]
    for j in range(rows):
        xs=np.linspace(-widths[j],widths[j],cols)
        for i,x in enumerate(xs):
            fold=(.055+.012*j)*math.sin((i/(cols-1))*math.pi*5+j*.18);rag=0
            if j==rows-1:rag=[-.12,.02,-.16,.06,-.23,.03,-.12,.07,-.20,.01,-.14,.05,-.19][i]
            verts.append([x,drop[j]+fold+rag,trail[j]])
    faces=[]
    for j in range(rows-1):
        for i in range(cols-1):a=j*cols+i;b=a+1;c=a+cols;d=c+1;faces += [[a,c,b],[b,c,d],[b,c,a],[d,c,b]]
    surf=trimesh.Trimesh(np.array(verts),np.array(faces),process=False);left=[verts[j*cols] for j in range(rows)];right=[verts[j*cols+cols-1] for j in range(rows)]
    return trimesh.util.concatenate([surf,tapered_tube(left,np.linspace(.022,.012,rows),6),tapered_tube(right,np.linspace(.022,.012,rows),6)])

def hair_cluster(i,length):
    pts=[]
    for j in range(10):
        f=j/9;pts.append(np.array([math.sin(f*math.pi*1.22+i*.73)*(.045+.075*f),-.08*f-.32*f*f,length*f]))
    meshes=[tapered_tube(pts,np.linspace(.105 if i!=2 else .12,.020,10),10)]
    for k,off in enumerate([-.055,0,.055]):
        q=[]
        for j,p in enumerate(pts):
            f=j/(len(pts)-1);q.append(p+np.array([off*(1-.35*f),.015*math.sin(f*7+k),.018*k*f]))
        meshes.append(tapered_tube(q,np.linspace(.026,.006,10),6))
    return trimesh.util.concatenate(meshes)

s=trimesh.Scene()
add(s,trimesh.creation.capsule(height=1.02,radius=.38,count=[12,24]),'body_core',M['cloth'],T((0,.38,0),scale=(1.18,1.18,.90)),axes=(0,1),uvscale=(2,2));add(s,frustum(.78,.35,1.32,32),'coat_skirt',M['cloth'],T((0,-.31,.10)),axes=(0,1),uvscale=(2.1,2.1));add(s,trimesh.creation.box([.035,.88,.055]),'coat_back_seam',M['edge'],T((0,.38,.365)),axes=(0,1),uvscale=(3,3))
for side in (-1,1):
    add(s,trimesh.creation.icosphere(subdivisions=2,radius=.27),f'shoulder_{side}',M['edge'],T((side*.42,.78,-.02),scale=(1.16,.72,.92)));add(s,trimesh.creation.box([.34,.055,.13]),f'epaulette_{side}',M['leather'],T((side*.37,.92,.05),rot=[('z',side*7)]))
add(s,trimesh.creation.cylinder(radius=.445,height=.11,sections=30),'belt',M['leather'],T((0,.16,0)),axes=(0,2),uvscale=(3,3));add(s,trimesh.creation.box([.21,.17,.075]),'belt_buckle',M['brass'],T((0,.16,-.405)));add(s,trimesh.creation.cylinder(radius=.17,height=.11,sections=24),'collar',M['burgdark'],T((0,1.08,-.03)));add(s,trimesh.creation.cylinder(radius=.13,height=.24,sections=18),'neck',M['skin'],T((0,1.15,-.04)));add(s,trimesh.creation.icosphere(subdivisions=3,radius=.34),'head',M['skin'],T((0,1.49,-.08),scale=(.92,1.08,.94)))
add(s,trimesh.creation.cylinder(radius=.72,height=.055,sections=48),'hat_brim',M['cloth'],T((0,1.82,-.08),rot=[('z',2)],scale=(1,1,.88)),axes=(0,2),uvscale=(2.5,2.5));add(s,frustum(.40,.23,.74,36),'hat_crown',M['cloth'],T((-.02,2.18,-.08),rot=[('z',-6)]));add(s,tapered_tube([[0,0,0],[-.04,.18,.01],[-.11,.34,.03],[-.22,.48,.05],[-.34,.57,.06]],[.23,.19,.15,.10,.035],18),'hat_tip',M['cloth'],T((.02,2.47,-.08),rot=[('z',-4)]));add(s,trimesh.creation.cylinder(radius=.42,height=.071,sections=36),'hat_band',M['burg'],T((0,1.94,-.08)));add(s,trimesh.creation.box([.16,.14,.055]),'hat_buckle',M['brass'],T((.28,1.95,-.34),rot=[('z',-8)]))
for side in (-1,1):
    a=(side*.34,.84,-.03);b=(side*.63,.24,-.40);mesh,tr=cylinder_between(a,b,.14,22);add(s,mesh,f'arm_{"L" if side<0 else "R"}',M['cloth'],tr,axes=(0,1),uvscale=(3,3));add(s,trimesh.creation.cylinder(radius=.145,height=.12,sections=20),f'cuff_{"L" if side<0 else "R"}',M['burgdark'],T(b,rot=[('x',70)]));c=(side*.38,-.12,-.56);mesh,tr=cylinder_between(b,c,.105,20);add(s,mesh,f'forearm_{"L" if side<0 else "R"}',M['leather'],tr,axes=(0,1),uvscale=(4,4));add(s,trimesh.creation.icosphere(subdivisions=2,radius=.12),f'glove_{"L" if side<0 else "R"}',M['leather'],T(c,scale=(1,.8,1.15)))
    for finger in range(3):
        p0=np.array(c)+np.array([side*(.015+finger*.018),-.02,-.02-finger*.012]);p1=p0+np.array([side*.02,-.08,-.07]);fm,ft=cylinder_between(p0,p1,.018,8);add(s,fm,f'glove_finger_{side}_{finger}',M['leather'],ft)
    hip=(side*.28,-.42,.05);knee=(side*.46,-.88,.36);ankle=(side*.34,-1.08,-.08);mesh,tr=cylinder_between(hip,knee,.16,20);add(s,mesh,f'thigh_{side}',M['cloth'],tr);mesh,tr=cylinder_between(knee,ankle,.13,20);add(s,mesh,f'shin_{side}',M['leather'],tr);add(s,trimesh.creation.capsule(height=.36,radius=.13,count=[8,14]),f'boot_{side}',M['boot'],T((ankle[0],ankle[1]-.10,ankle[2]-.16),rot=[('x',78)],scale=(1,1,1.45)))
cape=detailed_cape();add(s,cape,'cape',M['cloth'],T((0,.88,.24)),axes=(0,2),uvscale=(1.5,1.5));lining=detailed_cape();lining.apply_translation([0,-.020,.022]);lining.apply_scale([.965,.985,.986]);add(s,lining,'cape_lining',M['burg'],T((0,.88,.24)),axes=(0,2),uvscale=(1.5,1.5))
for i,x in enumerate(np.linspace(-.34,.34,5)):
    length=1.40+(.08 if i in [0,4] else .25 if i in [1,3] else .40);add(s,hair_cluster(i,length),f'hair_{i+1:02d}',M['hairhi'] if i in (1,3) else M['hair'],T((x,1.57,.20+(i%2)*.025),rot=[('z',(i-2)*3)]),axes=(0,2),uvscale=(2.2,1.2))
add(s,trimesh.creation.cylinder(radius=.052,height=5.3,sections=24),'broom_handle',M['wood'],T((0,-.82,.18)),axes=(0,1),uvscale=(5.5,1.5));add(s,trimesh.creation.torus(major_radius=.10,minor_radius=.025,major_sections=24,minor_sections=8),'broom_binding',M['brass'],T((0,-.82,2.80),rot=[('x',90)]));straw=[]
for i in range(30):
    a=2*math.pi*i/30;start=np.array([math.cos(a)*.074,math.sin(a)*.054,0]);end=np.array([math.cos(a)*(.24+.045*(i%4)),math.sin(a)*(.17+.03*(i%5)),1.23+.07*math.sin(i*.73)]);straw.append(tapered_tube([start,start*.80+end*.20,start*.48+end*.52,end],[.026,.022,.015,.006],6))
add(s,trimesh.util.concatenate(straw),'broom_bristles',M['bristle'],T((0,-.82,2.78)))
for k in range(5):add(s,trimesh.creation.icosphere(subdivisions=1,radius=.11-.012*k),f'ember_{k}',M['ember'],T(((-.10+.05*k),-.82,4.05+.24*k),scale=(1,.52,1.6)))

glb=gltf.export_glb(s,include_normals=True,unitize_normals=True);(OUT/'witch-rider.glb').write_bytes(glb)
manifest={'version':'witch-material-pass-v2','file':'witch-rider.glb','bytes':len(glb),'nodes':len(s.graph.nodes_geometry),'textures':[p.name for p in sorted(TEX.glob('witch-*.png'))]+[p.name for p in sorted(TEX.glob('broom-wood-*.png'))],'features':['woven cloth textures','cloth normal maps','leather grain normal maps','auburn hair strand maps','broom wood grain','cape fold geometry','cape hem cords','clustered animated hair','coat seams','epaulettes','glove finger detail','denser bristles']}
(ROOT/'assets'/'witch-material-pass.json').write_text(json.dumps(manifest,indent=2));print(json.dumps(manifest,indent=2))
