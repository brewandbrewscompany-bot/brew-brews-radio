import math, json, struct
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter, ImageDraw
import trimesh
from trimesh.exchange import gltf
from trimesh.transformations import translation_matrix, rotation_matrix, scale_matrix
from trimesh.visual.material import PBRMaterial
from trimesh.visual.texture import TextureVisuals

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'assets'/'models'; TEX=ROOT/'assets'/'textures'
OUT.mkdir(parents=True,exist_ok=True); TEX.mkdir(parents=True,exist_ok=True)
RNG=np.random.default_rng(26090611)

# ---------- texture generation ----------
def rgba(h,a=255):
    h=h.lstrip('#'); return [int(h[i:i+2],16) for i in (0,2,4)]+[a]

def normal_from_height(height,strength=3.0):
    h=np.asarray(height,dtype=float)/255.0
    gy,gx=np.gradient(h); nx=-gx*strength; ny=-gy*strength; nz=np.ones_like(nx)
    n=np.sqrt(nx*nx+ny*ny+nz*nz)+1e-9
    return Image.fromarray(np.dstack([(nx/n*.5+.5)*255,(ny/n*.5+.5)*255,(nz/n*.5+.5)*255]).astype(np.uint8),'RGB')

def packed_roughness(rough,size=128,seed=1,variation=.08,metal=.0):
    rr=np.random.default_rng(seed)
    base=np.clip(rough + rr.normal(0,variation,(size,size)),0,1)
    base=np.asarray(Image.fromarray(np.uint8(base*255)).filter(ImageFilter.GaussianBlur(.65)),dtype=np.uint8)
    arr=np.zeros((size,size,3),dtype=np.uint8)
    arr[:,:,0]=255; arr[:,:,1]=base; arr[:,:,2]=np.uint8(np.clip(metal,0,1)*255)
    return Image.fromarray(arr,'RGB')

def felt_texture(base,seed=1,size=128):
    rr=np.random.default_rng(seed); base=np.array(base,float)
    fine=rr.normal(0,4.2,(size,size)); coarse=np.asarray(Image.fromarray(np.uint8(rr.random((size,size))*255)).filter(ImageFilter.GaussianBlur(2.8)),float)
    coarse=(coarse-coarse.mean())/(coarse.std()+1e-9)
    yy,xx=np.mgrid[0:size,0:size]
    nap=2.2*np.sin(xx*.31+np.sin(yy*.045)*1.9)+1.4*np.sin((xx+yy)*.16)
    val=fine+coarse*2.8+nap
    arr=np.zeros((size,size,3),float)
    for c in range(3): arr[:,:,c]=base[c]+val
    img=Image.fromarray(np.uint8(np.clip(arr,0,255)),'RGB')
    h=Image.fromarray(np.uint8(np.clip(128+val*4.0,0,255)),'L').filter(ImageFilter.GaussianBlur(.28))
    return img,normal_from_height(h,2.7)

def wool_texture(base,seed=2,size=128):
    rr=np.random.default_rng(seed); base=np.array(base,float); yy,xx=np.mgrid[0:size,0:size]
    weave=np.sin(xx*np.pi/2.35)*2.9+np.sin(yy*np.pi/2.7)*2.5+np.sin((xx+yy)*np.pi/9.0)*1.3
    slub=np.asarray(Image.fromarray(np.uint8(rr.random((size,size))*255)).filter(ImageFilter.GaussianBlur(1.5)),float)
    slub=(slub-slub.mean())/(slub.std()+1e-9)
    val=weave+slub*2.0+rr.normal(0,1.7,(size,size))
    arr=np.zeros((size,size,3),float)
    for c in range(3): arr[:,:,c]=base[c]+val
    img=Image.fromarray(np.uint8(np.clip(arr,0,255)),'RGB')
    h=Image.fromarray(np.uint8(np.clip(128+val*4.4,0,255)),'L')
    return img,normal_from_height(h,3.0)

def leather_texture(base,seed=3,size=128):
    rr=np.random.default_rng(seed); base=np.array(base,float)
    raw=np.asarray(Image.fromarray(np.uint8(rr.random((size,size))*255)).filter(ImageFilter.GaussianBlur(1.1)),float)
    grain=(raw-raw.mean())/(raw.std()+1e-9)
    arr=np.zeros((size,size,3),float)
    for c in range(3): arr[:,:,c]=base[c]+grain*4.5
    img=Image.fromarray(np.uint8(np.clip(arr,0,255)),'RGB'); d=ImageDraw.Draw(img)
    for _ in range(42):
        x=int(rr.integers(0,size)); y=int(rr.integers(0,size)); ln=int(rr.integers(8,34)); dy=int(rr.integers(-6,7))
        d.line((x,y,min(size-1,x+ln),max(0,min(size-1,y+dy))),fill=tuple(np.clip(base+9,0,255).astype(int)),width=1)
    h=Image.fromarray(np.uint8(np.clip(128+grain*18,0,255)),'L')
    return img,normal_from_height(h,2.15)

