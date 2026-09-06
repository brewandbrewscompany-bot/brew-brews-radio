import * as pc from 'playcanvas';

const VERSION='atmosphere-pass-v5';
const wait=ms=>new Promise(r=>setTimeout(r,ms));

function textureAsset(app,url,name){
  const found=app.assets.find(name,'texture');
  if(found?.resource)return Promise.resolve(found.resource);
  return new Promise((resolve,reject)=>app.assets.loadFromUrlAndFilename(url,name,'texture',(err,asset)=>err?reject(err):resolve(asset.resource)));
}
function fogMaterial(texture,opacity=.13){
  const m=new pc.StandardMaterial();
  m.diffuse=new pc.Color(.40,.47,.52);m.diffuseMap=texture;m.opacityMap=texture;m.opacityMapChannel='a';m.opacity=opacity;
  m.emissive=new pc.Color(.055,.072,.086);m.emissiveMap=texture;m.emissiveIntensity=.34;m.blendType=pc.BLEND_NORMAL;m.depthWrite=false;m.cull=pc.CULLFACE_NONE;m.useMetalness=true;m.metalness=0;m.gloss=.05;m.update();return m;
}
function glowMaterial(color,opacity=.08){
  const m=new pc.StandardMaterial();m.diffuse=new pc.Color(...color);m.emissive=new pc.Color(...color);m.emissiveIntensity=1.2;m.opacity=opacity;m.blendType=pc.BLEND_ADDITIVE;m.depthWrite=false;m.cull=pc.CULLFACE_NONE;m.useMetalness=true;m.metalness=0;m.gloss=.18;m.update();return m;
}
function leafMaterial(){
  const m=new pc.StandardMaterial();m.diffuse=new pc.Color(.12,.065,.025);m.emissive=new pc.Color(.014,.006,.002);m.opacity=.72;m.blendType=pc.BLEND_NORMAL;m.depthWrite=true;m.useMetalness=true;m.metalness=0;m.gloss=.08;m.update();return m;
}
function entity(name,type,scale,pos,material,parent){
  const e=new pc.Entity(name);e.addComponent('render',{type});e.setLocalScale(...scale);e.setLocalPosition(...pos);e.render.material=material;e.render.castShadows=false;e.render.receiveShadows=false;(parent||pc.app.root).addChild(e);return e;
}
function addGroundMist(app,texture){
  texture.addressU=pc.ADDRESS_CLAMP_TO_EDGE;texture.addressV=pc.ADDRESS_CLAMP_TO_EDGE;
  const mat=fogMaterial(texture,.135),mist=[];
  for(let i=0;i<8;i++){
    const side=i%3===0?0:(i%2?-1:1),x=side*(3.8+(i%3)*2.1),z=-10-i*24;
    const e=entity(`Atmosphere Ground Mist ${i}`,'plane',[12+(i%3)*3,1,5.4+(i%2)*1.8],[x,.17,z],mat,app.root);
    e.__baseX=x;e.__phase=i*.83;e.__reset=-188-(i%3)*14;mist.push(e);
  }
  return mist;
}
function addDistanceFog(app,texture){
  const mats=[.08,.105,.125,.145].map(o=>fogMaterial(texture,o)),curtains=[];
  for(let i=0;i<4;i++){
    const e=entity(`Atmosphere Distance Fog ${i}`,'plane',[34+i*8,1,7.5+i*1.4],[i%2?-4:4,4.5+i*1.25,-54-i*24],mats[i],app.root);
    e.setLocalEulerAngles(90,0,0);e.__baseX=e.getPosition().x;e.__phase=i*1.17;curtains.push(e);
  }
  return curtains;
}
function addHeadlightFog(app){
  const beamMat=glowMaterial([1,.42,.105],.046),spillMat=glowMaterial([.58,.19,.025],.075),beams=[],spills=[];
  for(let i=0;i<7;i++){
    const car=app.root.findByName(`1938 Coupe ${i}`);if(!car)continue;
    const beam=entity(`Fog Headlight Volume ${i}`,'cone',[1.45,8.5,1.45],[0,1.12,6.8],beamMat,car);beam.setLocalEulerAngles(90,0,0);beams.push(beam);
    const spill=entity(`Wet Headlight Spill ${i}`,'plane',[2.05,1,7.2],[0,.08,6.5],spillMat,car);spills.push(spill);
  }
  return {beams,spills};
}
function addLeaves(app){
  const mat=leafMaterial(),leaves=[];
  for(let i=0;i<10;i++){
    const side=i%2?-1:1,x=side*(6.4+(i%4)*.72),z=-8-i*16,y=.8+(i%5)*.62;
    const e=entity(`Drifting Leaf ${i}`,'box',[.075+(i%3)*.018,.012,.13+(i%2)*.025],[x,y,z],mat,app.root);
    e.__side=side;e.__baseX=x;e.__phase=i*.79;e.__reset=-158-(i%4)*13;leaves.push(e);
  }
  return leaves;
}
function addEmbers(app){
  const witch=app.root.findByName('Witch Rig')||app.root.findByName('Witch Rig Fallback');if(!witch)return [];
  const mat=glowMaterial([1,.18,.018],.78),embers=[];
  for(let i=0;i<7;i++){
    const e=entity(`Restrained Broom Ember ${i}`,'sphere',[.035+(i%3)*.008,.035+(i%3)*.008,.035+(i%3)*.008],[(i%2?1:-1)*(.04+(i%3)*.025),-.78+(i%3)*.035,3.9+i*.33],mat,witch);
    e.__phase=i*.91;e.__start=3.88+(i%2)*.1;embers.push(e);
  }
  return embers;
}
function findRoasterySmoke(app){
  const smoke=[];for(let i=0;i<5;i++){const e=app.root.findByName(`Roastery Smoke ${i}`);if(e){const p=e.getLocalPosition();e.__smokeBase=new pc.Vec3(p.x,p.y,p.z);e.__smokePhase=i*.92;smoke.push(e)}}return smoke;
}
function tuneAtmosphere(app){
  try{app.scene.fog=pc.FOG_EXP2;app.scene.fogColor=new pc.Color(.032,.047,.061);app.scene.fogDensity=.0118;app.scene.exposure=1.36}catch{}
  const moon=app.root.findByName('Moon Light');if(moon?.light){moon.light.intensity=1.68;moon.light.color=new pc.Color(.49,.60,.77)}
  const warm=app.root.findByName('Warm Horizon');if(warm?.light)warm.light.intensity=.37;
}
function animate(app,{mist,curtains,leaves,embers,smoke}){
  let t=0;
  app.on('update',dt=>{
    t+=dt;const state=window.WitchRide3D?.state||{};const playing=state.mode==='playing';const speed=state.speed||1;const travel=playing?(4.2+speed*2.2):.28;
    for(const e of mist){const p=e.getPosition();p.z+=dt*travel;p.x=e.__baseX+Math.sin(t*.19+e.__phase)*.9;e.setPosition(p);if(p.z>18)e.setPosition(e.__baseX,.17,e.__reset)}
    for(const e of curtains){const p=e.getPosition();p.x=e.__baseX+Math.sin(t*.055+e.__phase)*2.2;e.setPosition(p)}
    for(let i=0;i<leaves.length;i++){
      const e=leaves[i],p=e.getPosition();p.z+=dt*(playing?(7+speed*3.1):.38);p.x=e.__baseX+Math.sin(t*.72+e.__phase)*1.15;p.y=.75+(i%5)*.62+Math.sin(t*1.15+e.__phase)*.42;e.setPosition(p);e.rotateLocal(dt*38*(i%2?-1:1),dt*57,dt*24);if(p.z>16){e.__baseX=e.__side*(6.2+((i+2)%4)*.8);e.setPosition(e.__baseX,.9+(i%4)*.58,e.__reset)}}
    for(let i=0;i<embers.length;i++){
      const e=embers[i],p=e.getLocalPosition();p.z+=dt*(playing?(1.25+speed*.72):.12);p.x=Math.sin(t*3.1+e.__phase)*(.055+(i%3)*.018);p.y=-.78+Math.sin(t*4.0+e.__phase)*.055;e.setLocalPosition(p);if(p.z>6.45)e.setLocalPosition(0,-.78,e.__start)
    }
    for(let i=0;i<smoke.length;i++){
      const e=smoke[i],b=e.__smokeBase,cycle=(t*.11+i*.17)%1,p=e.getLocalPosition();p.x=b.x+Math.sin(t*.19+e.__smokePhase)*(.18+i*.035);p.y=b.y+cycle*1.55;p.z=b.z+Math.cos(t*.15+e.__smokePhase)*.12;e.setLocalPosition(p);const s=1+cycle*.58;e.setLocalScale(s,s*.72,s)
    }
  });
}
async function install(){
  for(let i=0;i<300;i++){
    const app=pc.app;
    if(app&&window.WitchRide3D?.ready&&window.WitchRide3D?.environmentPass==='environment-material-pass-v4'){
      try{
        tuneAtmosphere(app);
        const fogTexture=await textureAsset(app,'assets/textures/fog-sheet.png','fog-sheet.png');
        const mist=addGroundMist(app,fogTexture),curtains=addDistanceFog(app,fogTexture),{beams,spills}=addHeadlightFog(app),leaves=addLeaves(app),embers=addEmbers(app),smoke=findRoasterySmoke(app);
        animate(app,{mist,curtains,leaves,embers,smoke});
        const detail={groundMist:mist.length,distanceFog:curtains.length,headlightBeams:beams.length,headlightSpills:spills.length,leaves:leaves.length,embers:embers.length,roasterySmoke:smoke.length};
        window.WitchRide3D.atmospherePass=VERSION;window.WitchRide3D.atmosphereDetail=detail;document.body.classList.add('atmosphere-pass-ready');
        console.info('Witch Ride atmosphere pass ready',VERSION,detail);return;
      }catch(err){console.error('Witch Ride atmosphere pass failed',err);window.WitchRide3D.atmospherePass='fallback';window.WitchRide3D.atmosphereDetail={}}
    }
    await wait(50);
  }
  console.warn('Witch Ride atmosphere pass timed out waiting for environment pass');
}
install();
