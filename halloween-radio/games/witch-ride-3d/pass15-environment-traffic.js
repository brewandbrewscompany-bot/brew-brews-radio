import * as pc from 'playcanvas';

const VERSION='pass15-environment-traffic-v1';
const wait=ms=>new Promise(r=>setTimeout(r,ms));

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
function softMaterial(texture,name,color,opacity,intensity=.35){
  const m=new pc.StandardMaterial();m.name=name;m.diffuse=new pc.Color(...color);m.emissive=new pc.Color(...color);m.emissiveIntensity=intensity;
  if(texture){m.diffuseMap=texture;m.opacityMap=texture;m.opacityMapChannel='a';m.emissiveMap=texture}
  m.opacity=opacity;m.blendType=pc.BLEND_ADDITIVE;m.depthWrite=false;m.cull=pc.CULLFACE_NONE;m.useMetalness=true;m.metalness=0;m.gloss=.03;m.update();return m;
}
function primitive(name,type,scale,pos,material,parent=null,rot=null){
  const e=new pc.Entity(name);e.addComponent('render',{type});e.setLocalScale(...scale);e.setLocalPosition(...pos);if(rot)e.setLocalEulerAngles(...rot);e.render.material=material;e.render.castShadows=false;e.render.receiveShadows=false;(parent||pc.app.root).addChild(e);return e;
}

function neutralizeRoad(app,fogTex){
  const neutralReflection=softMaterial(fogTex,'Pass15 neutral wet reflection',[.34,.31,.27],.028,.22);
  const warmReflection=softMaterial(fogTex,'Pass15 restrained headlight reflection',[.72,.30,.075],.038,.40);
  let roads=0,puddles=0,coolSheensDisabled=0,reflectionRibbons=0,warmPools=0;
  for(let i=0;i<9;i++){
    const root=app.root.findByName(`Road Segment ${i}`);if(!root)continue;
    const road=root.findByName('Road');const rm=renderMaterial(road);
    if(rm){tuneMaterial(rm,{diffuse:[.078,.076,.072],gloss:.79,metalness:.018});roads++}
    const puddle=root.findByName(`Puddle Variation ${i}`);const pm=renderMaterial(puddle);
    if(pm){tuneMaterial(pm,{diffuse:[.052,.050,.047],gloss:.992,metalness:.025,opacity:.19});puddles++}
    const cool=root.findByName(`Pass9 Moon Road Sheen ${i}`);if(cool){cool.enabled=false;coolSheensDisabled++}
    const oldWarm=root.findByName(`Pass9 Warm Road Pool ${i}`);if(oldWarm){oldWarm.enabled=false}
    const side=i%2?-1:1;
    const ribbon=primitive(`Pass15 Neutral Reflection ${i}`,'plane',[4.8,1,10.8],[side*.42,.166,-1.0+(i%3)*1.6],neutralReflection,root);ribbon.__phase=i*.61;reflectionRibbons++;
    const warm=primitive(`Pass15 Warm Reflection ${i}`,'plane',[1.25,1,6.6],[side*4.18,.169,-4.4+(i%3)*3.6],warmReflection,root);warm.__phase=i*.47;warmPools++;
  }
  for(let i=0;i<10;i++){
    const e=app.root.findByName(`Warm Road Reflection ${i}`);const m=renderMaterial(e);
    if(e&&m){e.setLocalScale(.46,1,5.6);tuneMaterial(m,{diffuse:[.24,.13,.055],opacity:.075,emissive:[.20,.075,.012],emissiveIntensity:.52})}
  }
  return {roads,puddles,coolSheensDisabled,reflectionRibbons,warmPools,neutralReflection,warmReflection};
}

function refineVehicleHeadlights(app){
  let lensesAdjusted=0,mountsAdjusted=0,pointLightsAdjusted=0,spillsAdjusted=0;
  for(let i=0;i<7;i++){
    const car=app.root.findByName(`1938 Coupe ${i}`);if(!car)continue;
    walk(car,node=>{
      if(node.name?.startsWith('headlamp_')){
        const s=node.getLocalScale();node.setLocalScale(s.x*.78,s.y*.78,s.z*.86);lensesAdjusted++;
        const m=renderMaterial(node);if(m)tuneMaterial(m,{diffuse:[.43,.19,.055],gloss:.62,metalness:.035,emissive:[1,.31,.065],emissiveIntensity:.82});
      }else if(node.name?.startsWith('lamp_mount_')){
        const s=node.getLocalScale();node.setLocalScale(s.x*.90,s.y*.90,s.z*.93);mountsAdjusted++;
      }else if(node.name?.startsWith('Headlight Glow')&&node.light){
        node.light.intensity=.43+(i%3)*.018;node.light.range=12.2;node.light.color=new pc.Color(1,.56,.23);pointLightsAdjusted++;
      }
    });
    const spill=app.root.findByName(`Wet Headlight Spill ${i}`);if(spill){spill.setLocalScale(2.05,1,7.6);const m=renderMaterial(spill);if(m)tuneMaterial(m,{diffuse:[.63,.27,.075],opacity:.042,emissive:[.50,.18,.028],emissiveIntensity:.48});spillsAdjusted++}
  }
  return {lensesAdjusted,mountsAdjusted,pointLightsAdjusted,spillsAdjusted};
}