def hair_texture(seed=4,size=128):
    rr=np.random.default_rng(seed); yy,xx=np.mgrid[0:size,0:size]
    strands=(np.sin(xx*.52)+np.sin(xx*1.02+1.7)+np.sin(xx*1.91+.4)+np.sin(xx*2.65+2.2))*5.0
    bands=4.5*np.sin(yy*.055)+2.0*np.sin((xx*.12+yy*.045))
    noise=rr.normal(0,1.4,(size,size)); base=np.array([88,26,10],float)
    arr=np.zeros((size,size,3),float)
    for c in range(3): arr[:,:,c]=base[c]+strands+bands+noise+(12 if c==0 else 3 if c==1 else 0)
    img=Image.fromarray(np.uint8(np.clip(arr,0,255)),'RGB')
    h=Image.fromarray(np.uint8(np.clip(128+strands*4.5+noise*2.0,0,255)),'L')
    return img,normal_from_height(h,3.0)

def wood_texture(seed=5,size=128):
    rr=np.random.default_rng(seed); yy,xx=np.mgrid[0:size,0:size]
    grain=np.sin(yy*.14+np.sin(xx*.065)*2.8)*7+np.sin(yy*.039)*5.5+np.sin((yy+xx*.2)*.23)*1.7+rr.normal(0,1.5,(size,size))
    base=np.array([74,42,21],float); arr=np.zeros((size,size,3),float)
    for c in range(3): arr[:,:,c]=base[c]+grain
    img=Image.fromarray(np.uint8(np.clip(arr,0,255)),'RGB'); d=ImageDraw.Draw(img)
    for _ in range(10):
        cx=int(rr.integers(12,size-12)); cy=int(rr.integers(12,size-12)); rx=int(rr.integers(4,11)); ry=int(rr.integers(7,18));
        d.ellipse((cx-rx,cy-ry,cx+rx,cy+ry),outline=(48,27,14),width=2)
    h=Image.fromarray(np.uint8(np.clip(128+grain*4.2,0,255)),'L')
    return img,normal_from_height(h,2.3)

def straw_texture(seed=6,size=128):
    rr=np.random.default_rng(seed); yy,xx=np.mgrid[0:size,0:size]
    fiber=np.sin(xx*.48)*5+np.sin(xx*1.15+1.2)*3+rr.normal(0,2,(size,size)); base=np.array([86,52,27],float)
    arr=np.zeros((size,size,3),float)
    for c in range(3): arr[:,:,c]=base[c]+fiber-(yy/size)*7
    img=Image.fromarray(np.uint8(np.clip(arr,0,255)),'RGB')
    h=Image.fromarray(np.uint8(np.clip(128+fiber*4,0,255)),'L')
    return img,normal_from_height(h,2.4)

def save_set(name,pair,rough,roughseed,variation=.06,metal=.0):
    a,n=pair; r=packed_roughness(rough,a.size[0],roughseed,variation,metal)
    a.save(TEX/f'{name}-albedo.png',optimize=True); n.save(TEX/f'{name}-normal.png',optimize=True); r.save(TEX/f'{name}-roughness.png',optimize=True)
    return a,n,r

hat_a,hat_n,hat_r=save_set('witch-hat-felt',felt_texture([24,18,23],20),.91,21,.045)
cape_a,cape_n,cape_r=save_set('witch-cape-wool',wool_texture([18,17,20],22),.89,23,.055)
lining_a,lining_n,lining_r=save_set('witch-cape-lining',wool_texture([66,10,18],24),.80,25,.06)
leather_a,leather_n,leather_r=save_set('witch-leather-v3',leather_texture([22,19,21],26),.56,27,.07)
hair_a,hair_n,hair_r=save_set('witch-hair-v3',hair_texture(28),.50,29,.08)
wood_a,wood_n,wood_r=save_set('broom-wood-v3',wood_texture(30),.72,31,.08)
straw_a,straw_n,straw_r=save_set('broom-straw-v3',straw_texture(32),.93,33,.035)

