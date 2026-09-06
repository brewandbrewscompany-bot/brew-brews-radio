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
  r.setScale(1.15);
  const back=scene.add.container(0,-8),front=scene.add.container(0,-8);
  const legs=img(scene,'legs',25,27,76,132,.55,.25);
  const body=img(scene,'outfitBody',3,-14,148,151,.50,.34);
  const left=scene.add.container(-27,25),mid=scene.add.container(0,31),right=scene.add.container(29,26);
  left.spring={x:0,v:0};mid.spring={x:0,v:0};right.spring={x:0,v:0};
  left.add(img(scene,'clothL',0,0,111,117,.58,.15));
  mid.add(img(scene,'clothM',0,0,101,139,.51,.12));
  right.add(img(scene,'clothR',0,0,83,151,.44,.12));
  back.add([legs,left,mid,right]);front.add(body);r.add([back,front]);
  for(const h of p.parts?.hair||[])try{r.bringToTop(h)}catch{}
  for(const part of [p.parts?.broom,p.parts?.bristles,p.parts?.hat,p.parts?.ribbon,p.parts?.glow])try{r.bringToTop(part)}catch{}
  p.__deepHD={back,front,left,mid,right,body,legs};
}
function installCar(scene,o,index){
  if(!o||o.kind!=='car'||o.__deepHDCar)return;
  for(const c of o.container.list||[])hide(c);
  const g=scene.add.container(0,0);
  const roadShadow=scene.add.graphics();roadShadow.fillStyle(0x000000,.48);roadShadow.fillEllipse(0,45,112,34);
  const reflection=img(scene,'carHD',0,70,160,42,.5,.52).setFlipY(true).setAlpha(.055).setTint(0x96745e).setBlendMode(Phaser.BlendModes.ADD);
  const beam=scene.add.graphics();beam.fillStyle(0xff9d35,.045);beam.fillTriangle(-37,27,-132,116,-7,58);beam.fillTriangle(37,27,132,116,7,58);beam.setBlendMode(Phaser.BlendModes.ADD);
  const halo=scene.add.graphics();halo.fillStyle(0xffb04a,.10);halo.fillEllipse(-33,28,48,36);halo.fillEllipse(33,28,48,36);halo.fillStyle(0xffd179,.16);halo.fillCircle(-33,28,8);halo.fillCircle(33,28,8);halo.setBlendMode(Phaser.BlendModes.ADD);
  const car=img(scene,'carHD',0,-2,166,124,.5,.58);
  const tints=[0xd9d4c8,0xb8bec0,0xa78f78];try{car.setTint(tints[index%tints.length])}catch{}
  const glass=scene.add.graphics();glass.fillStyle(0xb5ccd5,.045);glass.fillRoundedRect(-38,-42,76,24,5);glass.lineStyle(1,0xe0e5e7,.22);glass.beginPath();glass.moveTo(-31,-39);glass.lineTo(28,-22);glass.strokePath();
  const chrome=scene.add.graphics();chrome.lineStyle(1.5,0xc3b19c,.55);chrome.beginPath();chrome.moveTo(-49,34);chrome.lineTo(49,34);chrome.strokePath();for(let x=-16;x<=16;x+=8){chrome.beginPath();chrome.moveTo(x,7);chrome.lineTo(x,32);chrome.strokePath()}
  g.add([roadShadow,reflection,beam,halo,car,glass,chrome]);o.container.add(g);o.baseScale=.98;o.__deepHDCar=true;
}
function installCars(scene){(scene.obstacles||[]).forEach((o,i)=>installCar(scene,o,i))}
function addRoadLight(scene){
  if(scene.__deepRoadLight)return;
  const refl=scene.add.graphics().setDepth(5.19);refl.fillStyle(0xff9a3a,.032);refl.fillPoints([{x:239,y:294},{x:252,y:294},{x:192,y:960},{x:104,y:960}],true);refl.fillPoints([{x:289,y:294},{x:302,y:294},{x:448,y:960},{x:362,y:960}],true);
  refl.fillStyle(0xc4d2d7,.020);refl.fillPoints([{x:261,y:286},{x:280,y:286},{x:350,y:960},{x:244,y:960}],true);
  const haze=scene.add.graphics().setDepth(64);haze.fillStyle(0xbcc8cc,.030);haze.fillEllipse(270,895,640,210);haze.fillStyle(0xd7ddd9,.016);haze.fillEllipse(270,765,540,120);
  const playerShadow=scene.add.ellipse(270,872,170,34,0x000000,.26).setDepth(74).setBlendMode(Phaser.BlendModes.MULTIPLY);
  scene.__deepRoadLight={refl,haze,playerShadow};
}
function motion(scene){
  if(scene.__deepHDMotion)return;scene.__deepHDMotion=true;let last=performance.now(),faulted=false;
  scene.events.on('postupdate',()=>{
    if(faulted)return;
    try{
      const now=performance.now(),dt=Math.max(.001,Math.min(.05,(now-last)/1000));last=now;
      const p=scene.player,d=p&&p.__deepHD;
      if(d){
        const bank=Number(p.bank&&p.bank.x)||0,vel=clamp((Number(p.steerVelocity)||0)*.038,-.26,.26),acc=clamp((Number(p.accel)||0)*.28,-.14,.20),wind=clamp(((Number(scene.speed)||1)-1)/1.8,0,1);
        d.left.rotation=spring(d.left.spring,clamp(-bank*.90-vel*1.08-Math.sin(now*.0046)*(.020+wind*.036),-.48,.48),dt,22,5.0);d.left.x=-27-bank*14-vel*19;d.left.scaleY=1+wind*.12+Math.max(0,acc)*.19;
        d.mid.rotation=spring(d.mid.spring,clamp(-bank*.58-vel*.69+Math.sin(now*.0052)*(.013+wind*.022),-.32,.32),dt,27,6.0);d.mid.x=-bank*8-vel*10;d.mid.scaleY=1+wind*.09+Math.max(0,acc)*.13;
        d.right.rotation=spring(d.right.spring,clamp(-bank*1.10-vel*1.18+Math.sin(now*.0059)*(.019+wind*.034),-.51,.51),dt,20,4.7);d.right.x=29-bank*13-vel*18;d.right.scaleY=1+wind*.13+Math.max(0,acc)*.20;
      }
      const a=scene.__deepRoadLight;if(a){a.haze.alpha=.74+Math.sin(now*.0008)*.12;a.refl.alpha=.84+Math.sin(now*.0011)*.07;if(p){a.playerShadow.x=p.root.x;a.playerShadow.y=864+(Number(p.altSpring&&p.altSpring.x)||0)*11;a.playerShadow.scaleX=1-Math.abs(Number(p.bank&&p.bank.x)||0)*.75;a.playerShadow.alpha=.20+clamp(((Number(scene.speed)||1)-1)*.08,0,.09)}}
      if(window.WitchRideDeepRealism)window.WitchRideDeepRealism.frames++;
    }catch(e){faulted=true;scene.__deepHDFault=String(e&&e.message||e);if(window.WitchRideDeepRealism){window.WitchRideDeepRealism.fault=scene.__deepHDFault;window.WitchRideDeepRealism.motion=false}console.warn('Deep Witch Ride visual motion disabled; gameplay continues.',e)}
  })
}
async function install(){
  const scene=sceneNow();if(!scene||!scene.player?.__realismSkin){setTimeout(install,90);return}if(scene.__deepHDInstalled)return;
  scene.__deepHDInstalled=true;
  try{
    await load(scene);installWitch(scene);installCars(scene);addRoadLight(scene);
    window.WitchRideDeepRealism={active:true,version:3,motion:true,frames:0,fault:null,refresh:()=>installCars(scene)};
    document.documentElement.dataset.witchRealism='v3';
    motion(scene);try{delete window.__WR_DEEP_ATLAS}catch{}
  }catch(e){scene.__deepHDInstalled=false;document.documentElement.dataset.witchRealism='v2';console.warn('Deep Witch Ride realism unavailable; v2 remains active.',e)}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
