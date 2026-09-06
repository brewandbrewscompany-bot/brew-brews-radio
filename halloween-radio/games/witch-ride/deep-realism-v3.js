(()=>{
'use strict';
const KEY='witch-deep-hd-v3';
const FRAMES={
  outfitBody:{x:4,y:4,w:150,h:154},
  clothL:{x:160,y:4,w:120,h:126},
  clothM:{x:285,y:4,w:110,h:151},
  clothR:{x:400,y:4,w:90,h:165},
  legs:{x:4,y:175,w:90,h:160},
  carHD:{x:100,y:175,w:220,h:165}
};
const ATLAS_DATA='data:image/webp;base64,'+(window.__WR_DEEP_ATLAS||'');
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function spring(s,target,dt,k=26,d=6){s.v+=(target-s.x)*k*dt;s.v*=Math.exp(-d*dt);s.x+=s.v*dt;return s.x}
function sceneNow(){try{for(const game of Phaser.GAMES||[]){const s=game?.scene?.keys?.WitchRide||game?.scene?.getScene?.('WitchRide');if(s?.player)return s}}catch{}return null}
function load(scene){return new Promise((resolve,reject)=>{if(scene.textures.exists(KEY)){resolve();return}const im=new Image();im.decoding='async';im.onload=()=>{try{const tex=scene.textures.addImage(KEY,im);for(const [name,f] of Object.entries(FRAMES))tex.add(name,0,f.x,f.y,f.w,f.h);resolve()}catch(e){reject(e)}};im.onerror=()=>reject(new Error('Deep realism texture failed to load'));im.src=ATLAS_DATA})}
function img(scene,frame,x,y,w,h,ox=.5,oy=.5){return scene.add.image(x,y,KEY,frame).setDisplaySize(w,h).setOrigin(ox,oy)}
function hide(o){try{o?.setVisible?.(false)}catch{}}
function installWitch(scene){
  const p=scene.player;if(!p||p.__deepHD)return;
  hide(p.parts?.body);hide(p.parts?.arms);hide(p.parts?.cape);
  const r=p.root;
  const back=scene.add.container(0,-8),front=scene.add.container(0,-8);
  const legs=img(scene,'legs',26,29,70,124,.55,.25);
  const body=img(scene,'outfitBody',3,-14,139,143,.50,.34);
  const left=scene.add.container(-24,26),mid=scene.add.container(0,32),right=scene.add.container(27,27);
  left.spring={x:0,v:0};mid.spring={x:0,v:0};right.spring={x:0,v:0};
  left.add(img(scene,'clothL',0,0,103,108,.58,.15));
  mid.add(img(scene,'clothM',0,0,94,129,.51,.12));
  right.add(img(scene,'clothR',0,0,77,141,.44,.12));
  back.add([legs,left,mid,right]);front.add(body);
  r.add([back,front]);
  // Preserve the already-working moving hair, hat, ribbon and broom above the new material body.
  for(const h of p.parts?.hair||[])try{r.bringToTop(h)}catch{}
  for(const part of [p.parts?.broom,p.parts?.bristles,p.parts?.hat,p.parts?.ribbon,p.parts?.glow])try{r.bringToTop(part)}catch{}
  p.__deepHD={back,front,left,mid,right,body,legs};
}
function installCar(scene,o){
  if(!o||o.kind!=='car'||o.__deepHDCar)return;
  for(const c of o.container.list||[])hide(c);
  const g=scene.add.container(0,0);
  const beam=scene.add.graphics();beam.fillStyle(0xff9d35,.045);beam.fillTriangle(-34,25,-116,104,-5,55);beam.fillTriangle(34,25,116,104,5,55);beam.setBlendMode(Phaser.BlendModes.ADD);
  const halo=scene.add.graphics();halo.fillStyle(0xffb04a,.09);halo.fillEllipse(-31,27,44,34);halo.fillEllipse(31,27,44,34);halo.setBlendMode(Phaser.BlendModes.ADD);
  const car=img(scene,'carHD',0,0,148,111,.5,.58);
  const glass=scene.add.graphics();glass.fillStyle(0xa9c2cc,.035);glass.fillRoundedRect(-34,-37,68,22,5);glass.lineStyle(1,0xd6e1e5,.18);glass.beginPath();glass.moveTo(-29,-34);glass.lineTo(24,-20);glass.strokePath();
  g.add([beam,halo,car,glass]);o.container.add(g);o.baseScale=.94;o.__deepHDCar=true;
}
function installCars(scene){for(const o of scene.obstacles||[])installCar(scene,o)}
function addRoadLight(scene){
  if(scene.__deepRoadLight)return;
  const refl=scene.add.graphics().setDepth(5.19);refl.fillStyle(0xff9a3a,.030);refl.fillPoints([{x:245,y:300},{x:256,y:300},{x:212,y:950},{x:126,y:950}],true);refl.fillPoints([{x:286,y:300},{x:296,y:300},{x:432,y:950},{x:350,y:950}],true);
  const haze=scene.add.graphics().setDepth(64);haze.fillStyle(0xbcc8cc,.025);haze.fillEllipse(270,900,590,190);scene.__deepRoadLight={refl,haze};
}
function motion(scene){
  if(scene.__deepHDMotion)return;scene.__deepHDMotion=true;let last=performance.now();
  scene.events.on('postupdate',()=>{const now=performance.now(),dt=Math.min(.05,(now-last)/1000);last=now;const p=scene.player,d=p?.__deepHD;if(d){const bank=p.bank?.x||0,vel=clamp((p.steerVelocity||0)*.038,-.26,.26),acc=clamp((p.accel||0)*.28,-.14,.20),wind=clamp((scene.speed-1)/1.8,0,1);
    d.left.rotation=spring(d.left.spring,clamp(-bank*.88-vel*1.05-Math.sin(now*.0046)*(.018+wind*.032),-.46,.46),dt,22,5.0);d.left.x=-24-bank*13-vel*18;d.left.scaleY=1+wind*.11+Math.max(0,acc)*.18;
    d.mid.rotation=spring(d.mid.spring,clamp(-bank*.56-vel*.66+Math.sin(now*.0052)*(.012+wind*.020),-.31,.31),dt,27,6.0);d.mid.x=-bank*8-vel*9;d.mid.scaleY=1+wind*.08+Math.max(0,acc)*.12;
    d.right.rotation=spring(d.right.spring,clamp(-bank*1.08-vel*1.16+Math.sin(now*.0059)*(.017+wind*.030),-.49,.49),dt,20,4.7);d.right.x=27-bank*12-vel*17;d.right.scaleY=1+wind*.12+Math.max(0,acc)*.19;
  }const a=scene.__deepRoadLight;if(a){a.haze.alpha=.72+Math.sin(now*.0008)*.14;a.refl.alpha=.80+Math.sin(now*.0011)*.08}})
}
async function install(){const scene=sceneNow();if(!scene||!scene.player?.__realismSkin){setTimeout(install,90);return}if(scene.__deepHDInstalled)return;scene.__deepHDInstalled=true;try{await load(scene);installWitch(scene);installCars(scene);addRoadLight(scene);motion(scene);window.WitchRideDeepRealism={active:true,version:3,refresh:()=>installCars(scene)};try{delete window.__WR_DEEP_ATLAS}catch{}}catch(e){scene.__deepHDInstalled=false;console.warn('Deep Witch Ride realism unavailable; v2 remains active.',e)}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
