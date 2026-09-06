import * as pc from 'playcanvas';

const canvas=document.getElementById('game-canvas');
const $=id=>document.getElementById(id);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const app=new pc.Application(canvas,{graphicsDeviceOptions:{antialias:true,alpha:false,preserveDrawingBuffer:false,powerPreference:'high-performance'}});
app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);
app.start();
app.scene.ambientLight=new pc.Color(.038,.048,.062);
try{app.scene.fog=pc.FOG_EXP2;app.scene.fogColor=new pc.Color(.022,.038,.052);app.scene.fogDensity=.0145}catch{}
try{app.scene.exposure=1.1}catch{}

const state={mode:'title',elapsed:0,score:0,distance:0,beans:0,speed:1,targetX:0,x:0,velocityX:0,pointer:false,spawnClock:1.2,roadScroll:0,prevTurnVel:0};
const roadSegments=[],hazards=[],pickups=[],scenery=[],fogBanks=[];
let witch=null,cape=null,bristles=null,hatTip=null,broomHandle=null,hairRig=[],emberLight=null;
let assetMode='loading';
const detailMode='cinematic-detail-v2';

function mat(name,diffuse,metalness=.0,roughness=.8,emissive=null,opacity=1){
  const m=new pc.StandardMaterial();m.name=name;m.diffuse=new pc.Color(...diffuse);m.useMetalness=true;m.metalness=metalness;m.gloss=1-roughness;
  if(emissive){m.emissive=new pc.Color(...emissive);m.emissiveIntensity=1.3}
  if(opacity<1){m.opacity=opacity;m.blendType=pc.BLEND_NORMAL;m.depthWrite=false;m.cull=pc.CULLFACE_NONE}
  m.update();return m;
}
const materials={
  asphalt:mat('wet aged asphalt',[.085,.095,.105],.035,.31),
  shoulder:mat('mud shoulder',[.030,.024,.021],0,.96),
  haze:mat('road sheen',[.11,.15,.18],.08,.055,null,.10),
  puddle:mat('black mirror puddles',[.055,.085,.105],.12,.035,null,.22),
  fog:mat('low road fog',[.16,.19,.22],0,.98,null,.052),
  halo:mat('moon halo',[.32,.39,.44],0,.98,[.08,.10,.12],.055),
  moon:mat('moon',[.62,.66,.65],0,.82,[.48,.54,.56]),
  fallbackWitch:mat('fallback witch',[.035,.032,.034],0,.78),
  fallbackBurgundy:mat('fallback cape',[.17,.025,.018],0,.75),
  fallbackCar:mat('fallback car',[.025,.03,.035],.42,.22),
  fallbackBark:mat('fallback bark',[.045,.032,.025],0,.96),
  fallbackBean:mat('fallback bean',[.22,.065,.012],0,.34,[.8,.18,.025]),
  fallbackLamp:mat('fallback lamp',[.5,.24,.06],.05,.18,[1,.45,.08])
};
function primitive(name,type,scale,position,material,parent=null){
  const e=new pc.Entity(name);e.addComponent('render',{type});e.setLocalScale(...scale);e.setLocalPosition(...position);if(e.render)e.render.material=material;(parent||app.root).addChild(e);return e;
}
function styleRenderable(root,cast=true,receive=true){root.findComponents?.('render')?.forEach(r=>{r.castShadows=cast;r.receiveShadows=receive});return root}
function loadAsset(url,filename,type){return new Promise((resolve,reject)=>app.assets.loadFromUrlAndFilename(url,filename,type,(err,asset)=>err?reject(new Error(`${filename}: ${err}`)):resolve(asset)))}
function instantiate(asset,name){const e=asset.resource.instantiateRenderEntity();e.name=name||e.name;styleRenderable(e);return e}

