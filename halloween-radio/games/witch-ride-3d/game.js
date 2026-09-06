import * as pc from 'playcanvas';

const canvas=document.getElementById('game-canvas');
const $=id=>document.getElementById(id);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const app=new pc.Application(canvas,{graphicsDeviceOptions:{antialias:true,alpha:false,preserveDrawingBuffer:false,powerPreference:'high-performance'}});
app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);
app.start();
app.scene.ambientLight=new pc.Color(.055,.065,.075);
try{app.scene.fog=pc.FOG_EXP2;app.scene.fogColor=new pc.Color(.035,.055,.068);app.scene.fogDensity=.018}catch{}
try{app.scene.exposure=1.05}catch{}

const state={mode:'title',elapsed:0,score:0,distance:0,beans:0,speed:1,targetX:0,x:0,velocityX:0,pointer:false,spawnClock:1.2,roadScroll:0};
const roadSegments=[],hazards=[],pickups=[],trees=[];

function mat(name,diffuse,metalness=.0,roughness=.8,emissive=null,opacity=1){
  const m=new pc.StandardMaterial();m.name=name;m.diffuse=new pc.Color(...diffuse);m.metalness=metalness;m.gloss=1-roughness;
  if(emissive){m.emissive=new pc.Color(...emissive);m.emissiveIntensity=1.2}
  if(opacity<1){m.opacity=opacity;m.blendType=pc.BLEND_NORMAL;m.depthWrite=false}
  m.update();return m;
}
const materials={
  asphalt:mat('wet aged asphalt',[.035,.041,.047],.03,.32),
  shoulder:mat('mud shoulder',[.035,.028,.024],0,.95),
  witch:mat('weathered black wool',[.035,.032,.034],0,.78),
  burgundy:mat('burgundy cloth',[.17,.025,.018],0,.75),
  hair:mat('auburn hair',[.20,.055,.018],0,.48),
  wood:mat('old broom wood',[.16,.085,.035],0,.7),
  bristle:mat('broom straw',[.24,.13,.045],0,.8),
  chrome:mat('aged chrome',[.25,.26,.27],.82,.2),
  car:mat('black vintage paint',[.025,.03,.035],.42,.22),
  glass:mat('smoky glass',[.06,.10,.12],.08,.12,null,.72),
  tire:mat('rubber',[.012,.012,.013],0,.94),
  bark:mat('dead bark',[.045,.032,.025],0,.96),
  bean:mat('coffee ember',[.22,.065,.012],0,.34,[.8,.18,.025]),
  lamp:mat('headlamp',[.5,.24,.06],.05,.18,[1,.45,.08]),
  moon:mat('moon',[.58,.62,.61],0,.82,[.42,.48,.5]),
  haze:mat('road sheen',[.10,.12,.13],.05,.08,null,.13)
};
function primitive(name,type,scale,position,material,parent=null){
  const e=new pc.Entity(name);e.addComponent('render',{type});e.setLocalScale(...scale);e.setLocalPosition(...position);if(e.render)e.render.material=material;(parent||app.root).addChild(e);return e;
}

const camera=new pc.Entity('Chase Camera');camera.addComponent('camera',{clearColor:new pc.Color(.012,.019,.026),fov:61,nearClip:.08,farClip:260});camera.setPosition(0,5.25,11.8);camera.lookAt(0,1.3,-18);app.root.addChild(camera);
const moonLight=new pc.Entity('Moon Light');moonLight.addComponent('light',{type:'directional',color:new pc.Color(.44,.53,.62),intensity:1.22,castShadows:true,shadowDistance:70,shadowResolution:1024,shadowBias:.18});moonLight.setEulerAngles(42,-28,12);app.root.addChild(moonLight);
const fillLight=new pc.Entity('Warm Horizon');fillLight.addComponent('light',{type:'directional',color:new pc.Color(.40,.20,.09),intensity:.16,castShadows:false});fillLight.setEulerAngles(18,154,0);app.root.addChild(fillLight);
primitive('Moon','sphere',[9,9,9],[34,28,-115],materials.moon);

for(let i=0;i<9;i++){
  const z=8-i*28;const road=primitive('Road '+i,'box',[12,.18,28],[0,-.15,z],materials.asphalt);roadSegments.push(road);
  primitive('Shoulder L '+i,'box',[8,.15,28],[-10,-.18,z],materials.shoulder);
  primitive('Shoulder R '+i,'box',[8,.15,28],[10,-.18,z],materials.shoulder);
  for(const x of [-3.9,3.9])primitive('Wet sheen','box',[1.2,.006,10],[x,.0,z-4],materials.haze);
}
for(let i=0;i<24;i++){
  const side=i%2?-1:1,z=5-Math.floor(i/2)*20-(i%3)*4;
  const root=new pc.Entity('Dead Tree');root.setPosition(side*(10+Math.random()*5),0,z);app.root.addChild(root);
  primitive('trunk','cylinder',[.65,7,.65],[0,3.3,0],materials.bark,root).setLocalEulerAngles(0,0,side*(4+Math.random()*7));
  const b1=primitive('branch','cylinder',[.22,3.8,.22],[side*.75,6.5,0],materials.bark,root);b1.setLocalEulerAngles(0,0,side*57);const b2=primitive('branch','cylinder',[.16,3.0,.16],[-side*.45,7.4,.1],materials.bark,root);b2.setLocalEulerAngles(5,0,-side*49);trees.push(root);
}

