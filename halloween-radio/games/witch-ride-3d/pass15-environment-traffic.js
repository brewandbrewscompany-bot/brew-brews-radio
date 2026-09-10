import * as pc from 'playcanvas';

const VERSION='pass17-environment-headlight-bean-v1';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const REFLECTION_SLAB_PREFIXES=['Wet sheen','Pass11 Wet Reflection','Warm Road Reflection','Pass9 Moon Road Sheen','Pass9 Warm Road Pool','Wet Headlight Spill','Headlight Spill','Pass15 Neutral Reflection','Pass15 Warm Reflection','Oncoming Reflection'];
const HALO_SCALE=.34;

function walk(root,fn){if(!root)return;fn(root);for(const c of root.children||[])walk(c,fn)}
function renderMaterial(node){return node?.render?.material||node?.render?.meshInstances?.[0]?.material||null}
function tuneMaterial(m,{diffuse=null,gloss=null,metalness=null,opacity=null,emissive=null,emissiveIntensity=null}={}){
  if(!m)return;
  if(diffuse)m.diffuse=new pc.Color(...diffuse);
  if(gloss!==null)m.gloss=gloss;
  if(metalness!==null){m.useMetalness=true;m.metalness=metalness}
  if(opacity!==null)m.opacity=opacity;
  if(emissive)m.emissive=new pc.Color(...emissive);
  if(emissiveIntensity!==null)m.emissiveIntensity=emissiveIntensity;
  m.update();
}
function primitive(name,type,scale,pos,material,parent=null,rot=null){
  const e=new pc.Entity(name);e.addComponent('render',{type});e.setLocalScale(...scale);e.setLocalPosition(...pos);if(rot)e.setLocalEulerAngles(...rot);e.render.material=material;e.render.castShadows=false;e.render.receiveShadows=false;(parent||pc.app.root).addChild(e);return e;
}
function purgeReflectionSlabs(app){
  let disabled=0;
  walk(app.root,node=>{
    if(node!==app.root&&node.enabled!==false&&REFLECTION_SLAB_PREFIXES.some(prefix=>(node.name||'').startsWith(prefix))){node.enabled=false;disabled++}
  });
  return disabled;
}
function disableGroundFog(app){
  let disabled=0;
  for(let i=0;i<20;i++){
    const e=app.root.findByName(`Realism Fog ${i}`);if(e&&e.enabled!==false){e.enabled=false;disabled++}
  }
  return disabled;
}
function disableGroundMist(app){
  let disabled=0;
  for(let i=0;i<16;i++){
    const e=app.root.findByName(`Atmosphere Ground Mist ${i}`);if(e&&e.enabled!==false){e.enabled=false;disabled++}
  }
  return disabled;
}
function polishSceneReadability(app){
  const ambient=[.145,.153,.168],fogColor=[.066,.074,.082],exposure=1.70,fogDensity=.0086,gradeOpacity=.61;
  try{
    app.scene.exposure=exposure;
    app.scene.ambientLight=new pc.Color(...ambient);
    app.scene.fog=pc.FOG_EXP2;
    app.scene.fogColor=new pc.Color(...fogColor);
    app.scene.fogDensity=fogDensity;
  }catch{}
  const grade=document.getElementById('cinematic-grade-v7');if(grade)grade.style.opacity=String(gradeOpacity);
  return {sceneExposure:exposure,sceneAmbient:ambient,sceneFogColor:fogColor,sceneFogDensity:fogDensity,gradeOpacity};
}
function softWetTexture(app){
  const c=document.createElement('canvas');c.width=64;c.height=256;const ctx=c.getContext('2d'),img=ctx.createImageData(c.width,c.height),d=img.data;
  for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){
    const nx=(x-(c.width-1)/2)/(c.width*.5),ny=(y-c.height*.46)/(c.height*.54);
    const taper=.38+.62*Math.max(0,1-Math.abs(ny)*.72),grain=.92+.08*Math.sin(y*.31+x*.17);
    const a=Math.exp(-(nx*nx)/(0.085*taper*taper)-(ny*ny)/.54)*grain;
    const k=(y*c.width+x)*4;d[k]=255;d[k+1]=210;d[k+2]=154;d[k+3]=Math.round(255*Math.min(.94,a));
  }
  ctx.putImageData(img,0,0);
  const t=new pc.Texture(app.graphicsDevice,{width:c.width,height:c.height,format:pc.PIXELFORMAT_R8_G8_B8_A8,mipmaps:false});
  t.name='Pass17 soft wet reflection gradient';t.addressU=pc.ADDRESS_CLAMP_TO_EDGE;t.addressV=pc.ADDRESS_CLAMP_TO_EDGE;t.minFilter=pc.FILTER_LINEAR;t.magFilter=pc.FILTER_LINEAR;t.setSource(c);return t;
}
function softWetMaterial(app){
  const tex=softWetTexture(app),m=new pc.StandardMaterial();m.name='Pass17 feathered wet light';m.diffuse=new pc.Color(.44,.22,.09);m.emissive=new pc.Color(.86,.38,.105);m.emissiveIntensity=.33;m.emissiveMap=tex;m.opacity=.23;m.opacityMap=tex;m.opacityMapChannel='a';m.blendType=pc.BLEND_NORMAL;m.depthWrite=false;m.cull=pc.CULLFACE_NONE;m.useMetalness=true;m.metalness=0;m.gloss=.91;m.update();return m;
}
function addSoftHeadlightReflection(car,index,mat){
  let count=0;
  for(const x of [-.70,.70]){
    const e=primitive(`Pass15 Soft Wet Light ${index} ${count}`,'plane',[.50,1,6.0],[x,.026,5.15],mat,car,[0,0,0]);e.__softWetReflection=true;count++;
  }
  return count;
}

