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
RNG=np.random.default_rng(26090612)

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
    fine=rr.normal(0,3.8,(size,size)); coarse=np.asarray(Image.fromarray(np.uint8(rr.random((size,size))*255)).filter(ImageFilter.GaussianBlur(3.2)),float)
    coarse=(coarse-coarse.mean())/(coarse.std()+1e-9); nap=2.0*np.sin(xx*.29+np.sin(yy*.041)*1.8)+1.2*np.sin((xx+yy)*.15)
    val=fine+coarse*2.5+nap; arr=np.zeros((size,size,3),float)
    for c in range(3): arr[:,:,c]=base[c]+val
    img=Image.fromarray(np.uint8(np.clip(arr,0,255)),'RGB'); h=Image.fromarray(np.uint8(np.clip(128+val*4.2,0,255)),'L')
    return img,normal_from_height(h,2.5)

def wool_texture(base,seed=2,size=192):
    rr=np.random.default_rng(seed); base=np.array(base,float); yy,xx=np.mgrid[0:size,0:size]
    weave=np.sin(xx*np.pi/2.2)*2.4+np.sin(yy*np.pi/2.6)*2.2+np.sin((xx+yy)*np.pi/8.5)*1.1
    slub=np.asarray(Image.fromarray(np.uint8(rr.random((size,size))*255)).filter(ImageFilter.GaussianBlur(1.8)),float); slub=(slub-slub.mean())/(slub.std()+1e-9)
    val=weave+slub*2.3+rr.normal(0,1.5,(size,size)); arr=np.zeros((size,size,3),float)
    for c in range(3): arr[:,:,c]=base[c]+val
    img=Image.fromarray(np.uint8(np.clip(arr,0,255)),'RGB'); h=Image.fromarray(np.uint8(np.clip(128+val*4.6,0,255)),'L')
    return img,normal_from_height(h,3.2)

def leather_texture(base,seed=3,size=192):
    rr=np.random.default_rng(seed); base=np.array(base,float)
    raw=np.asarray(Image.fromarray(np.uint8(rr.random((size,size))*255)).filter(ImageFilter.GaussianBlur(1.15)),float); grain=(raw-raw.mean())/(raw.std()+1e-9)
    arr=np.zeros((size,size,3),float)
    for c in range(3): arr[:,:,c]=base[c]+grain*4.2
    img=Image.fromarray(np.uint8(np.clip(arr,0,255)),'RGB'); d=ImageDraw.Draw(img)
    for _ in range(54):
        x=int(rr.integers(0,size)); y=int(rr.integers(0,size)); ln=int(rr.integers(10,45)); dy=int(rr.integers(-8,9))
        d.line((x,y,min(size-1,x+ln),max(0,min(size-1,y+dy))),fill=tuple(np.clip(base+8,0,255).astype(int)),width=1)
    h=Image.fromarray(np.uint8(np.clip(128+grain*17,0,255)),'L'); return img,normal_from_height(h,2.2)

def hair_texture(seed=4,size=192):
    rr=np.random.default_rng(seed); yy,xx=np.mgrid[0:size,0:size]
    strands=(np.sin(xx*.43)+np.sin(xx*.89+1.6)+np.sin(xx*1.62+.3)+np.sin(xx*2.31+2.0))*5.4
    broad=3.8*np.sin(yy*.047)+2.2*np.sin(xx*.09+yy*.039); noise=rr.normal(0,1.2,(size,size)); base=np.array([74,19,7],float)
    arr=np.zeros((size,size,3),float)
    for c in range(3): arr[:,:,c]=base[c]+strands+broad+noise+(16 if c==0 else 5 if c==1 else 0)
    img=Image.fromarray(np.uint8(np.clip(arr,0,255)),'RGB'); h=Image.fromarray(np.uint8(np.clip(128+strands*4.8+noise*2,0,255)),'L')
    return img,normal_from_height(h,3.4)

