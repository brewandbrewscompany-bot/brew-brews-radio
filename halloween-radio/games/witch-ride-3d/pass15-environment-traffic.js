import * as pc from 'playcanvas';

const VERSION='pass17-environment-headlight-bean-v3';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const REFLECTION_SLAB_PREFIXES=['Wet sheen','Pass11 Wet Reflection','Warm Road Reflection','Pass9 Moon Road Sheen','Pass9 Warm Road Pool','Wet Headlight Spill','Headlight Spill','Pass15 Neutral Reflection','Pass15 Warm Reflection','Oncoming Reflection','Pass15 Soft Wet Light'];

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
function purgeLegacyHeadlightVolumes(app){
  let disabled=0;
  walk(app.root,node=>{
    if(node!==app.root&&(node.name||'').startsWith('Fog Headlight Volume')&&node.enabled!==false){node.enabled=false;disabled++}
  });
  return disabled;
}
function disableGroundFog(app){let disabled=0;for(let i=0;i<20;i++){const e=app.root.findByName(`Realism Fog ${i}`);if(e&&e.enabled!==false){e.enabled=false;disabled++}}return disabled}
function disableGroundMist(app){let disabled=0;for(let i=0;i<16;i++){const e=app.root.findByName(`Atmosphere Ground Mist ${i}`);if(e&&e.enabled!==false){e.enabled=false;disabled++}}return disabled}

function polishSceneReadability(app){
  // Composition Pass 11 lands at exposure 1.82 / ambient .155,.170,.205. Pass 17 must lift from that accepted RC, not reduce it.
  const ambient=[.175,.186,.205],fogColor=[.072,.078,.082],exposure=1.96,fogDensity=.0082,gradeOpacity=.56;
  try{
    app.scene.exposure=exposure;
    app.scene.ambientLight=new pc.Color(...ambient);
    app.scene.fog=pc.FOG_EXP2;
    app.scene.fogColor=new pc.Color(...fogColor);
    app.scene.fogDensity=fogDensity;
  }catch{}
  const grade=document.getElementById('cinematic-grade-v7');if(grade)grade.style.opacity=String(gradeOpacity);
  const skyFill=app.root.findByName('Cinematic Sky Fill');if(skyFill?.light){skyFill.light.intensity=.27;skyFill.light.color=new pc.Color(.25,.31,.39)}
  return {sceneExposure:exposure,sceneAmbient:ambient,sceneFogColor:fogColor,sceneFogDensity:fogDensity,gradeOpacity,skyFillIntensity:skyFill?.light?.intensity||0};
}

function wetStreakTexture(app){
  const c=document.createElement('canvas');c.width=64;c.height=192;const ctx=c.getContext('2d'),img=ctx.createImageData(c.width,c.height),d=img.data;
  for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){
    const nx=(x-(c.width-1)/2)/(c.width*.5),ny=(y-(c.height-1)/2)/(c.height*.5);
    const edge=Math.exp(-(nx*nx)/.085-(ny*ny)/.68),broken=.78+.16*Math.sin(y*.41+x*.19)+.06*Math.sin(y*.93-x*.27);
    const a=Math.max(0,Math.min(1,edge*broken));const k=(y*c.width+x)*4;d[k]=255;d[k+1]=206;d[k+2]=142;d[k+3]=Math.round(255*a);
  }
  ctx.putImageData(img,0,0);
  const t=new pc.Texture(app.graphicsDevice,{width:c.width,height:c.height,format:pc.PIXELFORMAT_R8_G8_B8_A8,mipmaps:false});
  t.name='Pass17 broken wet streak';t.addressU=pc.ADDRESS_CLAMP_TO_EDGE;t.addressV=pc.ADDRESS_CLAMP_TO_EDGE;t.minFilter=pc.FILTER_LINEAR;t.magFilter=pc.FILTER_LINEAR;t.setSource(c);return t;
}
function wetStreakMaterial(app){
  const tex=wetStreakTexture(app),m=new pc.StandardMaterial();m.name='Pass17 restrained wet headlight streak';m.diffuse=new pc.Color(.32,.17,.075);m.emissive=new pc.Color(.68,.29,.075);m.emissiveIntensity=.18;m.emissiveMap=tex;m.opacity=.13;m.opacityMap=tex;m.opacityMapChannel='a';m.blendType=pc.BLEND_NORMAL;m.depthWrite=false;m.cull=pc.CULLFACE_NONE;m.useMetalness=true;m.metalness=0;m.gloss=.92;m.update();return m;
}
function addWetHeadlightStreaks(car,index,mat){
  let count=0;
  for(const x of [-.70,.70])for(const seg of [[3.65,.14,1.18],[5.65,.095,1.42]]){
    const e=primitive(`Pass17 Wet Reflection ${index} ${count}`,'plane',[seg[1],1,seg[2]],[x,.027,seg[0]],mat,car);e.__wetHeadlightStreak=true;count++;
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
    if(rm){tuneMaterial(rm,{diffuse:[.102,.100,.096],gloss:.93,metalness:.012});roads++}
    walk(root,n=>{if(n!==root&&/^Puddle( Variation)?/.test(n.name||'')&&n.enabled!==false){n.enabled=false;puddlesDisabled++}});
    const cool=root.findByName(`Pass9 Moon Road Sheen ${i}`);if(cool){cool.enabled=false;coolSheensDisabled++}
    const oldWarm=root.findByName(`Pass9 Warm Road Pool ${i}`);if(oldWarm){oldWarm.enabled=false;legacyWarmPoolsDisabled++}
  }
  return {roads,puddlesDisabled,coolSheensDisabled,baseSheenSlabsDisabled,legacyStreaksDisabled,legacyWarmDisabled,legacyWarmPoolsDisabled,reflectionPanels:0};
}