# ---------- material helpers ----------
def pbr(name,color,rough,metal=0,base=None,normal=None,mr=None,double=False,em=None):
    return PBRMaterial(name=name,baseColorFactor=np.array(rgba(color),float)/255,metallicFactor=metal,roughnessFactor=rough,
                       baseColorTexture=base,normalTexture=normal,metallicRoughnessTexture=mr,doubleSided=double,
                       emissiveFactor=None if em is None else np.array(rgba(em)[:3],float)/255)
M={
 'hat':pbr('aged black felt','#20191f',.91,base=hat_a,normal=hat_n,mr=hat_r,double=True),
 'hatEdge':pbr('worn felt edge','#352a32',.86,base=hat_a,normal=hat_n,mr=hat_r,double=True),
 'cape':pbr('heavy charcoal wool','#1d1b20',.89,base=cape_a,normal=cape_n,mr=cape_r,double=True),
 'lining':pbr('oxblood wool lining','#550d17',.80,base=lining_a,normal=lining_n,mr=lining_r,double=True),
 'edge':pbr('worn cape seam','#3a2a31',.85,base=cape_a,normal=cape_n,mr=cape_r,double=True),
 'band':pbr('aged burgundy hat band','#4c0d16',.78,base=lining_a,normal=lining_n,mr=lining_r,double=True),
 'leather':pbr('creased black leather','#171519',.56,base=leather_a,normal=leather_n,mr=leather_r),
 'boot':pbr('scuffed riding boot','#0f0f11',.53,base=leather_a,normal=leather_n,mr=leather_r),
 'hair':pbr('deep auburn hair','#67230f',.50,base=hair_a,normal=hair_n,mr=hair_r,double=True),
 'hairHi':pbr('copper auburn hair','#8b3518',.47,base=hair_a,normal=hair_n,mr=hair_r,double=True),
 'wood':pbr('aged crooked ash broom','#553118',.72,base=wood_a,normal=wood_n,mr=wood_r),
 'straw':pbr('dark broom straw','#6a3d1d',.93,base=straw_a,normal=straw_n,mr=straw_r,double=True),
 'skin':pbr('shadowed moonlit skin','#745346',.72),
 'brass':pbr('tarnished brass','#6d4d2a',.38,.70),
 'cord':pbr('aged binding cord','#3d2519',.87),
 'ember':pbr('restrained ember','#2c1207',.54,em='#ff5f12')
}

# ---------- geometry helpers ----------
def T(pos=(0,0,0),rot=None,scale=None):
    m=np.eye(4)
    if scale is not None: m=(scale_matrix(scale) if np.isscalar(scale) else np.diag([*scale,1]))@m
    if rot:
        for axis,ang in rot: m=rotation_matrix(math.radians(ang),{'x':[1,0,0],'y':[0,1,0],'z':[0,0,1]}[axis])@m
    return translation_matrix(pos)@m

def uv_for(mesh,axes=(0,2),scale=(1.2,1.2)):
    v=np.asarray(mesh.vertices,float); uv=v[:,list(axes)].copy(); uv[:,0]*=scale[0]; uv[:,1]*=scale[1]; uv-=np.floor(uv); return uv

def add(scene,mesh,name,material,transform=None,parent=None,axes=(0,2),uvscale=(1.2,1.2)):
    mesh=mesh.copy()
    try: mesh.visual=TextureVisuals(uv=uv_for(mesh,axes,uvscale),material=material)
    except Exception: mesh.visual.material=material
    scene.add_geometry(mesh,node_name=name,geom_name=name,parent_node_name=parent,transform=np.eye(4) if transform is None else transform)

def group(scene,name,parent=None,transform=None):
    scene.graph.update(frame_to=name,frame_from=parent or scene.graph.base_frame,matrix=np.eye(4) if transform is None else transform)

def cylinder_between(a,b,r,sections=16):
    a=np.array(a,float); b=np.array(b,float); vec=b-a; L=np.linalg.norm(vec); mesh=trimesh.creation.cylinder(radius=r,height=L,sections=sections)
    z=np.array([0,0,1.]); n=vec/L; axis=np.cross(z,n); dot=np.clip(np.dot(z,n),-1,1); R=np.eye(4)
    if np.linalg.norm(axis)>1e-8: R=rotation_matrix(math.acos(dot),axis/np.linalg.norm(axis))
    elif dot<0: R=rotation_matrix(math.pi,[1,0,0])
    return mesh,translation_matrix((a+b)/2)@R