const witch=new pc.Entity('Witch Rig');witch.setPosition(0,1.55,2.0);app.root.addChild(witch);
primitive('coat','capsule',[1.15,1.65,.85],[0,.15,0],materials.witch,witch);
const cape=primitive('cape','box',[1.6,.055,1.85],[0,.35,.72],materials.burgundy,witch);cape.setLocalEulerAngles(19,0,0);
primitive('head','sphere',[.42,.5,.42],[0,1.5,-.08],mat('skin',[.31,.19,.13],0,.72),witch);
const hatBrim=primitive('hat brim','cylinder',[1.05,.08,1.05],[0,1.93,-.08],materials.witch,witch);hatBrim.setLocalEulerAngles(0,0,2);
const hatCone=primitive('hat crown','cone',[.58,1.45,.58],[0,2.55,-.08],materials.witch,witch);hatCone.setLocalEulerAngles(0,0,-5);
for(let i=0;i<5;i++){const h=primitive('hair '+i,'cylinder',[.07,.85+i*.08,.07],[-.38+i*.19,1.1,.35+i*.035],materials.hair,witch);h.setLocalEulerAngles(61+(i-2)*4,0,(i-2)*6);h.__phase=i*.8}
const broom=primitive('broom shaft','cylinder',[.09,2.85,.09],[0,-.72,.1],materials.wood,witch);broom.setLocalEulerAngles(90,0,0);
const bristles=primitive('broom bristles','cone',[.58,1.35,.58],[0,-.72,2.65],materials.bristle,witch);bristles.setLocalEulerAngles(90,0,0);
const armL=primitive('arm L','capsule',[.22,.7,.22],[-.58,.65,-.25],materials.witch,witch);armL.setLocalEulerAngles(43,0,-27);const armR=primitive('arm R','capsule',[.22,.7,.22],[.58,.65,-.25],materials.witch,witch);armR.setLocalEulerAngles(43,0,27);

function buildCar(){
  const r=new pc.Entity('1930s Car');app.root.addChild(r);
  primitive('body','box',[2.6,.85,4.9],[0,.78,0],materials.car,r);primitive('hood','box',[2.2,.55,1.75],[0,1.35,1.7],materials.car,r);primitive('cabin','box',[2.05,1.15,2.25],[0,1.85,-.55],materials.car,r);primitive('windshield','box',[1.84,.7,.06],[0,2.0,.62],materials.glass,r).setLocalEulerAngles(-17,0,0);
  for(const x of [-1.35,1.35])for(const z of [-1.55,1.6]){const w=primitive('wheel','cylinder',[.48,.28,.48],[x,.48,z],materials.tire,r);w.setLocalEulerAngles(0,0,90)}
  for(const x of [-.78,.78])primitive('headlamp','sphere',[.24,.24,.18],[x,1.18,2.48],materials.lamp,r);primitive('grille','box',[1.25,.82,.10],[0,1.05,2.5],materials.chrome,r);primitive('bumper','box',[2.5,.12,.16],[0,.58,2.65],materials.chrome,r);
  r.enabled=false;r.__lane=0;r.__active=false;return r;
}
for(let i=0;i<7;i++)hazards.push(buildCar());
function buildBean(){const e=primitive('Coffee Bean','sphere',[.34,.46,.24],[0,1,-40],materials.bean);e.enabled=false;e.__active=false;return e}for(let i=0;i<16;i++)pickups.push(buildBean());

function open(id){for(const el of document.querySelectorAll('.screen'))el.classList.remove('open');if(id)$(id).classList.add('open')}
function resetObjects(){for(const h of hazards){h.enabled=false;h.__active=false}for(const b of pickups){b.enabled=false;b.__active=false}}
function spawn(){
  const lanes=[-4.0,0,4.0],blocked=lanes[Math.floor(Math.random()*3)],car=hazards.find(x=>!x.__active);if(car){car.__active=true;car.__lane=blocked;car.enabled=true;car.setPosition(blocked,0,-105-Math.random()*16)}
  const safe=lanes.filter(x=>x!==blocked),lane=safe[Math.floor(Math.random()*safe.length)];for(let i=0;i<3;i++){const b=pickups.find(x=>!x.__active);if(!b)break;b.__active=true;b.enabled=true;b.setPosition(lane,1.15,-94-i*9)}
}
function start(){state.mode='playing';state.elapsed=state.score=state.distance=state.beans=0;state.speed=1;state.targetX=state.x=state.velocityX=0;state.spawnClock=.8;resetObjects();witch.setPosition(0,1.55,2);$('hud').classList.remove('hidden');open(null);updateHud()}
function end(){if(state.mode!=='playing')return;state.mode='over';$('hud').classList.add('hidden');$('over-score').textContent=Math.floor(state.score).toLocaleString();$('over-distance').textContent=state.distance.toFixed(2)+' MI';$('over-beans').textContent=state.beans;open('over')}
function updateHud(){$('score').textContent=Math.floor(state.score).toLocaleString();$('distance').textContent=state.distance.toFixed(2)+' MI';$('beans').textContent=state.beans;$('speed').textContent=state.speed.toFixed(1)+'×'}
function back(){if(window.parent&&window.parent!==window)window.parent.postMessage({type:'witch-ride-close'},'*');else location.href='../../'}

