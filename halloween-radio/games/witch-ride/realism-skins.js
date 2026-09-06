(()=>{
'use strict';
const ATLAS_KEY='witch-realism-atlas';
const FRAMES={"arms":{"x":3,"y":18,"w":58,"h":43},"body":{"x":70,"y":4,"w":52,"h":72},"cape":{"x":132,"y":4,"w":55,"h":72},"hat":{"x":195,"y":18,"w":58,"h":43},"ribbon":{"x":3,"y":98,"w":58,"h":43},"hair0":{"x":67,"y":90,"w":58,"h":60},"hair1":{"x":131,"y":91,"w":58,"h":57},"hair2":{"x":195,"y":91,"w":58,"h":58},"broom":{"x":3,"y":190,"w":58,"h":19},"bristles":{"x":67,"y":170,"w":58,"h":59},"trail":{"x":131,"y":171,"w":58,"h":58},"car":{"x":195,"y":164,"w":58,"h":71},"tree":{"x":4,"y":244,"w":55,"h":72}};
const ATLAS_DATA='data:image/webp;base64,'+(window.__WR_REAL_ATLAS||'');
function sceneNow(){try{if(!window.Phaser||!Array.isArray(Phaser.GAMES))return null;for(const game of Phaser.GAMES){const scene=game?.scene?.keys?.WitchRide||game?.scene?.getScene?.('WitchRide');if(scene?.player)return scene}}catch{}return null}
function loadAtlas(scene){return new Promise((resolve,reject)=>{if(scene.textures.exists(ATLAS_KEY)){resolve();return}const im=new Image();im.decoding='async';im.onload=()=>{try{const tex=scene.textures.addImage(ATLAS_KEY,im);for(const [name,f] of Object.entries(FRAMES))tex.add(name,0,f.x,f.y,f.w,f.h);resolve()}catch(err){reject(err)}};im.onerror=()=>reject(new Error('Witch Ride realism atlas failed to load.'));im.src=ATLAS_DATA})}
function hide(o){try{o?.setVisible?.(false)}catch{}}
function sprite(scene,frame,x,y,w,h,ox=.5,oy=.5){const s=scene.add.image(x,y,ATLAS_KEY,frame);s.setDisplaySize(w,h);s.setOrigin(ox,oy);return s}
function replacePlayer(scene){const p=scene.player;if(!p||p.__realismSkin)return;const r=p.root,old=p.parts;hide(old.cape);hide(old.body);hide(old.arms);hide(old.head);hide(old.hat);hide(old.ribbon);hide(old.broom);hide(old.bristles);old.hair?.forEach(c=>{try{c.list?.forEach(hide)}catch{}});
const cape=sprite(scene,'cape',-6,-8,162,214,.55,.17);cape.spring=old.cape?.spring||{x:0,v:0};
const broom=scene.add.container(0,0);const broomSkin=sprite(scene,'broom',2,10,178,58,.5,.5);broomSkin.rotation=-.18;broom.add(broomSkin);broom.spring=old.broom?.spring||{x:0,v:0};
const bristles=scene.add.container(-79,27);const trail=sprite(scene,'trail',-47,3,118,118,.70,.5).setBlendMode(Phaser.BlendModes.ADD).setAlpha(.46);const bristle=sprite(scene,'bristles',-27,0,88,92,.72,.5);bristles.add([trail,bristle]);bristles.spring=old.bristles?.spring||{x:0,v:0};
const body=sprite(scene,'body',1,-8,126,176,.5,.26);const arms=sprite(scene,'arms',1,-18,137,102,.5,.5);
const hairFrames=['hair0','hair1','hair2','hair0','hair1'],hairs=[];for(let i=0;i<5;i++){const prior=old.hair?.[i];const c=scene.add.container(prior?.x??(-16+i*8),prior?.y??-58);const h=sprite(scene,hairFrames[i],0,0,58+i*4,76+i*5,.58,.15);h.rotation=-.08+i*.034;c.add(h);c.spring=prior?.spring||{x:0,v:0};c.baseX=prior?.baseX??(-16+i*8);c.phase=prior?.phase??i*1.37;c.freq=prior?.freq??(.0044+i*.0007);hairs.push(c)}
const hat=sprite(scene,'hat',0,-94,111,83,.5,.68);hat.spring=old.hat?.spring||{x:0,v:0};
const ribbon=scene.add.container(18,-103);const ribbonSkin=sprite(scene,'ribbon',-5,4,83,61,.73,.48);ribbon.add(ribbonSkin);ribbon.spring=old.ribbon?.spring||{x:0,v:0};
const glow=sprite(scene,'trail',-108,31,76,76,.72,.5).setBlendMode(Phaser.BlendModes.ADD).setAlpha(.30);
r.add([cape,broom,bristles,body,arms,...hairs,hat,ribbon,glow]);
p.parts.cape=cape;p.parts.body=body;p.parts.arms=arms;p.parts.hair=hairs;p.parts.hat=hat;p.parts.ribbon=ribbon;p.parts.broom=broom;p.parts.bristles=bristles;p.parts.glow=glow;p.__realismSkin=true}
function replaceObstacle(scene,o){if(!o||o.__realismSkin||(o.kind!=='car'&&o.kind!=='tree'))return;o.container.list?.forEach(hide);if(o.kind==='car'){const skin=sprite(scene,'car',0,2,97,121,.5,.56);o.container.add(skin);o.baseScale=.71}else{const skin=sprite(scene,'tree',0,-11,104,141,.5,.73);o.container.add(skin);o.baseScale=.83}o.__realismSkin=true}
function replaceObstacles(scene){scene.obstacles?.forEach(o=>replaceObstacle(scene,o))}
async function install(){const scene=sceneNow();if(!scene){setTimeout(install,80);return}if(scene.__realismAtlasInstalled)return;scene.__realismAtlasInstalled=true;try{await loadAtlas(scene);replacePlayer(scene);replaceObstacles(scene);window.WitchRideRealism={active:true,refresh:()=>replaceObstacles(scene)};try{delete window.__WR_REAL_ATLAS}catch{}}catch(err){scene.__realismAtlasInstalled=false;console.warn('Witch Ride realism skin unavailable; procedural fallback remains active.',err)}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