def tapered_tube(points,radii,radial=8,cap=True):
    p=np.asarray(points,float); radii=np.asarray(radii,float); verts=[]
    rings=[]
    for i,pt in enumerate(p):
        t=(p[1]-p[0]) if i==0 else (p[-1]-p[-2]) if i==len(p)-1 else (p[i+1]-p[i-1]); t=t/(np.linalg.norm(t)+1e-9)
        ref=np.array([0,1,0.])
        if abs(np.dot(t,ref))>.88: ref=np.array([1,0,0.])
        u=np.cross(t,ref); u/=np.linalg.norm(u)+1e-9; v=np.cross(t,u); v/=np.linalg.norm(v)+1e-9
        ring=[]
        for a in np.linspace(0,2*math.pi,radial,endpoint=False): ring.append(len(verts)); verts.append(pt+(u*math.cos(a)+v*math.sin(a))*radii[i])
        rings.append(ring)
    faces=[]
    for i in range(len(p)-1):
        for j in range(radial): k=(j+1)%radial; a=rings[i][j]; b=rings[i][k]; c=rings[i+1][j]; d=rings[i+1][k]; faces += [[a,c,b],[b,c,d]]
    if cap:
        a0=len(verts); verts.append(p[0]); a1=len(verts); verts.append(p[-1])
        for j in range(radial): k=(j+1)%radial; faces += [[a0,rings[0][k],rings[0][j]],[a1,rings[-1][j],rings[-1][k]]]
    return trimesh.Trimesh(np.array(verts),np.array(faces),process=True)

def frustum(r0,r1,h,sections=32):
    ang=np.linspace(0,2*math.pi,sections,endpoint=False); v=[]
    for y,r in [(-h/2,r0),(h/2,r1)]:
        for a in ang: v.append([math.cos(a)*r,y,math.sin(a)*r])
    faces=[]
    for i in range(sections): j=(i+1)%sections; faces += [[i,j,sections+i],[j,sections+j,sections+i]]
    return trimesh.Trimesh(np.array(v),np.array(faces),process=True)

def warped_brim(rx=.80,rz=.70,thickness=.055,segments=64,rings=5):
    verts=[]; faces=[]
    def ywarp(r,a): return .022*math.sin(a*2.0+.4)*r + .028*math.sin(a*3.0-1.1)*(r**2) + .012*math.cos(a*5.0)*r
    # top/bottom radial grids
    for layer,sign in [(0,1),(1,-1)]:
        for ir in range(rings):
            rr=.25 + (.75*ir/(rings-1))
            for i in range(segments):
                a=2*math.pi*i/segments; asym=1 + .035*math.sin(a*3.0+.8)+.018*math.cos(a*5.0)
                x=rx*rr*math.cos(a)*asym; z=rz*rr*math.sin(a)*(1+.03*math.sin(a*2.0)); y=ywarp(rr,a)+sign*thickness/2
                verts.append([x,y,z])
    layer_count=rings*segments
    for layer in range(2):
        base=layer*layer_count
        for ir in range(rings-1):
            for i in range(segments):
                j=(i+1)%segments; a=base+ir*segments+i; b=base+ir*segments+j; c=base+(ir+1)*segments+i; d=base+(ir+1)*segments+j
                faces += ([[a,c,b],[b,c,d]] if layer==0 else [[a,b,c],[b,d,c]])
    # connect outer and inner walls
    for ir in [0,rings-1]:
        for i in range(segments):
            j=(i+1)%segments; a=ir*segments+i; b=ir*segments+j; c=layer_count+ir*segments+i; d=layer_count+ir*segments+j
            faces += [[a,b,c],[b,d,c]] if ir==rings-1 else [[a,c,b],[b,c,d]]
    return trimesh.Trimesh(np.array(verts),np.array(faces),process=True)

def brim_outer_points(rx=.80,rz=.70,segments=64):
    pts=[]
    for i in range(segments):
        a=2*math.pi*i/segments; asym=1 + .035*math.sin(a*3.0+.8)+.018*math.cos(a*5.0)
        rr=1; x=rx*math.cos(a)*asym; z=rz*math.sin(a)*(1+.03*math.sin(a*2.0)); y=.022*math.sin(a*2.0+.4)+.028*math.sin(a*3.0-1.1)+.012*math.cos(a*5.0)
        pts.append([x,y,z])
    return pts

def cape_panel(u0,u1,rows=14,cols=6,lining=False):
    verts=[]; faces=[]
    for j in range(rows):
        f=j/(rows-1); half=.48 + .82*(f**.92); trail=2.25*(f**1.02); drop=-.10*f-.72*(f**1.48)
        for i in range(cols):
            q=i/(cols-1); u=u0+(u1-u0)*q; x=u*half
            fold=(.035+.075*f)*math.sin((u+1)*math.pi*3.05 + j*.23) + .018*math.sin(j*.82+u*4.1)
            rag=0
            if j==rows-1: rag=.12*math.sin((u+1)*13.7)+.06*math.sin((u+1)*23.0)
            y=drop+fold+rag + (.014 if lining else 0)
            z=trail + .035*math.sin(u*5.2)*(f**1.3) - (.018 if lining else 0)
            verts.append([x,y,z])
    for j in range(rows-1):
        for i in range(cols-1):
            a=j*cols+i; b=a+1; c=a+cols; d=c+1
            faces += [[a,c,b],[b,c,d]] if not lining else [[a,b,c],[b,d,c]]
    return trimesh.Trimesh(np.array(verts),np.array(faces),process=False)

