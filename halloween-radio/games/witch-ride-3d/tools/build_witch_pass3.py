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
RNG=np.random.default_rng(26090713)

# ---------- texture generation ----------
def rgba(h,a=255):
    h=h.lstrip('#'); return [int(h[i:i+2],16) for i in (0,2,4)]+[a]

def normal_from_height(height,strength=3.0):
    h=np.asarray(height,dtype=float)/255.0; gy,gx=np.gradient(h)
    nx=-gx*strength; ny=-gy*strength; nz=np.ones_like(nx); n=np.sqrt(nx*nx+ny*ny+nz*nz)+1e-9
    return Image.fromarray(np.dstack([(nx/n*.5+.5)*255,(ny/n*.5+.5)*255,(nz/n*.5+.5)*255]).astype(np.uint8),'RGB')

def packed_roughness(rough,size=192,seed=1,variation=.08,metal=.0):
    rr=np.random.default_rng(seed); base=np.clip(rough+rr.normal(0,variation,(size,size)),0,1)
    base=np.asarray(Image.fromarray(np.uint8(base*255)).filter(ImageFilter.GaussianBlur(.7)),dtype=np.uint8)
    arr=np.zeros((size,size,3),dtype=np.uint8); arr[:,:,0]=255; arr[:,:,1]=base; arr[:,:,2]=np.uint8(np.clip(metal,0,1)*255)
    return Image.fromarray(arr,'RGB')

def felt_texture(base,seed=1,size=192):
    rr=np.random.default_rng(seed); base=np.array(base,float); yy,xx=np.mgrid[0:size,0:size]
    fine=rr.normal(0,3.0,(size,size)); coarse=np.asarray(Image.fromarray(np.uint8(rr.random((size,size))*255)).filter(ImageFilter.GaussianBlur(3.2)),float)
    coarse=(coarse-coarse.mean())/(coarse.std()+1e-9); nap=1.5*np.sin(xx*.29+np.sin(yy*.041)*1.8)+.9*np.sin((xx+yy)*.15)
    val=fine+coarse*2.0+nap; arr=np.zeros((size,size,3),float)
    for c in range(3): arr[:,:,c]=base[c]+val
    img=Image.fromarray(np.uint8(np.clip(arr,0,255)),'RGB'); h=Image.fromarray(np.uint8(np.clip(128+val*3.0,0,255)),'L')
    return img,normal_from_height(h,1.65)

def wool_texture(base,seed=2,size=192):
    rr=np.random.default_rng(seed); base=np.array(base,float); yy,xx=np.mgrid[0:size,0:size]
    weave=np.sin(xx*np.pi/2.2)*1.55+np.sin(yy*np.pi/2.6)*1.35+np.sin((xx+yy)*np.pi/8.5)*.7
    slub=np.asarray(Image.fromarray(np.uint8(rr.random((size,size))*255)).filter(ImageFilter.GaussianBlur(1.8)),float); slub=(slub-slub.mean())/(slub.std()+1e-9)
    val=weave+slub*1.55+rr.normal(0,1.0,(size,size)); arr=np.zeros((size,size,3),float)
    for c in range(3): arr[:,:,c]=base[c]+val
    img=Image.fromarray(np.uint8(np.clip(arr,0,255)),'RGB'); h=Image.fromarray(np.uint8(np.clip(128+val*3.0,0,255)),'L')
    return img,normal_from_height(h,1.65)

def leather_texture(base,seed=3,size=192):
    rr=np.random.default_rng(seed); base=np.array(base,float)
    raw=np.asarray(Image.fromarray(np.uint8(rr.random((size,size))*255)).filter(ImageFilter.GaussianBlur(1.15)),float); grain=(raw-raw.mean())/(raw.std()+1e-9)
    arr=np.zeros((size,size,3),float)
    for c in range(3): arr[:,:,c]=base[c]+grain*3.1
    img=Image.fromarray(np.uint8(np.clip(arr,0,255)),'RGB'); d=ImageDraw.Draw(img)
    for _ in range(42):
        x=int(rr.integers(0,size)); y=int(rr.integers(0,size)); ln=int(rr.integers(10,45)); dy=int(rr.integers(-8,9))
        d.line((x,y,min(size-1,x+ln),max(0,min(size-1,y+dy))),fill=tuple(np.clip(base+7,0,255).astype(int)),width=1)
    h=Image.fromarray(np.uint8(np.clip(128+grain*12,0,255)),'L'); return img,normal_from_height(h,1.65)

