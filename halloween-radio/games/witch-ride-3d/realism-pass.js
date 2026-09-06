import * as pc from 'playcanvas';

const VERSION='realism-pass-v1';
const wait=(ms)=>new Promise(r=>setTimeout(r,ms));

function textureAsset(app,url,name){
  return new Promise((resolve,reject)=>app.assets.loadFromUrlAndFilename(url,name,'texture',(err,asset)=>err?reject(err):resolve(asset.resource)));
}
function transparentMaterial(texture,opacity=.24){
  const m=new pc.StandardMaterial();
  m.diffuse=new pc.Color(.48,.56,.62);m.diffuseMap=texture;m.opacityMap=texture;m.opacityMapChannel='a';m.opacity=opacity;
  m.blendType=pc.BLEND_NORMAL;m.depthWrite=false;m.cull=pc.CULLFACE_NONE;m.useMetalness=true;m.metalness=0;m.gloss=.12;m.update();return m;
}
function imageMaterial(texture){
  const m=new pc.StandardMaterial();m.diffuseMap=texture;m.emissiveMap=texture;m.emissive=new pc.Color(.58,.58,.58);m.emissiveIntensity=.72;
  m.useMetalness=true;m.metalness=0;m.gloss=.08;m.cull=pc.CULLFACE_NONE;m.update();return m;
}
function box(app,name,scale,pos,material){
  const e=new pc.Entity(name);e.addComponent('render',{type:'box'});e.setLocalScale(...scale);e.setPosition(...pos);e.render.material=material;e.render.castShadows=false;e.render.receiveShadows=false;app.root.addChild(e);return e;
}
function plane(app,name,scale,pos,material){
  const e=new pc.Entity(name);e.addComponent('render',{type:'plane'});e.setLocalScale(...scale);e.setPosition(...pos);e.render.material=material;e.render.castShadows=false;e.render.receiveShadows=false;app.root.addChild(e);return e;
}
function softenExistingFog(app){
  for(let i=0;i<20;i++){const e=app.root.findByName(`Fog Bank ${i}`);if(e)e.enabled=false}
}
function widenRoad(app){
  for(let i=0;i<9;i++){
    const root=app.root.findByName(`Road Segment ${i}`);if(!root)continue;
    const road=root.findByName('Road');if(road)road.setLocalScale(15,.18,28);
    const sl=root.findByName('Shoulder L'),sr=root.findByName('Shoulder R');if(sl){sl.setLocalScale(9,.15,28);sl.setLocalPosition(-12.1,-.18,0)}if(sr){sr.setLocalScale(9,.15,28);sr.setLocalPosition(12.1,-.18,0)}
    const sheens=root.children.filter(c=>c.name==='Wet sheen');if(sheens[0]){sheens[0].setLocalPosition(-4.5,0,-4);sheens[0].setLocalScale(1.45,.006,11)}if(sheens[1]){sheens[1].setLocalPosition(4.5,0,-4);sheens[1].setLocalScale(1.45,.006,11)}
  }
}
function tuneLights(app){
  app.scene.ambientLight=new pc.Color(.072,.083,.105);try{app.scene.fog=pc.FOG_EXP2;app.scene.fogColor=new pc.Color(.035,.052,.068);app.scene.fogDensity=.0108;app.scene.exposure=1.34}catch{}
  const cam=app.root.findByName('Chase Camera');if(cam?.camera){cam.camera.fov=59;cam.camera.farClip=340;cam.setPosition(0,5.85,14.2);cam.lookAt(0,1.15,-21)}
  const moon=app.root.findByName('Moon Light');if(moon?.light){moon.light.intensity=1.62;moon.light.color=new pc.Color(.50,.61,.78);moon.light.shadowDistance=104}
  const warm=app.root.findByName('Warm Horizon');if(warm?.light){warm.light.intensity=.34;warm.light.color=new pc.Color(.66,.27,.085)}
  const rim=new pc.Entity('Realism Cool Rim');rim.addComponent('light',{type:'directional',color:new pc.Color(.21,.34,.55),intensity:.31,castShadows:false});rim.setEulerAngles(28,36,-8);app.root.addChild(rim);
}
function tuneModels(app){
  const witch=app.root.findByName('Witch Rig')||app.root.findByName('Witch Rig Fallback');if(witch){witch.setLocalScale(.91,.91,.91);const rim=new pc.Entity('Witch Rim Glow');rim.addComponent('light',{type:'point',color:new pc.Color(.20,.34,.58),intensity:.46,range:7.5,castShadows:false});rim.setLocalPosition(0,2.3,1.5);witch.addChild(rim);const ember=witch.findByName('Broom Ember Light');if(ember?.light){ember.light.intensity=.88;ember.light.range=10.5}}
  for(let i=0;i<7;i++){const car=app.root.findByName(`1938 Coupe ${i}`);if(!car)continue;car.setLocalScale(1.02,1.02,1.02);for(const c of car.children){if(c.name?.startsWith('Headlight Glow')&&c.light){c.light.intensity=.52;c.light.range=13}}}
}
function addAtmosphere(app,fogTexture){
  softenExistingFog(app);const mat=transparentMaterial(fogTexture,.30);const banks=[];
  for(let i=0;i<12;i++){const side=i%3===0?0:(i%2?-1:1),e=plane(app,`Realism Fog ${i}`,[11+(i%4)*2.2,1,5.2+(i%3)*1.3],[side*(4.5+(i%3)*1.4),.11,-12-i*21],mat);e.__baseX=e.getPosition().x;e.__reset=245+(i%3)*14;e.__phase=i*.77;banks.push(e)}
  let t=0;app.on('update',dt=>{t+=dt;for(const e of banks){const p=e.getPosition();p.z+=dt*7.3;p.x=e.__baseX+Math.sin(t*.26+e.__phase)*.75;e.setPosition(p);if(p.z>18)e.setPosition(e.__baseX,.11,-e.__reset)}});
}
function addBackdrop(app,texture){
  for(const n of ['Moon Halo Outer','Moon Halo Inner','Moon']){const e=app.root.findByName(n);if(e)e.enabled=false}
  const m=imageMaterial(texture);const e=box(app,'Cinematic Haunted Horizon',[108,52,.08],[0,20,-139],m);e.setEulerAngles(0,0,0);return e;
}
function addRoadReflections(app){
  const m=new pc.StandardMaterial();m.diffuse=new pc.Color(.20,.105,.035);m.emissive=new pc.Color(.17,.055,.006);m.emissiveIntensity=.75;m.opacity=.12;m.blendType=pc.BLEND_ADDITIVE;m.depthWrite=false;m.cull=pc.CULLFACE_NONE;m.update();
  for(let i=0;i<10;i++){const x=i%2?-4.3:4.3,z=-8-i*24;const e=plane(app,`Warm Road Reflection ${i}`,[.68,1,4.6],[x,.035,z],m);e.__z0=z}
}
async function install(){
  for(let i=0;i<240;i++){
    const app=pc.app;
    if(app&&window.WitchRide3D?.ready){
      try{
        tuneLights(app);widenRoad(app);tuneModels(app);
        const [backdrop,fog]=await Promise.all([textureAsset(app,'assets/textures/cinematic-backdrop.jpg','cinematic-backdrop.jpg'),textureAsset(app,'assets/textures/fog-sheet.png','fog-sheet.png')]);
        addBackdrop(app,backdrop);addAtmosphere(app,fog);addRoadReflections(app);
        document.body.classList.add('realism-pass-ready');window.WitchRide3D.realismPass=VERSION;
        console.info('Witch Ride realism pass ready',VERSION);return;
      }catch(err){console.error('Witch Ride realism pass failed',err);window.WitchRide3D.realismPass='fallback'}
    }
    await wait(50);
  }
  console.warn('Witch Ride realism pass timed out waiting for PlayCanvas app');
}
install();
