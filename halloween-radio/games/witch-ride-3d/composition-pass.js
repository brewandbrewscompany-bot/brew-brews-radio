import * as pc from 'playcanvas';

const VERSION='composition-pass-v11-reference-match';
const wait=ms=>new Promise(r=>setTimeout(r,ms));

function walk(root,fn){fn(root);for(const c of root.children||[])walk(c,fn)}
function meshInstances(root){const out=[];for(const r of root?.findComponents?.('render')||[])for(const mi of r.meshInstances||[])out.push(mi);return out}
function styleStatic(root){root.findComponents?.('render')?.forEach(r=>{r.castShadows=false;r.receiveShadows=true});return root}
function instantiate(asset,name){const e=asset.resource.instantiateRenderEntity();e.name=name;styleStatic(e);return e}
function mat(name,color,metalness=.0,gloss=.18,emissive=null,opacity=1,blend=pc.BLEND_NORMAL){const m=new pc.StandardMaterial();m.name=name;m.diffuse=new pc.Color(...color);m.useMetalness=true;m.metalness=metalness;m.gloss=gloss;if(emissive){m.emissive=new pc.Color(...emissive);m.emissiveIntensity=1}if(opacity<1){m.opacity=opacity;m.blendType=blend;m.depthWrite=false;m.cull=pc.CULLFACE_NONE}m.update();return m}
function fogMat(tex,name,color,opacity,intensity){const m=mat(name,color,0,.06,color,opacity,pc.BLEND_ADDITIVE);m.diffuseMap=tex;m.opacityMap=tex;m.opacityMapChannel='a';m.emissiveMap=tex;m.emissiveIntensity=intensity;m.update();return m}
function primitive(name,type,scale,pos,material,parent,rot=null){const e=new pc.Entity(name);e.addComponent('render',{type});e.setLocalScale(...scale);e.setLocalPosition(...pos);if(rot)e.setLocalEulerAngles(...rot);e.render.material=material;e.render.castShadows=false;e.render.receiveShadows=false;(parent||pc.app.root).addChild(e);return e}

function referenceCollectibles(app){
  let halos=0,steam=0,beanSurfaces=0,beanLights=0;
  for(let i=0;i<16;i++){
    const halo=app.root.findByName(`Coffee Bean Halo ${i}`);if(halo){halo.setLocalScale(.56,.27,.56);const m=halo.render?.material||halo.render?.meshInstances?.[0]?.material;if(m){m.opacity=.072;m.emissiveIntensity=.82;m.update()}halos++}
    for(let s=0;s<2;s++){const w=app.root.findByName(`Coffee Steam ${i}-${s}`);if(!w)continue;const m=w.render?.material||w.render?.meshInstances?.[0]?.material;if(m){m.opacity=.055;m.emissiveIntensity=.10;m.update()}w.setLocalScale(.26,1,.44);steam++}
    const bean=app.root.findByName(`Coffee Bean ${i}`);if(bean){
      bean.setLocalScale(1.30,1.30,1.30);
      for(const mi of meshInstances(bean)){const n=(mi.material?.name||'').toLowerCase();if(n.includes('v8 bean')||n.includes('roasted coffee')){mi.material.emissiveIntensity=.31;mi.material.gloss=Math.max(.54,mi.material.gloss||0);mi.material.update();beanSurfaces++}}
      let glow=bean.findByName(`Pass11 Bean Warm Light ${i}`);if(!glow){glow=new pc.Entity(`Pass11 Bean Warm Light ${i}`);glow.addComponent('light',{type:'point',color:new pc.Color(1,.24,.035),intensity:.12,range:3.4,castShadows:false});glow.setLocalPosition(0,-.18,.05);bean.addChild(glow)}beanLights++
    }
  }
  return {referenceBeanHalos:halos,referenceBeanSteam:steam,readableBeanSurfaces:beanSurfaces,beanWarmLights:beanLights};
}