def hair_texture(seed=4,size=192):
    rr=np.random.default_rng(seed); yy,xx=np.mgrid[0:size,0:size]
    strands=(np.sin(xx*.32)+np.sin(xx*.69+1.6)+np.sin(xx*1.28+.3))*3.1
    broad=2.4*np.sin(yy*.043)+1.5*np.sin(xx*.075+yy*.033); noise=rr.normal(0,.8,(size,size)); base=np.array([58,16,7],float)
    arr=np.zeros((size,size,3),float)
    for c in range(3): arr[:,:,c]=base[c]+strands+broad+noise+(11 if c==0 else 3 if c==1 else 0)
    img=Image.fromarray(np.uint8(np.clip(arr,0,255)),'RGB'); h=Image.fromarray(np.uint8(np.clip(128+strands*2.8+noise*1.5,0,255)),'L')
    return img,normal_from_height(h,1.55)

def wood_texture(seed=5,size=192):
    rr=np.random.default_rng(seed); yy,xx=np.mgrid[0:size,0:size]
    grain=np.sin(yy*.13+np.sin(xx*.055)*3.1)*7.2+np.sin(yy*.035)*5.1+np.sin((yy+xx*.2)*.22)*1.8+rr.normal(0,1.4,(size,size))
    base=np.array([70,38,18],float); arr=np.zeros((size,size,3),float)
    for c in range(3): arr[:,:,c]=base[c]+grain
    img=Image.fromarray(np.uint8(np.clip(arr,0,255)),'RGB'); d=ImageDraw.Draw(img)
    for _ in range(14):
        cx=int(rr.integers(14,size-14)); cy=int(rr.integers(14,size-14)); rx=int(rr.integers(4,12)); ry=int(rr.integers(8,22)); d.ellipse((cx-rx,cy-ry,cx+rx,cy+ry),outline=(43,23,11),width=2)
    h=Image.fromarray(np.uint8(np.clip(128+grain*4.0,0,255)),'L'); return img,normal_from_height(h,2.0)

def straw_texture(seed=6,size=192):
    rr=np.random.default_rng(seed); yy,xx=np.mgrid[0:size,0:size]
    fiber=np.sin(xx*.42)*4.2+np.sin(xx*1.06+1.2)*2.4+rr.normal(0,1.5,(size,size)); base=np.array([72,40,19],float)
    arr=np.zeros((size,size,3),float)
    for c in range(3): arr[:,:,c]=base[c]+fiber-(yy/size)*7
    img=Image.fromarray(np.uint8(np.clip(arr,0,255)),'RGB'); h=Image.fromarray(np.uint8(np.clip(128+fiber*3.4,0,255)),'L')
    return img,normal_from_height(h,1.8)

def save_set(name,pair,rough,roughseed,variation=.06,metal=.0):
    a,n=pair; r=packed_roughness(rough,a.size[0],roughseed,variation,metal)
    a.save(TEX/f'{name}-albedo.png',optimize=True); n.save(TEX/f'{name}-normal.png',optimize=True); r.save(TEX/f'{name}-roughness.png',optimize=True)
    return a,n,r

hat_a,hat_n,hat_r=save_set('witch-hat-felt',felt_texture([20,16,21],20),.96,21,.022)
cape_a,cape_n,cape_r=save_set('witch-cape-wool',wool_texture([24,24,27],22),.97,23,.022)
lining_a,lining_n,lining_r=save_set('witch-cape-lining',wool_texture([48,8,14],24),.94,25,.025)
leather_a,leather_n,leather_r=save_set('witch-leather-v3',leather_texture([22,20,21],26),.76,27,.040)
hair_a,hair_n,hair_r=save_set('witch-hair-v3',hair_texture(28),.78,29,.035)
wood_a,wood_n,wood_r=save_set('broom-wood-v3',wood_texture(30),.82,31,.045)
straw_a,straw_n,straw_r=save_set('broom-straw-v3',straw_texture(32),.97,33,.020)

# ---------- materials ----------
def pbr(name,color,rough,metal=0,base=None,normal=None,mr=None,double=False,em=None):
    return PBRMaterial(name=name,baseColorFactor=np.array(rgba(color),float)/255,metallicFactor=metal,roughnessFactor=rough,
        baseColorTexture=base,normalTexture=normal,metallicRoughnessTexture=mr,doubleSided=double,
        emissiveFactor=None if em is None else np.array(rgba(em)[:3],float)/255)