def cape_edge_path(u,rows=14):
    pts=[]
    for j in range(rows):
        f=j/(rows-1); half=.48+.82*(f**.92); trail=2.25*(f**1.02); drop=-.10*f-.72*(f**1.48)
        fold=(.035+.075*f)*math.sin((u+1)*math.pi*3.05+j*.23)+.018*math.sin(j*.82+u*4.1)
        rag=.12*math.sin((u+1)*13.7)+.06*math.sin((u+1)*23.0) if j==rows-1 else 0
        pts.append([u*half,drop+fold+rag,trail+.035*math.sin(u*5.2)*(f**1.3)])
    return pts

def hair_lock(seed,x,length,lean=.0,rootz=.17):
    rr=np.random.default_rng(seed); meshes=[]
    # 7 bundled tubes per animated lock, with tapered tips
    for k in range(7):
        off=(k-3)*.024 + rr.normal(0,.007); pts=[]
        for j in range(11):
            f=j/10; sway=math.sin(f*math.pi*1.35+seed*.17+k*.33)*(.035+.065*f)+lean*f
            pts.append([off+sway,-.05*f-.34*f*f + .018*math.sin(f*7+k), length*f + .025*math.sin(f*5+k*.8)])
        meshes.append(tapered_tube(pts,np.linspace(.036 if k in [2,3,4] else .029,.0055,11),6))
    return trimesh.util.concatenate(meshes)

def root_hair_tube(angle,side=1):
    # follows the skull from crown to nape/shoulder, eliminating the exposed sphere read
    a=angle; x0=.29*math.sin(a)*side; z0=.20+.14*math.cos(a); y0=1.68-.06*abs(math.sin(a))
    pts=[]
    for j in range(8):
        f=j/7; pts.append([x0*(1-.18*f)+side*.12*f,y0-.82*f-.06*f*f,z0+.22*f+.03*math.sin(f*6+a)])
    return tapered_tube(pts,np.linspace(.065,.018,8),7)

def boot_shape():
    return trimesh.creation.capsule(height=.42,radius=.13,count=[8,14])

s=trimesh.Scene()

# ---------- body silhouette ----------
add(s,trimesh.creation.capsule(height=1.00,radius=.36,count=[12,24]),'body_core',M['cape'],T((0,.40,0),scale=(1.15,1.18,.88)),axes=(0,1),uvscale=(2.2,2.2))
add(s,frustum(.74,.34,1.28,34),'coat_skirt',M['cape'],T((0,-.30,.09)),axes=(0,1),uvscale=(2.2,2.2))
add(s,trimesh.creation.box([.032,.92,.050]),'coat_back_seam',M['edge'],T((0,.37,.365)),axes=(0,1),uvscale=(4,3))
for side in (-1,1):
    add(s,trimesh.creation.icosphere(subdivisions=2,radius=.25),f'shoulder_{side}',M['cape'],T((side*.40,.82,-.01),scale=(1.14,.68,.94)))
    add(s,trimesh.creation.box([.32,.045,.12]),f'shoulder_seam_{side}',M['edge'],T((side*.37,.93,.05),rot=[('z',side*6)]))
add(s,trimesh.creation.cylinder(radius=.44,height=.10,sections=30),'belt',M['leather'],T((0,.16,0)),axes=(0,2),uvscale=(4,2))
add(s,trimesh.creation.box([.19,.16,.065]),'belt_buckle',M['brass'],T((0,.16,-.40)))
# high collar hides nape and prevents floating-head read
add(s,frustum(.20,.16,.34,26),'high_collar',M['band'],T((0,1.08,.02),rot=[('x',-4)]),axes=(0,1),uvscale=(4,3))
# only a restrained partial head volume remains; most of it is buried in hair/hat
add(s,trimesh.creation.icosphere(subdivisions=3,radius=.285),'head_shadow',M['skin'],T((0,1.48,-.105),scale=(.86,1.02,.82)))
# narrow visible nape only
add(s,trimesh.creation.cylinder(radius=.095,height=.16,sections=18),'nape',M['skin'],T((0,1.18,-.03),scale=(1,.95,.78)))

