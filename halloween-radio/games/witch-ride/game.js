(()=>{
'use strict';

const W=540,H=960,HORIZON=250,ROAD_BOTTOM=940;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const $=id=>document.getElementById(id);

const statsKey='bb-witch-ride-stats-v1';
function readStats(){try{const s=JSON.parse(localStorage.getItem(statsKey)||'{}');return{high:Number(s.high)||0,longest:Number(s.longest)||0,totalBeans:Number(s.totalBeans)||0}}catch{return{high:0,longest:0,totalBeans:0}}}
function writeStats(s){try{localStorage.setItem(statsKey,JSON.stringify(s))}catch{}}
let savedStats=readStats();
$('title-high').textContent=Math.floor(savedStats.high).toLocaleString();
$('title-distance').textContent=`${savedStats.longest.toFixed(2)} MI`;

function openScreen(id){document.querySelectorAll('.screen').forEach(x=>x.classList.remove('open'));if(id)$(id).classList.add('open')}
function backToRadio(){
  try{window.WitchRide?.stopAudio?.()}catch{}
  if(window.parent&&window.parent!==window){window.parent.postMessage({type:'witch-ride-close'},'*')}
  else location.href='../../';
}
document.querySelectorAll('.back-radio').forEach(b=>b.addEventListener('click',backToRadio));
$('how-btn').addEventListener('click',()=>openScreen('how-screen'));
$('how-back').addEventListener('click',()=>openScreen('title-screen'));

class AudioEngine{
  constructor(){this.ctx=null;this.master=null;this.wind=null;this.windGain=null}
  unlock(){
    if(this.ctx)return;
    const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
    this.ctx=new AC();this.master=this.ctx.createGain();this.master.gain.value=.18;this.master.connect(this.ctx.destination);
  }
  tone(freq=600,dur=.08,g=.06,type='sine'){
    this.unlock();if(!this.ctx)return;const now=this.ctx.currentTime,o=this.ctx.createOscillator(),gain=this.ctx.createGain();o.type=type;o.frequency.setValueAtTime(freq,now);o.frequency.exponentialRampToValueAtTime(Math.max(80,freq*.72),now+dur);gain.gain.setValueAtTime(g,now);gain.gain.exponentialRampToValueAtTime(.0001,now+dur);o.connect(gain).connect(this.master);o.start(now);o.stop(now+dur+.02)
  }
  bean(){this.tone(900,.09,.09,'triangle');setTimeout(()=>this.tone(1250,.07,.05,'triangle'),45)}
  boost(){this.tone(180,.22,.1,'sawtooth');setTimeout(()=>this.tone(360,.18,.07,'triangle'),90)}
  crash(){
    this.unlock();if(!this.ctx)return;const len=Math.floor(this.ctx.sampleRate*.45),buf=this.ctx.createBuffer(1,len,this.ctx.sampleRate),d=buf.getChannelData(0);for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*(1-i/len);const src=this.ctx.createBufferSource(),f=this.ctx.createBiquadFilter(),g=this.ctx.createGain();src.buffer=buf;f.type='lowpass';f.frequency.value=900;g.gain.value=.22;src.connect(f).connect(g).connect(this.master);src.start();this.tone(85,.35,.12,'sawtooth')
  }
  startWind(){
    this.unlock();if(!this.ctx||this.wind)return;const len=this.ctx.sampleRate*2,buf=this.ctx.createBuffer(1,len,this.ctx.sampleRate),d=buf.getChannelData(0);let last=0;for(let i=0;i<len;i++){const n=Math.random()*2-1;last=last*.93+n*.07;d[i]=last*.7+n*.15}const src=this.ctx.createBufferSource(),f=this.ctx.createBiquadFilter(),g=this.ctx.createGain();src.buffer=buf;src.loop=true;f.type='bandpass';f.frequency.value=620;f.Q.value=.4;g.gain.value=.035;src.connect(f).connect(g).connect(this.master);src.start();this.wind=src;this.windGain=g
  }
  windLevel(v){if(this.windGain&&this.ctx)this.windGain.gain.setTargetAtTime(.025+.035*clamp((v-1)/1.8,0,1),this.ctx.currentTime,.08)}
  stop(){if(this.wind){try{this.wind.stop()}catch{}this.wind=null;this.windGain=null}}
}
const audioFx=new AudioEngine();

function springStep(s,target,dt,stiff=42,damp=10){s.v+=(target-s.x)*stiff*dt;s.v*=Math.exp(-damp*dt);s.x+=s.v*dt;return s.x}

class WitchPlayer{
  constructor(scene){
    this.scene=scene;this.root=scene.add.container(W*.5,790).setDepth(80);
    this.xSpring={x:0,v:0};this.altSpring={x:0,v:0};this.bank={x:0,v:0};this.prevX=0;this.steerVelocity=0;
    this.parts={};
    this.build();
  }
  g(){return this.scene.add.graphics()}
  build(){
    const r=this.root;
    const cape=this.g();cape.fillStyle(0x161316,1);cape.fillTriangle(-36,-8,36,-8,12,84);cape.fillStyle(0x2b1714,.85);cape.fillTriangle(-28,-2,23,2,4,70);cape.lineStyle(2,0x7b3c23,.55);cape.strokeTriangle(-36,-8,36,-8,12,84);r.add(cape);this.parts.cape=cape;
    this.parts.hair=[];
    const hairColors=[0xa6421d,0xc95d25,0x7c2d17,0xe2732b];
    for(let i=0;i<4;i++){
      const c=this.scene.add.container(-12+i*8,-57);const h=this.g();h.lineStyle(7-i*.8,hairColors[i],.95);h.beginPath();h.moveTo(0,0);h.lineTo(-3+i*2,26);h.lineTo(5-i,57+i*5);h.strokePath();h.fillStyle(hairColors[i],.9);h.fillCircle(4-i,59+i*5,3.2);c.add(h);c.spring={x:0,v:0};r.add(c);this.parts.hair.push(c)
    }
    const body=this.g();body.fillStyle(0x191719,1);body.fillRoundedRect(-30,-44,60,65,15);body.fillStyle(0x34201a,.9);body.fillRoundedRect(-23,-38,46,52,12);body.lineStyle(2,0x9b5d35,.45);body.strokeRoundedRect(-30,-44,60,65,15);r.add(body);this.parts.body=body;
    const arms=this.g();arms.lineStyle(10,0x181619,1);arms.beginPath();arms.moveTo(-24,-26);arms.lineTo(-47,8);arms.moveTo(24,-26);arms.lineTo(48,2);arms.strokePath();arms.lineStyle(3,0xa87049,1);arms.beginPath();arms.moveTo(47,4);arms.lineTo(60,-4);arms.strokePath();r.add(arms);
    const head=this.g();head.fillStyle(0x7c4d36,1);head.fillCircle(0,-65,18);head.fillStyle(0x1a1618,1);head.fillEllipse(0,-74,35,13);r.add(head);
    const hat=this.g();hat.fillStyle(0x151317,1);hat.fillEllipse(0,-87,78,15);hat.fillTriangle(-20,-91,17,-91,5,-145);hat.fillStyle(0x492019,.95);hat.fillRect(-22,-98,42,6);hat.lineStyle(2,0xb46739,.45);hat.strokeEllipse(0,-87,78,15);r.add(hat);this.parts.hat=hat;
    const ribbon=this.scene.add.container(17,-101);const rg=this.g();rg.fillStyle(0x8c2e1c,1);rg.fillTriangle(0,0,28,8,3,17);rg.fillTriangle(3,6,25,22,0,18);ribbon.add(rg);ribbon.spring={x:0,v:0};r.add(ribbon);this.parts.ribbon=ribbon;
    const broom=this.g();broom.lineStyle(7,0x79502f,1);broom.beginPath();broom.moveTo(-77,26);broom.lineTo(82,-4);broom.strokePath();broom.lineStyle(2,0xc08a50,.7);broom.beginPath();broom.moveTo(-77,24);broom.lineTo(82,-6);broom.strokePath();r.add(broom);
    const bristles=this.scene.add.container(-78,27);const bg=this.g();for(let i=0;i<9;i++){bg.lineStyle(3,0xa9672f,.95);bg.beginPath();bg.moveTo(0,0);bg.lineTo(-31-Math.random()*18,-12+i*3.1);bg.strokePath()}bg.fillStyle(0x6f401f,1);bg.fillEllipse(-4,0,18,20);bristles.add(bg);bristles.spring={x:0,v:0};r.add(bristles);this.parts.bristles=bristles;
    const glow=this.g();glow.fillStyle(0xff7a27,.16);glow.fillCircle(-105,30,26);r.add(glow);this.parts.glow=glow;
    r.setScale(1.08);
  }
  update(dt,targetX,targetAlt,speed){
    const x=springStep(this.xSpring,targetX,dt,55,12);const alt=springStep(this.altSpring,targetAlt,dt,38,10);
    this.steerVelocity=(x-this.prevX)/Math.max(dt,.001);this.prevX=x;
    const roadHalf=188;this.root.x=W*.5+x*roadHalf;this.root.y=790-alt*42+Math.sin(this.scene.time.now*.0025)*2.2;
    const bankTarget=clamp(this.steerVelocity*.055,-.24,.24);this.root.rotation=springStep(this.bank,bankTarget,dt,52,12);
    const wind=clamp((speed-1)/1.8,0,1);
    this.parts.hair.forEach((h,i)=>{
      const target=clamp(-bankTarget*.9 + Math.sin(this.scene.time.now*.005+i*1.7)*(.035+i*.008),-.34,.34);
      h.rotation=springStep(h.spring,target,dt,28+i*3,6.5+i*.7);
      h.scaleY=1+wind*(.20+i*.035);h.x=-12+i*8-bankTarget*12;
    });
    this.parts.cape.rotation=clamp(-bankTarget*.55+Math.sin(this.scene.time.now*.003)*.02,-.18,.18);this.parts.cape.scaleY=1+wind*.10;
    this.parts.ribbon.rotation=springStep(this.parts.ribbon.spring,clamp(-bankTarget*1.3+Math.sin(this.scene.time.now*.008)*.09,-.55,.55),dt,24,6);this.parts.ribbon.scaleX=1+wind*.16;
    this.parts.bristles.rotation=springStep(this.parts.bristles.spring,clamp(-bankTarget*.75+Math.sin(this.scene.time.now*.011)*.035,-.24,.24),dt,34,8);this.parts.bristles.scaleX=1+wind*.22;
    this.parts.glow.alpha=.45+wind*.32;
    return {x,alt};
  }
  flashHit(){this.scene.tweens.add({targets:this.root,alpha:.1,duration:55,yoyo:true,repeat:4,onComplete:()=>this.root.alpha=1})}
}

class PerspectiveThing{
  constructor(scene,kind){this.scene=scene;this.kind=kind;this.active=false;this.lane=0;this.z=1.1;this.container=scene.add.container(0,HORIZON).setVisible(false);this.build()}
  build(){
    const s=this.scene,g=s.add.graphics();
    if(this.kind==='car'){
      g.fillStyle(0x111316,1);g.fillRoundedRect(-38,-54,76,108,13);g.fillStyle(0x333b42,1);g.fillRoundedRect(-30,-40,60,42,9);g.fillStyle(0x101214,1);g.fillRect(-27,-34,54,27);g.fillStyle(0x73190f,1);g.fillCircle(-26,35,8);g.fillCircle(26,35,8);g.fillStyle(0xff3d1d,.9);g.fillCircle(-26,35,4);g.fillCircle(26,35,4);g.fillStyle(0xa16d39,.9);g.fillRect(-30,49,60,5);g.lineStyle(2,0x8b694b,.45);g.strokeRoundedRect(-38,-54,76,108,13);
      const light=s.add.graphics();light.fillStyle(0xff5b29,.12);light.fillCircle(-26,35,20);light.fillCircle(26,35,20);this.container.add([light,g]);this.baseScale=.72;this.hitAlt=.25;
    } else if(this.kind==='tree'){
      g.lineStyle(13,0x2c211d,1);g.beginPath();g.moveTo(0,60);g.lineTo(-4,-18);g.lineTo(-29,-52);g.moveTo(-4,-18);g.lineTo(30,-48);g.moveTo(0,-2);g.lineTo(-38,-14);g.moveTo(13,-28);g.lineTo(43,-68);g.strokePath();g.lineStyle(4,0x55402f,.7);g.beginPath();g.moveTo(-3,58);g.lineTo(-6,-14);g.strokePath();this.container.add(g);this.baseScale=.88;this.hitAlt=.78;
    } else if(this.kind==='bean'){
      g.fillStyle(0xff8a28,.18);g.fillCircle(0,0,24);g.fillStyle(0xc96925,1);g.fillEllipse(0,0,23,34);g.lineStyle(3,0xffc077,.95);g.beginPath();g.moveTo(1,-13);g.lineTo(-4,-5);g.lineTo(4,4);g.lineTo(-1,14);g.strokePath();g.lineStyle(2,0xffa54a,.8);g.strokeEllipse(0,0,23,34);this.container.add(g);this.baseScale=.48;this.hitAlt=1;
    } else if(this.kind==='boost'){
      g.fillStyle(0xff7a22,.14);g.fillCircle(0,0,30);g.fillStyle(0x2b1710,1);g.fillRoundedRect(-17,-14,29,27,6);g.lineStyle(4,0xf2a34f,1);g.strokeRoundedRect(-17,-14,29,27,6);g.beginPath();g.arc(14,-1,10,-Math.PI/2,Math.PI/2);g.strokePath();g.fillStyle(0xffb65f,1);g.fillTriangle(-5,-20,1,-31,5,-20);g.fillTriangle(4,-20,9,-29,13,-19);this.container.add(g);this.baseScale=.52;this.hitAlt=1;
    }
  }
  spawn(lane,z=1.08){this.active=true;this.lane=lane;this.z=z;this.container.setVisible(true).setAlpha(1)}
  kill(){this.active=false;this.container.setVisible(false)}
  project(){
    const p=clamp(1-this.z,0,1.18),curve=Math.pow(p,1.62);const y=lerp(HORIZON,ROAD_BOTTOM,curve);const roadW=lerp(84,500,Math.pow(p,1.2));const laneX=this.lane*(roadW/3.05);const scale=(.11+Math.pow(p,1.72)*1.32)*this.baseScale;this.container.x=W*.5+laneX;this.container.y=y;this.container.setScale(scale);this.container.setDepth(20+Math.floor(p*50));this.container.alpha=clamp(.25+p*1.15,0,1);return p
  }
}

class WitchRideScene extends Phaser.Scene{
  constructor(){super('WitchRide');this.mode='title';this.targetX=0;this.targetAlt=0;this.elapsed=0;this.distance=0;this.beans=0;this.speed=1;this.score=0;this.spawnClock=0;this.sceneryScroll=0;this.lightning=0;this.lastPattern=-1;this.boostTime=0}
  create(){
    document.body.classList.add('ready');
    this.createEnvironment();
    this.player=new WitchPlayer(this);
    this.obstacles=[];for(let i=0;i<12;i++)this.obstacles.push(new PerspectiveThing(this,i%3===0?'tree':'car'));
    this.pickups=[];for(let i=0;i<20;i++)this.pickups.push(new PerspectiveThing(this,'bean'));
    this.boosts=[];for(let i=0;i<2;i++)this.boosts.push(new PerspectiveThing(this,'boost'));
    this.keys=this.input.keyboard.addKeys('LEFT,RIGHT,UP,DOWN,A,D,W,S,P');
    this.input.on('pointerdown',p=>{this.dragging=true;this.pointerTarget(p)});
    this.input.on('pointermove',p=>{if(this.dragging)this.pointerTarget(p)});
    this.input.on('pointerup',()=>this.dragging=false);this.input.on('pointerupoutside',()=>this.dragging=false);
    this.input.keyboard.on('keydown-P',()=>this.togglePause());
    this.time.addEvent({delay:850,loop:true,callback:()=>this.maybeLightning()});
    window.WitchRide={start:()=>this.startRun(),pause:()=>this.togglePause(),resume:()=>this.resumeRun(),stopAudio:()=>audioFx.stop()};
    this.renderEnvironment(0);
  }
  createEnvironment(){
    const sky=this.add.graphics().setDepth(0);sky.fillGradientStyle(0x080b12,0x080b12,0x181016,0x181016,1);sky.fillRect(0,0,W,H);
    const glow=this.add.graphics().setDepth(1);for(let r=92;r>42;r-=10){glow.fillStyle(0xffd79c,.012+(92-r)*.001);glow.fillCircle(400,160,r)}glow.fillStyle(0xf2d0a0,.92);glow.fillCircle(400,160,49);glow.fillStyle(0xc7aa82,.14);glow.fillCircle(384,145,12);glow.fillCircle(418,175,8);glow.fillCircle(410,135,6);
    const hills=this.add.graphics().setDepth(2);hills.fillStyle(0x050709,1);hills.beginPath();hills.moveTo(0,248);for(let x=0;x<=W;x+=35)hills.lineTo(x,220+Math.sin(x*.037)*18+Math.sin(x*.011)*20);hills.lineTo(W,330);hills.lineTo(0,330);hills.closePath();hills.fillPath();
    const town=this.add.container(112,205).setDepth(3);const b=this.add.graphics();b.fillStyle(0x0c0a09,1);b.fillRect(-50,-58,100,70);b.fillTriangle(-62,-58,62,-58,0,-96);b.fillStyle(0x1a100c,1);b.fillRect(54,-34,48,46);b.fillTriangle(48,-34,108,-34,78,-62);b.fillStyle(0xd9782b,.72);[-30,0,28,68,88].forEach((x,i)=>b.fillRect(x-5,i<3?-33:-20,10,14));b.lineStyle(2,0x7d4d2a,.4);b.strokeRect(-50,-58,100,70);town.add(b);const sign=this.add.text(0,-43,'B & B',{fontFamily:'Georgia',fontSize:'14px',color:'#b56d36'}).setOrigin(.5);town.add(sign);
    this.backTrees=this.add.graphics().setDepth(4);this.drawBackTrees();
    this.road=this.add.graphics().setDepth(5);this.fog=this.add.graphics().setDepth(6);this.flash=this.add.rectangle(W/2,H/2,W,H,0xa6c7ff,0).setDepth(100);
    this.leaves=[];for(let i=0;i<22;i++){const l=this.add.rectangle(Math.random()*W,Math.random()*H,3+Math.random()*4,1+Math.random()*3,0xb45a22,.5).setDepth(65);l.vx=-15+Math.random()*30;l.vy=40+Math.random()*95;l.spin=-2+Math.random()*4;this.leaves.push(l)}
  }
  drawBackTrees(){const g=this.backTrees;g.clear();g.lineStyle(8,0x0a0909,1);for(let i=0;i<13;i++){const x=i*49-15,h=45+(i%4)*18;g.beginPath();g.moveTo(x,278);g.lineTo(x+2,278-h);g.moveTo(x+2,278-h*.6);g.lineTo(x-18,278-h*.9);g.moveTo(x+2,278-h*.72);g.lineTo(x+21,278-h);g.strokePath()}}
  pointerTarget(p){if(this.mode!=='playing')return;this.targetX=clamp((p.x/W-.5)*1.85,-1,1);this.targetAlt=clamp((.73-p.y/H)*2.5,-.65,.8)}
  roadWidthAt(y){const p=clamp((y-HORIZON)/(ROAD_BOTTOM-HORIZON),0,1);return lerp(84,500,Math.pow(p,.8))}
  renderEnvironment(dt){
    this.sceneryScroll=(this.sceneryScroll+dt*(.6+this.speed*.8))%1;
    const g=this.road;g.clear();
    g.fillStyle(0x0b0b0c,1);g.fillPoints([{x:W/2-46,y:HORIZON},{x:W/2+46,y:HORIZON},{x:W/2+260,y:ROAD_BOTTOM},{x:W/2-260,y:ROAD_BOTTOM}],true);
    g.lineStyle(3,0x79502f,.62);g.beginPath();g.moveTo(W/2-48,HORIZON);g.lineTo(W/2-263,ROAD_BOTTOM);g.moveTo(W/2+48,HORIZON);g.lineTo(W/2+263,ROAD_BOTTOM);g.strokePath();
    g.fillStyle(0x6a5b52,.08);g.fillPoints([{x:W/2-10,y:HORIZON},{x:W/2+10,y:HORIZON},{x:W/2+80,y:ROAD_BOTTOM},{x:W/2-80,y:ROAD_BOTTOM}],true);
    for(let lane=-1;lane<=1;lane+=2){for(let i=0;i<13;i++){const z=(i/13+this.sceneryScroll)%1,p=Math.pow(z,1.55),y=lerp(HORIZON,ROAD_BOTTOM,p),rw=this.roadWidthAt(y),x=W/2+lane*rw/6;const len=lerp(2,44,p),wid=lerp(.7,3.6,p);g.lineStyle(wid,0xd0aa7b,.18+z*.32);g.beginPath();g.moveTo(x,y);g.lineTo(x,y+len);g.strokePath()}}
    for(let side=-1;side<=1;side+=2){for(let i=0;i<11;i++){const z=(i/11+this.sceneryScroll*.82)%1,p=Math.pow(z,1.52),y=lerp(HORIZON+10,ROAD_BOTTOM,p),rw=this.roadWidthAt(y),x=W/2+side*(rw*.59),h=lerp(3,48,p);g.lineStyle(lerp(1,5,p),0x2f241d,.9);g.beginPath();g.moveTo(x,y);g.lineTo(x+side*3,y-h);g.strokePath();if(i%3===0){g.fillStyle(0xe27828,.18+p*.26);g.fillCircle(x+side*3,y-h,lerp(1,5,p))}}}
    for(let side=-1;side<=1;side+=2){for(let i=0;i<7;i++){const z=(i/7+this.sceneryScroll*.66+.15)%1,p=Math.pow(z,1.6),y=lerp(HORIZON+20,ROAD_BOTTOM,p),rw=this.roadWidthAt(y),x=W/2+side*(rw*.72+24),h=lerp(5,95,p);g.lineStyle(lerp(1,9,p),0x15100e,.92);g.beginPath();g.moveTo(x,y);g.lineTo(x,y-h);g.moveTo(x,y-h*.62);g.lineTo(x-side*h*.24,y-h*.88);g.moveTo(x,y-h*.75);g.lineTo(x+side*h*.3,y-h);g.strokePath()}}
    const f=this.fog;f.clear();for(let i=0;i<5;i++){const y=305+i*115+Math.sin(this.time.now*.0008+i)*18;f.fillStyle(0xb9c0bc,.018+i*.004);f.fillEllipse(W/2+Math.sin(this.time.now*.00035+i)*60,y,620-i*55,70+i*9)}
    for(const l of this.leaves){l.x+=l.vx*dt*(.8+this.speed*.45);l.y+=l.vy*dt*(.8+this.speed*.5);l.rotation+=l.spin*dt;if(l.y>H+20||l.x<-20||l.x>W+20){l.x=Math.random()*W;l.y=HORIZON+Math.random()*160}}
  }
  startRun(){
    audioFx.unlock();audioFx.startWind();openScreen(null);$('hud').classList.remove('hidden');
    this.mode='playing';this.elapsed=0;this.distance=0;this.beans=0;this.score=0;this.speed=1;this.spawnClock=.55;this.targetX=0;this.targetAlt=0;this.boostTime=0;
    this.obstacles.forEach(o=>o.kill());this.pickups.forEach(o=>o.kill());this.boosts.forEach(o=>o.kill());
    this.player.root.setVisible(true).setAlpha(1);this.player.xSpring={x:0,v:0};this.player.altSpring={x:0,v:0};
    this.updateHud();
  }
  togglePause(){if(this.mode==='playing')this.pauseRun();else if(this.mode==='paused')this.resumeRun()}
  pauseRun(){if(this.mode!=='playing')return;this.mode='paused';openScreen('pause-screen');audioFx.stop()}
  resumeRun(){if(this.mode!=='paused')return;this.mode='playing';openScreen(null);audioFx.startWind()}
  endRun(){
    if(this.mode!=='playing')return;this.mode='gameover';audioFx.crash();audioFx.stop();this.player.flashHit();
    savedStats.high=Math.max(savedStats.high,Math.floor(this.score));savedStats.longest=Math.max(savedStats.longest,this.distance);savedStats.totalBeans+=this.beans;writeStats(savedStats);
    $('over-score').textContent=Math.floor(this.score).toLocaleString();$('over-distance').textContent=`${this.distance.toFixed(2)} MI`;$('over-beans').textContent=this.beans;
    $('title-high').textContent=Math.floor(savedStats.high).toLocaleString();$('title-distance').textContent=`${savedStats.longest.toFixed(2)} MI`;
    $('hud').classList.add('hidden');this.time.delayedCall(430,()=>openScreen('gameover-screen'));
  }
  getPool(pool){return pool.find(x=>!x.active)||null}
  spawnPattern(){
    const choices=[0,1,2,3,4];let pattern=Phaser.Math.RND.pick(choices.filter(x=>x!==this.lastPattern));this.lastPattern=pattern;
    const lanes=[-1,0,1];let blocked=[];
    if(pattern<=2)blocked=[lanes[pattern]];else{const safe=lanes[pattern===3?0:2];blocked=lanes.filter(x=>x!==safe)}
    const safeLanes=lanes.filter(l=>!blocked.includes(l));
    blocked.forEach((lane,i)=>{const kind=Math.random()<.72?'car':'tree';const obj=this.getPool(this.obstacles.filter(o=>o.kind===kind))||this.getPool(this.obstacles);if(obj)obj.spawn(lane,1.06+i*.035)});
    const guide=Phaser.Math.RND.pick(safeLanes);
    for(let i=0;i<3;i++){const b=this.getPool(this.pickups);if(b)b.spawn(guide,1.02+i*.095)}
    if(this.elapsed>18&&Math.random()<.09){const p=this.getPool(this.boosts);if(p)p.spawn(guide,1.13)}
  }
  updateObjects(dt,px,palt){
    const travel=(.155*this.speed)*(this.boostTime>0?1.18:1);
    const all=[...this.obstacles,...this.pickups,...this.boosts];
    for(const o of all){
      if(!o.active)continue;o.z-=travel*dt;const p=o.project();
      if(o.kind==='bean')o.container.rotation+=dt*(1.8+this.speed*.4);
      if(o.kind==='boost')o.container.rotation=Math.sin(this.time.now*.004)*.08;
      if(o.z<.105&&o.z>-.03){
        const laneNorm=o.lane*.64;const dx=Math.abs(px-laneNorm);
        if(o.kind==='bean'&&dx<.29&&Math.abs(palt)<1.1){o.kill();this.beans++;this.score+=35;audioFx.bean();this.sparkBurst(o.container.x,o.container.y)}
        else if(o.kind==='boost'&&dx<.31){o.kill();this.boostTime=5;audioFx.boost();this.sparkBurst(o.container.x,o.container.y,0xffb04e)}
        else if((o.kind==='car'||o.kind==='tree')&&dx<.27){const hits=o.kind==='tree'||palt<o.hitAlt;if(hits){o.kill();this.endRun();return}}
      }
      if(o.z<-.08)o.kill();
    }
  }
  sparkBurst(x,y,color=0xff8b2d){for(let i=0;i<8;i++){const q=this.add.rectangle(x,y,2+Math.random()*3,5+Math.random()*8,color,.85).setDepth(95);this.tweens.add({targets:q,x:x+(Math.random()-.5)*70,y:y+(Math.random()-.5)*60,alpha:0,rotation:(Math.random()-.5)*4,duration:300+Math.random()*260,onComplete:()=>q.destroy()})}}
  maybeLightning(){if(this.mode!=='playing'||Math.random()>.16)return;this.flash.alpha=.11;this.tweens.add({targets:this.flash,alpha:0,duration:80,repeat:1,yoyo:true});audioFx.tone(72,.25,.035,'sawtooth')}
  updateHud(){
    $('hud-score').textContent=Math.floor(this.score).toLocaleString();$('hud-distance').textContent=`${this.distance.toFixed(2)} MI`;$('hud-beans').textContent=this.beans;$('hud-speed').textContent=`${this.speed.toFixed(1)}×`;
  }
  update(time,delta){
    const dt=Math.min(delta/1000,.034);this.renderEnvironment(dt);
    if(this.mode!=='playing')return;
    let dx=0,dy=0;if(this.keys.LEFT.isDown||this.keys.A.isDown)dx=-1;if(this.keys.RIGHT.isDown||this.keys.D.isDown)dx=1;if(this.keys.UP.isDown||this.keys.W.isDown)dy=1;if(this.keys.DOWN.isDown||this.keys.S.isDown)dy=-1;
    if(dx)this.targetX=clamp(this.targetX+dx*dt*1.85,-1,1);if(dy)this.targetAlt=clamp(this.targetAlt+dy*dt*1.4,-.65,.8);
    this.elapsed+=dt;this.speed=1+Math.min(1.85,this.elapsed*.011);if(this.boostTime>0)this.boostTime=Math.max(0,this.boostTime-dt);
    const pose=this.player.update(dt,this.targetX,this.targetAlt,this.speed);audioFx.windLevel(this.speed);
    this.distance+=dt*(.0105*this.speed)*(this.boostTime>0?1.2:1);this.score+=dt*(11*this.speed)*(this.boostTime>0?1.5:1);
    this.spawnClock-=dt;if(this.spawnClock<=0){this.spawnPattern();this.spawnClock=Math.max(.72,1.36-this.speed*.20)+Math.random()*.16}
    this.updateObjects(dt,pose.x,pose.alt);
    if((Math.floor(this.elapsed*10)%3)===0)this.updateHud();
  }
}

const config={
  type:Phaser.WEBGL,
  parent:'game',
  width:W,height:H,
  backgroundColor:'#050607',
  scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH,width:W,height:H},
  render:{antialias:true,pixelArt:false,roundPixels:false,powerPreference:'high-performance'},
  physics:{default:'arcade',arcade:{debug:false}},
  scene:[WitchRideScene]
};

if(typeof Phaser==='undefined'){$('loading').textContent='THE GAME ENGINE COULD NOT LOAD · CHECK CONNECTION';return}
new Phaser.Game(config);

$('play-btn').addEventListener('click',()=>window.WitchRide?.start());
$('again-btn').addEventListener('click',()=>window.WitchRide?.start());
$('pause-btn').addEventListener('click',()=>window.WitchRide?.pause());
$('resume-btn').addEventListener('click',()=>window.WitchRide?.resume());
document.addEventListener('visibilitychange',()=>{if(document.hidden)window.WitchRide?.pause()});
})();