M={
 'hat':pbr('aged black felt','#181519',.96,base=hat_a,normal=hat_n,mr=hat_r,double=True),
 'hatEdge':pbr('worn felt edge','#2a2328',.94,base=hat_a,normal=hat_n,mr=hat_r,double=True),
 'cape':pbr('heavy charcoal wool','#1b1b1f',.97,base=cape_a,normal=cape_n,mr=cape_r,double=True),
 'lining':pbr('oxblood wool lining','#360910',.94,base=lining_a,normal=lining_n,mr=lining_r,double=True),
 'edge':pbr('worn cape seam','#30262b',.95,base=cape_a,normal=cape_n,mr=cape_r,double=True),
 'band':pbr('aged burgundy hat band','#4a1019',.90,base=lining_a,normal=lining_n,mr=lining_r,double=True),
 'leather':pbr('creased black leather','#171517',.76,base=leather_a,normal=leather_n,mr=leather_r),
 'boot':pbr('scuffed riding boot','#101012',.78,base=leather_a,normal=leather_n,mr=leather_r),
 'hair':pbr('deep auburn hair','#4c1608',.78,base=hair_a,normal=hair_n,mr=hair_r,double=True),
 'hairHi':pbr('copper auburn hair','#6d2812',.73,base=hair_a,normal=hair_n,mr=hair_r,double=True),
 'wood':pbr('aged crooked ash broom','#4a2713',.82,base=wood_a,normal=wood_n,mr=wood_r),
 'straw':pbr('dark broom straw','#553018',.97,base=straw_a,normal=straw_n,mr=straw_r,double=True),
 'skin':pbr('shadowed moonlit skin','#5d443d',.84), 'brass':pbr('tarnished brass','#624522',.52,.55),
 'cord':pbr('aged binding cord','#362116',.94), 'ember':pbr('restrained ember','#261006',.68,em='#f04a0d')
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

def group(scene,name,parent=None,transform=None): scene.graph.update(frame_to=name,frame_from=parent or scene.graph.base_frame,matrix=np.eye(4) if transform is None else transform)

def cylinder_between(a,b,r,sections=16):
    a=np.array(a,float); b=np.array(b,float); vec=b-a; L=np.linalg.norm(vec); mesh=trimesh.creation.cylinder(radius=r,height=L,sections=sections)
    z=np.array([0,0,1.]); n=vec/L; axis=np.cross(z,n); dot=np.clip(np.dot(z,n),-1,1); R=np.eye(4)
    if np.linalg.norm(axis)>1e-8: R=rotation_matrix(math.acos(dot),axis/np.linalg.norm(axis))
    elif dot<0: R=rotation_matrix(math.pi,[1,0,0])
    return mesh,translation_matrix((a+b)/2)@R

def tapered_tube(points,radii,radial=8,cap=True):
    p=np.asarray(points,float); radii=np.asarray(radii,float); verts=[]; rings=[]
    for i,pt in enumerate(p):
        t=(p[1]-p[0]) if i==0 else (p[-1]-p[-2]) if i==len(p)-1 else (p[i+1]-p[i-1]); t=t/(np.linalg.norm(t)+1e-9)
        ref=np.array([0,1,0.]); ref=np.array([1,0,0.]) if abs(np.dot(t,ref))>.88 else ref
        u=np.cross(t,ref); u/=np.linalg.norm(u)+1e-9; v=np.cross(t,u); v/=np.linalg.norm(v)+1e-9; ring=[]
        for a in np.linspace(0,2*math.pi,radial,endpoint=False): ring.append(len(verts)); verts.append(pt+(u*math.cos(a)+v*math.sin(a))*radii[i])
        rings.append(ring)
    faces=[]
    for i in range(len(p)-1):
        for j in range(radial):
            k=(j+1)%radial; a,b,c,d=rings[i][j],rings[i][k],rings[i+1][j],rings[i+1][k]; faces += [[a,c,b],[b,c,d]]
    if cap:
        a0=len(verts); verts.append(p[0]); a1=len(verts); verts.append(p[-1])
        for j in range(radial):
            k=(j+1)%radial; faces += [[a0,rings[0][k],rings[0][j]],[a1,rings[-1][j],rings[-1][k]]]
    return trimesh.Trimesh(np.array(verts),np.array(faces),process=True)

def frustum(r0,r1,h,sections=32):
    ang=np.linspace(0,2*math.pi,sections,endpoint=False); v=[]
    for y,r in [(-h/2,r0),(h/2,r1)]:
        for a in ang: v.append([math.cos(a)*r,y,math.sin(a)*r])
    faces=[]
    for i in range(sections): j=(i+1)%sections; faces += [[i,j,sections+i],[j,sections+j,sections+i]]
    return trimesh.Trimesh(np.array(v),np.array(faces),process=True)

def loft_lock(points,widths,depths):
    p=np.asarray(points,float); verts=[]; faces=[]
    for i,pt in enumerate(p):
        w=widths[i]; d=depths[i]; verts += [[pt[0]-w,pt[1],pt[2]-d],[pt[0]+w,pt[1],pt[2]-d],[pt[0]+w*.78,pt[1],pt[2]+d],[pt[0]-w*.78,pt[1],pt[2]+d]]
    for i in range(len(p)-1):
        a=i*4; b=(i+1)*4
        faces += [[a,b,a+1],[a+1,b,b+1],[a+3,a+2,b+3],[a+2,b+2,b+3],[a,a+3,b],[a+3,b+3,b],[a+1,b+1,a+2],[a+2,b+1,b+2]]
    faces += [[0,1,3],[1,2,3]]; e=(len(p)-1)*4; faces += [[e,e+3,e+1],[e+1,e+3,e+2]]
    return trimesh.Trimesh(np.array(verts),np.array(faces),process=True)

def warped_brim(rx=.68,rz=.56,thickness=.055,segments=72,rings=6):
    verts=[]; faces=[]
    def ywarp(r,a): return .024*math.sin(a*2.0+.5)*r + .032*math.sin(a*3.0-1.0)*(r**2)+.014*math.cos(a*5.0+.2)*r
    for sign in (1,-1):
        for ir in range(rings):
            rr=.22+.78*ir/(rings-1)
            for i in range(segments):
                a=2*math.pi*i/segments; asym=1+.078*math.sin(a*3+.7)+.034*math.cos(a*5.0)
                verts.append([rx*rr*math.cos(a)*asym,ywarp(rr,a)+sign*thickness/2,rz*rr*math.sin(a)*(1+.060*math.sin(a*2.0-.4))])
    layer=rings*segments
    for L in range(2):
        base=L*layer
        for ir in range(rings-1):
            for i in range(segments):
                j=(i+1)%segments; a=base+ir*segments+i; b=base+ir*segments+j; c=base+(ir+1)*segments+i; d=base+(ir+1)*segments+j
                faces += ([[a,c,b],[b,c,d]] if L==0 else [[a,b,c],[b,d,c]])
    for ir in (0,rings-1):
        for i in range(segments):
            j=(i+1)%segments; a=ir*segments+i; b=ir*segments+j; c=layer+ir*segments+i; d=layer+ir*segments+j; faces += [[a,b,c],[b,d,c]] if ir==rings-1 else [[a,c,b],[b,c,d]]
    return trimesh.Trimesh(np.array(verts),np.array(faces),process=True)

def brim_outer_points(rx=.68,rz=.56,segments=72):
    pts=[]
    for i in range(segments):
        a=2*math.pi*i/segments; asym=1+.078*math.sin(a*3+.7)+.034*math.cos(a*5.0); y=.024*math.sin(a*2+.5)+.032*math.sin(a*3-1)+.014*math.cos(a*5+.2)
        pts.append([rx*math.cos(a)*asym,y,rz*math.sin(a)*(1+.060*math.sin(a*2-.4))])
    return pts

def cape_panel(u0,u1,rows=18,cols=9,lining=False,overlap=0.0):
    verts=[]; faces=[]
    for j in range(rows):
        f=j/(rows-1); half=.36+.11*f+.015*math.sin(f*math.pi); trail=.12+.50*(f**1.20); drop=-1.02*(f**1.08)
        for i in range(cols):
            q=i/(cols-1); u=u0+(u1-u0)*q; x=u*half
            fold=(.018+.043*f)*math.sin((u+1)*math.pi*3.0)+(.010+.022*f)*math.sin((u+1)*math.pi*5.0+f*1.5)
            rag=(.035*math.sin((u+1)*15.0)+.020*math.sin((u+1)*27.0)) if j==rows-1 else 0
            y=drop+rag; z=trail+fold+overlap + (-.030 if lining else .030)
            verts.append([x,y,z])
    for j in range(rows-1):
        for i in range(cols-1):
            a=j*cols+i; b=a+1; c=a+cols; d=c+1; faces += [[a,c,b],[b,c,d]] if not lining else [[a,b,c],[b,d,c]]
    return trimesh.Trimesh(np.array(verts),np.array(faces),process=False)

def cape_edge_path(u,rows=18,overlap=0.0):
    pts=[]
    for j in range(rows):
        f=j/(rows-1); half=.36+.11*f+.015*math.sin(f*math.pi); trail=.12+.50*(f**1.20); drop=-1.02*(f**1.08)
        fold=(.018+.043*f)*math.sin((u+1)*math.pi*3.0)+(.010+.022*f)*math.sin((u+1)*math.pi*5.0+f*1.5)
        rag=(.035*math.sin((u+1)*15)+.020*math.sin((u+1)*27)) if j==rows-1 else 0; pts.append([u*half,drop+rag,trail+fold+overlap+.030])
    return pts

def hair_lock_cluster(seed,length,lean=0.0,side_bias=0.0):
    rr=np.random.default_rng(seed); meshes=[]
    # Phone-scale hair mass is built from overlapping tapered lock volumes, not dangling cords.
    for k in range(5):
        start=(k-2)*.064+rr.normal(0,.009); L=length*(.88+rr.uniform(-.04,.08)); pts=[]; widths=[]; depths=[]
        for j in range(8):
            f=j/7; sway=math.sin(f*math.pi*1.18+seed*.11+k*.66)*(.020+.045*f)+lean*f+side_bias*f*.20
            pts.append([start+sway,-.07*f-.34*f*f,L*f+.020*math.sin(f*4.5+k*.9)])
            widths.append((.105+rr.uniform(-.010,.014))*(1-.74*(f**1.40))+.010); depths.append((.052+rr.uniform(-.005,.007))*(1-.60*f)+.010)
        meshes.append(loft_lock(pts,widths,depths))
    # One restrained center relief strand keeps texture without making the mane read as ropes.
    pts=[]
    for j in range(9):
        f=j/8; pts.append([math.sin(f*4.2+seed*.3)*.020+lean*f,-.06*f-.30*f*f,length*.92*f])
    meshes.append(tapered_tube(pts,np.linspace(.018,.0028,9),6))
    return trimesh.util.concatenate(meshes)

def root_hair_cluster(seed,x,y,z,side=0,length=.58,width=.14):
    rr=np.random.default_rng(seed); pts=[]; widths=[]; depths=[]
    for j in range(7):
        f=j/6; pts.append([side*(.018+.032*f)+math.sin(f*4.0+seed)*.014,-.07*f-.30*f*f,length*f]); widths.append(width*(1-.64*f)+.026); depths.append(.055*(1-.48*f)+.016)
    return loft_lock(pts,widths,depths),T((x,y,z),rot=[('z',rr.uniform(-3.2,3.2))])

def boot_shape(): return trimesh.creation.capsule(height=.46,radius=.14,count=[8,16])

s=trimesh.Scene()

# ---------- human rider silhouette ----------
add(s,trimesh.creation.capsule(height=.92,radius=.35,count=[12,26]),'body_core',M['cape'],T((0,.43,-.02),scale=(1.07,1.14,.82)),axes=(0,1),uvscale=(2.3,2.3))
add(s,frustum(.43,.29,.90,36),'torso_taper',M['cape'],T((0,.47,-.01)),axes=(0,1),uvscale=(2.2,2.2))
add(s,frustum(.48,.35,.64,36),'coat_skirt',M['cape'],T((0,-.26,.07),rot=[('x',3)]),axes=(0,1),uvscale=(2.2,2.2))
add(s,trimesh.creation.box([.026,.82,.042]),'coat_back_seam',M['edge'],T((0,.29,.30)),axes=(0,1),uvscale=(4,3))
for side in (-1,1):
    add(s,trimesh.creation.icosphere(subdivisions=2,radius=.235),f'shoulder_{side}',M['cape'],T((side*.37,.82,-.02),scale=(1.18,.68,.92)))
    add(s,trimesh.creation.box([.27,.032,.082]),f'shoulder_seam_{side}',M['edge'],T((side*.35,.91,.055),rot=[('z',side*6)]))
add(s,trimesh.creation.cylinder(radius=.36,height=.078,sections=30),'belt',M['leather'],T((0,.02,.02)),axes=(0,2),uvscale=(4,2))
add(s,frustum(.18,.145,.29,28),'high_collar',M['band'],T((0,1.04,.01),rot=[('x',-3)]),axes=(0,1),uvscale=(4,3))
add(s,trimesh.creation.icosphere(subdivisions=3,radius=.255),'head_shadow',M['skin'],T((0,1.43,-.11),scale=(.82,1.0,.76)))
add(s,trimesh.creation.cylinder(radius=.074,height=.12,sections=18),'nape',M['skin'],T((0,1.17,-.02),scale=(1,.92,.72)))

# Arms and legs now create a visible human riding posture from the rear camera.
for side in (-1,1):
    shoulder=(side*.34,.78,-.03); elbow=(side*.48,.20,-.20); hand=(side*.22,-.57,-.31)
    mesh,tr=cylinder_between(shoulder,elbow,.120,20); add(s,mesh,f'upper_arm_{side}',M['cape'],tr,axes=(0,1),uvscale=(4,3))
    mesh,tr=cylinder_between(elbow,hand,.090,18); add(s,mesh,f'forearm_{side}',M['leather'],tr,axes=(0,1),uvscale=(4,3))
    add(s,trimesh.creation.cylinder(radius=.12,height=.09,sections=18),f'cuff_{side}',M['band'],T(elbow,rot=[('x',72)]))
    add(s,trimesh.creation.icosphere(subdivisions=2,radius=.105),f'glove_{side}',M['leather'],T(hand,scale=(1,.78,1.15)))
    for finger in range(4):
        p0=np.array(hand)+np.array([side*(.008+finger*.013),-.008,-.018-finger*.008]); p1=p0+np.array([side*.010,-.030,-.060]); fm,ft=cylinder_between(p0,p1,.013,7); add(s,fm,f'glove_finger_{side}_{finger}',M['leather'],ft)
    hip=(side*.23,-.15,.04); knee=(side*.38,-.67,.22); ankle=(side*.31,-1.08,-.03)
    mesh,tr=cylinder_between(hip,knee,.140,18); add(s,mesh,f'thigh_{side}',M['cape'],tr)
    mesh,tr=cylinder_between(knee,ankle,.112,18); add(s,mesh,f'shin_{side}',M['leather'],tr)
    add(s,boot_shape(),f'boot_{side}',M['boot'],T((ankle[0],ankle[1]-.08,ankle[2]-.17),rot=[('x',74)],scale=(1,1,1.28)))

# ---------- dense auburn mane ----------
# 28 broad coverage elements wrap crown, sides, nape and shoulders; the skull nearly disappears rear-on.
root_i=0
for side in (-1,1):
    for row,(yy,zz,L,W) in enumerate([(1.58,.10,.40,.145),(1.48,.14,.50,.152),(1.38,.18,.60,.158)]):
        for k in range(4):
            x=side*(.045+.074*k); mesh,tr=root_hair_cluster(300+root_i,x,yy,zz,side,L,W); add(s,mesh,f'hair_root_{side}_{row}_{k}',M['hairHi'] if (k+row)%5==1 else M['hair'],tr,axes=(0,2),uvscale=(2.4,1.1)); root_i+=1
for side in (-1,1):
    for k in range(2):
        mesh,tr=root_hair_cluster(400+root_i,side*(.22+.085*k),1.31,.18+k*.02,side,.70,.160); add(s,mesh,f'hair_under_{side}_{k}',M['hair'],tr,axes=(0,2),uvscale=(2.4,1.1)); root_i+=1
# Five required animated roots carry broad clustered locks with staggered lengths and tapered bottoms.
lock_specs=[(-.28,.82,-.035,-.034),(-.14,.96,.014,-.014),(0,1.02,0,0),(.14,.94,-.014,.014),(.28,.80,.035,.034)]
for i,(x,length,lean,bias) in enumerate(lock_specs,1):
    name=f'hair_{i:02d}'; group(s,name,transform=T((x,1.50,.18),rot=[('z',(i-3)*1.8)])); add(s,hair_lock_cluster(500+i,length,lean,bias),f'{name}_strands',M['hairHi'] if i in (2,4) else M['hair'],parent=name,axes=(0,2),uvscale=(2.4,1.05))
for i in range(8):
    side=-1 if i%2==0 else 1; pts=[[0,0,0],[side*.026,-.10,.14],[side*(.060+.006*i),-.24,.31],[side*(.085+.008*i),-.38,.46]]
    add(s,tapered_tube(pts,[.008,.006,.004,.0018],5),f'hair_flyaway_{i}',M['hairHi'],T((side*(.24+.014*(i%3)),1.44,.16+.006*i)),axes=(0,2),uvscale=(2.4,1.1))

# ---------- handmade felt hat ----------
add(s,warped_brim(),'hat_brim',M['hat'],T((0,1.75,-.060),rot=[('z',3.4),('x',-3.5)]),axes=(0,2),uvscale=(2.5,2.5))
edge_pts=brim_outer_points(); edge_pts.append(edge_pts[0]); add(s,tapered_tube(edge_pts,[.016]*len(edge_pts),5),'hat_brim_edge',M['hatEdge'],T((0,1.75,-.060),rot=[('z',3.4),('x',-3.5)]),axes=(0,2),uvscale=(4,2))
crown_pts=[[0,0,0],[-.01,.14,.004],[-.035,.29,.012],[-.085,.44,.030],[-.15,.57,.052],[-.22,.69,.082]]
add(s,tapered_tube(crown_pts,[.315,.292,.255,.210,.155,.105],26),'hat_crown',M['hat'],T((.01,1.78,-.060),rot=[('z',-4.5)]),axes=(0,1),uvscale=(2.4,2.1))
for j in range(4):
    y=.11+j*.125; ring=[]
    for i in range(44):
        a=2*math.pi*i/44; r=.286-j*.039; ring.append([math.cos(a)*r,y,math.sin(a)*r*(.92+.04*math.sin(a*3))])
    ring.append(ring[0]); add(s,tapered_tube(ring,[.0065]*len(ring),4),f'hat_wrinkle_{j}',M['hatEdge'],T((0,1.78,-.060),rot=[('z',-4.5)]),axes=(0,2),uvscale=(5,2))
group(s,'hat_tip',transform=T((-.205,2.44,.022),rot=[('z',-9)])); tip_pts=[[0,0,0],[-.08,.09,.025],[-.17,.16,.055],[-.28,.20,.10],[-.40,.18,.16],[-.50,.11,.22]]
add(s,tapered_tube(tip_pts,[.108,.092,.072,.050,.030,.010],18),'hat_tip_mesh',M['hat'],parent='hat_tip',axes=(0,1),uvscale=(2.6,2.0))
add(s,trimesh.creation.cylinder(radius=.320,height=.064,sections=44),'hat_band',M['band'],T((0,1.88,-.060),scale=(1,.70,.94)),axes=(0,2),uvscale=(4,2))
for name,pos,scale in [('top',(.205,1.91,.238),(.145,.014,.014)),('bottom',(.205,1.85,.238),(.145,.014,.014)),('left',(.145,1.88,.238),(.014,.075,.014)),('right',(.265,1.88,.238),(.014,.075,.014))]: add(s,trimesh.creation.box(scale),f'hat_buckle_{name}',M['brass'],T(pos,rot=[('z',-7)]))
add(s,trimesh.creation.box([.010,.058,.010]),'hat_buckle_pin',M['brass'],T((.205,1.88,.250),rot=[('z',-7)]))

# ---------- heavy short cape with a physical yoke, deep broad folds and visible thickness ----------
group(s,'cape',transform=T((0,.90,.14),rot=[('x',1.0)]))
add(s,trimesh.creation.box([.70,.16,.14]),'cape_yoke',M['cape'],T((0,.92,.16),rot=[('x',-5)]),axes=(0,1),uvscale=(2.4,2.4))
sections=[('cape_left',-1.0,-.12,-.014),('cape_center',-.30,.30,.018),('cape_right',.12,1.0,-.004)]
for name,u0,u1,ov in sections:
    group(s,name,parent='cape'); add(s,cape_panel(u0,u1,lining=False,overlap=ov),f'{name}_outer',M['cape'],parent=name,axes=(0,2),uvscale=(1.7,1.5)); add(s,cape_panel(u0,u1,lining=True,overlap=ov),f'{name}_lining',M['lining'],parent=name,axes=(0,2),uvscale=(1.7,1.5))
for idx,(u,ov) in enumerate([(-1,-.014),(-.12,-.014),(-.30,.018),(.30,.018),(.12,-.004),(1,-.004)]):
    path=cape_edge_path(u,overlap=ov); add(s,tapered_tube(path,np.linspace(.016,.010,len(path)),5),f'cape_seam_{idx}',M['edge'],parent='cape',axes=(0,2),uvscale=(4,2))
hem=[]
for u in np.linspace(-1,1,42):
    half=.47; rag=.035*math.sin((u+1)*15)+.020*math.sin((u+1)*27); fold=.061*math.sin((u+1)*math.pi*3)+.030*math.sin((u+1)*math.pi*5+1.5); hem.append([u*half,-1.02+rag,.62+fold])
add(s,tapered_tube(hem,[.019]*len(hem),6),'cape_weighted_hem',M['edge'],parent='cape',axes=(0,2),uvscale=(5,2))
for side in (-1,1):
    add(s,trimesh.creation.box([.20,.046,.12]),f'cape_clasp_tab_{side}',M['leather'],T((side*.27,.93,.13),rot=[('z',side*6)])); add(s,trimesh.creation.cylinder(radius=.050,height=.034,sections=18),f'cape_clasp_{side}',M['brass'],T((side*.27,.95,.20),rot=[('x',90)]))

# ---------- unmistakable crooked broom ----------
group(s,'broom_handle',transform=T((0,-.70,.08),rot=[('y',-7),('x',-2.5)]))
handle_pts=[[-.055,.025,-2.70],[-.025,.005,-1.80],[.025,-.014,-.88],[-.018,.018,.05],[.038,.002,1.00],[-.020,-.020,1.90],[.055,.018,2.78]]
add(s,tapered_tube(handle_pts,[.080,.086,.084,.090,.084,.078,.072],18),'broom_shaft',M['wood'],parent='broom_handle',axes=(2,1),uvscale=(6,1.2))
for i,z in enumerate([-.62,-.34]): add(s,trimesh.creation.cylinder(radius=.092,height=.31,sections=22),f'broom_grip_wear_{i}',M['leather'],T((0,0,z),rot=[('x',90)]),parent='broom_handle',axes=(0,1),uvscale=(3,2))
for i,(x,y,z) in enumerate([(.075,.01,-1.46),(-.075,-.006,.74),(.068,.004,1.65)]): add(s,trimesh.creation.icosphere(subdivisions=1,radius=.045),f'broom_knot_{i}',M['wood'],T((x,y,z),scale=(1,.65,1.25)),parent='broom_handle')
group(s,'broom_bristles',parent='broom_handle',transform=T((.055,.018,2.72)))
add(s,trimesh.creation.torus(major_radius=.128,minor_radius=.026,major_sections=30,minor_sections=8),'broom_ferrule',M['brass'],T((0,0,.03),rot=[('x',90)]),parent='broom_bristles')
for j in range(5): add(s,trimesh.creation.torus(major_radius=.140+j*.006,minor_radius=.010,major_sections=28,minor_sections=6),f'broom_cord_{j}',M['cord'],T((0,0,.08+j*.036),rot=[('x',90)]),parent='broom_bristles')
BRISTLE_COUNT=112
for i in range(BRISTLE_COUNT):
    a=2*math.pi*(i/BRISTLE_COUNT)+RNG.normal(0,.028); ring=i%5; r0=.052+.021*ring+RNG.uniform(-.005,.007); sx=math.cos(a)*r0; sy=math.sin(a)*r0*.78
    length=.98+RNG.uniform(-.10,.24); flare=.30+RNG.uniform(.02,.18); ex=math.cos(a)*flare+RNG.normal(0,.034); ey=math.sin(a)*flare*.78+RNG.normal(0,.022); bend=RNG.normal(0,.042)
    pts=[[sx,sy,.10],[sx*.86+ex*.14,sy*.86+ey*.14,.32],[sx*.55+ex*.45+bend,sy*.55+ey*.45,.64],[ex+bend*.50,ey,length]]; rad=RNG.uniform(.010,.017)
    add(s,tapered_tube(pts,[rad,rad*.80,rad*.50,.0022],5),f'broom_bristle_{i:03d}',M['straw'],parent='broom_bristles',axes=(2,1),uvscale=(5,1))
for k in range(5): add(s,trimesh.creation.icosphere(subdivisions=1,radius=.040-.004*k),f'ember_coal_{k}',M['ember'],T((-.050+.025*k,-.010,1.02+.085*k),scale=(1,.52,1.24)),parent='broom_bristles')

# Export with explicit normals.
glb=gltf.export_glb(s,include_normals=True,unitize_normals=True); model_path=OUT/'witch-rider.glb'; model_path.write_bytes(glb)
magic,version,total=struct.unpack_from('<4sII',glb,0)
manifest={
 'version':'witch-material-pass-v2','build_version':'witch-realism-pass-v3','build':'pass-13-rear-silhouette-rebuild','file':'witch-rider.glb','bytes':len(glb),
 'required_motion_nodes':['cape','cape_left','cape_center','cape_right','hair_01','hair_02','hair_03','hair_04','hair_05','hat_tip','broom_handle','broom_bristles'],
 'hair_lock_count':5,'hair_root_tube_count':root_i,'broom_bristle_count':BRISTLE_COUNT,'cape_panel_count':3,
 'features':['broad overlapping auburn mane volumes','dense crown nape and shoulder hair coverage','five animated hair roots','restrained flyaways','smaller asymmetrical warped felt brim','crooked tapered crown','drooping twisted tip','heavy short wool cape','physical cape yoke','broad vertical folds','true outer and lining thickness','weighted irregular hem','physical shoulder clasps','human rear riding posture','hands aligned to broom grip','crooked thicker wood handle','wood knots and grip wear','112 layered individual straw bristles','restrained ember coals','low-specular PBR hierarchy'],
 'textures':sorted(p.name for p in TEX.glob('*-v3-*.png'))+sorted(p.name for p in TEX.glob('witch-hat-felt-*.png'))+sorted(p.name for p in TEX.glob('witch-cape-*.png')),
 'glb_magic':magic.decode('ascii'),'glb_version':version,'scene_nodes':len(s.graph.nodes),'geometry_nodes':len(s.graph.nodes_geometry)
}
(ROOT/'assets'/'witch-material-pass.json').write_text(json.dumps(manifest,indent=2)); print(json.dumps(manifest,indent=2))