# arms / gloves / legs
for side in (-1,1):
    a=(side*.33,.82,-.02); b=(side*.61,.24,-.38); mesh,tr=cylinder_between(a,b,.13,20); add(s,mesh,f'upper_arm_{side}',M['cape'],tr,axes=(0,1),uvscale=(4,3))
    add(s,trimesh.creation.cylinder(radius=.14,height=.11,sections=18),f'cuff_{side}',M['band'],T(b,rot=[('x',70)]))
    c=(side*.37,-.11,-.57); mesh,tr=cylinder_between(b,c,.100,18); add(s,mesh,f'forearm_{side}',M['leather'],tr,axes=(0,1),uvscale=(4,3))
    add(s,trimesh.creation.icosphere(subdivisions=2,radius=.115),f'glove_{side}',M['leather'],T(c,scale=(1,.8,1.12)))
    for finger in range(4):
        p0=np.array(c)+np.array([side*(.012+finger*.014),-.01,-.015-finger*.010]); p1=p0+np.array([side*.018,-.075,-.065]); fm,ft=cylinder_between(p0,p1,.014,7); add(s,fm,f'glove_finger_{side}_{finger}',M['leather'],ft)
    hip=(side*.27,-.40,.02); knee=(side*.44,-.86,.34); ankle=(side*.33,-1.07,-.10); mesh,tr=cylinder_between(hip,knee,.15,18); add(s,mesh,f'thigh_{side}',M['cape'],tr)
    mesh,tr=cylinder_between(knee,ankle,.125,18); add(s,mesh,f'shin_{side}',M['leather'],tr)
    add(s,boot_shape(),f'boot_{side}',M['boot'],T((ankle[0],ankle[1]-.11,ankle[2]-.17),rot=[('x',78)],scale=(1,1,1.38)))

# ---------- hair: root mass + five animated lock groups ----------
# root tubes blanket back/sides of skull and nape
for side in (-1,1):
    for k,a in enumerate(np.linspace(-1.2,1.2,8)):
        add(s,root_hair_tube(a,side),f'hair_root_{side}_{k}',M['hairHi'] if k in (2,5) else M['hair'],T((0,0,0)),axes=(0,2),uvscale=(3.2,1.4))
# shoulder-covering underlayers
for side in (-1,1):
    for k in range(4):
        x=side*(.16+.065*k); pts=[[0,0,0],[side*.025,-.20,.20],[side*.055,-.48,.48],[side*.08,-.72,.72]]
        add(s,tapered_tube(pts,[.052,.045,.026,.008],7),f'hair_under_{side}_{k}',M['hair'],T((x,1.52,.18+k*.012)),axes=(0,2),uvscale=(3,1.2))
# five motion roots, each with multiple child strands
lock_specs=[(-.31,1.36,-.05),(-.17,1.52,.02),(0,1.68,0),(.17,1.53,-.02),(.31,1.38,.05)]
for i,(x,length,lean) in enumerate(lock_specs,1):
    name=f'hair_{i:02d}'; group(s,name,transform=T((x,1.56,.21),rot=[('z',(i-3)*2.2)]))
    add(s,hair_lock(100+i,x,length,lean),f'{name}_strands',M['hairHi'] if i in (2,4) else M['hair'],parent=name,axes=(0,2),uvscale=(3,1.2))
# restrained flyaways
for i in range(10):
    side=-1 if i%2==0 else 1; x=side*(.23+.018*(i%4)); pts=[[0,0,0],[side*.05,-.12,.16],[side*(.10+.01*i),-.34,.36],[side*(.14+.015*i),-.58,.54]]
    add(s,tapered_tube(pts,[.011,.009,.006,.0025],5),f'hair_flyaway_{i}',M['hairHi'],T((x,1.55,.18+.01*i)),axes=(0,2),uvscale=(3,1.2))