function neutralizeRoad(app){
  let roads=0,puddlesDisabled=0,coolSheensDisabled=0,baseSheenSlabsDisabled=0,legacyStreaksDisabled=0,legacyWarmDisabled=0,legacyWarmPoolsDisabled=0;
  for(let i=0;i<24;i++){const e=app.root.findByName(`Pass11 Wet Reflection ${i}`);if(e){e.enabled=false;legacyStreaksDisabled++}}
  for(let i=0;i<10;i++){const e=app.root.findByName(`Warm Road Reflection ${i}`);if(e){e.enabled=false;legacyWarmDisabled++}}
  for(let i=0;i<9;i++){
    const root=app.root.findByName(`Road Segment ${i}`);if(!root)continue;
    for(const child of root.children||[]){if(child.name==='Wet sheen'){child.enabled=false;baseSheenSlabsDisabled++}}
    const road=root.findByName('Road'),rm=renderMaterial(road);
    if(rm){tuneMaterial(rm,{diffuse:[.080,.078,.074],gloss:.92,metalness:.012});roads++}
    walk(root,n=>{if(n!==root&&/^Puddle( Variation)?/.test(n.name||'')&&n.enabled!==false){n.enabled=false;puddlesDisabled++}});
    const cool=root.findByName(`Pass9 Moon Road Sheen ${i}`);if(cool){cool.enabled=false;coolSheensDisabled++}
    const oldWarm=root.findByName(`Pass9 Warm Road Pool ${i}`);if(oldWarm){oldWarm.enabled=false;legacyWarmPoolsDisabled++}
  }
  return {roads,puddlesDisabled,coolSheensDisabled,baseSheenSlabsDisabled,legacyStreaksDisabled,legacyWarmDisabled,legacyWarmPoolsDisabled,reflectionPanels:0};
}