const camera=new pc.Entity('Chase Camera');camera.addComponent('camera',{clearColor:new pc.Color(.008,.014,.022),fov:61,nearClip:.08,farClip:300});camera.setPosition(0,5.25,11.8);camera.lookAt(0,1.3,-18);app.root.addChild(camera);
const moonLight=new pc.Entity('Moon Light');moonLight.addComponent('light',{type:'directional',color:new pc.Color(.43,.53,.68),intensity:1.32,castShadows:true,shadowDistance:88,shadowResolution:1024,shadowBias:.17});moonLight.setEulerAngles(42,-28,12);app.root.addChild(moonLight);
const fillLight=new pc.Entity('Warm Horizon');fillLight.addComponent('light',{type:'directional',color:new pc.Color(.47,.19,.07),intensity:.18,castShadows:false});fillLight.setEulerAngles(18,154,0);app.root.addChild(fillLight);
primitive('Moon Halo Outer','sphere',[12.7,12.7,12.7],[34,28,-115],materials.halo).render.castShadows=false;
primitive('Moon Halo Inner','sphere',[10.6,10.6,10.6],[34,28,-115],materials.halo).render.castShadows=false;
primitive('Moon','sphere',[9,9,9],[34,28,-115],materials.moon);

for(let i=0;i<9;i++){
  const root=new pc.Entity('Road Segment '+i),z=8-i*28;root.setPosition(0,0,z);app.root.addChild(root);roadSegments.push(root);
  primitive('Road','box',[12,.18,28],[0,-.15,0],materials.asphalt,root);
  primitive('Shoulder L','box',[8,.15,28],[-10,-.18,0],materials.shoulder,root);
  primitive('Shoulder R','box',[8,.15,28],[10,-.18,0],materials.shoulder,root);
  for(const x of [-3.9,3.9])primitive('Wet sheen','box',[1.15,.006,11],[x,.0,-4],materials.haze,root);
  const puddles=[[-2.65,-7,1.5,3.1],[2.7,4,1.1,2.4],[(i%2?1:-1)*.55,-1.2,1.45,1.7]];
  puddles.forEach((p,n)=>{const e=primitive(`Puddle ${n}`,'box',[p[2],.004,p[3]],[p[0],.012,p[1]],materials.puddle,root);e.render.castShadows=false;e.render.receiveShadows=false});
}
for(let i=0;i<14;i++){
  const side=i%3===0?0:(i%2?-1:1);const e=primitive(`Fog Bank ${i}`,'sphere',[4.6+(i%4)*1.3,.24+(i%3)*.08,7.8+(i%5)*1.1],[side*(5.0+(i%4)),.30,-8-i*17],materials.fog);e.render.castShadows=false;e.render.receiveShadows=false;e.__reset=238+(i%3)*12;e.__drift=(i%2?-1:1)*(.10+.025*(i%4));fogBanks.push(e);
}
function applyAsphaltTextures(diffuse,normal,gloss){
  for(const t of [diffuse,normal,gloss]){t.addressU=pc.ADDRESS_REPEAT;t.addressV=pc.ADDRESS_REPEAT;t.anisotropy=4}
  const m=materials.asphalt;m.diffuseMap=diffuse;m.diffuseMapTiling=new pc.Vec2(2.4,5.5);m.normalMap=normal;m.normalMapTiling=new pc.Vec2(2.4,5.5);m.bumpiness=.82;m.glossMap=gloss;m.glossMapChannel='r';m.glossMapTiling=new pc.Vec2(2.4,5.5);m.update();
}
function applyPuddleTexture(texture){texture.addressU=pc.ADDRESS_REPEAT;texture.addressV=pc.ADDRESS_REPEAT;texture.anisotropy=2;const m=materials.puddle;m.opacityMap=texture;m.opacityMapChannel='r';m.opacityMapTiling=new pc.Vec2(1.35,2.2);m.update()}