function refineVehicleHeadlights(app,streakMat){
  let lensesAdjusted=0,mountsAdjusted=0,pointLightsAdjusted=0,spillsAdjusted=0,wetReflectionStreaks=0;
  for(let i=0;i<7;i++){
    const car=app.root.findByName(`1938 Coupe ${i}`);if(!car)continue;
    walk(car,node=>{
      if(node.name?.startsWith('headlamp_')){
        const s=node.getLocalScale();node.setLocalScale(s.x*.56,s.y*.56,s.z*.66);lensesAdjusted++;
        const m=renderMaterial(node);if(m)tuneMaterial(m,{diffuse:[.34,.20,.09],gloss:.72,metalness:.025,emissive:[1,.47,.15],emissiveIntensity:.78});
      }else if(node.name?.startsWith('lamp_mount_')){
        const s=node.getLocalScale();node.setLocalScale(s.x*.78,s.y*.78,s.z*.82);mountsAdjusted++;
      }else if(node.name?.startsWith('Headlight Glow')&&node.light){
        node.light.intensity=.62+(i%3)*.018;node.light.range=13.2;node.light.color=new pc.Color(1,.66,.39);pointLightsAdjusted++;
      }
    });
    wetReflectionStreaks+=addWetHeadlightStreaks(car,i,streakMat);
    for(const name of [`Wet Headlight Spill ${i}`,`Headlight Spill ${i}`]){const spill=app.root.findByName(name);if(spill&&spill.enabled){spill.enabled=false;spillsAdjusted++}}
  }
  return {lensesAdjusted,mountsAdjusted,pointLightsAdjusted,spillsAdjusted,wetReflectionStreaks,pointIntensityBase:.62,pointRange:13.2,reflectionOpacity:.13,reflectionIntensity:.18};
}

function buildOncomingTraffic(app){
  const base=app.root.findByName('1938 Coupe 0');if(!base?.clone)return {cars:[]};
  const cars=[],lanes=[-4.25,4.20,-4.10,4.15],starts=[-42,-88,-138,-190];
  for(let i=0;i<4;i++){
    const e=base.clone();e.name=`Oncoming Traffic ${i}`;e.enabled=true;e.setPosition(lanes[i],0,starts[i]);e.setEulerAngles(0,(i%2?-.35:.35),0);e.setLocalScale(.84+(i%2)*.025,.84+(i%2)*.025,.84+(i%2)*.025);e.__lane=lanes[i];e.__reset=172+i*18;e.__offset=i*1.73;app.root.addChild(e);
    walk(e,node=>{
      if(node.light){node.light.intensity=.47+(i%2)*.018;node.light.range=11.4;node.light.color=new pc.Color(1,.66,.40);node.light.castShadows=false}
      if(node.name?.startsWith('headlamp_')){const s=node.getLocalScale();node.setLocalScale(s.x*.92,s.y*.92,s.z*.94);const m=renderMaterial(node);if(m)tuneMaterial(m,{emissive:[1,.47,.15],emissiveIntensity:.66})}
    });
    cars.push(e);
  }
  return {cars,pointIntensityBase:.47,pointRange:11.4};
}

function buildBeanHalos(app){
  const halos=[];let beansRescaled=0,beanLightsSoftened=0,halosReactivated=0;
  for(let i=0;i<16;i++){
    const bean=app.root.findByName(`Coffee Bean ${i}`);if(!bean)continue;
    bean.setLocalScale(.92,.92,.92);beansRescaled++;
    const halo=bean.findByName?.(`Coffee Bean Halo ${i}`);
    if(halo){halo.enabled=true;halo.setLocalScale(.66,.66,.66);const hm=renderMaterial(halo);if(hm)tuneMaterial(hm,{diffuse:[.46,.105,.025],opacity:.070,emissive:[.64,.16,.035],emissiveIntensity:.58});halos.push(halo);halosReactivated++}
    const oldLight=bean.findByName?.(`Pass11 Bean Warm Light ${i}`);if(oldLight?.light){oldLight.light.intensity=.078;oldLight.light.range=2.55;oldLight.light.color=new pc.Color(1,.34,.105);beanLightsSoftened++}
  }
  return {halos,beansRescaled,beanLightsSoftened,halosReactivated,beanScale:.92,haloScale:.66,haloOpacity:.070,haloIntensity:.58,beanLightIntensity:.078,beanLightRange:2.55};
}