function tuneReferenceRoad(app){
  let roadMaterials=0,puddleMaterials=0;
  const road=app.root.findByName('Road');
  for(const mi of meshInstances(road)){const m=mi.material;if(!m)continue;m.diffuse=new pc.Color(.112,.124,.139);m.gloss=.72;m.bumpiness=.76;m.update();roadMaterials++}
  const puddle=app.root.findByName('Puddle 0');
  for(const mi of meshInstances(puddle)){const m=mi.material;if(!m)continue;m.diffuse=new pc.Color(.085,.115,.155);m.gloss=.86;m.opacity=Math.max(.30,m.opacity||0);m.update();puddleMaterials++}
  return {roadMaterials,puddleMaterials};
}

function buildHamlet(app){
  const asset=app.assets.find('haunted-roastery.glb','container');if(!asset?.resource)throw new Error('haunted-roastery GLB unavailable for composition pass');
  const windowA=mat('hamlet warm window',[.42,.15,.028],0,.48,[1,.30,.040]);windowA.emissiveIntensity=2.25;windowA.update();
  const windowB=mat('hamlet dim window',[.25,.078,.014],0,.52,[.78,.14,.018]);windowB.emissiveIntensity=1.35;windowB.update();
  const setups=[[-1,-66,.34,22],[1,-112,.27,-31],[-1,-162,.30,37],[1,-213,.24,-18]],buildings=[],windows=[],lights=[];
  setups.forEach(([side,z,scale,yaw],i)=>{
    const b=instantiate(asset,`Pass10 Haunted Outbuilding ${i}`);b.setPosition(side*(17.5+(i%2)*2.2),-.08,z);b.setLocalScale(scale,scale,scale);b.setEulerAngles(0,yaw,0);b.__side=side;b.__reset=258+i*7;b.__x=side*(17.5+(i%2)*2.2);app.root.addChild(b);
    walk(b,n=>{const nm=(n.name||'').toLowerCase();if(nm.includes('sign')||nm.includes('brew & brews'))n.enabled=false});
    const local=[[-3.6,3.15,2.80],[-1.25,3.15,2.80],[1.28,3.15,2.80],[3.72,3.15,2.80]];local.forEach((p,j)=>windows.push(primitive(`Pass10 Hamlet Window ${i}-${j}`,'box',[.78,.58,.025],p,(i+j)%3?windowA:windowB,b)));
    const l=new pc.Entity(`Pass10 Hamlet Lamp ${i}`);l.addComponent('light',{type:'point',color:new pc.Color(1,.38,.075),intensity:.28,range:9,castShadows:false});l.setLocalPosition(side<0?2.8:-2.8,2.8,3.15);b.addChild(l);lights.push(l);buildings.push(b)
  });return {buildings,windows,lights};
}

function buildRoadsideDensity(app){
  const treeAsset=app.assets.find('dead-tree.glb','container'),fenceAsset=app.assets.find('haunted-fence.glb','container');if(!treeAsset?.resource||!fenceAsset?.resource)throw new Error('production roadside GLBs unavailable');const trees=[],fences=[];
  for(let i=0;i<10;i++){const side=i%2?-1:1,e=instantiate(treeAsset,`Pass10 Midground Tree ${i}`),scale=.52+(i%4)*.055;e.setPosition(side*(13.7+(i%3)*1.15),-.06,-36-i*21);e.setLocalScale(scale,scale,scale);e.setEulerAngles(0,(i*67+21)%360,side*((i%3)-1)*3.3);e.__side=side;e.__reset=246;e.__x=side*(13.7+(i%3)*1.15);app.root.addChild(e);trees.push(e)}
  for(let i=0;i<8;i++){const side=i%2?-1:1,e=instantiate(fenceAsset,`Pass10 Midground Fence ${i}`),scale=.68+(i%3)*.045;e.setPosition(side*9.4,-.04,-48-i*28);e.setLocalScale(scale,scale,scale);e.setEulerAngles(0,side<0?9:-9,(i%3-1)*1.8);e.__side=side;e.__reset=238;e.__x=side*9.4;app.root.addChild(e);fences.push(e)}return {trees,fences};
}