function fallbackWitch(){const r=new pc.Entity('Witch Rig Fallback');primitive('body','capsule',[1.05,1.55,.82],[0,.15,0],materials.fallbackWitch,r);cape=primitive('cape','box',[1.55,.055,1.75],[0,.35,.72],materials.fallbackBurgundy,r);cape.setLocalEulerAngles(19,0,0);primitive('head','sphere',[.42,.5,.42],[0,1.5,-.08],materials.fallbackBurgundy,r);primitive('hat','cone',[.58,1.45,.58],[0,2.52,-.08],materials.fallbackWitch,r);return r}
function fallbackCar(){const r=new pc.Entity('Fallback Car');primitive('body','box',[2.6,.85,4.9],[0,.78,0],materials.fallbackCar,r);primitive('cabin','box',[2.05,1.15,2.25],[0,1.85,-.55],materials.fallbackCar,r);for(const x of [-.78,.78])primitive('lamp','sphere',[.24,.24,.18],[x,1.18,2.48],materials.fallbackLamp,r);return r}
function fallbackTree(){const r=new pc.Entity('Fallback Tree');primitive('trunk','cylinder',[.65,7,.65],[0,3.3,0],materials.fallbackBark,r);return r}
function fallbackBean(){const r=new pc.Entity('Fallback Bean');primitive('bean','sphere',[.34,.46,.24],[0,0,0],materials.fallbackBean,r);return r}
function rememberMotionPart(node,phase=0){if(!node)return null;return{node,base:node.getLocalEulerAngles().clone(),phase,roll:0,rollV:0}}
function springRoll(part,target,dt,stiffness,damping){if(!part?.node)return 0;part.rollV+=(target-part.roll)*stiffness*dt;part.rollV*=Math.exp(-damping*dt);part.roll+=part.rollV*dt;return part.roll}
function configureWitch(root){
  witch=root;witch.setPosition(0,1.55,2);witch.setLocalScale(1,1,1);app.root.addChild(witch);
  const capeNode=witch.findByName?.('cape')||cape;
  cape=rememberMotionPart(capeNode,.15);bristles=rememberMotionPart(witch.findByName?.('broom_bristles'),1.7);hatTip=rememberMotionPart(witch.findByName?.('hat_tip'),2.3);broomHandle=rememberMotionPart(witch.findByName?.('broom_handle'),2.9);
  hairRig=[];for(let i=1;i<=5;i++){const p=rememberMotionPart(witch.findByName?.(`hair_${String(i).padStart(2,'0')}`),i*.73);if(p)hairRig.push(p)}
  emberLight=new pc.Entity('Broom Ember Light');emberLight.addComponent('light',{type:'point',color:new pc.Color(1,.31,.055),intensity:.45,range:8,castShadows:false});emberLight.setLocalPosition(0,-.8,3.8);witch.addChild(emberLight);
}
function configureCar(e){
  e.enabled=false;e.__active=false;e.__lane=0;e.setLocalScale(.92,.92,.92);e.__lights=[];
  for(const x of [-.74,.74]){const l=new pc.Entity(`Headlight Glow ${x}`);l.addComponent('light',{type:'point',color:new pc.Color(1,.52,.16),intensity:.30,range:8.5,castShadows:false});l.setLocalPosition(x,1.18,2.72);e.addChild(l);e.__lights.push(l)}
  hazards.push(e);app.root.addChild(e)
}
function configureBean(e){e.enabled=false;e.__active=false;e.setLocalScale(1.15,1.15,1.15);pickups.push(e);app.root.addChild(e)}
function addScenery(e,x,z,scale=1,reset=245){e.setPosition(x,0,z);e.setLocalScale(scale,scale,scale);e.__reset=reset;e.__x=x;scenery.push(e);app.root.addChild(e)}
function decorate(set){
  for(let i=0;i<24;i++){const side=i%2?-1:1,z=4-Math.floor(i/2)*20-(i%3)*4,e=set.tree?instantiate(set.tree,`Dead Tree ${i}`):fallbackTree();e.setEulerAngles(0,(i*47)%360,side*(i%4));addScenery(e,side*(10.2+(i%5)*.85),z,.82+(i%4)*.09)}
  if(set.fence)for(let i=0;i<10;i++){const side=i%2?-1:1,e=instantiate(set.fence,`Fence ${i}`);e.setEulerAngles(0,side<0?8:-8,0);addScenery(e,side*8.25,-8-Math.floor(i/2)*43,.95,235)}
  if(set.pumpkin)for(let i=0;i<10;i++){const side=i%2?-1:1,e=instantiate(set.pumpkin,`Pumpkin ${i}`);e.setEulerAngles(0,(i*71)%360,0);addScenery(e,side*(7.2+(i%3)*.3),-20-Math.floor(i/2)*46,.60+(i%3)*.09,235)}
  if(set.roastery){const r=instantiate(set.roastery,'Brew & Brews Haunted Roastery');r.setEulerAngles(0,-12,0);for(let i=0;i<5;i++){const smoke=primitive(`Roastery Smoke ${i}`,'sphere',[.8+i*.16,.36+i*.05,.8+i*.12],[-2.7+i*.08,7.65+i*.46,-.8+i*.05],materials.fog,r);smoke.render.castShadows=false;smoke.render.receiveShadows=false}addScenery(r,-15.5,-122,.72,260)}
}
async function bootAssets(){
  const mb='assets/models/',tb='assets/textures/',set={};
  const jobs=[
    loadAsset(mb+'witch-rider.glb','witch-rider.glb','container').then(a=>set.witch=a),loadAsset(mb+'vintage-car.glb','vintage-car.glb','container').then(a=>set.car=a),loadAsset(mb+'dead-tree.glb','dead-tree.glb','container').then(a=>set.tree=a),loadAsset(mb+'coffee-bean.glb','coffee-bean.glb','container').then(a=>set.bean=a),loadAsset(mb+'haunted-fence.glb','haunted-fence.glb','container').then(a=>set.fence=a),loadAsset(mb+'jack-o-lantern.glb','jack-o-lantern.glb','container').then(a=>set.pumpkin=a),loadAsset(mb+'haunted-roastery.glb','haunted-roastery.glb','container').then(a=>set.roastery=a),
    Promise.all([loadAsset(tb+'asphalt-albedo.png','asphalt-albedo.png','texture'),loadAsset(tb+'asphalt-normal.png','asphalt-normal.png','texture'),loadAsset(tb+'asphalt-gloss.png','asphalt-gloss.png','texture')]).then(([d,n,g])=>applyAsphaltTextures(d.resource,n.resource,g.resource)),
    loadAsset(tb+'asphalt-puddles.png','asphalt-puddles.png','texture').then(a=>applyPuddleTexture(a.resource))
  ];
  const result=await Promise.allSettled(jobs),failed=result.filter(r=>r.status==='rejected');if(failed.length)console.warn('Witch Ride 3D asset fallbacks:',failed.map(x=>x.reason?.message||String(x.reason)).join(' | '));
  configureWitch(set.witch?instantiate(set.witch,'Witch Rig'):fallbackWitch());for(let i=0;i<7;i++)configureCar(set.car?instantiate(set.car,`1938 Coupe ${i}`):fallbackCar());for(let i=0;i<16;i++)configureBean(set.bean?instantiate(set.bean,`Coffee Bean ${i}`):fallbackBean());decorate(set);assetMode=failed.length?'mixed':'glb-pbr';
}