function animate(app,traffic){
  app.on('update',dt=>{
    const s=window.WitchRide3D?.state||{},playing=s.mode==='playing',speed=s.speed||1,roadTravel=playing?11.2*speed:.18;
    for(let i=0;i<traffic.cars.length;i++){
      const e=traffic.cars[i],approach=playing?(roadTravel+8.0+speed*1.9):.22;e.translate(0,0,approach*dt);const p=e.getPosition();
      if(p.z>24)e.setPosition(e.__lane,0,p.z-e.__reset);
    }
  });
}

async function install(){
  for(let i=0;i<420;i++){
    const app=pc.app,w=window.WitchRide3D;
    if(app&&w?.ready&&w?.illuminationPass==='illumination-pass-v9'&&w?.worldDetailPass==='world-detail-pass-v6'&&window.WitchRideWitchCenterpiecePass?.active===true){
      try{
        const readability=polishSceneReadability(app),road=neutralizeRoad(app),groundFogDisabled=disableGroundFog(app),groundMistDisabled=disableGroundMist(app),streakMat=wetStreakMaterial(app),headlights=refineVehicleHeadlights(app,streakMat),traffic=buildOncomingTraffic(app),beans=buildBeanHalos(app);
        const legacyHeadlightVolumesDisabled=purgeLegacyHeadlightVolumes(app),purgedReflectionSlabs=purgeReflectionSlabs(app);
        animate(app,traffic);
        const detail={...readability,roadNeutralCharcoal:road.roads===9,roadSegments:road.roads,puddlesDisabled:road.puddlesDisabled,groundFogDisabled,groundMistDisabled,coolRoadSheensDisabled:road.coolSheensDisabled,baseSheenSlabsDisabled:road.baseSheenSlabsDisabled,legacyWetStreaksDisabled:road.legacyStreaksDisabled,legacyWarmReflectionsDisabled:road.legacyWarmDisabled,legacyWarmPoolsDisabled:road.legacyWarmPoolsDisabled,reflectionPanels:road.reflectionPanels,purgedReflectionSlabs,legacyHeadlightVolumesDisabled,headlightLensesAdjusted:headlights.lensesAdjusted,headlightMountsAdjusted:headlights.mountsAdjusted,headlightPointsAdjusted:headlights.pointLightsAdjusted,headlightSpillsAdjusted:headlights.spillsAdjusted,headlightPointIntensityBase:headlights.pointIntensityBase,headlightPointRange:headlights.pointRange,wetReflectionStreaks:headlights.wetReflectionStreaks,wetReflectionOpacity:headlights.reflectionOpacity,wetReflectionIntensity:headlights.reflectionIntensity,oncomingTraffic:traffic.cars.length,oncomingPointIntensityBase:traffic.pointIntensityBase,oncomingPointRange:traffic.pointRange,beanHalos:beans.halos.length,beanHalosReactivated:beans.halosReactivated,beansRescaled:beans.beansRescaled,beanScale:beans.beanScale,beanLightsSoftened:beans.beanLightsSoftened,beanHaloScale:beans.haloScale,beanHaloOpacity:beans.haloOpacity,beanHaloIntensity:beans.haloIntensity,beanLightIntensity:beans.beanLightIntensity,beanLightRange:beans.beanLightRange,witchTouched:false};
        w.pass15EnvironmentPass=VERSION;w.pass15EnvironmentDetail=detail;w.pass17EnvironmentPass=VERSION;w.pass17EnvironmentDetail=detail;window.WitchRidePass15Environment={active:true,version:VERSION,detail};window.WitchRidePass17Environment={active:true,version:VERSION,detail};document.body.classList.add('pass15-environment-ready','pass17-environment-ready');console.info('Witch Ride Pass 17 environment/headlight/bean polish ready',VERSION,detail);return;
      }catch(err){console.error('Witch Ride Pass 17 environment/headlight/bean polish failed',err);w.pass15EnvironmentPass='fallback';w.pass15EnvironmentDetail={};w.pass17EnvironmentPass='fallback';w.pass17EnvironmentDetail={};w.pass17EnvironmentError=err?.stack||err?.message||String(err);return}
    }
    await wait(50);
  }
  const w=window.WitchRide3D;if(w){w.pass15EnvironmentPass='fallback';w.pass15EnvironmentDetail={};w.pass17EnvironmentPass='fallback';w.pass17EnvironmentDetail={};w.pass17EnvironmentError='timed out waiting for Pass 17 scene stack'}
}
install();
