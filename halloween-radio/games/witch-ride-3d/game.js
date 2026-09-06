import * as pc from 'playcanvas';

const canvas=document.getElementById('game-canvas');
const $=id=>document.getElementById(id);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const app=new pc.Application(canvas,{graphicsDeviceOptions:{antialias:true,alpha:false,preserveDrawingBuffer:false,powerPreference:'high-performance'}});
app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);
app.start();
app.scene.ambientLight=new pc.Color(.045,.055,.068);
try{app.scene.fog=pc.FOG_EXP2;app.scene.fogColor=new pc.Color(.026,.043,.055);app.scene.fogDensity=.015}catch{}
try{app.scene.exposure=1.08}catch{}

const state={mode:'title',elapsed:0,score:0,distance:0,beans:0,speed:1,targetX:0,x:0,velocityX:0,pointer:false,spawnClock:1.2,roadScroll:0};
const roadSegments=[],hazards=[],pickups=[],scenery=[];
let witch=null,cape=null,bristles=null,hatTip=null,hairRig=[];
let assetMode='loading';

function mat(name,diffuse,metalness=.0,roughness=.8,emissive=null,opacity=1){
  const m=new pc.StandardMaterial();m.name=name;m.diffuse=new pc.Color(...diffuse);m.useMetalness=true;m.metalness=metalness;m.gloss=1-roughness;
  if(emissive){m.emissive=new pc.Color(...emissive);m.emissiveIntensity=1.25}
  if(opacity<1){m.opacity=opacity;m.blendType=pc.BLEND_NORMAL;m.depthWrite=false}
  m.update();return m;
}
const materials={
  asphalt:mat('wet aged asphalt',[.11,.12,.13],.03,.36),
  shoulder:mat('mud shoulder',[.033,.026,.022],0,.95),
  haze:mat('road sheen',[.12,.15,.17],.05,.08,null,.12),
  moon:mat('moon',[.58,.62,.61],0,.82,[.42,.48,.5]),
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

const camera=new pc.Entity('Chase Camera');camera.addComponent('camera',{clearColor:new pc.Color(.009,.016,.024),fov:61,nearClip:.08,farClip:280});camera.setPosition(0,5.25,11.8);camera.lookAt(0,1.3,-18);app.root.addChild(camera);
const moonLight=new pc.Entity('Moon Light');moonLight.addComponent('light',{type:'directional',color:new pc.Color(.44,.54,.66),intensity:1.3,castShadows:true,shadowDistance:80,shadowResolution:1024,shadowBias:.18});moonLight.setEulerAngles(42,-28,12);app.root.addChild(moonLight);
const fillLight=new pc.Entity('Warm Horizon');fillLight.addComponent('light',{type:'directional',color:new pc.Color(.46,.20,.075),intensity:.18,castShadows:false});fillLight.setEulerAngles(18,154,0);app.root.addChild(fillLight);
primitive('Moon','sphere',[9,9,9],[34,28,-115],materials.moon);

for(let i=0;i<9;i++){
  const root=new pc.Entity('Road Segment '+i),z=8-i*28;root.setPosition(0,0,z);app.root.addChild(root);roadSegments.push(root);
  primitive('Road','box',[12,.18,28],[0,-.15,0],materials.asphalt,root);
  primitive('Shoulder L','box',[8,.15,28],[-10,-.18,0],materials.shoulder,root);
  primitive('Shoulder R','box',[8,.15,28],[10,-.18,0],materials.shoulder,root);
  for(const x of [-3.9,3.9])primitive('Wet sheen','box',[1.25,.006,10],[x,.0,-4],materials.haze,root);
}
function applyAsphaltTextures(diffuse,normal,gloss){
  for(const t of [diffuse,normal,gloss]){t.addressU=pc.ADDRESS_REPEAT;t.addressV=pc.ADDRESS_REPEAT;t.anisotropy=4}
  const m=materials.asphalt;m.diffuseMap=diffuse;m.diffuseMapTiling=new pc.Vec2(2.4,5.5);m.normalMap=normal;m.normalMapTiling=new pc.Vec2(2.4,5.5);m.bumpiness=.75;m.glossMap=gloss;m.glossMapChannel='r';m.glossMapTiling=new pc.Vec2(2.4,5.5);m.update();
}

function fallbackWitch(){const r=new pc.Entity('Witch Rig Fallback');primitive('body','capsule',[1.05,1.55,.82],[0,.15,0],materials.fallbackWitch,r);cape=primitive('cape','box',[1.55,.055,1.75],[0,.35,.72],materials.fallbackBurgundy,r);cape.setLocalEulerAngles(19,0,0);primitive('head','sphere',[.42,.5,.42],[0,1.5,-.08],materials.fallbackBurgundy,r);primitive('hat','cone',[.58,1.45,.58],[0,2.52,-.08],materials.fallbackWitch,r);return r}
function fallbackCar(){const r=new pc.Entity('Fallback Car');primitive('body','box',[2.6,.85,4.9],[0,.78,0],materials.fallbackCar,r);primitive('cabin','box',[2.05,1.15,2.25],[0,1.85,-.55],materials.fallbackCar,r);for(const x of [-.78,.78])primitive('lamp','sphere',[.24,.24,.18],[x,1.18,2.48],materials.fallbackLamp,r);return r}
function fallbackTree(){const r=new pc.Entity('Fallback Tree');primitive('trunk','cylinder',[.65,7,.65],[0,3.3,0],materials.fallbackBark,r);return r}
function fallbackBean(){const r=new pc.Entity('Fallback Bean');primitive('bean','sphere',[.34,.46,.24],[0,0,0],materials.fallbackBean,r);return r}
function rememberMotionPart(node,phase=0){if(!node)return null;return{node,base:node.getLocalEulerAngles().clone(),phase}}
function configureWitch(root){
  witch=root;witch.setPosition(0,1.55,2);witch.setLocalScale(1,1,1);app.root.addChild(witch);
  const capeNode=witch.findByName?.('cape')||cape;bristles=witch.findByName?.('broom_bristles')||null;hatTip=witch.findByName?.('hat_tip')||null;
  hairRig=[];for(let i=1;i<=5;i++){const p=rememberMotionPart(witch.findByName?.(`hair_${String(i).padStart(2,'0')}`),i*.73);if(p)hairRig.push(p)}
  cape=rememberMotionPart(capeNode,.15);bristles=rememberMotionPart(bristles,1.7);hatTip=rememberMotionPart(hatTip,2.3);
}
function configureCar(e){e.enabled=false;e.__active=false;e.__lane=0;e.setLocalScale(.92,.92,.92);hazards.push(e);app.root.addChild(e)}
function configureBean(e){e.enabled=false;e.__active=false;e.setLocalScale(1.15,1.15,1.15);pickups.push(e);app.root.addChild(e)}
function addScenery(e,x,z,scale=1,reset=245){e.setPosition(x,0,z);e.setLocalScale(scale,scale,scale);e.__reset=reset;e.__x=x;scenery.push(e);app.root.addChild(e)}
function decorate(set){
  for(let i=0;i<24;i++){const side=i%2?-1:1,z=4-Math.floor(i/2)*20-(i%3)*4,e=set.tree?instantiate(set.tree,`Dead Tree ${i}`):fallbackTree();e.setEulerAngles(0,(i*47)%360,side*(i%4));addScenery(e,side*(10.2+(i%5)*.85),z,.82+(i%4)*.09)}
  if(set.fence)for(let i=0;i<10;i++){const side=i%2?-1:1,e=instantiate(set.fence,`Fence ${i}`);e.setEulerAngles(0,side<0?8:-8,0);addScenery(e,side*8.25,-8-Math.floor(i/2)*43,.95,235)}
  if(set.pumpkin)for(let i=0;i<8;i++){const side=i%2?-1:1,e=instantiate(set.pumpkin,`Pumpkin ${i}`);e.setEulerAngles(0,(i*71)%360,0);addScenery(e,side*(7.25+(i%3)*.25),-24-Math.floor(i/2)*52,.62+(i%2)*.12,235)}
  if(set.roastery){const r=instantiate(set.roastery,'Brew & Brews Haunted Roastery');r.setEulerAngles(0,-12,0);addScenery(r,-15.5,-122,.72,260)}
}
async function bootAssets(){
  const mb='assets/models/',tb='assets/textures/',set={};
  const jobs=[
    loadAsset(mb+'witch-rider.glb','witch-rider.glb','container').then(a=>set.witch=a),loadAsset(mb+'vintage-car.glb','vintage-car.glb','container').then(a=>set.car=a),loadAsset(mb+'dead-tree.glb','dead-tree.glb','container').then(a=>set.tree=a),loadAsset(mb+'coffee-bean.glb','coffee-bean.glb','container').then(a=>set.bean=a),loadAsset(mb+'haunted-fence.glb','haunted-fence.glb','container').then(a=>set.fence=a),loadAsset(mb+'jack-o-lantern.glb','jack-o-lantern.glb','container').then(a=>set.pumpkin=a),loadAsset(mb+'haunted-roastery.glb','haunted-roastery.glb','container').then(a=>set.roastery=a),
    Promise.all([loadAsset(tb+'asphalt-albedo.png','asphalt-albedo.png','texture'),loadAsset(tb+'asphalt-normal.png','asphalt-normal.png','texture'),loadAsset(tb+'asphalt-gloss.png','asphalt-gloss.png','texture')]).then(([d,n,g])=>applyAsphaltTextures(d.resource,n.resource,g.resource))
  ];
  const result=await Promise.allSettled(jobs),failed=result.filter(r=>r.status==='rejected');if(failed.length)console.warn('Witch Ride 3D asset fallbacks:',failed.map(x=>x.reason?.message||String(x.reason)).join(' | '));
  configureWitch(set.witch?instantiate(set.witch,'Witch Rig'):fallbackWitch());for(let i=0;i<7;i++)configureCar(set.car?instantiate(set.car,`1938 Coupe ${i}`):fallbackCar());for(let i=0;i<16;i++)configureBean(set.bean?instantiate(set.bean,`Coffee Bean ${i}`):fallbackBean());decorate(set);assetMode=failed.length?'mixed':'glb-pbr';
}

function open(id){for(const el of document.querySelectorAll('.screen'))el.classList.remove('open');if(id)$(id).classList.add('open')}
function resetObjects(){for(const h of hazards){h.enabled=false;h.__active=false}for(const b of pickups){b.enabled=false;b.__active=false}}
function spawn(){const lanes=[-4,0,4],blocked=lanes[Math.floor(Math.random()*3)],car=hazards.find(x=>!x.__active);if(car){car.__active=true;car.enabled=true;car.setPosition(blocked,0,-108-Math.random()*18)}const safe=lanes.filter(x=>x!==blocked),lane=safe[Math.floor(Math.random()*safe.length)];for(let i=0;i<3;i++){const b=pickups.find(x=>!x.__active);if(!b)break;b.__active=true;b.enabled=true;b.setPosition(lane,1.15,-94-i*9)}}
function start(){if(!witch)return;state.mode='playing';state.elapsed=state.score=state.distance=state.beans=0;state.speed=1;state.targetX=state.x=state.velocityX=0;state.spawnClock=.8;resetObjects();witch.setPosition(0,1.55,2);$('hud').classList.remove('hidden');open(null);updateHud()}
function end(){if(state.mode!=='playing')return;state.mode='over';$('hud').classList.add('hidden');$('over-score').textContent=Math.floor(state.score).toLocaleString();$('over-distance').textContent=state.distance.toFixed(2)+' MI';$('over-beans').textContent=state.beans;open('over')}
function updateHud(){$('score').textContent=Math.floor(state.score).toLocaleString();$('distance').textContent=state.distance.toFixed(2)+' MI';$('beans').textContent=state.beans;$('speed').textContent=state.speed.toFixed(1)+'×'}
function back(){if(window.parent&&window.parent!==window)window.parent.postMessage({type:'witch-ride-close'},'*');else location.href='../../'}
$('play').addEventListener('click',start);$('again').addEventListener('click',start);$('pause').addEventListener('click',()=>{if(state.mode==='playing'){state.mode='paused';open('paused')}});$('resume').addEventListener('click',()=>{if(state.mode==='paused'){state.mode='playing';open(null)}});document.querySelectorAll('.back').forEach(b=>b.addEventListener('click',back));
const keys=new Set();addEventListener('keydown',e=>keys.add(e.code));addEventListener('keyup',e=>keys.delete(e.code));function pointer(e){const r=canvas.getBoundingClientRect();state.targetX=clamp(((e.clientX-r.left)/r.width-.5)*11,-5,5)}canvas.addEventListener('pointerdown',e=>{state.pointer=true;canvas.setPointerCapture?.(e.pointerId);pointer(e)});canvas.addEventListener('pointermove',e=>{if(state.pointer)pointer(e)});canvas.addEventListener('pointerup',()=>state.pointer=false);canvas.addEventListener('pointercancel',()=>state.pointer=false);addEventListener('resize',()=>app.resizeCanvas());document.addEventListener('visibilitychange',()=>{if(document.hidden&&state.mode==='playing'){state.mode='paused';open('paused')}});

app.on('update',dt=>{
  dt=Math.min(dt,.04);const time=performance.now()*.001;if(cape?.node){const b=cape.base;cape.node.setLocalEulerAngles(b.x+Math.sin(time*1.7)*2.5,b.y+Math.sin(time*.85)*1.4,b.z+Math.sin(time*1.2)*1.5)}for(const h of hairRig){const b=h.base;h.node.setLocalEulerAngles(b.x+Math.sin(time*4.2+h.phase)*5.7,b.y+Math.sin(time*2+h.phase)*1.4,b.z+Math.sin(time*3+h.phase)*3.2)}if(bristles?.node){const b=bristles.base;bristles.node.setLocalEulerAngles(b.x+Math.sin(time*5.2)*1.6,b.y,b.z+Math.sin(time*7.1)*1.2)}if(hatTip?.node){const b=hatTip.base;hatTip.node.setLocalEulerAngles(b.x,b.y+Math.sin(time*1.3)*1.2,b.z+Math.sin(time*1.55)*1.4)}if(state.mode!=='playing'||!witch)return;
  let steer=0;if(keys.has('ArrowLeft')||keys.has('KeyA'))steer=-1;if(keys.has('ArrowRight')||keys.has('KeyD'))steer=1;if(steer)state.targetX=clamp(state.targetX+steer*dt*6.5,-5,5);const prev=state.x;state.velocityX+=(state.targetX-state.x)*18*dt;state.velocityX*=Math.exp(-7.2*dt);state.x+=state.velocityX*dt;const turnVel=(state.x-prev)/Math.max(dt,.001),bank=clamp(-turnVel*4.2,-13,13);witch.setPosition(state.x,1.55+Math.sin(time*2.1)*.028,2);witch.setEulerAngles(0,0,bank);camera.setPosition(state.x*.18,5.25,11.8);camera.lookAt(state.x*.42,1.25,-18);
  if(cape?.node){const b=cape.base;cape.node.setLocalEulerAngles(b.x+Math.sin(time*1.7)*2.5,b.y,b.z-bank*.38+Math.sin(time*1.2)*1.4)}for(let i=0;i<hairRig.length;i++){const h=hairRig[i],b=h.base;h.node.setLocalEulerAngles(b.x+Math.sin(time*4.2+h.phase)*5.7,b.y,b.z-bank*(.22+i*.025)+Math.sin(time*3+h.phase)*3)}
  state.elapsed+=dt;state.speed=1+Math.min(1.7,state.elapsed*.012);const travel=11.2*state.speed;state.roadScroll+=travel*dt;for(const seg of roadSegments){seg.translate(0,0,travel*dt);if(seg.getPosition().z>22)seg.translate(0,0,-252)}for(const e of scenery){e.translate(0,0,travel*dt);if(e.getPosition().z>28){const p=e.getPosition(),a=e.getEulerAngles();e.setPosition(e.__x,0,p.z-e.__reset);e.setEulerAngles(a.x,(a.y+37)%360,a.z)}}
  for(const h of hazards){if(!h.__active)continue;h.translate(0,0,travel*dt);const p=h.getPosition();if(p.z>18){h.__active=false;h.enabled=false;continue}if(p.z>-1.6&&p.z<5.4&&Math.abs(p.x-state.x)<2.05){end();break}}for(const b of pickups){if(!b.__active)continue;b.translate(0,0,travel*dt);b.rotateLocal(0,95*dt,0);const p=b.getPosition();if(p.z>16){b.__active=false;b.enabled=false;continue}if(p.z>0&&p.z<4.3&&Math.abs(p.x-state.x)<1.15){b.__active=false;b.enabled=false;state.beans++;state.score+=40}}state.spawnClock-=dt;if(state.spawnClock<=0){spawn();state.spawnClock=Math.max(1,1.85-state.speed*.2)+Math.random()*.35}state.distance+=dt*.0078*state.speed;state.score+=dt*14*state.speed;if((Math.floor(state.elapsed*10)%3)===0)updateHud();
});
window.WitchRide3D={ready:false,engine:'PlayCanvas',assetMode,start,pause:()=>{$('pause').click()},resume:()=>{$('resume').click()},state};bootAssets().catch(err=>{console.error(err);configureWitch(fallbackWitch());for(let i=0;i<7;i++)configureCar(fallbackCar());for(let i=0;i<16;i++)configureBean(fallbackBean());assetMode='fallback'}).finally(()=>{document.body.classList.add('ready');$('loading').style.display='none';$('tech').textContent=`PLAYCANVAS ${pc.version||''} · GLB/PBR ${assetMode.toUpperCase()}`;window.WitchRide3D.ready=true;window.WitchRide3D.assetMode=assetMode});