function open(id){for(const el of document.querySelectorAll('.screen'))el.classList.remove('open');if(id)$(id).classList.add('open')}
function resetObjects(){for(const h of hazards){h.enabled=false;h.__active=false}for(const b of pickups){b.enabled=false;b.__active=false}}
function spawn(){const lanes=[-4,0,4],blocked=lanes[Math.floor(Math.random()*3)],car=hazards.find(x=>!x.__active);if(car){car.__active=true;car.enabled=true;car.setPosition(blocked,0,-108-Math.random()*18)}const safe=lanes.filter(x=>x!==blocked),lane=safe[Math.floor(Math.random()*safe.length)];for(let i=0;i<3;i++){const b=pickups.find(x=>!x.__active);if(!b)break;b.__active=true;b.enabled=true;b.setPosition(lane,1.15,-94-i*9)}}
function start(){if(!witch)return;state.mode='playing';state.elapsed=state.score=state.distance=state.beans=0;state.speed=1;state.targetX=state.x=state.velocityX=state.prevTurnVel=0;state.spawnClock=.8;resetObjects();witch.setPosition(0,1.55,2);$('hud').classList.remove('hidden');open(null);updateHud()}
function end(){if(state.mode!=='playing')return;state.mode='over';$('hud').classList.add('hidden');$('over-score').textContent=Math.floor(state.score).toLocaleString();$('over-distance').textContent=state.distance.toFixed(2)+' MI';$('over-beans').textContent=state.beans;open('over')}
function updateHud(){$('score').textContent=Math.floor(state.score).toLocaleString();$('distance').textContent=state.distance.toFixed(2)+' MI';$('beans').textContent=state.beans;$('speed').textContent=state.speed.toFixed(1)+'×'}
function back(){if(window.parent&&window.parent!==window)window.parent.postMessage({type:'witch-ride-close'},'*');else location.href='../../'}
$('play').addEventListener('click',start);$('again').addEventListener('click',start);$('pause').addEventListener('click',()=>{if(state.mode==='playing'){state.mode='paused';open('paused')}});$('resume').addEventListener('click',()=>{if(state.mode==='paused'){state.mode='playing';open(null)}});document.querySelectorAll('.back').forEach(b=>b.addEventListener('click',back));
const keys=new Set();addEventListener('keydown',e=>keys.add(e.code));addEventListener('keyup',e=>keys.delete(e.code));function pointer(e){const r=canvas.getBoundingClientRect();state.targetX=clamp(((e.clientX-r.left)/r.width-.5)*11,-5,5)}canvas.addEventListener('pointerdown',e=>{state.pointer=true;canvas.setPointerCapture?.(e.pointerId);pointer(e)});canvas.addEventListener('pointermove',e=>{if(state.pointer)pointer(e)});canvas.addEventListener('pointerup',()=>state.pointer=false);canvas.addEventListener('pointercancel',()=>state.pointer=false);addEventListener('resize',()=>app.resizeCanvas());document.addEventListener('visibilitychange',()=>{if(document.hidden&&state.mode==='playing'){state.mode='paused';open('paused')}});