# ---------- handmade hat ----------
add(s,warped_brim(),'hat_brim',M['hat'],T((0,1.79,-.07),rot=[('z',1.2),('x',-1.8)]),axes=(0,2),uvscale=(2.5,2.5))
# stitched/worn brim edge follows warped outer silhouette
edge_pts=brim_outer_points(); edge_pts.append(edge_pts[0])
add(s,tapered_tube(edge_pts,[.017]*len(edge_pts),5),'hat_brim_edge',M['hatEdge'],T((0,1.79,-.07),rot=[('z',1.2),('x',-1.8)]),axes=(0,2),uvscale=(4,2))
# bent crown built as a crooked taper, not a cone
crown_pts=[[0,0,0],[-.025,.17,.006],[-.06,.35,.018],[-.10,.51,.034],[-.15,.66,.052],[-.20,.79,.070]]
add(s,tapered_tube(crown_pts,[.39,.37,.33,.285,.235,.18],24),'hat_crown',M['hat'],T((.02,1.82,-.07),rot=[('z',-3.0)]),axes=(0,1),uvscale=(2.4,2.1))
# subtle crown wrinkle cords
for j in range(4):
    y=.14+j*.15; ring=[]
    for i in range(42):
        a=2*math.pi*i/42; r=.36-j*.045; ring.append([math.cos(a)*r,y,math.sin(a)*r*(.94+.025*math.sin(a*3))])
    ring.append(ring[0]); add(s,tapered_tube(ring,[.008]*len(ring),4),f'hat_wrinkle_{j}',M['hatEdge'],T((.00,1.82,-.07),rot=[('z',-3.0)]),axes=(0,2),uvscale=(5,2))
# motion node for drooping twisted tip
group(s,'hat_tip',transform=T((-.18,2.60,-.005),rot=[('z',-4)]))
tip_pts=[[0,0,0],[-.06,.13,.025],[-.15,.24,.06],[-.25,.33,.10],[-.36,.38,.15],[-.44,.34,.20]]
add(s,tapered_tube(tip_pts,[.18,.15,.115,.082,.050,.018],18),'hat_tip_mesh',M['hat'],parent='hat_tip',axes=(0,1),uvscale=(2.6,2.0))
# burgundy band + buckle frame and pin
add(s,trimesh.creation.cylinder(radius=.405,height=.075,sections=42),'hat_band',M['band'],T((0,1.93,-.07),scale=(1,.65,.94)),axes=(0,2),uvscale=(4,2))
for dx,dz in [(-.075,-.04),(.075,-.04),(-.075,.04),(.075,.04)]:
    pass
# buckle frame from 4 slim bars on camera/rear side
for name,pos,scale in [('top',(.27,1.955,.31),(.18,.018,.018)),('bottom',(.27,1.875,.31),(.18,.018,.018)),('left',(.19,1.915,.31),(.018,.10,.018)),('right',(.35,1.915,.31),(.018,.10,.018))]:
    add(s,trimesh.creation.box(scale),f'hat_buckle_{name}',M['brass'],T(pos,rot=[('z',-7)]))
add(s,trimesh.creation.box([.012,.075,.012]),'hat_buckle_pin',M['brass'],T((.27,1.915,.323),rot=[('z',-7)]))

# ---------- heavy 3-section cape ----------
group(s,'cape',transform=T((0,.92,.24),rot=[('x',2)]))
sections=[('cape_left',-1.0,-.25),('cape_center',-.31,.31),('cape_right',.25,1.0)]
for name,u0,u1 in sections:
    group(s,name,parent='cape')
    add(s,cape_panel(u0,u1,lining=False),f'{name}_outer',M['cape'],parent=name,axes=(0,2),uvscale=(1.7,1.5))
    add(s,cape_panel(u0,u1,lining=True),f'{name}_lining',M['lining'],parent=name,axes=(0,2),uvscale=(1.7,1.5))
# side hem cords + lower ragged seam gives thickness/readability
for idx,u in enumerate([-1,-.25,.25,1]):
    path=cape_edge_path(u); add(s,tapered_tube(path,np.linspace(.019,.011,len(path)),5),f'cape_seam_{idx}',M['edge'],parent='cape',axes=(0,2),uvscale=(4,2))
# shoulder tabs secure cape physically
for side in (-1,1):
    add(s,trimesh.creation.box([.22,.05,.14]),f'cape_clasp_tab_{side}',M['leather'],T((side*.30,.93,.19),rot=[('z',side*7)]))
    add(s,trimesh.creation.cylinder(radius=.055,height=.035,sections=18),f'cape_clasp_{side}',M['brass'],T((side*.30,.96,.26),rot=[('x',90)]))

# ---------- crooked handmade broom ----------
group(s,'broom_handle',transform=T((0,-.81,.15)))
handle_pts=[[-.04,.02,-2.65],[-.02,.00,-1.75],[.015,-.012,-.80],[-.01,.015,.15],[.028,.00,1.05],[-.012,-.018,1.92],[.045,.015,2.72]]
add(s,tapered_tube(handle_pts,[.049,.052,.050,.054,.050,.047,.044],14),'broom_shaft',M['wood'],parent='broom_handle',axes=(2,1),uvscale=(5.5,1.2))
# worn hand contact wraps/polish sections
for i,z in enumerate([-.62,-.36]):
    add(s,trimesh.creation.cylinder(radius=.055,height=.26,sections=20),f'broom_grip_wear_{i}',M['leather'],T((.0,0,z),rot=[('x',90)]),parent='broom_handle',axes=(0,1),uvscale=(3,2))