function refineVehicleHeadlights(app,softMat){
  let lensesAdjusted=0,mountsAdjusted=0,pointLightsAdjusted=0,spillsAdjusted=0,softWetReflections=0;
  for(let i=0;i<7;i++){
    const car=app.root.findByName(`1938 Coupe ${i}`);if(!car)continue;
    walk(car,node=>{
      if(node.name?.startsWith('headlamp_')){
        const s=node.getLocalScale();node.setLocalScale(s.x*.56,s.y*.56,s.z*.66);lensesAdjusted++;
        const m=renderMaterial(node);if(m)tuneMaterial(m,{diffuse:[.32,.18,.078],gloss:.70,metalness:.025,emissive:[1,.44,.13],emissiveIntensity:.46});
      }else if(node.name?.startsWith('lamp_mount_')){
        const s=node.getLocalScale();node.setLocalScale(s.x*.78,s.y*.78,s.z*.82);mountsAdjusted++;
      }else if(node.name?.startsWith('Headlight Glow')&&node.light){
        node.light.intensity=.34+(i%3)*.012;node.light.range=9.6;node.light.color=new pc.Color(1,.64,.35);pointLightsAdjusted++;
      }
    });
    softWetReflections+=addSoftHeadlightReflection(car,i,softMat);
    for(const name of [`Wet Headlight Spill ${i}`,`Headlight Spill ${i}`]){const spill=app.root.findByName(name);if(spill&&spill.enabled){spill.enabled=false;spillsAdjusted++}}
  }
  return {lensesAdjusted,mountsAdjusted,pointLightsAdjusted,spillsAdjusted,softWetReflections,pointIntensityBase:.34,pointRange:9.6,reflectionOpacity:.23,reflectionIntensity:.33};
}

function buildOncomingTraffic(app){
  const base=app.root.findByName('1938 Coupe 0');if(!base?.clone)return {cars:[]};
  const cars=[],lanes=[-4.25,4.20,-4.10,4.15],starts=[-42,-88,-138,-190];
  for(let i=0;i<4;i++){
    const e=base.clone();e.name=`Oncoming Traffic ${i}`;e.enabled=true;e.setPosition(lanes[i],0,starts[i]);e.setEulerAngles(0,(i%2?-.35:.35),0);e.setLocalScale(.84+(i%2)*.025,.84+(i%2)*.025,.84+(i%2)*.025);e.__lane=lanes[i];e.__reset=172+i*18;e.__offset=i*1.73;app.root.addChild(e);
    walk(e,node=>{
      if(node.light){node.light.intensity=.30+(i%2)*.012;node.light.range=9.2;node.light.color=new pc.Color(1,.65,.36);node.light.castShadows=false}
      if(node.name?.startsWith('headlamp_')){const s=node.getLocalScale();node.setLocalScale(s.x*.92,s.y*.92,s.z*.94);const m=renderMaterial(node);if(m)tuneMaterial(m,{emissive:[1,.45,.14],emissiveIntensity:.42})}
    });
    cars.push(e);
  }
  return {cars,pointIntensityBase:.30,pointRange:9.2};
}

function buildBeanHalos(app){
  const m=new pc.StandardMaterial();m.name='Pass17 soft bean halo';m.diffuse=new pc.Color(.24,.080,.024);m.emissive=new pc.Color(.48,.15,.038);m.emissiveIntensity=.22;m.opacity=.045;m.blendType=pc.BLEND_ADDITIVE;m.depthWrite=false;m.cull=pc.CULLFACE_NONE;m.useMetalness=true;m.metalness=0;m.gloss=.015;m.update();
  const halos=[];let beansRescaled=0,beanLightsSoftened=0;
  for(let i=0;i<16;i++){
    const bean=app.root.findByName(`Coffee Bean ${i}`);if(!bean)continue;
    bean.setLocalScale(.92,.92,.92);beansRescaled++;
    const old=bean.findByName?.(`Coffee Bean Halo ${i}`);if(old)old.enabled=false;
    const oldLight=bean.findByName?.(`Pass11 Bean Warm Light ${i}`);if(oldLight?.light){oldLight.light.intensity=.055;oldLight.light.range=2.1;oldLight.light.color=new pc.Color(1,.31,.09);beanLightsSoftened++}
    const h=primitive(`Pass15 Bean Halo ${i}`,'sphere',[HALO_SCALE,HALO_SCALE,HALO_SCALE],[0,0,0],m,bean);h.__phase=i*.63;halos.push(h);
  }
  return {halos,material:m,beansRescaled,beanLightsSoftened,beanScale:.92,haloScale:HALO_SCALE,haloOpacity:.045,haloIntensity:.22,beanLightIntensity:.055,beanLightRange:2.1};
}