function animateSecondary(dt,time,bank,steerAccel,wind){
  const kick=clamp(-steerAccel*.013,-10.5,10.5);
  if(cape?.node){const r=springRoll(cape,-bank*.46+kick,dt,20,5.8),b=cape.base;cape.node.setLocalEulerAngles(b.x+2.0+wind*5.2+Math.sin(time*1.7)*2.1,b.y+Math.sin(time*.85)*.8,b.z+r)}
  for(let i=0;i<hairRig.length;i++){const h=hairRig[i],strength=.25+i*.028,target=-bank*strength+kick*(.88+i*.055)+Math.sin(time*(3.2+i*.18)+h.phase)*(2.0+i*.15),r=springRoll(h,target,dt,25+i*1.8,6.2+i*.15),b=h.base;h.node.setLocalEulerAngles(b.x+wind*(3.2+i*.42)+Math.sin(time*(4.0+i*.12)+h.phase)*3.1,b.y+Math.sin(time*1.8+h.phase)*.8,b.z+r)}
  if(bristles?.node){const r=springRoll(bristles,-bank*.17+kick*.32+Math.sin(time*6.4)*1.0,dt,34,7.3),b=bristles.base;bristles.node.setLocalEulerAngles(b.x+wind*2.4+Math.sin(time*5.2)*1.2,b.y,b.z+r)}
  if(hatTip?.node){const r=springRoll(hatTip,-bank*.08+kick*.18+Math.sin(time*1.55)*.9,dt,17,5.2),b=hatTip.base;hatTip.node.setLocalEulerAngles(b.x+Math.sin(time*1.3)*.7,b.y+Math.sin(time*.9)*.5,b.z+r)}
  if(broomHandle?.node){const r=springRoll(broomHandle,-bank*.045+kick*.08+Math.sin(time*7.5)*.18,dt,42,9.5),b=broomHandle.base;broomHandle.node.setLocalEulerAngles(b.x+Math.sin(time*8.1)*.12,b.y,b.z+r)}
}