# dark knots raised slightly from shaft
for i,(x,y,z) in enumerate([(.044,.01,-1.42),(-.048,-.006,.72),(.040,.004,1.62)]):
    add(s,trimesh.creation.icosphere(subdivisions=1,radius=.032),f'broom_knot_{i}',M['wood'],T((x,y,z),scale=(1,.65,1.25)),parent='broom_handle')
# bristle group attaches to handle, can lag independently
group(s,'broom_bristles',parent='broom_handle',transform=T((.045,.015,2.68)))
# brass ferrule + cord wrappings
add(s,trimesh.creation.torus(major_radius=.092,minor_radius=.020,major_sections=28,minor_sections=8),'broom_ferrule',M['brass'],T((0,0,.03),rot=[('x',90)]),parent='broom_bristles')
for j in range(4):
    add(s,trimesh.creation.torus(major_radius=.105+j*.006,minor_radius=.010,major_sections=24,minor_sections=6),f'broom_cord_{j}',M['cord'],T((0,0,.08+j*.038),rot=[('x',90)]),parent='broom_bristles')
# 72 individual twig/straw strands; varied length, bend and thickness
for i in range(72):
    a=2*math.pi*(i/72)+RNG.normal(0,.035); ring=(i%3); r0=.045+.021*ring+RNG.uniform(-.007,.007)
    sx=math.cos(a)*r0; sy=math.sin(a)*r0*.72; length=1.02+RNG.uniform(-.13,.24)
    flare=.18+RNG.uniform(.02,.16); ex=math.cos(a)*flare+RNG.normal(0,.035); ey=math.sin(a)*flare*.72+RNG.normal(0,.022)
    bend=RNG.normal(0,.045); pts=[[sx,sy,.10],[sx*.88+ex*.12,sy*.88+ey*.12,.34],[sx*.60+ex*.40+bend,sy*.60+ey*.40,.66],[ex+bend*.5,ey,length]]
    rad=RNG.uniform(.010,.018); add(s,tapered_tube(pts,[rad,rad*.82,rad*.56,.0027],5),f'broom_bristle_{i:02d}',M['straw'],parent='broom_bristles',axes=(2,1),uvscale=(5,1))
# restrained ember coals/sparks, not a flame plume
for k in range(4):
    add(s,trimesh.creation.icosphere(subdivisions=1,radius=.055-.006*k),f'ember_coal_{k}',M['ember'],T((-.05+.035*k,-.015,1.07+.13*k),scale=(1,.55,1.35)),parent='broom_bristles')

# export with explicit normals
glb=gltf.export_glb(s,include_normals=True,unitize_normals=True)
model_path=OUT/'witch-rider.glb'; model_path.write_bytes(glb)

# lightweight GLB metadata extraction for manifest
magic,version,total=struct.unpack_from('<4sII',glb,0)
manifest={
 'version':'witch-material-pass-v2', 'build_version':'witch-realism-pass-v3', 'build':'pass-11-witch-centerpiece', 'file':'witch-rider.glb','bytes':len(glb),
 'required_motion_nodes':['cape','cape_left','cape_center','cape_right','hair_01','hair_02','hair_03','hair_04','hair_05','hat_tip','broom_handle','broom_bristles'],
 'hair_lock_count':5,'hair_root_tube_count':24,'broom_bristle_count':72,'cape_panel_count':3,
 'features':['warped thick felt brim','bent non-cone crown','animated drooping hat tip','stitched brim edge','high collar and concealed rear head','auburn root mass','five multi-strand animated hair locks','flyaways','three-section heavy wool cape','oxblood lining','ragged hem seams','cape clasps','crooked tapered wood broom','wood knots and hand wear','brass and cord binding','72 individual straw bristles','restrained ember coals','PBR roughness maps'],
 'textures':sorted(p.name for p in TEX.glob('*-v3-*.png'))+sorted(p.name for p in TEX.glob('witch-hat-felt-*.png'))+sorted(p.name for p in TEX.glob('witch-cape-*.png')),
 'glb_magic':magic.decode('ascii'),'glb_version':version,'scene_nodes':len(s.graph.nodes),'geometry_nodes':len(s.graph.nodes_geometry)
}
(ROOT/'assets'/'witch-material-pass.json').write_text(json.dumps(manifest,indent=2))
print(json.dumps(manifest,indent=2))
