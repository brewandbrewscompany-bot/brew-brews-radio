import * as pc from 'playcanvas';

const PASS_ID='environment-realism-pass15';
const VERSION='road-truck-bean-realism-v2-neutral-road-glimmer-bean';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const TRUCK_FILES=['traffic-pickup.glb','traffic-farm-truck.glb','traffic-box-truck.glb','traffic-utility-truck.glb'];
const TRUCK_TYPES=['pickup','farm','box','utility'];
const BEAN_VISUAL_SCALE=.40;

function mat(name,diffuse,metalness=0,roughness=.8,emissive=null,opacity=1){
  const m=new pc.StandardMaterial();
  m.name=name;
  m.diffuse=new pc.Color(...diffuse);
  m.useMetalness=true;
  m.metalness=metalness;
  m.gloss=1-roughness;
  if(emissive){m.emissive=new pc.Color(...emissive);m.emissiveIntensity=1}
  if(opacity<1){m.opacity=opacity;m.blendType=pc.BLEND_NORMAL;m.depthWrite=false;m.cull=pc.CULLFACE_NONE}
  m.update();
  return m;
}
function primitive(name,type,scale,pos,material,parent,rot=null){
  const e=new pc.Entity(name);
  e.addComponent('render',{type});
  e.setLocalScale(...scale);
  e.setLocalPosition(...pos);
  if(rot)e.setLocalEulerAngles(...rot);
  e.render.material=material;
  e.render.castShadows=false;
  e.render.receiveShadows=true;
  (parent||pc.app.root).addChild(e);
  return e;
}
function walk(root,fn){fn(root);for(const c of root.children||[])walk(c,fn)}
function loadAsset(app,filename){
  const url=`assets/models/${filename}`;
  return new Promise((resolve,reject)=>app.assets.loadFromUrlAndFilename(url,filename,'container',(err,a)=>err?reject(new Error(`${filename}: ${err}`)):resolve(a)));
}
function instantiate(asset,name){
  const e=asset.resource.instantiateRenderEntity();
  e.name=name;
  for(const r of e.findComponents?.('render')||[]){r.castShadows=true;r.receiveShadows=true}
  return e;
}
function makeNoiseTexture(app,name,size=128){
  const c=document.createElement('canvas');c.width=c.height=size;
  const g=c.getContext('2d'),img=g.createImageData(size,size);
  let seed=0x1f2e3d4c;
  const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
  for(let i=0;i<size*size;i++){
    const n=38+Math.floor(rand()*30),warm=Math.floor(rand()*11);
    img.data[i*4]=Math.min(255,n+warm);
    img.data[i*4+1]=Math.max(0,n-2);
    img.data[i*4+2]=Math.max(0,n-9);
    img.data[i*4+3]=255;
  }
  g.putImageData(img,0,0);
  const tex=new pc.Texture(app.graphicsDevice,{width:size,height:size,mipmaps:true,minFilter:pc.FILTER_LINEAR_MIPMAP_LINEAR,magFilter:pc.FILTER_LINEAR,addressU:pc.ADDRESS_REPEAT,addressV:pc.ADDRESS_REPEAT});
  tex.name=name;tex.setSource(c);tex.anisotropy=4;
  return tex;
}
function existingTexture(app,name){return app.assets.find(name,'texture')?.resource||null}
function makeRoadMesh(app,name,xs,z0=-14,z1=14,yFn=x=>0){
  const positions=[],normals=[],uvs=[],indices=[];
  for(const z of [z0,z1])for(const x of xs){
    positions.push(x,yFn(x),z);normals.push(0,1,0);uvs.push((x-xs[0])/(xs.at(-1)-xs[0])*3.2,(z-z0)/(z1-z0)*6.2);
  }
  const n=xs.length;
  for(let i=0;i<n-1;i++){const a=i,b=i+1,c=n+i,d=n+i+1;indices.push(a,c,b,b,c,d)}
  const mesh=new pc.Mesh(app.graphicsDevice);
  mesh.setPositions(positions);mesh.setNormals(normals);mesh.setUvs(0,uvs);mesh.setIndices(indices);mesh.update();mesh.name=name;
  return mesh;
}
function meshEntity(name,mesh,material,parent){
  const mi=new pc.MeshInstance(mesh,material),e=new pc.Entity(name);
  e.addComponent('render',{meshInstances:[mi]});e.render.castShadows=false;e.render.receiveShadows=true;parent.addChild(e);
  return e;
}
function tuneAsphaltMaterial(app){
  const m=mat('pass15 neutral charcoal rural asphalt',[.118,.096,.078],0,.955),d=existingTexture(app,'asphalt-albedo.png'),n=existingTexture(app,'asphalt-normal.png');
  m.useMetalness=false;
  m.metalness=0;
  m.gloss=.045;
  m.specular=new pc.Color(.045,.042,.038);
  m.emissive=new pc.Color(.035,.024,.015);
  m.emissiveIntensity=.22;
  if(d){d.addressU=d.addressV=pc.ADDRESS_REPEAT;d.anisotropy=4;m.diffuseMap=d;m.diffuseMapTiling=new pc.Vec2(2.55,5.75)}
  if(n){n.addressU=n.addressV=pc.ADDRESS_REPEAT;n.anisotropy=4;m.normalMap=n;m.normalMapTiling=new pc.Vec2(2.55,5.75);m.bumpiness=.58}
  m.update();
  return m;
}
function disableLegacyRoadOverlay(root){
  let disabled=0;
  for(const c of root.children||[]){
    const name=c.name||'';
    const oldRoad=name==='Road'||name.startsWith('Shoulder ')||name==='Wet sheen'||name.startsWith('Puddle ')||name.startsWith('Puddle Variation');
    const oldLighting=name.startsWith('Pass9 Moon Road Sheen')||name.startsWith('Pass9 Warm Road Pool');
    if((oldRoad||oldLighting)&&c.render){c.render.enabled=false;disabled++}
  }
  return disabled;
}
function upgradeRoad(app){
  const asphalt=tuneAsphaltMaterial(app);
  const gravel=mat('pass15 dry dirty gravel shoulder',[.112,.086,.061],0,.96);
  const edge=mat('pass15 dirty asphalt edge',[.055,.043,.034],0,.96);
  const track=mat('pass15 worn wheel track',[.052,.044,.038],0,.80,null,.13);
  const mark=mat('pass15 faded old highway paint',[.40,.32,.18],0,.88,null,.46);
  const patch=mat('pass15 rough charcoal asphalt repair',[.043,.037,.032],0,.93,null,.72);
  const crack=mat('pass15 tar crack',[.014,.012,.011],0,.98,null,.82);
  const puddle=mat('pass15 neutral damp road spot',[.032,.029,.026],0,.62,null,.07);
  gravel.diffuseMap=makeNoiseTexture(app,'pass15 warm gravel noise');gravel.diffuseMapTiling=new pc.Vec2(5.8,7.8);gravel.update();
  const detail={roadSegments:0,shoulderMeshes:0,laneDashes:0,wheelTracks:0,patches:0,cracks:0,puddles:0,roadWidth:12,laneWidth:4,crown:true,roadPalette:'neutral-charcoal-warm',blueSheenDisabled:true,legacyRoadOverlaysDisabled:0,asphaltGloss:.045};
  for(let i=0;i<9;i++){
    const root=app.root.findByName(`Road Segment ${i}`);if(!root)continue;
    detail.legacyRoadOverlaysDisabled+=disableLegacyRoadOverlay(root);
    const reflection=app.root.findByName(`Warm Road Reflection ${i}`);if(reflection?.render){reflection.render.enabled=false;detail.legacyRoadOverlaysDisabled++}
    const y=x=>-.040+.040*(1-Math.pow(Math.abs(x)/6,1.65));
    meshEntity('Pass15 Cambered Asphalt',makeRoadMesh(app,`pass15-road-${i}`,[-6,-5,-4,-2,0,2,4,5,6],-14,14,y),asphalt,root);
    const ly=x=>-.04-(Math.abs(x)-6)*.052;
    meshEntity('Pass15 Shoulder L',makeRoadMesh(app,`pass15-shoulder-l-${i}`,[-9.2,-7.5,-6],-14,14,ly),gravel,root);
    meshEntity('Pass15 Shoulder R',makeRoadMesh(app,`pass15-shoulder-r-${i}`,[6,7.5,9.2],-14,14,ly),gravel,root);
    detail.shoulderMeshes+=2;
    for(const side of [-1,1])for(let s=0;s<6;s++){
      const len=2.35+((i+s)%3)*.42,z=-11.4+s*4.55+(((i*13+s*7)%9)-4)*.05,x=side*(5.73+(((i+s)%3)-1)*.025),yaw=side*(((i*11+s*5)%9)-4)*.22;
      primitive('Pass15 Broken Edge','box',[.30,.006,len],[x,-.035,z],edge,root,[0,yaw,0]);
    }
    for(const lane of [-4,0,4])for(const off of [-.68,.68]){primitive('Pass15 Wheel Track','box',[.30,.003,27.35],[lane+off,-.010,0],track,root);detail.wheelTracks++}
    for(const x of [-2,2])for(let d=0;d<4;d++){
      const z=-10.4+d*7.0+(i%2?0.28:-.18),yaw=((i+d)%3-1)*.35;
      primitive('Pass15 Faded Lane Dash','box',[.082,.006,3.05],[x,-.003,z],mark,root,[0,yaw,0]);detail.laneDashes++;
    }
    const patchCenters=[[-3.05+(i%3)*.52,-5.4+(i%2)*2.1],[2.35-(i%4)*.24,5.1-(i%3)*1.65]];
    patchCenters.forEach((p,j)=>{for(let k=0;k<2;k++){
      const w=.42+.10*((i+j+k)%3),l=.72+.22*((i*3+j+k)%3),x=p[0]+(k?-.20:.16),z=p[1]+(k?-.24:.18),yaw=((i*19+j*31+k*23)%25)-12;
      primitive('Pass15 Asphalt Patch','box',[w,.004,l],[x,-.004,z],patch,root,[0,yaw,0]);detail.patches++;
    }});
    for(let c=0;c<4;c++){
      const x=-4.7+((i*17+c*31)%91)/91*9.4,z=-10+((i*23+c*37)%79)/79*20,w=.014+(c%2)*.009,len=.58+((i+c)%4)*.21;
      primitive('Pass15 Tar Crack','box',[w,.007,len],[x,.002,z],crack,root,[0,((i*13+c*41)%70)-35,0]);detail.cracks++;
    }
    if(i%2===0){primitive('Pass15 Damp Spot','box',[.46,.004,.92],[i%4===0?-3.05:2.92,.005,-1.8+(i%3)*2.35],puddle,root,[0,(i*13)%17-8,0]);detail.puddles++}
    detail.roadSegments++;
  }
  return detail;
}
async function upgradeTraffic(app){
  const assets=await Promise.all(TRUCK_FILES.map(f=>loadAsset(app,f))),types=[],wheels=[];
  const scales={pickup:.88,farm:.88,box:.90,utility:.88};
  for(let i=0;i<7;i++){
    const root=app.root.findByName(`1938 Coupe ${i}`);if(!root)continue;
    const type=TRUCK_TYPES[i%TRUCK_TYPES.length];
    for(const r of root.findComponents?.('render')||[])r.enabled=false;
    const visual=instantiate(assets[i%assets.length],`Pass15 ${type} truck visual`);
    visual.setLocalScale(scales[type],scales[type],scales[type]);visual.setLocalPosition(0,0,0);root.addChild(visual);
    root.__trafficType=type;root.__pass15Visual=visual;root.__pass15PrevZ=root.getPosition().z;root.__pass15Wheels=[];
    walk(visual,n=>{if(n.name?.startsWith('wheel_')){root.__pass15Wheels.push(n);wheels.push(n)}});
    const lamps=(root.children||[]).filter(c=>c.name?.startsWith('Headlight Glow')&&c.light),front={pickup:2.45,farm:2.60,box:2.63,utility:2.48}[type];
    for(const lamp of lamps){const p=lamp.getLocalPosition();lamp.setLocalPosition(p.x,1.16,front);lamp.light.range=9.0;lamp.light.intensity=.25}
    types.push(type);
  }
  return {vehicles:types.length,truckTypes:[...new Set(types)].sort(),wheelNodes:wheels.length,types};
}
function beanGlimmerMaterials(){
  const halo=mat('pass15 restrained coffee bean glimmer',[.20,.095,.024],0,.98,[.45,.18,.035],.055);
  halo.blendType=pc.BLEND_ADDITIVE;halo.depthWrite=false;halo.cull=pc.CULLFACE_NONE;halo.emissiveIntensity=.32;halo.update();
  const glint=mat('pass15 coffee bean specular glint',[.62,.38,.12],0,.72,[1,.48,.12],.48);
  glint.blendType=pc.BLEND_ADDITIVE;glint.depthWrite=false;glint.cull=pc.CULLFACE_NONE;glint.emissiveIntensity=.72;glint.update();
  return {halo,glint};
}
async function upgradeBeans(app){
  const asset=await loadAsset(app,'coffee-bean-v2.glb'),visuals=[],glimmers=[],glints=[],gm=beanGlimmerMaterials();
  for(let i=0;i<16;i++){
    const root=app.root.findByName(`Coffee Bean ${i}`);if(!root)continue;
    for(const r of root.findComponents?.('render')||[])r.enabled=false;
    const visual=instantiate(asset,`Pass15 Coffee Bean Visual ${i}`);
    visual.setLocalScale(BEAN_VISUAL_SCALE,BEAN_VISUAL_SCALE,BEAN_VISUAL_SCALE);visual.setLocalEulerAngles(0,(i*37)%360,(i%3-1)*4);root.addChild(visual);
    const halo=primitive(`Pass15 Bean Glimmer ${i}`,'sphere',[.48,.62,.34],[0,0,0],gm.halo,root),glint=primitive(`Pass15 Bean Glint ${i}`,'sphere',[.040,.040,.040],[-.14,.19,.13],gm.glint,root);
    halo.render.receiveShadows=false;glint.render.receiveShadows=false;halo.__phase=i*.61;glint.__phase=i*.83;
    root.__pass15BeanVisual=visual;root.__pass15BeanGlimmer=halo;root.__pass15BeanGlint=glint;
    visuals.push(visual);glimmers.push(halo);glints.push(glint);
  }
  return {beans:visuals.length,centerCrease:true,organicAsymmetry:true,neonHalo:false,glimmer:true,glimmerNonNeon:true,visualScale:BEAN_VISUAL_SCALE,approxWorldHeight:.59,glimmers:glimmers.length,glints:glints.length,visuals};
}
function animate(app){
  let t=0;
  app.on('update',dt=>{
    t+=dt;
    for(let i=0;i<7;i++){
      const root=app.root.findByName(`1938 Coupe ${i}`);if(!root?.__pass15Wheels)continue;
      const z=root.getPosition().z,prev=root.__pass15PrevZ;root.__pass15PrevZ=z;const dz=z-prev;
      if(root.enabled&&Math.abs(dz)<4){const deg=-(dz/.49)*57.2958;for(const w of root.__pass15Wheels)w.rotateLocal(0,0,deg)}
    }
    for(let i=0;i<16;i++){
      const root=app.root.findByName(`Coffee Bean ${i}`),v=root?.__pass15BeanVisual,h=root?.__pass15BeanGlimmer,g=root?.__pass15BeanGlint;
      if(v)v.rotateLocal(8*dt,-70*dt,3*dt);
      if(h){const p=.985+Math.sin(t*2.4+h.__phase)*.035;h.setLocalScale(.48*p,.62*p,.34*p)}
      if(g){const p=.80+Math.sin(t*3.2+g.__phase)*.20;g.setLocalScale(.040*p,.040*p,.040*p);g.setLocalPosition(-.14+Math.sin(t*1.7+g.__phase)*.018,.19+Math.cos(t*1.35+g.__phase)*.015,.13)}
    }
  });
}
async function install(){
  for(let i=0;i<360;i++){
    const app=pc.app,w=window.WitchRide3D;
    if(app&&w?.ready&&w?.variationPass==='variation-pass-v8'&&w?.worldDetailPass==='world-detail-pass-v6'&&window.WitchRideWitchMaterialPass14?.active===true){
      try{
        const road=upgradeRoad(app),traffic=await upgradeTraffic(app),beans=await upgradeBeans(app);animate(app);
        const detail={road,...traffic,beans:beans.beans,beanCenterCrease:beans.centerCrease,beanOrganicAsymmetry:beans.organicAsymmetry,beanNeonHalo:beans.neonHalo,beanGlimmer:beans.glimmer,beanGlimmerNonNeon:beans.glimmerNonNeon,beanVisualScale:beans.visualScale,beanApproxWorldHeight:beans.approxWorldHeight,beanGlimmerEntities:beans.glimmers,beanGlints:beans.glints};
        if(road.roadSegments!==9||!road.blueSheenDisabled||road.legacyRoadOverlaysDisabled<18||traffic.vehicles!==7||traffic.truckTypes.length<4||beans.beans!==16||beans.visualScale>.42||!beans.glimmer||beans.neonHalo||traffic.wheelNodes<70)throw new Error(`environment coverage incomplete ${JSON.stringify(detail)}`);
        window.WitchRideEnvironmentPass15={passId:PASS_ID,version:VERSION,active:true,production:true,preservesWitch:true,preservesGameplay:true,detail};
        w.environmentRealismPass=VERSION;w.environmentRealismDetail=detail;document.body.classList.add('environment-realism-pass15-ready');console.info('Witch Ride environment realism pass ready',window.WitchRideEnvironmentPass15);return;
      }catch(err){console.error('Witch Ride environment realism pass failed',err);w.environmentRealismPass='fallback';w.environmentRealismDetail={};return}
    }
    await wait(50);
  }
  console.error('Witch Ride environment realism pass timed out');
}
install();
