(()=>{
'use strict';
const ATLAS_KEY='witch-realism-atlas',ROAD_KEY='witch-road-wet-v2';
const FRAMES={"arms":{"x":3,"y":18,"w":58,"h":43},"body":{"x":70,"y":4,"w":52,"h":72},"cape":{"x":132,"y":4,"w":55,"h":72},"hat":{"x":195,"y":18,"w":58,"h":43},"ribbon":{"x":3,"y":98,"w":58,"h":43},"hair0":{"x":67,"y":90,"w":58,"h":60},"hair1":{"x":131,"y":91,"w":58,"h":57},"hair2":{"x":195,"y":91,"w":58,"h":58},"broom":{"x":3,"y":190,"w":58,"h":19},"bristles":{"x":67,"y":170,"w":58,"h":59},"trail":{"x":131,"y":171,"w":58,"h":58},"car":{"x":195,"y":164,"w":58,"h":71},"tree":{"x":4,"y":244,"w":55,"h":72}};
const ATLAS_DATA='data:image/webp;base64,'+(window.__WR_REAL_ATLAS||'');
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),lerp=(a,b,t)=>a+(b-a)*t;
function spring(s,target,dt,k=28,d=6){s.v+=(target-s.x)*k*dt;s.v*=Math.exp(-d*dt);s.x+=s.v*dt;return s.x}
function sceneNow(){try{if(!window.Phaser||!Array.isArray(Phaser.GAMES))return null;for(const game of Phaser.GAMES){const scene=game?.scene?.keys?.WitchRide||game?.scene?.getScene?.('WitchRide');if(scene?.player)return scene}}catch{}return null}
function loadAtlas(scene){return new Promise((resolve,reject)=>{if(scene.textures.exists(ATLAS_KEY)){resolve();return}const im=new Image();im.decoding='async';im.onload=()=>{try{const tex=scene.textures.addImage(ATLAS_KEY,im);for(const [name,f] of Object.entries(FRAMES))tex.add(name,0,f.x,f.y,f.w,f.h);resolve()}catch(err){reject(err)}};im.onerror=()=>reject(new Error('Witch Ride realism atlas failed to load.'));im.src=ATLAS_DATA})}
function hide(o){try{o?.setVisible?.(false)}catch{}}
function sprite(scene,frame,x,y,w,h,ox=.5,oy=.5){return scene.add.image(x,y,ATLAS_KEY,frame).setDisplaySize(w,h).setOrigin(ox,oy)}
function makeWetRoadTexture(scene){
  if(scene.textures.exists(ROAD_KEY))return;
  const tex=scene.textures.createCanvas(ROAD_KEY,256,256),ctx=tex.getContext();
  const im=ctx.createImageData(256,256),d=im.data;let seed=731;
  const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
  for(let y=0;y<256;y++)for(let x=0;x<256;x++){const i=(y*256+x)*4,n=(rnd()-.5)*18,c=Math.max(7,15+n+7*(1-Math.abs(x-128)/128));d[i]=c;d[i+1]=c+2;d[i+2]=c+5;d[i+3]=255}ctx.putImageData(im,0,0);
  ctx.globalCompositeOperation='screen';for(let i=0;i<95;i++){const x=rnd()*256,y=rnd()*256,l=8+rnd()*48,a=.025+rnd()*.07;ctx.strokeStyle=`rgba(${120+rnd()*55},${85+rnd()*45},${45+rnd()*40},${a})`;ctx.lineWidth=rnd()>.82?2:1;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+(rnd()-.5)*3,y+l);ctx.stroke()}
  ctx.globalCompositeOperation='source-over';for(let i=0;i<28;i++){let x=rnd()*256,y=rnd()*256;ctx.strokeStyle='rgba(0,0,0,.34)';ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(x,y);for(let j=0;j<3+rnd()*4;j++){x+=(rnd()-.5)*20;y+=7+rnd()*20;ctx.lineTo(x,y)}ctx.stroke()}
  tex.refresh();
}
function installRoad(scene){
  if(scene.__realRoadV2)return;makeWetRoadTexture(scene);hide(scene.road);
  const maskShape=scene.add.graphics().setVisible(false);maskShape.fillStyle(0xffffff,1);maskShape.fillPoints([{x:216,y:228},{x:324,y:228},{x:610,y:962},{x:-70,y:962}],true);const mask=maskShape.createGeometryMask();
  const road=scene.add.tileSprite(270,596,700,738,ROAD_KEY).setDepth(5.08).setAlpha(.98);road.setMask(mask);road.tileScaleX=.72;road.tileScaleY=.72;
  const shoulders=scene.add.graphics().setDepth(5.04);shoulders.fillStyle(0x030405,.98);shoulders.fillPoints([{x:0,y:248},{x:214,y:228},{x:-70,y:962},{x:0,y:962}],true);shoulders.fillPoints([{x:326,y:228},{x:540,y:248},{x:540,y:962},{x:610,y:962}],true);
  const sheen=scene.add.graphics().setDepth(5.16);sheen.fillStyle(0xd2d8db,.027);sheen.fillPoints([{x:256,y:246},{x:281,y:246},{x:370,y:962},{x:175,y:962}],true);sheen.fillStyle(0xd67a34,.045);sheen.fillPoints([{x:293,y:265},{x:306,y:265},{x:484,y:962},{x:404,y:962}],true);
  const edge=scene.add.graphics().setDepth(5.17);edge.lineStyle(2.1,0x6a4d3b,.38);edge.beginPath();edge.moveTo(216,228);edge.lineTo(-70,962);edge.moveTo(324,228);edge.lineTo(610,962);edge.strokePath();
  const mist=scene.add.graphics().setDepth(63);mist.fillStyle(0xa6b3b9,.04);mist.fillEllipse(36,802,300,220);mist.fillEllipse(510,825,310,230);
  scene.__realRoadV2={road,maskShape,mist};
}
function patchProjection(scene){
  const all=[...(scene.obstacles||[]),...(scene.pickups||[]),...(scene.boosts||[])];for(const o of all){if(o.__wideProject)return;o.__wideProject=true;o.project=function(){const p=clamp(1-this.z,0,1.18),curve=Math.pow(p,1.60),y=lerp(238,952,curve),roadW=lerp(102,636,Math.pow(p,1.14)),laneX=this.lane*(roadW/3.02),scale=(.095+Math.pow(p,1.66)*1.44)*this.baseScale;this.container.x=270+laneX;this.container.y=y;this.container.setScale(scale);this.container.setDepth(20+Math.floor(p*50));this.container.alpha=clamp(.15+p*1.27,0,1);return p}}
  const p=scene.player;if(p&&!p.__widePlayer){const old=p.update.bind(p);p.update=function(...args){const pose=old(...args);this.root.x=270+pose.x*210;return pose};p.__widePlayer=true}
}
function replacePlayer(scene){
  const p=scene.player;if(!p||p.__realismSkin)return;const r=p.root,old=p.parts;hide(old.cape);hide(old.body);hide(old.arms);hide(old.head);hide(old.hat);hide(old.ribbon);hide(old.broom);hide(old.bristles);old.hair?.forEach(c=>{try{c.list?.forEach(hide)}catch{}});
  const cape=scene.add.container(-4,-7);cape.spring=old.cape?.spring||{x:0,v:0};const capeBase=sprite(scene,'cape',-7,4,168,218,.54,.18);const clothL=scene.add.container(-35,26),clothR=scene.add.container(29,22);clothL.spring={x:0,v:0};clothR.spring={x:0,v:0};clothL.add(sprite(scene,'cape',0,0,94,132,.62,.14).setAlpha(.52));clothR.add(sprite(scene,'cape',0,0,88,128,.42,.12).setAlpha(.38));cape.add([capeBase,clothL,clothR]);
  const broom=scene.add.container(0,0);const broomSkin=sprite(scene,'broom',2,10,184,60,.5,.5);broomSkin.rotation=-.18;broom.add(broomSkin);broom.spring=old.broom?.spring||{x:0,v:0};
  const bristles=scene.add.container(-79,27);const trail=sprite(scene,'trail',-49,3,126,126,.70,.5).setBlendMode(Phaser.BlendModes.ADD).setAlpha(.49);const bristle=sprite(scene,'bristles',-28,0,92,96,.72,.5);bristles.add([trail,bristle]);bristles.spring=old.bristles?.spring||{x:0,v:0};
  const body=sprite(scene,'body',1,-8,132,184,.5,.26);const arms=sprite(scene,'arms',1,-18,143,107,.5,.5);
  const rim=scene.add.graphics();rim.lineStyle(1.3,0xc98247,.22);rim.strokeEllipse(0,-12,92,116);r.add(rim);
  const hairFrames=['hair0','hair1','hair2','hair0','hair1'],hairs=[];for(let i=0;i<5;i++){const prior=old.hair?.[i],c=scene.add.container(prior?.x??(-16+i*8),prior?.y??-58),h=sprite(scene,hairFrames[i],0,0,61+i*4,80+i*5,.58,.15);h.rotation=-.08+i*.034;c.add(h);c.spring=prior?.spring||{x:0,v:0};c.baseX=prior?.baseX??(-16+i*8);c.phase=prior?.phase??i*1.37;c.freq=prior?.freq??(.0044+i*.0007);hairs.push(c)}
  const hat=sprite(scene,'hat',0,-94,116,86,.5,.68);hat.spring=old.hat?.spring||{x:0,v:0};const ribbon=scene.add.container(18,-103);ribbon.add(sprite(scene,'ribbon',-5,4,87,64,.73,.48));ribbon.spring=old.ribbon?.spring||{x:0,v:0};const glow=sprite(scene,'trail',-108,31,82,82,.72,.5).setBlendMode(Phaser.BlendModes.ADD).setAlpha(.31);
  r.add([cape,broom,bristles,body,arms,...hairs,hat,ribbon,glow]);p.parts.cape=cape;p.parts.body=body;p.parts.arms=arms;p.parts.hair=hairs;p.parts.hat=hat;p.parts.ribbon=ribbon;p.parts.broom=broom;p.parts.bristles=bristles;p.parts.glow=glow;p.__clothV2={clothL,clothR};p.__realismSkin=true;
}
function replaceObstacle(scene,o){
  if(!o||o.__realismSkin||(o.kind!=='car'&&o.kind!=='tree'))return;o.container.list?.forEach(hide);
  if(o.kind==='car'){const group=scene.add.container(0,0),beam=scene.add.graphics();beam.fillStyle(0xffa23a,.055);beam.fillTriangle(-37,28,-108,94,-10,54);beam.fillTriangle(37,28,108,94,10,54);beam.setBlendMode(Phaser.BlendModes.ADD);const halo=scene.add.graphics();halo.fillStyle(0xffb04d,.10);halo.fillEllipse(-29,30,38,28);halo.fillEllipse(29,30,38,28);halo.fillStyle(0xffd17a,.18);halo.fillCircle(-29,30,8);halo.fillCircle(29,30,8);halo.setBlendMode(Phaser.BlendModes.ADD);const skin=sprite(scene,'car',0,2,111,136,.5,.56);const metal=scene.add.graphics();metal.lineStyle(2,0x8f765d,.65);metal.strokeRoundedRect(-42,-34,84,75,12);metal.lineStyle(1,0xb49a7a,.5);for(let x=-15;x<=15;x+=6){metal.beginPath();metal.moveTo(x,7);metal.lineTo(x,37);metal.strokePath()}metal.lineStyle(2,0xb1a18e,.7);metal.beginPath();metal.moveTo(-42,39);metal.lineTo(42,39);metal.strokePath();metal.fillStyle(0x101317,.8);metal.fillRect(-22,-27,44,18);metal.lineStyle(1,0xc6d6df,.22);metal.beginPath();metal.moveTo(-20,-25);metal.lineTo(17,-12);metal.strokePath();group.add([beam,halo,skin,metal]);o.container.add(group);o.baseScale=.86}else{const skin=sprite(scene,'tree',0,-11,110,149,.5,.73);o.container.add(skin);o.baseScale=.83}o.__realismSkin=true
}
function replaceObstacles(scene){scene.obstacles?.forEach(o=>replaceObstacle(scene,o))}
function liveMotion(scene){if(scene.__realLiveV2)return;scene.__realLiveV2=true;let last=performance.now();scene.events.on('postupdate',()=>{const now=performance.now(),dt=Math.min((now-last)/1000,.05);last=now;const rd=scene.__realRoadV2;if(rd){rd.road.tilePositionY-=dt*(42+scene.speed*94);rd.road.tilePositionX=Math.sin(now*.00026)*6;rd.mist.alpha=.60+Math.sin(now*.0007)*.12}const p=scene.player,c=p?.__clothV2;if(c){const bank=p.bank?.x||0,vel=clamp((p.steerVelocity||0)*.035,-.23,.23),acc=clamp((p.accel||0)*.25,-.12,.18),wind=clamp((scene.speed-1)/1.85,0,1);c.clothL.rotation=spring(c.clothL.spring,clamp(-bank*.82-vel*.88-Math.sin(now*.0049)*(.018+wind*.028),-.36,.36),dt,23,5.4);c.clothL.x=-35-bank*11-vel*14;c.clothL.scaleY=1+wind*.10+Math.max(0,acc)*.15;c.clothR.rotation=spring(c.clothR.spring,clamp(-bank*1.02-vel*.96+Math.sin(now*.0057)*(.015+wind*.025),-.40,.40),dt,20,4.9);c.clothR.x=29-bank*9-vel*12;c.clothR.scaleY=1+wind*.12+Math.max(0,acc)*.17}})}
async function install(){const scene=sceneNow();if(!scene){setTimeout(install,80);return}if(scene.__realismAtlasInstalled)return;scene.__realismAtlasInstalled=true;try{await loadAtlas(scene);installRoad(scene);patchProjection(scene);replacePlayer(scene);replaceObstacles(scene);liveMotion(scene);window.WitchRideRealism={active:true,version:2,refresh:()=>replaceObstacles(scene)};try{delete window.__WR_REAL_ATLAS}catch{}}catch(err){scene.__realismAtlasInstalled=false;console.warn('Witch Ride realism skin unavailable; procedural fallback remains active.',err)}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