app.on('update',dt=>{
  dt=Math.min(dt,.04);const time=performance.now()*.001;moonLight.light.intensity=1.31+Math.sin(time*.18)*.025;
  if(state.mode!=='playing'||!witch){animateSecondary(dt,time,0,0,0);return}
  let steer=0;if(keys.has('ArrowLeft')||keys.has('KeyA'))steer=-1;if(keys.has('ArrowRight')||keys.has('KeyD'))steer=1;if(steer)state.targetX=clamp(state.targetX+steer*dt*6.5,-5,5);
  const prev=state.x;state.velocityX+=(state.targetX-state.x)*18*dt;state.velocityX*=Math.exp(-7.2*dt);state.x+=state.velocityX*dt;
  const turnVel=(state.x-prev)/Math.max(dt,.001),steerAccel=(turnVel-state.prevTurnVel)/Math.max(dt,.001);state.prevTurnVel=turnVel;const bank=clamp(-turnVel*4.2,-13,13);
  state.elapsed+=dt;state.speed=1+Math.min(1.7,state.elapsed*.012);const wind=clamp((state.speed-1)/1.7,0,1),travel=11.2*state.speed;
  witch.setPosition(state.x,1.55+Math.sin(time*2.1)*.022,2);witch.setEulerAngles(0,0,bank);animateSecondary(dt,time,bank,steerAccel,wind);
  if(emberLight?.light)emberLight.light.intensity=.42+wind*.62+Math.abs(bank)*.012+Math.sin(time*8.2)*.035;
  camera.setPosition(state.x*.18,5.25+wind*.05,11.8);camera.lookAt(state.x*.42,1.25,-18);camera.camera.fov+=(61+wind*3.1-camera.camera.fov)*Math.min(1,dt*2.4);
  try{app.scene.fogDensity=.0145+wind*.0022}catch{}
  state.roadScroll+=travel*dt;for(const seg of roadSegments){seg.translate(0,0,travel*dt);if(seg.getPosition().z>22)seg.translate(0,0,-252)}
  for(const e of scenery){e.translate(0,0,travel*dt);if(e.getPosition().z>28){const p=e.getPosition(),a=e.getEulerAngles();e.setPosition(e.__x,0,p.z-e.__reset);e.setEulerAngles(a.x,(a.y+37)%360,a.z)}}
  for(const f of fogBanks){f.translate(f.__drift*dt,0,travel*.62*dt);const p=f.getPosition();if(p.z>25)f.setPosition(-p.x*.65,.30,p.z-f.__reset)}
  for(const h of hazards){if(!h.__active)continue;h.translate(0,0,travel*dt);if(h.__lights)for(const l of h.__lights)l.light.intensity=.28+Math.sin(time*6.1+h.getPosition().z)*.025;const p=h.getPosition();if(p.z>18){h.__active=false;h.enabled=false;continue}if(p.z>-1.6&&p.z<5.4&&Math.abs(p.x-state.x)<2.05){end();break}}
  for(const b of pickups){if(!b.__active)continue;b.translate(0,0,travel*dt);b.rotateLocal(0,95*dt,0);const p=b.getPosition();if(p.z>16){b.__active=false;b.enabled=false;continue}if(p.z>0&&p.z<4.3&&Math.abs(p.x-state.x)<1.15){b.__active=false;b.enabled=false;state.beans++;state.score+=40}}
  state.spawnClock-=dt;if(state.spawnClock<=0){spawn();state.spawnClock=Math.max(1,1.85-state.speed*.2)+Math.random()*.35}state.distance+=dt*.0078*state.speed;state.score+=dt*14*state.speed;if((Math.floor(state.elapsed*10)%3)===0)updateHud();
});
window.WitchRide3D={ready:false,engine:'PlayCanvas',assetMode,detailMode,start,pause:()=>{$('pause').click()},resume:()=>{$('resume').click()},state};
bootAssets().catch(err=>{console.error(err);configureWitch(fallbackWitch());for(let i=0;i<7;i++)configureCar(fallbackCar());for(let i=0;i<16;i++)configureBean(fallbackBean());assetMode='fallback'}).finally(()=>{document.body.classList.add('ready');$('loading').style.display='none';$('tech').textContent=`PLAYCANVAS ${pc.version||''} · GLB/PBR CINEMATIC`;window.WitchRide3D.ready=true;window.WitchRide3D.assetMode=assetMode;window.WitchRide3D.detailMode=detailMode});