def wood_texture(seed=5,size=192):
    rr=np.random.default_rng(seed); yy,xx=np.mgrid[0:size,0:size]
    grain=np.sin(yy*.13+np.sin(xx*.055)*3.1)*7.2+np.sin(yy*.035)*5.1+np.sin((yy+xx*.2)*.22)*1.8+rr.normal(0,1.4,(size,size))
    base=np.array([70,38,18],float); arr=np.zeros((size,size,3),float)
    for c in range(3): arr[:,:,c]=base[c]+grain
    img=Image.fromarray(np.uint8(np.clip(arr,0,255)),'RGB'); d=ImageDraw.Draw(img)
    for _ in range(14):
        cx=int(rr.integers(14,size-14)); cy=int(rr.integers(14,size-14)); rx=int(rr.integers(4,12)); ry=int(rr.integers(8,22)); d.ellipse((cx-rx,cy-ry,cx+rx,cy+ry),outline=(43,23,11),width=2)
    h=Image.fromarray(np.uint8(np.clip(128+grain*4.5,0,255)),'L'); return img,normal_from_height(h,2.5)

def straw_texture(seed=6,size=192):
    rr=np.random.default_rng(seed); yy,xx=np.mgrid[0:size,0:size]
    fiber=np.sin(xx*.42)*5.3+np.sin(xx*1.06+1.2)*3.1+rr.normal(0,1.8,(size,size)); base=np.array([78,44,21],float)
    arr=np.zeros((size,size,3),float)
    for c in range(3): arr[:,:,c]=base[c]+fiber-(yy/size)*8
    img=Image.fromarray(np.uint8(np.clip(arr,0,255)),'RGB'); h=Image.fromarray(np.uint8(np.clip(128+fiber*4.4,0,255)),'L')
    return img,normal_from_height(h,2.6)

def save_set(name,pair,rough,roughseed,variation=.06,metal=.0):
    a,n=pair; r=packed_roughness(rough,a.size[0],roughseed,variation,metal)
    a.save(TEX/f'{name}-albedo.png',optimize=True); n.save(TEX/f'{name}-normal.png',optimize=True); r.save(TEX/f'{name}-roughness.png',optimize=True)
    return a,n,r

hat_a,hat_n,hat_r=save_set('witch-hat-felt',felt_texture([22,17,22],20),.94,21,.032)
cape_a,cape_n,cape_r=save_set('witch-cape-wool',wool_texture([15,15,18],22),.95,23,.034)
lining_a,lining_n,lining_r=save_set('witch-cape-lining',wool_texture([55,8,15],24),.90,25,.04)
leather_a,leather_n,leather_r=save_set('witch-leather-v3',leather_texture([20,18,19],26),.66,27,.055)
hair_a,hair_n,hair_r=save_set('witch-hair-v3',hair_texture(28),.63,29,.055)
wood_a,wood_n,wood_r=save_set('broom-wood-v3',wood_texture(30),.78,31,.055)
straw_a,straw_n,straw_r=save_set('broom-straw-v3',straw_texture(32),.96,33,.025)

# ---------- materials ----------
def pbr(name,color,rough,metal=0,base=None,normal=None,mr=None,double=False,em=None):
    return PBRMaterial(name=name,baseColorFactor=np.array(rgba(color),float)/255,metallicFactor=metal,roughnessFactor=rough,
        baseColorTexture=base,normalTexture=normal,metallicRoughnessTexture=mr,doubleSided=double,
        emissiveFactor=None if em is None else np.array(rgba(em)[:3],float)/255)
