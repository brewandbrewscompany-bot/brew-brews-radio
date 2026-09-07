import * as pc from 'playcanvas';

const VERSION='illumination-pass-v9';
const wait=ms=>new Promise(r=>setTimeout(r,ms));

function meshInstances(root){const out=[];for(const r of root?.findComponents?.('render')||[])for(const mi of r.meshInstances||[])out.push(mi);return out}
function tuneMaterial(mat,{diffuse=null,gloss=null,opacity=null,emissive=null,emissiveIntensity=null}={}){
  if(!mat)return;
  if(diffuse)mat.diffuse=new pc.Color(...diffuse);
  if(gloss!==null)mat.gloss=gloss;
  if(opacity!==null)mat.opacity=opacity;
  if(emissive)mat.emissive=new pc.Color(...emissive);
  if(emissiveIntensity!==null)mat.emissiveIntensity=emissiveIntensity;
  mat.update();
}
function softMaterial(texture,name,color,opacity,intensity=1){
  const m=new pc.StandardMaterial();m.name=name;m.diffuse=new pc.Color(...color);m.emissive=new pc.Color(...color);m.emissiveIntensity=intensity;
  if(texture){m.diffuseMap=texture;m.opacityMap=texture;m.opacityMapChannel='a';m.emissiveMap=texture}
  m.opacity=opacity;m.blendType=pc.BLEND_ADDITIVE;m.depthWrite=false;m.cull=pc.CULLFACE_NONE;m.useMetalness=true;m.metalness=0;m.gloss=.08;m.update();return m
}
function primitive(name,type,scale,pos,material,parent=null,rot=null){
  const e=new pc.Entity(name);e.addComponent('render',{type});e.setLocalScale(...scale);e.setLocalPosition(...pos);if(rot)e.setLocalEulerAngles(...rot);e.render.material=material;e.render.castShadows=false;e.render.receiveShadows=false;(parent||pc.app.root).addChild(e);return e
}
function tuneScene(app){
  app.scene.ambientLight=new pc.Color(.125,.142,.172);
  try{app.scene.exposure=1.58;app.scene.fog=pc.FOG_EXP2;app.scene.fogColor=new pc.Color(.060,.078,.096);app.scene.fogDensity=.0092}catch{}
  const moon=app.root.findByName('Moon Light');if(moon?.light){moon.light.intensity=1.88;moon.light.color=new pc.Color(.59,.69,.89);moon.light.shadowDistance=108}
  const warm=app.root.findByName('Warm Horizon');if(warm?.light){warm.light.intensity=.48;warm.light.color=new pc.Color(.82,.36,.105)}
  const rim=app.root.findByName('Realism Cool Rim');if(rim?.light){rim.light.intensity=.43;rim.light.color=new pc.Color(.30,.43,.67)}
  const fill=new pc.Entity('Cinematic Sky Fill');fill.addComponent('light',{type:'directional',color:new pc.Color(.22,.31,.45),intensity:.22,castShadows:false});fill.setEulerAngles(15,132,-6);app.root.addChild(fill);
  const backdrop=app.root.findByName('Cinematic Haunted Horizon');if(backdrop?.render){const m=backdrop.render.material||backdrop.render.meshInstances?.[0]?.material;if(m){m.emissiveIntensity=1.02;m.diffuse=new pc.Color(.92,.94,.98);m.update()}}
  const grade=document.getElementById('cinematic-grade-v7');if(grade)grade.style.opacity='.68';const grain=document.getElementById('cinematic-grain-v7');if(grain)grain.style.opacity='.018';
  return {skyFill:1,backdropBoost:backdrop?1:0,exposure:1.58}
}
function tuneRoad(app,fogTex){
  const coolSheen=softMaterial(fogTex,'moonlit wet road sheen',[.18,.30,.43],.048,.72),warmSheen=softMaterial(fogTex,'soft tungsten wet road glow',[.72,.235,.035],.045,.94);let roadSegments=0,coolRoadSheens=0,warmRoadPools=0;
  for(let i=0;i<9;i++){
    const root=app.root.findByName(`Road Segment ${i}`);if(!root)continue;roadSegments++;
    const road=root.findByName('Road');if(road?.render){const m=road.render.material||road.render.meshInstances?.[0]?.material;tuneMaterial(m,{diffuse:[.115,.125,.137],gloss:.78})}
    for(const shoulderName of ['Shoulder L','Shoulder R']){const s=root.findByName(shoulderName);if(s?.render){const m=s.render.material||s.render.meshInstances?.[0]?.material;tuneMaterial(m,{diffuse:[.145,.098,.058],gloss:.34})}}
    const puddle=root.findByName(`Puddle Variation ${i}`);if(puddle?.render){const m=puddle.render.material||puddle.render.meshInstances?.[0]?.material;tuneMaterial(m,{diffuse:[.075,.105,.128],gloss:.985,opacity:.25})}
    const cool=primitive(`Pass9 Moon Road Sheen ${i}`,'plane',[5.4,1,10.5],[0,.158,-1.2],coolSheen,root);coolRoadSheens++;
    const side=i%2?-1:1;const warm=primitive(`Pass9 Warm Road Pool ${i}`,'plane',[2.5,1,5.8],[side*4.2,.164,-5+(i%3)*4.4],warmSheen,root);warmRoadPools++;
  }
  for(let i=0;i<10;i++){const e=app.root.findByName(`Warm Road Reflection ${i}`);if(e?.render){const m=e.render.material||e.render.meshInstances?.[0]?.material;tuneMaterial(m,{opacity:.17,emissive:[.26,.09,.010],emissiveIntensity:1.02})}}
  return {roadSegments,coolRoadSheens,warmRoadPools}
}
function softenHeadlights(app,fogTex){
  const spillMat=softMaterial(fogTex,'diffused tungsten headlight pool',[1,.34,.055],.064,1.08);let disabledHardCones=0,softHeadlightSpills=0,headlightPoints=0;
  for(let i=0;i<7;i++){
    const hard=app.root.findByName(`Fog Headlight Volume ${i}`);if(hard){hard.enabled=false;disabledHardCones++}
    const spill=app.root.findByName(`Wet Headlight Spill ${i}`);if(spill?.render){spill.render.material=spillMat;spill.setLocalScale(3.1,1,8.7);softHeadlightSpills++}
    const car=app.root.findByName(`1938 Coupe ${i}`);if(!car)continue;
    for(const c of car.children){if(c.name?.startsWith('Headlight Glow')&&c.light){c.light.intensity=.69+(i%3)*.035;c.light.range=16.5;c.light.color=new pc.Color(1,.49,.125);headlightPoints++}}
    for(const mi of meshInstances(car)){const n=(mi.material?.name||'').toLowerCase();if(n.includes('warm tungsten lens'))tuneMaterial(mi.material,{emissive:[1,.30,.035],emissiveIntensity:1.45})}
  }
  return {disabledHardCones,softHeadlightSpills,headlightPoints}
}
function tuneWitch(app){
  const witch=app.root.findByName('Witch Rig')||app.root.findByName('Witch Rig Fallback');if(!witch)return {witchFill:0};
  const rim=witch.findByName('Witch Rim Glow');if(rim?.light){rim.light.intensity=.78;rim.light.range=9.5;rim.light.color=new pc.Color(.28,.46,.76)}
  const ember=witch.findByName('Broom Ember Light');if(ember?.light){ember.light.intensity=1.18;ember.light.range=12.5;ember.light.color=new pc.Color(1,.28,.045)}
  const fill=new pc.Entity('Witch Warm Underfill');fill.addComponent('light',{type:'point',color:new pc.Color(1,.26,.055),intensity:.42,range:7.2,castShadows:false});fill.setLocalPosition(0,.10,2.15);witch.addChild(fill);
  return {witchFill:1}
}
function tuneWorld(app,fogTex){
  let roasteryWindows=0,pumpkinGlows=0;for(let i=0;i<6;i++){const e=app.root.findByName(`Roastery Window Glow ${i}`);if(e?.render){const m=e.render.material||e.render.meshInstances?.[0]?.material;if(m){m.emissiveIntensity=Math.max(2.15,m.emissiveIntensity||0);m.update();roasteryWindows++}}}
  const furnace=app.root.findByName('Roastery Furnace Glow');if(furnace?.render){const m=furnace.render.material||furnace.render.meshInstances?.[0]?.material;if(m){m.emissiveIntensity=2.25;m.update()}}
  for(let i=0;i<10;i++){const p=app.root.findByName(`Pumpkin ${i}`);if(!p)continue;for(const mi of meshInstances(p)){const n=(mi.material?.name||'').toLowerCase();if(n.includes('carved pumpkin glow')){mi.material.emissiveIntensity=1.65;mi.material.emissive=new pc.Color(1,.18,.018);mi.material.update();pumpkinGlows++}}}
  const postMat=new pc.StandardMaterial();postMat.name='weathered lantern post';postMat.diffuse=new pc.Color(.055,.042,.035);postMat.useMetalness=true;postMat.metalness=.42;postMat.gloss=.18;postMat.update();
  const lampMat=new pc.StandardMaterial();lampMat.name='roadside tungsten lantern';lampMat.diffuse=new pc.Color(.72,.22,.035);lampMat.emissive=new pc.Color(1,.22,.025);lampMat.emissiveIntensity=1.55;lampMat.gloss=.42;lampMat.update();
  const haloMat=softMaterial(fogTex,'roadside lantern halo',[1,.22,.025],.10,1.0),lanterns=[];
  for(let i=0;i<10;i++){
    const side=i%2?-1:1,root=new pc.Entity(`Pass9 Roadside Lantern ${i}`);root.setPosition(side*(8.1+(i%3)*.35),0,-32-i*22);root.__side=side;root.__reset=232;app.root.addChild(root);
    primitive('lantern post','cylinder',[.10,2.45,.10],[0,1.18,0],postMat,root);primitive('lantern cap','cone',[.22,.30,.22],[0,2.62,0],postMat,root);primitive('lantern bulb','sphere',[.15,.18,.15],[0,2.45,0],lampMat,root);primitive('lantern halo','plane',[1.05,1,1.05],[0,2.45,.05],haloMat,root,[90,0,0]);lanterns.push(root)
  }
  let t=0;app.on('update',dt=>{t+=dt;const s=window.WitchRide3D?.state||{},travel=(s.mode==='playing'?11.2*(s.speed||1):.18)*dt;for(let i=0;i<lanterns.length;i++){const e=lanterns[i];e.translate(0,0,travel);const p=e.getPosition();if(p.z>22)e.setPosition(e.__side*(8.1+(i%3)*.35),0,p.z-e.__reset);const bulb=e.findByName('lantern bulb');if(bulb?.render?.material){bulb.render.material.emissiveIntensity=1.48+Math.sin(t*4.1+i*.73)*.07;bulb.render.material.update()}}});
  return {roasteryWindows,pumpkinGlows,roadsideLanterns:lanterns.length}
}
async function install(){
  for(let i=0;i<360;i++){
    const app=pc.app,w=window.WitchRide3D;
    if(app&&w?.ready&&w?.variationPass==='variation-pass-v8'){
      try{
        const fog=app.assets.find('fog-sheet.png','texture')?.resource;if(!fog)throw new Error('fog-sheet texture unavailable for illumination pass');
        const scene=tuneScene(app),road=tuneRoad(app,fog),headlights=softenHeadlights(app,fog),witch=tuneWitch(app),world=tuneWorld(app,fog);
        const detail={...scene,...road,...headlights,...witch,...world};w.illuminationPass=VERSION;w.illuminationDetail=detail;document.body.classList.add('illumination-pass-ready');console.info('Witch Ride illumination pass ready',VERSION,detail);return;
      }catch(err){console.error('Witch Ride illumination pass failed',err);w.illuminationPass='fallback';w.illuminationDetail={};w.illuminationError=err?.stack||err?.message||String(err);return}
    }
    await wait(50)
  }
  const w=window.WitchRide3D;if(w){w.illuminationPass='fallback';w.illuminationDetail={};w.illuminationError='timed out waiting for variation pass'}
}
install();