function buildOncomingTraffic(app,fogTex){
  const base=app.root.findByName('1938 Coupe 0');if(!base?.clone)return {cars:[],reflectionMaterial:null};
  const reflectionMaterial=softMaterial(fogTex,'Pass15 moving headlight reflection',[.78,.33,.085],.045,.42),cars=[];
  const lanes=[-4.25,4.20,-4.10,4.15],starts=[-38,-82,-132,-182];
  for(let i=0;i<4;i++){
    const e=base.clone();e.name=`Oncoming Traffic ${i}`;e.enabled=true;e.setPosition(lanes[i],0,starts[i]);e.setEulerAngles(0,(i%2?-.35:.35),0);e.setLocalScale(.88+(i%2)*.025,.88+(i%2)*.025,.88+(i%2)*.025);e.__lane=lanes[i];e.__reset=164+i*18;e.__offset=i*1.73;app.root.addChild(e);
    walk(e,node=>{if(node.light){node.light.intensity=.34+(i%2)*.025;node.light.range=10.5;node.light.color=new pc.Color(1,.57,.25);node.light.castShadows=false}});
    for(const x of [-.68,.68])primitive(`Oncoming Reflection ${i} ${x}`,'plane',[.72,1,5.4],[x,.035,5.3],reflectionMaterial,e);
    cars.push(e);
  }
  return {cars,reflectionMaterial};
}

function buildBeanHalos(app){
  const m=new pc.StandardMaterial();m.name='Pass15 subtle bean halo';m.diffuse=new pc.Color(.42,.12,.025);m.emissive=new pc.Color(.72,.20,.035);m.emissiveIntensity=.28;m.opacity=.045;m.blendType=pc.BLEND_ADDITIVE;m.depthWrite=false;m.cull=pc.CULLFACE_NONE;m.useMetalness=true;m.metalness=0;m.gloss=.02;m.update();
  const halos=[];
  for(let i=0;i<16;i++){
    const bean=app.root.findByName(`Coffee Bean ${i}`);if(!bean)continue;
    const old=bean.findByName?.(`Coffee Bean Halo ${i}`);if(old)old.enabled=false;
    const h=primitive(`Pass15 Bean Halo ${i}`,'sphere',[.43,.43,.43],[0,0,0],m,bean);h.__phase=i*.63;halos.push(h);
  }
  return {halos,material:m};
}

function animate(app,road,traffic,beans){
  let t=0;
  app.on('update',dt=>{
    t+=dt;const s=window.WitchRide3D?.state||{},playing=s.mode==='playing',speed=s.speed||1,roadTravel=playing?11.2*speed:.18;
    if(road.neutralReflection){road.neutralReflection.opacity=.025+Math.sin(t*.72)*.003;road.neutralReflection.update()}
    if(road.warmReflection){road.warmReflection.opacity=.034+Math.sin(t*1.1+.8)*.004;road.warmReflection.update()}
    if(traffic.reflectionMaterial){traffic.reflectionMaterial.opacity=.041+Math.sin(t*1.7)*.004;traffic.reflectionMaterial.update()}
    for(let i=0;i<traffic.cars.length;i++){
      const e=traffic.cars[i],approach=playing?(roadTravel+8.2+speed*2.1):.24;e.translate(0,0,approach*dt);const p=e.getPosition();
      if(p.z>24)e.setPosition(e.__lane,0,p.z-e.__reset);
    }
    for(let i=0;i<beans.halos.length;i++){
      const h=beans.halos[i],pulse=.97+Math.sin(t*2.2+h.__phase)*.03;h.setLocalScale(.43*pulse,.43*pulse,.43*pulse);
    }
  });
}

async function install(){
  for(let i=0;i<420;i++){
    const app=pc.app,w=window.WitchRide3D;
    if(app&&w?.ready&&w?.illuminationPass==='illumination-pass-v9'&&w?.worldDetailPass==='world-detail-pass-v6'&&window.WitchRideWitchCenterpiecePass?.active===true){
      try{
        const fogTex=app.assets.find('fog-sheet.png','texture')?.resource;if(!fogTex)throw new Error('fog-sheet texture unavailable for Pass 15 environment pass');
        const road=neutralizeRoad(app,fogTex),headlights=refineVehicleHeadlights(app),traffic=buildOncomingTraffic(app,fogTex),beans=buildBeanHalos(app);
        animate(app,road,traffic,beans);
        const detail={roadNeutralCharcoal:road.roads===9,roadSegments:road.roads,puddles:road.puddles,coolRoadSheensDisabled:road.coolSheensDisabled,reflectionRibbons:road.reflectionRibbons,warmReflectionPools:road.warmPools,headlightLensesAdjusted:headlights.lensesAdjusted,headlightMountsAdjusted:headlights.mountsAdjusted,headlightPointsAdjusted:headlights.pointLightsAdjusted,headlightSpillsAdjusted:headlights.spillsAdjusted,oncomingTraffic:traffic.cars.length,beanHalos:beans.halos.length,witchTouched:false};
        w.pass15EnvironmentPass=VERSION;w.pass15EnvironmentDetail=detail;window.WitchRidePass15Environment={active:true,version:VERSION,detail};document.body.classList.add('pass15-environment-ready');console.info('Witch Ride Pass 15 environment/traffic pass ready',VERSION,detail);return;
      }catch(err){console.error('Witch Ride Pass 15 environment/traffic pass failed',err);w.pass15EnvironmentPass='fallback';w.pass15EnvironmentDetail={};w.pass15EnvironmentError=err?.stack||err?.message||String(err);return}
    }
    await wait(50);
  }
  const w=window.WitchRide3D;if(w){w.pass15EnvironmentPass='fallback';w.pass15EnvironmentDetail={};w.pass15EnvironmentError='timed out waiting for Pass 15 scene stack'}
}
install();