$('play').addEventListener('click',start);$('again').addEventListener('click',start);$('pause').addEventListener('click',()=>{if(state.mode==='playing'){state.mode='paused';open('paused')}});$('resume').addEventListener('click',()=>{if(state.mode==='paused'){state.mode='playing';open(null)}});document.querySelectorAll('.back').forEach(b=>b.addEventListener('click',back));
const keys=new Set();addEventListener('keydown',e=>keys.add(e.code));addEventListener('keyup',e=>keys.delete(e.code));
function pointer(e){const r=canvas.getBoundingClientRect();state.targetX=clamp(((e.clientX-r.left)/r.width-.5)*11,-5,5)}
canvas.addEventListener('pointerdown',e=>{state.pointer=true;canvas.setPointerCapture?.(e.pointerId);pointer(e)});canvas.addEventListener('pointermove',e=>{if(state.pointer)pointer(e)});canvas.addEventListener('pointerup',()=>state.pointer=false);canvas.addEventListener('pointercancel',()=>state.pointer=false);
addEventListener('resize',()=>app.resizeCanvas());document.addEventListener('visibilitychange',()=>{if(document.hidden&&state.mode==='playing'){state.mode='paused';open('paused')}});

app.on('update',dt=>{
  dt=Math.min(dt,.04);const time=performance.now()*.001;
  cape.setLocalEulerAngles(19+Math.sin(time*1.8)*2,0,Math.sin(time*1.2)*1.2);
  witch.children.filter(x=>x.name.startsWith('hair')).forEach((h,i)=>h.setLocalEulerAngles(61+(i-2)*4+Math.sin(time*4+h.__phase)*5,0,(i-2)*6));
  if(state.mode!=='playing')return;
  let steer=0;if(keys.has('ArrowLeft')||keys.has('KeyA'))steer=-1;if(keys.has('ArrowRight')||keys.has('KeyD'))steer=1;if(steer)state.targetX=clamp(state.targetX+steer*dt*6.5,-5,5);
  const prev=state.x;state.velocityX+=(state.targetX-state.x)*18*dt;state.velocityX*=Math.exp(-7.2*dt);state.x+=state.velocityX*dt;const turnVel=(state.x-prev)/Math.max(dt,.001);
  witch.setPosition(state.x,1.55+Math.sin(time*2.1)*.035,2);witch.setEulerAngles(0,0,clamp(-turnVel*4.2,-13,13));camera.setPosition(state.x*.18,5.25,11.8);camera.lookAt(state.x*.42,1.25,-18);
  state.elapsed+=dt;state.speed=1+Math.min(1.7,state.elapsed*.012);const travel=11.2*state.speed;
  state.roadScroll+=travel*dt;for(const seg of roadSegments){const p=seg.getPosition();if(p.z>22)seg.translate(0,0,-252);else seg.translate(0,0,travel*dt)}
  for(const h of hazards){if(!h.__active)continue;h.translate(0,0,travel*dt);const p=h.getPosition();if(p.z>18){h.__active=false;h.enabled=false;continue}if(p.z>-1.6&&p.z<5.4&&Math.abs(p.x-state.x)<2.15){end();break}}
  for(const b of pickups){if(!b.__active)continue;b.translate(0,0,travel*dt);b.rotateLocal(0,95*dt,0);const p=b.getPosition();if(p.z>16){b.__active=false;b.enabled=false;continue}if(p.z>0&&p.z<4.3&&Math.abs(p.x-state.x)<1.15){b.__active=false;b.enabled=false;state.beans++;state.score+=40}}
  state.spawnClock-=dt;if(state.spawnClock<=0){spawn();state.spawnClock=Math.max(1.0,1.85-state.speed*.2)+Math.random()*.35}
  state.distance+=dt*.0078*state.speed;state.score+=dt*14*state.speed;if((Math.floor(state.elapsed*10)%3)===0)updateHud();
});

document.body.classList.add('ready');$('tech').textContent=`PLAYCANVAS ${pc.version||''} · TRUE 3D SCENE`;
window.WitchRide3D={ready:true,engine:'PlayCanvas',start,pause:()=>{$('pause').click()},resume:()=>{$('resume').click()},state};