function buildRoadTexture(app,fogTex){
  const cool=fogMat(fogTex,'pass11 wet reflection cool',[.20,.31,.44],.055,.70),warm=fogMat(fogTex,'pass11 wet reflection warm',[.72,.20,.032],.050,.92),streaks=[];
  for(let i=0;i<24;i++){const side=((i*37)%100)/100*2-1,x=side*5.1,z=10-i*9.4,w=.22+(i%5)*.075,l=1.8+(i%6)*.55,e=primitive(`Pass11 Wet Reflection ${i}`,'plane',[w,1,l],[x,.176,z],i%5===0?warm:cool,app.root);e.setEulerAngles(0,(i%7-3)*3.1,0);e.__reset=228;e.__baseX=x;streaks.push(e)}
  const leafMats=[mat('wet copper leaf',[.28,.090,.020],0,.30,[.045,.012,.002]),mat('wet umber leaf',[.16,.075,.030],0,.34),mat('wet russet leaf',[.23,.064,.023],0,.31)],debris=[];
  for(let i=0;i<30;i++){const x=(((i*53)%97)/96*2-1)*6.1,z=8-i*7.3,e=primitive(`Pass10 Road Leaf ${i}`,'sphere',[.055+(i%3)*.018,.012,.11+(i%4)*.018],[x,.185,z],leafMats[i%3],app.root);e.setEulerAngles((i*17)%40,(i*73)%360,(i%5-2)*6);e.__reset=226;e.__baseX=x;debris.push(e)}return {streaks,debris};
}

function buildForegroundFill(app){const l=new pc.Entity('Pass11 Foreground Moon Fill');l.addComponent('light',{type:'point',color:new pc.Color(.27,.39,.57),intensity:.42,range:40,castShadows:false});l.setPosition(0,4.2,7.5);app.root.addChild(l);return l}
function animate(app,parts){app.on('update',dt=>{dt=Math.min(.04,dt);const s=window.WitchRide3D?.state||{},travel=(s.mode==='playing'?11.2*(s.speed||1):.18)*dt;for(const e of [...parts.buildings,...parts.trees,...parts.fences]){e.translate(0,0,travel);const p=e.getPosition();if(p.z>30)e.setPosition(e.__x,p.y,p.z-e.__reset)}for(const e of [...parts.streaks,...parts.debris]){e.translate(0,0,travel);const p=e.getPosition();if(p.z>18)e.setPosition(e.__baseX,p.y,p.z-e.__reset)}})}

async function install(){
  for(let i=0;i<360;i++){
    const app=pc.app,w=window.WitchRide3D;if(app&&w?.ready&&w?.illuminationPass==='illumination-pass-v9'){
      try{
        const fogTex=app.assets.find('fog-sheet.png','texture')?.resource;if(!fogTex)throw new Error('fog-sheet unavailable');app.scene.ambientLight=new pc.Color(.155,.170,.205);app.scene.exposure=1.82;
        const beans=referenceCollectibles(app),roadTune=tuneReferenceRoad(app),hamlet=buildHamlet(app),roadside=buildRoadsideDensity(app),road=buildRoadTexture(app,fogTex),fill=buildForegroundFill(app);animate(app,{...hamlet,...roadside,...road});
        const detail={...beans,...roadTune,hauntedOutbuildings:hamlet.buildings.length,hamletWindows:hamlet.windows.length,hamletLights:hamlet.lights.length,midgroundTrees:roadside.trees.length,midgroundFences:roadside.fences.length,wetMicroReflections:road.streaks.length,roadDebris:road.debris.length,foregroundFill:fill?1:0,compositionExposure:1.82,compositionAmbient:[.155,.170,.205]};w.compositionPass=VERSION;w.compositionDetail=detail;w.compositionError='';document.body.classList.add('composition-pass-ready');console.info('Witch Ride composition pass ready',VERSION,detail);return
      }catch(err){console.error('Witch Ride composition pass failed',err);w.compositionPass='fallback';w.compositionDetail={};w.compositionError=err?.stack||err?.message||String(err);return}
    }await wait(50)
  }const w=window.WitchRide3D;if(w){w.compositionPass='fallback';w.compositionDetail={};w.compositionError='timed out waiting for illumination pass'}
}
install();