M={
 'hat':pbr('aged black felt','#1b171c',.94,base=hat_a,normal=hat_n,mr=hat_r,double=True),
 'hatEdge':pbr('worn felt edge','#2b2329',.91,base=hat_a,normal=hat_n,mr=hat_r,double=True),
 'cape':pbr('heavy charcoal wool','#151419',.95,base=cape_a,normal=cape_n,mr=cape_r,double=True),
 'lining':pbr('oxblood wool lining','#430812',.90,base=lining_a,normal=lining_n,mr=lining_r,double=True),
 'edge':pbr('worn cape seam','#302329',.92,base=cape_a,normal=cape_n,mr=cape_r,double=True),
 'band':pbr('aged burgundy hat band','#4b1019',.86,base=lining_a,normal=lining_n,mr=lining_r,double=True),
 'leather':pbr('creased black leather','#151316',.66,base=leather_a,normal=leather_n,mr=leather_r),
 'boot':pbr('scuffed riding boot','#0d0d0f',.69,base=leather_a,normal=leather_n,mr=leather_r),
 'hair':pbr('deep auburn hair','#5d1d0a',.63,base=hair_a,normal=hair_n,mr=hair_r,double=True),
 'hairHi':pbr('copper auburn hair','#863116',.60,base=hair_a,normal=hair_n,mr=hair_r,double=True),
 'wood':pbr('aged crooked ash broom','#4c2914',.78,base=wood_a,normal=wood_n,mr=wood_r),
 'straw':pbr('dark broom straw','#5c3218',.96,base=straw_a,normal=straw_n,mr=straw_r,double=True),
 'skin':pbr('shadowed moonlit skin','#674b41',.78), 'brass':pbr('tarnished brass','#624522',.44,.62),
 'cord':pbr('aged binding cord','#362116',.91), 'ember':pbr('restrained ember','#261006',.62,em='#f04a0d')
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

def warped_brim(rx=.86,rz=.72,thickness=.064,segments=72,rings=6):
    verts=[]; faces=[]
    def ywarp(r,a): return .028*math.sin(a*2.0+.5)*r + .038*math.sin(a*3.0-1.0)*(r**2)+.018*math.cos(a*5.0+.2)*r
    for sign in (1,-1):
        for ir in range(rings):
            rr=.22+.78*ir/(rings-1)
            for i in range(segments):
                a=2*math.pi*i/segments; asym=1+.060*math.sin(a*3+.7)+.025*math.cos(a*5.0)
                verts.append([rx*rr*math.cos(a)*asym,ywarp(rr,a)+sign*thickness/2,rz*rr*math.sin(a)*(1+.045*math.sin(a*2.0-.4))])
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

def brim_outer_points(rx=.86,rz=.72,segments=72):
    pts=[]
    for i in range(segments):
        a=2*math.pi*i/segments; asym=1+.060*math.sin(a*3+.7)+.025*math.cos(a*5.0); y=.028*math.sin(a*2+.5)+.038*math.sin(a*3-1)+.018*math.cos(a*5+.2)
        pts.append([rx*math.cos(a)*asym,y,rz*math.sin(a)*(1+.045*math.sin(a*2-.4))])
    return pts

def cape_panel(u0,u1,rows=17,cols=8,lining=False,overlap=0.0):
    verts=[]; faces=[]
    for j in range(rows):
        f=j/(rows-1); half=.43+.14*f+.02*math.sin(f*math.pi); trail=.16+.92*(f**1.18); drop=-1.55*(f**1.08)
        for i in range(cols):
            q=i/(cols-1); u=u0+(u1-u0)*q; x=u*half
            fold=(.035+.085*f)*math.sin((u+1)*math.pi*4.0)+(.018+.035*f)*math.sin((u+1)*math.pi*7.0+f*1.8)
            rag=(.055*math.sin((u+1)*17.0)+.035*math.sin((u+1)*29.0)) if j==rows-1 else 0
            y=drop+rag; z=trail+fold+overlap + (-.025 if lining else .025)
            verts.append([x,y,z])
    for j in range(rows-1):
        for i in range(cols-1):
            a=j*cols+i; b=a+1; c=a+cols; d=c+1; faces += [[a,c,b],[b,c,d]] if not lining else [[a,b,c],[b,d,c]]
    return trimesh.Trimesh(np.array(verts),np.array(faces),process=False)

def cape_edge_path(u,rows=17,overlap=0.0):
    pts=[]
    for j in range(rows):
        f=j/(rows-1); half=.43+.14*f+.02*math.sin(f*math.pi); trail=.16+.92*(f**1.18); drop=-1.55*(f**1.08)
        fold=(.035+.085*f)*math.sin((u+1)*math.pi*4.0)+(.018+.035*f)*math.sin((u+1)*math.pi*7.0+f*1.8)
        rag=(.055*math.sin((u+1)*17)+.035*math.sin((u+1)*29)) if j==rows-1 else 0; pts.append([u*half,drop+rag,trail+fold+overlap+.025])
    return pts

def hair_lock_cluster(seed,length,lean=0.0,side_bias=0.0):
    rr=np.random.default_rng(seed); meshes=[]
    # Broad overlapping lock plates dominate the phone-size read; narrow tubes add strand relief.
    for k in range(5):
        start=(k-2)*.050+rr.normal(0,.011); L=length*(.86+rr.uniform(-.03,.10)); pts=[]; widths=[]; depths=[]
        for j in range(9):
            f=j/8; sway=math.sin(f*math.pi*1.25+seed*.13+k*.63)*(.025+.060*f)+lean*f+side_bias*f*.25
            pts.append([start+sway,-.12*f-.56*f*f,L*f+.028*math.sin(f*5.2+k*.9)])
            widths.append((.078+rr.uniform(-.012,.015))*(1-.72*(f**1.35))+.008); depths.append((.040+rr.uniform(-.006,.008))*(1-.62*f)+.008)
        meshes.append(loft_lock(pts,widths,depths))
    for k in range(3):
        pts=[]
        for j in range(10):
            f=j/9; pts.append([(k-1)*.047+math.sin(f*4.8+k)*.025+lean*f,-.10*f-.50*f*f,length*.95*f])
        meshes.append(tapered_tube(pts,np.linspace(.026,.0035,10),6))
    return trimesh.util.concatenate(meshes)

def root_hair_cluster(seed,x,y,z,side=0,length=.72,width=.12):
    rr=np.random.default_rng(seed); pts=[]; widths=[]; depths=[]
    for j in range(7):
        f=j/6; pts.append([side*(.02+.04*f)+math.sin(f*4.2+seed)*.018,-.11*f-.46*f*f,length*f]); widths.append(width*(1-.63*f)+.020); depths.append(.046*(1-.45*f)+.014)
    return loft_lock(pts,widths,depths),T((x,y,z),rot=[('z',rr.uniform(-4,4))])

def boot_shape(): return trimesh.creation.capsule(height=.48,radius=.14,count=[8,16])

s=trimesh.Scene()

# ---------- human rider silhouette ----------
add(s,trimesh.creation.capsule(height=.94,radius=.34,count=[12,26]),'body_core',M['cape'],T((0,.40,-.02),scale=(1.08,1.18,.82)),axes=(0,1),uvscale=(2.3,2.3))
add(s,frustum(.48,.31,.94,36),'torso_taper',M['cape'],T((0,.42,-.01)),axes=(0,1),uvscale=(2.2,2.2))
add(s,frustum(.56,.40,.78,36),'coat_skirt',M['cape'],T((0,-.34,.08),rot=[('x',4)]),axes=(0,1),uvscale=(2.2,2.2))
add(s,trimesh.creation.box([.030,.86,.045]),'coat_back_seam',M['edge'],T((0,.28,.30)),axes=(0,1),uvscale=(4,3))
for side in (-1,1):
    add(s,trimesh.creation.icosphere(subdivisions=2,radius=.245),f'shoulder_{side}',M['cape'],T((side*.39,.82,-.02),scale=(1.20,.66,.90)))
    add(s,trimesh.creation.box([.30,.038,.095]),f'shoulder_seam_{side}',M['edge'],T((side*.37,.92,.06),rot=[('z',side*7)]))
add(s,trimesh.creation.cylinder(radius=.39,height=.085,sections=30),'belt',M['leather'],T((0,.03,.02)),axes=(0,2),uvscale=(4,2))
add(s,frustum(.19,.155,.32,28),'high_collar',M['band'],T((0,1.05,.02),rot=[('x',-4)]),axes=(0,1),uvscale=(4,3))
add(s,trimesh.creation.icosphere(subdivisions=3,radius=.275),'head_shadow',M['skin'],T((0,1.45,-.11),scale=(.83,1.0,.78)))
add(s,trimesh.creation.cylinder(radius=.082,height=.13,sections=18),'nape',M['skin'],T((0,1.17,-.02),scale=(1,.95,.74)))

# Arms reach down to the actual broom height; gloves visibly close around the shaft.
for side in (-1,1):
    shoulder=(side*.35,.79,-.03); elbow=(side*.55,.12,-.27); hand=(side*.25,-.69,-.36)
    mesh,tr=cylinder_between(shoulder,elbow,.125,20); add(s,mesh,f'upper_arm_{side}',M['cape'],tr,axes=(0,1),uvscale=(4,3))
    mesh,tr=cylinder_between(elbow,hand,.095,18); add(s,mesh,f'forearm_{side}',M['leather'],tr,axes=(0,1),uvscale=(4,3))
    add(s,trimesh.creation.cylinder(radius=.13,height=.10,sections=18),f'cuff_{side}',M['band'],T(elbow,rot=[('x',72)]))
    add(s,trimesh.creation.icosphere(subdivisions=2,radius=.112),f'glove_{side}',M['leather'],T(hand,scale=(1,.78,1.18)))
    for finger in range(4):
        p0=np.array(hand)+np.array([side*(.008+finger*.014),-.01,-.020-finger*.009]); p1=p0+np.array([side*.012,-.035,-.070]); fm,ft=cylinder_between(p0,p1,.014,7); add(s,fm,f'glove_finger_{side}_{finger}',M['leather'],ft)
    hip=(side*.24,-.26,.05); knee=(side*.43,-.75,.28); ankle=(side*.34,-1.15,-.08)
    mesh,tr=cylinder_between(hip,knee,.145,18); add(s,mesh,f'thigh_{side}',M['cape'],tr)
    mesh,tr=cylinder_between(knee,ankle,.118,18); add(s,mesh,f'shin_{side}',M['leather'],tr)
    add(s,boot_shape(),f'boot_{side}',M['boot'],T((ankle[0],ankle[1]-.10,ankle[2]-.18),rot=[('x',76)],scale=(1,1,1.34)))

# ---------- dense auburn mane ----------
# 28 broad coverage elements wrap crown, sides, nape and shoulders; the head nearly disappears from rear view.
root_i=0
for side in (-1,1):
    for row,(yy,zz,L,W) in enumerate([(1.61,.12,.52,.115),(1.50,.16,.65,.125),(1.39,.20,.76,.135)]):
        for k in range(4):
            x=side*(.05+.075*k); mesh,tr=root_hair_cluster(300+root_i,x,yy,zz,side,L,W); add(s,mesh,f'hair_root_{side}_{row}_{k}',M['hairHi'] if (k+row)%4==1 else M['hair'],tr,axes=(0,2),uvscale=(3.2,1.3)); root_i+=1
for side in (-1,1):
    for k in range(2):
        mesh,tr=root_hair_cluster(400+root_i,side*(.24+.09*k),1.34,.20+k*.02,side,.88,.14); add(s,mesh,f'hair_under_{side}_{k}',M['hair'],tr,axes=(0,2),uvscale=(3,1.2)); root_i+=1
# Five required animated roots, each carrying a layered broad cluster rather than rope-like cords.
lock_specs=[(-.30,1.18,-.045,-.035),(-.16,1.42,.018,-.015),(0,1.58,0,0),(.16,1.42,-.018,.015),(.30,1.18,.045,.035)]
for i,(x,length,lean,bias) in enumerate(lock_specs,1):
    name=f'hair_{i:02d}'; group(s,name,transform=T((x,1.53,.22),rot=[('z',(i-3)*2.0)])); add(s,hair_lock_cluster(500+i,length,lean,bias),f'{name}_strands',M['hairHi'] if i in (2,4) else M['hair'],parent=name,axes=(0,2),uvscale=(3,1.15))
for i in range(9):
    side=-1 if i%2==0 else 1; pts=[[0,0,0],[side*.035,-.16,.18],[side*(.08+.008*i),-.39,.38],[side*(.12+.010*i),-.63,.56]]
    add(s,tapered_tube(pts,[.010,.008,.005,.0022],5),f'hair_flyaway_{i}',M['hairHi'],T((side*(.25+.018*(i%3)),1.48,.19+.008*i)),axes=(0,2),uvscale=(3,1.2))

# ---------- handmade felt hat ----------
add(s,warped_brim(),'hat_brim',M['hat'],T((0,1.77,-.065),rot=[('z',2.6),('x',-3.0)]),axes=(0,2),uvscale=(2.5,2.5))
edge_pts=brim_outer_points(); edge_pts.append(edge_pts[0]); add(s,tapered_tube(edge_pts,[.019]*len(edge_pts),5),'hat_brim_edge',M['hatEdge'],T((0,1.77,-.065),rot=[('z',2.6),('x',-3.0)]),axes=(0,2),uvscale=(4,2))
crown_pts=[[0,0,0],[-.02,.16,.006],[-.055,.33,.018],[-.11,.49,.038],[-.18,.63,.064],[-.26,.75,.092]]
add(s,tapered_tube(crown_pts,[.40,.375,.335,.285,.225,.165],26),'hat_crown',M['hat'],T((.02,1.80,-.065),rot=[('z',-4.0)]),axes=(0,1),uvscale=(2.4,2.1))
for j in range(4):
    y=.13+j*.145; ring=[]
    for i in range(44):
        a=2*math.pi*i/44; r=.365-j*.047; ring.append([math.cos(a)*r,y,math.sin(a)*r*(.93+.03*math.sin(a*3))])
    ring.append(ring[0]); add(s,tapered_tube(ring,[.008]*len(ring),4),f'hat_wrinkle_{j}',M['hatEdge'],T((0,1.80,-.065),rot=[('z',-4.0)]),axes=(0,2),uvscale=(5,2))
group(s,'hat_tip',transform=T((-.245,2.54,.025),rot=[('z',-7)])); tip_pts=[[0,0,0],[-.08,.11,.03],[-.18,.20,.07],[-.30,.26,.12],[-.43,.28,.18],[-.55,.22,.25]]
add(s,tapered_tube(tip_pts,[.17,.145,.112,.078,.046,.014],18),'hat_tip_mesh',M['hat'],parent='hat_tip',axes=(0,1),uvscale=(2.6,2.0))
add(s,trimesh.creation.cylinder(radius=.405,height=.076,sections=44),'hat_band',M['band'],T((0,1.91,-.065),scale=(1,.66,.94)),axes=(0,2),uvscale=(4,2))
for name,pos,scale in [('top',(.27,1.95,.30),(.18,.018,.018)),('bottom',(.27,1.87,.30),(.18,.018,.018)),('left',(.19,1.91,.30),(.018,.10,.018)),('right',(.35,1.91,.30),(.018,.10,.018))]: add(s,trimesh.creation.box(scale),f'hat_buckle_{name}',M['brass'],T(pos,rot=[('z',-7)]))
add(s,trimesh.creation.box([.012,.075,.012]),'hat_buckle_pin',M['brass'],T((.27,1.91,.314),rot=[('z',-7)]))

# ---------- heavy narrow cape with deep folds and physical thickness ----------
group(s,'cape',transform=T((0,.91,.18),rot=[('x',1.5)]))
sections=[('cape_left',-1.0,-.18,-.018),('cape_center',-.24,.24,.025),('cape_right',.18,1.0,-.006)]
for name,u0,u1,ov in sections:
    group(s,name,parent='cape'); add(s,cape_panel(u0,u1,lining=False,overlap=ov),f'{name}_outer',M['cape'],parent=name,axes=(0,2),uvscale=(1.8,1.5)); add(s,cape_panel(u0,u1,lining=True,overlap=ov),f'{name}_lining',M['lining'],parent=name,axes=(0,2),uvscale=(1.8,1.5))
for idx,(u,ov) in enumerate([(-1,-.018),(-.18,-.018),(-.24,.025),(.24,.025),(.18,-.006),(1,-.006)]):
    path=cape_edge_path(u,overlap=ov); add(s,tapered_tube(path,np.linspace(.020,.012,len(path)),5),f'cape_seam_{idx}',M['edge'],parent='cape',axes=(0,2),uvscale=(4,2))
# Weighted, irregular hem is a true cord instead of a razor-thin panel edge.
hem=[]
for u in np.linspace(-1,1,42):
    half=.57; rag=.055*math.sin((u+1)*17)+.035*math.sin((u+1)*29); fold=.12*math.sin((u+1)*math.pi*4)+.053*math.sin((u+1)*math.pi*7+1.8); hem.append([u*half,-1.55+rag,1.08+fold])
add(s,tapered_tube(hem,[.024]*len(hem),6),'cape_weighted_hem',M['edge'],parent='cape',axes=(0,2),uvscale=(5,2))
for side in (-1,1):
    add(s,trimesh.creation.box([.23,.052,.145]),f'cape_clasp_tab_{side}',M['leather'],T((side*.30,.93,.15),rot=[('z',side*7)])); add(s,trimesh.creation.cylinder(radius=.055,height=.038,sections=18),f'cape_clasp_{side}',M['brass'],T((side*.30,.96,.23),rot=[('x',90)]))

# ---------- unmistakable crooked broom ----------
group(s,'broom_handle',transform=T((0,-.82,.15)))
handle_pts=[[-.055,.025,-2.70],[-.025,.005,-1.80],[.025,-.014,-.88],[-.018,.018,.05],[.038,.002,1.00],[-.020,-.020,1.90],[.055,.018,2.78]]
add(s,tapered_tube(handle_pts,[.066,.071,.069,.075,.069,.064,.058],16),'broom_shaft',M['wood'],parent='broom_handle',axes=(2,1),uvscale=(6,1.2))
for i,z in enumerate([-.61,-.34]): add(s,trimesh.creation.cylinder(radius=.077,height=.29,sections=22),f'broom_grip_wear_{i}',M['leather'],T((0,0,z),rot=[('x',90)]),parent='broom_handle',axes=(0,1),uvscale=(3,2))
for i,(x,y,z) in enumerate([(.061,.01,-1.46),(-.062,-.006,.74),(.055,.004,1.65)]): add(s,trimesh.creation.icosphere(subdivisions=1,radius=.040),f'broom_knot_{i}',M['wood'],T((x,y,z),scale=(1,.65,1.25)),parent='broom_handle')
group(s,'broom_bristles',parent='broom_handle',transform=T((.055,.018,2.72)))
add(s,trimesh.creation.torus(major_radius=.116,minor_radius=.024,major_sections=30,minor_sections=8),'broom_ferrule',M['brass'],T((0,0,.03),rot=[('x',90)]),parent='broom_bristles')
for j in range(5): add(s,trimesh.creation.torus(major_radius=.128+j*.006,minor_radius=.010,major_sections=28,minor_sections=6),f'broom_cord_{j}',M['cord'],T((0,0,.08+j*.036),rot=[('x',90)]),parent='broom_bristles')
BRISTLE_COUNT=96
for i in range(BRISTLE_COUNT):
    a=2*math.pi*(i/BRISTLE_COUNT)+RNG.normal(0,.030); ring=i%4; r0=.050+.023*ring+RNG.uniform(-.006,.008); sx=math.cos(a)*r0; sy=math.sin(a)*r0*.78
    length=1.06+RNG.uniform(-.14,.28); flare=.25+RNG.uniform(.02,.20); ex=math.cos(a)*flare+RNG.normal(0,.040); ey=math.sin(a)*flare*.78+RNG.normal(0,.026); bend=RNG.normal(0,.052)
    pts=[[sx,sy,.10],[sx*.88+ex*.12,sy*.88+ey*.12,.34],[sx*.58+ex*.42+bend,sy*.58+ey*.42,.68],[ex+bend*.55,ey,length]]; rad=RNG.uniform(.011,.020)
    add(s,tapered_tube(pts,[rad,rad*.82,rad*.54,.0025],5),f'broom_bristle_{i:02d}',M['straw'],parent='broom_bristles',axes=(2,1),uvscale=(5,1))
for k in range(5): add(s,trimesh.creation.icosphere(subdivisions=1,radius=.048-.005*k),f'ember_coal_{k}',M['ember'],T((-.06+.030*k,-.012,1.09+.10*k),scale=(1,.52,1.30)),parent='broom_bristles')

# Export with explicit normals.
glb=gltf.export_glb(s,include_normals=True,unitize_normals=True); model_path=OUT/'witch-rider.glb'; model_path.write_bytes(glb)
magic,version,total=struct.unpack_from('<4sII',glb,0)
manifest={
 'version':'witch-material-pass-v2','build_version':'witch-realism-pass-v3','build':'pass-12-witch-silhouette-correction','file':'witch-rider.glb','bytes':len(glb),
 'required_motion_nodes':['cape','cape_left','cape_center','cape_right','hair_01','hair_02','hair_03','hair_04','hair_05','hat_tip','broom_handle','broom_bristles'],
 'hair_lock_count':5,'hair_root_tube_count':root_i,'broom_bristle_count':BRISTLE_COUNT,'cape_panel_count':3,
 'features':['broad overlapping auburn lock clusters','dense crown nape and shoulder hair coverage','five animated hair roots','restrained flyaways','broader asymmetrical warped felt brim','crooked tapered crown','drooping twisted tip','heavy narrow wool cape','deep vertical folds','true outer and lining thickness','weighted irregular hem','physical shoulder clasps','human rider proportions','hands aligned to broom grip','crooked thick wood handle','wood knots and grip wear','96 layered individual straw bristles','restrained ember coals','high-roughness PBR hierarchy'],
 'textures':sorted(p.name for p in TEX.glob('*-v3-*.png'))+sorted(p.name for p in TEX.glob('witch-hat-felt-*.png'))+sorted(p.name for p in TEX.glob('witch-cape-*.png')),
 'glb_magic':magic.decode('ascii'),'glb_version':version,'scene_nodes':len(s.graph.nodes),'geometry_nodes':len(s.graph.nodes_geometry)
}
(ROOT/'assets'/'witch-material-pass.json').write_text(json.dumps(manifest,indent=2)); print(json.dumps(manifest,indent=2))