function animate(app,traffic,beans){
  let t=0;
  app.on('update',dt=>{
    t+=dt;const s=window.WitchRide3D?.state||{},playing=s.mode==='playing',speed=s.speed||1,roadTravel=playing?11.2*speed:.18;
    for(let i=0;i<traffic.cars.length;i++){
      const e=traffic.cars[i],approach=playing?(roadTravel+8.0+speed*1.9):.22;e.translate(0,0,approach*dt);const p=e.getPosition();
      if(p.z>24)e.setPosition(e.__lane,0,p.z-e.__reset);
    }
    for(let i=0;i<beans.halos.length;i++){
      const h=beans.halos[i],pulse=1+Math.sin(t*1.65+h.__phase)*.022;h.setLocalScale(HALO_SCALE*pulse,HALO_SCALE*pulse,HALO_SCALE*pulse);
    }
  });
}

async function install(){
  for(let i=0;i<420;i++){
    const app=pc.app,w=window.WitchRide3D;
    if(app&&w?.ready&&w?.illuminationPass==='illumination-pass-v9'&&w?.worldDetailPass==='world-detail-pass-v6'&&window.WitchRideWitchCenterpiecePass?.active===true){
      try{
        const readability=polishSceneReadability(app),road=neutralizeRoad(app),groundFogDisabled=disableGroundFog(app),groundMistDisabled=disableGroundMist(app),softMat=softWetMaterial(app),headlights=refineVehicleHeadlights(app,softMat),traffic=buildOncomingTraffic(app),beans=buildBeanHalos(app);
        const purgedReflectionSlabs=purgeReflectionSlabs(app);
        animate(app,traffic,beans);
        const detail={...readability,roadNeutralCharcoal:road.roads===9,roadSegments:road.roads,puddlesDisabled:road.puddlesDisabled,groundFogDisabled,groundMistDisabled,coolRoadSheensDisabled:road.coolSheensDisabled,baseSheenSlabsDisabled:road.baseSheenSlabsDisabled,legacyWetStreaksDisabled:road.legacyStreaksDisabled,legacyWarmReflectionsDisabled:road.legacyWarmDisabled,legacyWarmPoolsDisabled:road.legacyWarmPoolsDisabled,reflectionPanels:road.reflectionPanels,purgedReflectionSlabs,headlightLensesAdjusted:headlights.lensesAdjusted,headlightMountsAdjusted:headlights.mountsAdjusted,headlightPointsAdjusted:headlights.pointLightsAdjusted,headlightSpillsAdjusted:headlights.spillsAdjusted,headlightPointIntensityBase:headlights.pointIntensityBase,headlightPointRange:headlights.pointRange,softWetReflections:headlights.softWetReflections,softWetReflectionOpacity:headlights.reflectionOpacity,softWetReflectionIntensity:headlights.reflectionIntensity,oncomingTraffic:traffic.cars.length,oncomingPointIntensityBase:traffic.pointIntensityBase,oncomingPointRange:traffic.pointRange,beanHalos:beans.halos.length,beansRescaled:beans.beansRescaled,beanScale:beans.beanScale,beanLightsSoftened:beans.beanLightsSoftened,beanHaloScale:beans.haloScale,beanHaloOpacity:beans.haloOpacity,beanHaloIntensity:beans.haloIntensity,beanLightIntensity:beans.beanLightIntensity,beanLightRange:beans.beanLightRange,witchTouched:false};
        w.pass15EnvironmentPass=VERSION;w.pass15EnvironmentDetail=detail;w.pass17EnvironmentPass=VERSION;w.pass17EnvironmentDetail=detail;window.WitchRidePass15Environment={active:true,version:VERSION,detail};window.WitchRidePass17Environment={active:true,version:VERSION,detail};document.body.classList.add('pass15-environment-ready','pass17-environment-ready');console.info('Witch Ride Pass 17 environment/headlight/bean polish ready',VERSION,detail);return;
      }catch(err){console.error('Witch Ride Pass 17 environment/headlight/bean polish failed',err);w.pass15EnvironmentPass='fallback';w.pass15EnvironmentDetail={};w.pass17EnvironmentPass='fallback';w.pass17EnvironmentDetail={};w.pass17EnvironmentError=err?.stack||err?.message||String(err);return}
    }
    await wait(50);
  }
  const w=window.WitchRide3D;if(w){w.pass15EnvironmentPass='fallback';w.pass15EnvironmentDetail={};w.pass17EnvironmentPass='fallback';w.pass17EnvironmentDetail={};w.pass17EnvironmentError='timed out waiting for Pass 17 scene stack'}
}
install();
