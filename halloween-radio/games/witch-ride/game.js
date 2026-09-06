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
    this.xSpring={x:0,v:0};this.altSpring={x:0,v:0};this.bank={x:0,v:0};this.bodyLean={x:0,v:0};
    this.prevX=0;this.prevSteerVelocity=0;this.steerVelocity=0;this.prevSpeed=1;this.accel=0;
    this.parts={};
    this.build();
  }
  g(){return this.scene.add.graphics()}
  build(){
    const r=this.root;
    const cape=this.g();cape.fillStyle(0x101116,1);cape.fillTriangle(-36,-8,36,-8,12,84);cape.fillStyle(0x2a1512,.84);cape.fillTriangle(-28,-2,23,2,4,70);cape.lineStyle(2,0x8b4525,.5);cape.strokeTriangle(-36,-8,36,-8,12,84);cape.spring={x:0,v:0};r.add(cape);this.parts.cape=cape;
    this.parts.hair=[];
    const hairColors=[0x8f341b,0xc65322,0x6d2717,0xdd6e2b];
    for(let i=0;i<5;i++){
      const c=this.scene.add.container(-16+i*8,-58);const h=this.g();h.lineStyle(7-i*.7,hairColors[i%hairColors.length],.94);h.beginPath();h.moveTo(0,0);h.lineTo(-4+i*1.8,24+i*2);h.lineTo(5-i*.8,57+i*5);h.strokePath();h.lineStyle(2,0xf18b45,.22);h.beginPath();h.moveTo(1,5);h.lineTo(0,42+i*3);h.strokePath();c.add(h);c.spring={x:0,v:0};c.baseX=-16+i*8;c.phase=i*1.37;c.freq=.0044+i*.0007;r.add(c);this.parts.hair.push(c)
    }
    const body=this.g();body.fillStyle(0x121418,1);body.fillRoundedRect(-30,-44,60,65,15);body.fillStyle(0x302019,.95);body.fillRoundedRect(-23,-38,46,52,12);body.lineStyle(2,0xa76a3b,.36);body.strokeRoundedRect(-30,-44,60,65,15);r.add(body);this.parts.body=body;
    const arms=this.g();arms.lineStyle(10,0x121419,1);arms.beginPath();arms.moveTo(-24,-26);arms.lineTo(-47,8);arms.moveTo(24,-26);arms.lineTo(48,2);arms.strokePath();arms.lineStyle(3,0xa87049,1);arms.beginPath();arms.moveTo(47,4);arms.lineTo(60,-4);arms.strokePath();r.add(arms);this.parts.arms=arms;
    const head=this.g();head.fillStyle(0x714630,1);head.fillCircle(0,-65,18);head.fillStyle(0x17161a,1);head.fillEllipse(0,-74,35,13);r.add(head);this.parts.head=head;
    const hat=this.g();hat.fillStyle(0x101217,1);hat.fillEllipse(0,-87,78,15);hat.fillTriangle(-20,-91,17,-91,5,-145);hat.fillStyle(0x572219,.95);hat.fillRect(-22,-98,42,6);hat.lineStyle(2,0xb56b3f,.42);hat.strokeEllipse(0,-87,78,15);hat.spring={x:0,v:0};r.add(hat);this.parts.hat=hat;
    const ribbon=this.scene.add.container(17,-101);const rg=this.g();rg.fillStyle(0x8f2e1d,1);rg.fillTriangle(0,0,29,7,3,17);rg.fillTriangle(3,6,26,23,0,18);ribbon.add(rg);ribbon.spring={x:0,v:0};r.add(ribbon);this.parts.ribbon=ribbon;
    const broom=this.scene.add.container(0,0);const broomG=this.g();broomG.lineStyle(7,0x6f4a2d,1);broomG.beginPath();broomG.moveTo(-77,26);broomG.lineTo(82,-4);broomG.strokePath();broomG.lineStyle(2,0xd1a167,.58);broomG.beginPath();broomG.moveTo(-76,23);broomG.lineTo(81,-7);broomG.strokePath();broom.add(broomG);broom.spring={x:0,v:0};r.add(broom);this.parts.broom=broom;
    const bristles=this.scene.add.container(-78,27);const bg=this.g();for(let i=0;i<11;i++){bg.lineStyle(2.4,0x9f5f2b,.95);bg.beginPath();bg.moveTo(0,0);bg.lineTo(-34-Math.random()*19,-14+i*2.8);bg.strokePath()}bg.fillStyle(0x653b22,1);bg.fillEllipse(-4,0,18,20);bristles.add(bg);bristles.spring={x:0,v:0};r.add(bristles);this.parts.bristles=bristles;
    const glow=this.g();glow.fillStyle(0xff7a27,.12);glow.fillCircle(-107,31,30);glow.fillStyle(0xffa24e,.12);glow.fillCircle(-104,30,13);r.add(glow);this.parts.glow=glow;
    r.setScale(1.08);
  }
  resetMotion(){
    this.xSpring={x:0,v:0};this.altSpring={x:0,v:0};this.bank={x:0,v:0};this.bodyLean={x:0,v:0};this.prevX=0;this.prevSteerVelocity=0;this.steerVelocity=0;this.prevSpeed=1;this.accel=0;
    this.parts.cape.spring={x:0,v:0};this.parts.hat.spring={x:0,v:0};this.parts.ribbon.spring={x:0,v:0};this.parts.broom.spring={x:0,v:0};this.parts.bristles.spring={x:0,v:0};this.parts.hair.forEach(h=>h.spring={x:0,v:0});
  }
  update(dt,targetX,targetAlt,speed){
    const x=springStep(this.xSpring,targetX,dt,55,12),alt=springStep(this.altSpring,targetAlt,dt,38,10);
    this.steerVelocity=(x-this.prevX)/Math.max(dt,.001);const steerAccel=(this.steerVelocity-this.prevSteerVelocity)/Math.max(dt,.001);this.prevSteerVelocity=this.steerVelocity;this.prevX=x;
    const speedAccel=(speed-this.prevSpeed)/Math.max(dt,.001);this.prevSpeed=speed;this.accel=lerp(this.accel,speedAccel,1-Math.exp(-dt*5.5));
    const roadHalf=188;this.root.x=W*.5+x*roadHalf;this.root.y=790-alt*42+Math.sin(this.scene.time.now*.0022)*1.15;
    const bankTarget=clamp(this.steerVelocity*.052,-.245,.245),bank=springStep(this.bank,bankTarget,dt,52,11.5);this.root.rotation=bank;
    const wind=clamp((speed-1)/1.8,0,1),accelKick=clamp(this.accel*.32,-.12,.18),turnKick=clamp(steerAccel*.0028,-.11,.11);
    const bodyTarget=clamp(-bank*.09-turnKick*.025,-.025,.025);this.parts.body.rotation=springStep(this.bodyLean,bodyTarget,dt,38,10);this.parts.body.y=accelKick*1.6;
    this.parts.hair.forEach((h,i)=>{
      const flutter=Math.sin(this.scene.time.now*h.freq+h.phase)*(.022+i*.005)*(1+wind*.65);
      const lag=-bank*(.82+i*.055)-turnKick*(.62+i*.07)+flutter;
      const target=clamp(lag,-.39,.39);h.rotation=springStep(h.spring,target,dt,24+i*3.4,5.7+i*.65);
      h.scaleY=1+wind*(.16+i*.025)+Math.max(0,accelKick)*(.24+i*.03);h.x=h.baseX-bank*(10+i*1.7)-turnKick*(18+i*2.2);h.y=-58+Math.max(0,accelKick)*(4+i*.8);
    });
    const capeTarget=clamp(-bank*.72-turnKick*.85+Math.sin(this.scene.time.now*.0028)*.014,-.24,.24);this.parts.cape.rotation=springStep(this.parts.cape.spring,capeTarget,dt,22,5.4);this.parts.cape.scaleY=1+wind*.12+Math.max(0,accelKick)*.22;this.parts.cape.x=-turnKick*9;
    const hatTarget=clamp(-bank*.18-turnKick*.12+Math.sin(this.scene.time.now*.0037)*.006,-.055,.055);this.parts.hat.rotation=springStep(this.parts.hat.spring,hatTarget,dt,34,8.5);
    const ribbonTarget=clamp(-bank*1.08-turnKick*1.35+Math.sin(this.scene.time.now*.0077)*(.055+wind*.045),-.58,.58);this.parts.ribbon.rotation=springStep(this.parts.ribbon.spring,ribbonTarget,dt,21,5.3);this.parts.ribbon.scaleX=1+wind*.18+Math.max(0,accelKick)*.22;
    const broomTarget=clamp(bank*.055+turnKick*.11+Math.sin(this.scene.time.now*.021)*(.003+wind*.004),-.025,.025);this.parts.broom.rotation=springStep(this.parts.broom.spring,broomTarget,dt,46,12);
    const bristleTarget=clamp(-bank*.62-turnKick*.82+Math.sin(this.scene.time.now*.0125)*(.026+wind*.018),-.28,.28);this.parts.bristles.rotation=springStep(this.parts.bristles.spring,bristleTarget,dt,29,6.7);this.parts.bristles.scaleX=1+wind*.25+Math.max(0,accelKick)*.28;
    this.parts.glow.alpha=.34+wind*.34+Math.max(0,accelKick)*.45;this.parts.glow.scale=1+wind*.12+Math.max(0,accelKick)*.08;
    return {x,alt};
  }
  flashHit(){this.scene.tweens.add({targets:this.root,alpha:.1,duration:55,yoyo:true,repeat:4,onComplete:()=>this.root.alpha=1})}
}

class PerspectiveThing{
  constructor(scene,kind){this.scene=scene;this.kind=kind;this.active=false;this.lane=0;this.z=1.1;this.container=scene.add.container(0,HORIZON).setVisible(false);this.build()}
  build(){
    const s=this.scene,g=s.add.graphics();
    if(this.kind==='car'){
      const light=s.add.graphics();light.fillStyle(0xffb455,.06);light.fillEllipse(-28,31,36,22);light.fillEllipse(28,31,36,22);light.fillStyle(0xffc36d,.12);light.fillCircle(-28,31,12);light.fillCircle(28,31,12);
      g.fillStyle(0x0d1014,1);g.fillRoundedRect(-37,-48,74,94,16);g.fillStyle(0x171b20,1);g.fillTriangle(-30,-16,30,-16,22,-52);g.fillTriangle(-30,-16,-22,-52,22,-52);g.fillStyle(0x283038,1);g.fillRoundedRect(-25,-40,50,24,7);g.fillStyle(0x080a0d,1);g.fillRoundedRect(-21,-37,42,18,5);g.fillStyle(0x4c3426,.72);g.fillRect(-29,9,58,5);g.fillStyle(0xeaa04d,.96);g.fillCircle(-27,29,6);g.fillCircle(27,29,6);g.fillStyle(0xffd486,.95);g.fillCircle(-27,29,3);g.fillCircle(27,29,3);g.lineStyle(3,0x78624d,.65);g.beginPath();g.moveTo(-25,40);g.lineTo(25,40);g.strokePath();g.lineStyle(2,0x80634b,.36);g.strokeRoundedRect(-37,-48,74,94,16);
      this.container.add([light,g]);this.baseScale=.75;this.hitAlt=.25;
    } else if(this.kind==='tree'){
      g.lineStyle(15,0x211a18,1);g.beginPath();g.moveTo(0,62);g.lineTo(-3,4);g.lineTo(-8,-26);g.moveTo(-5,-10);g.lineTo(-33,-43);g.lineTo(-42,-67);g.moveTo(-4,-2);g.lineTo(28,-39);g.lineTo(39,-63);g.moveTo(2,14);g.lineTo(35,-3);g.lineTo(49,-26);g.moveTo(-9,-27);g.lineTo(9,-53);g.strokePath();g.lineStyle(4,0x574132,.54);g.beginPath();g.moveTo(-2,58);g.lineTo(-5,-19);g.strokePath();this.container.add(g);this.baseScale=.92;this.hitAlt=.78;
    } else if(this.kind==='bean'){
      g.fillStyle(0xff8a28,.11);g.fillCircle(0,0,25);g.fillStyle(0x8f3f1f,1);g.fillEllipse(0,0,23,34);g.fillStyle(0xd26b2b,.82);g.fillEllipse(-4,-3,10,25);g.lineStyle(3,0xffc077,.88);g.beginPath();g.moveTo(2,-14);g.lineTo(-4,-6);g.lineTo(4,3);g.lineTo(-2,14);g.strokePath();g.lineStyle(1.5,0xffa54a,.62);g.strokeEllipse(0,0,23,34);this.container.add(g);this.baseScale=.48;this.hitAlt=1;
    } else if(this.kind==='boost'){
      g.fillStyle(0xff7a22,.11);g.fillCircle(0,0,31);g.fillStyle(0x17110e,1);g.fillRoundedRect(-17,-14,29,27,6);g.lineStyle(3,0xd98843,1);g.strokeRoundedRect(-17,-14,29,27,6);g.beginPath();g.arc(14,-1,10,-Math.PI/2,Math.PI/2);g.strokePath();g.fillStyle(0xffc16d,.92);g.fillEllipse(-2,-11,19,4);g.fillStyle(0xc36b31,.9);g.fillTriangle(-5,-20,1,-31,5,-20);g.fillTriangle(4,-20,9,-29,13,-19);this.container.add(g);this.baseScale=.52;this.hitAlt=1;
    }
  }
  spawn(lane,z=1.08){this.active=true;this.lane=lane;this.z=z;this.container.setVisible(true).setAlpha(1)}
  kill(){this.active=false;this.container.setVisible(false)}
  project(){
    const p=clamp(1-this.z,0,1.18),curve=Math.pow(p,1.62),y=lerp(HORIZON,ROAD_BOTTOM,curve),roadW=lerp(84,500,Math.pow(p,1.2)),laneX=this.lane*(roadW/3.05),scale=(.11+Math.pow(p,1.72)*1.32)*this.baseScale;
    this.container.x=W*.5+laneX;this.container.y=y;this.container.setScale(scale);this.container.setDepth(20+Math.floor(p*50));this.container.alpha=clamp(.18+p*1.22,0,1);return p
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
    const sky=this.add.graphics().setDepth(0);sky.fillGradientStyle(0x04070c,0x04070c,0x10121a,0x171019,1);sky.fillRect(0,0,W,H);
    const glow=this.add.graphics().setDepth(1);for(let r=120;r>46;r-=11){glow.fillStyle(0xcdd8dd,.006+(120-r)*.00055);glow.fillCircle(404,154,r)}glow.fillStyle(0xe6dfc8,.92);glow.fillCircle(404,154,48);glow.fillStyle(0x9b978c,.18);glow.fillCircle(389,141,12);glow.fillCircle(421,169,8);glow.fillCircle(414,130,6);
    const haze=this.add.graphics().setDepth(1);haze.fillStyle(0x61717c,.035);haze.fillEllipse(W*.5,244,620,116);haze.fillStyle(0x8c6e60,.025);haze.fillEllipse(W*.48,277,680,86);
    const hills=this.add.graphics().setDepth(2);hills.fillStyle(0x030609,1);hills.beginPath();hills.moveTo(0,255);for(let x=0;x<=W;x+=30)hills.lineTo(x,225+Math.sin(x*.031)*14+Math.sin(x*.009)*23);hills.lineTo(W,332);hills.lineTo(0,332);hills.closePath();hills.fillPath();
    const town=this.add.container(106,216).setDepth(3);const b=this.add.graphics();b.fillStyle(0x070707,1);b.fillRect(-48,-48,92,55);b.fillTriangle(-58,-48,53,-48,-5,-83);b.fillRect(48,-28,40,35);b.fillTriangle(42,-28,94,-28,68,-49);b.fillRect(-34,-67,8,21);b.fillStyle(0xc06a2c,.48);[-28,-3,25,60,78].forEach((x,i)=>b.fillRect(x-4,i<3?-29:-16,8,11));town.add(b);const sign=this.add.text(-3,-39,'B & B',{fontFamily:'Georgia',fontSize:'10px',color:'#87512f'}).setOrigin(.5).setAlpha(.62);town.add(sign);
    this.backTrees=this.add.graphics().setDepth(4);this.drawBackTrees();
    this.road=this.add.graphics().setDepth(5);this.fogBack=this.add.graphics().setDepth(5.5);this.fog=this.add.graphics().setDepth(67);this.vignette=this.add.graphics().setDepth(68);this.flash=this.add.rectangle(W/2,H/2,W,H,0xa6c7ff,0).setDepth(100);
    this.leaves=[];for(let i=0;i<22;i++){const l=this.add.rectangle(Math.random()*W,Math.random()*H,3+Math.random()*4,1+Math.random()*3,0x8f4a27,.36).setDepth(65);l.vx=-15+Math.random()*30;l.vy=40+Math.random()*95;l.spin=-2+Math.random()*4;this.leaves.push(l)}
  }
  drawBackTrees(){const g=this.backTrees;g.clear();g.lineStyle(8,0x060708,1);for(let i=0;i<15;i++){const x=i*43-22,h=50+(i%5)*16;g.beginPath();g.moveTo(x,286);g.lineTo(x+2,286-h);g.moveTo(x+2,286-h*.48);g.lineTo(x-19,286-h*.82);g.lineTo(x-28,286-h*.96);g.moveTo(x+2,286-h*.66);g.lineTo(x+20,286-h*.93);g.lineTo(x+29,286-h*1.04);g.strokePath()}}
  pointerTarget(p){if(this.mode!=='playing')return;this.targetX=clamp((p.x/W-.5)*1.85,-1,1);this.targetAlt=clamp((.73-p.y/H)*2.5,-.65,.8)}
  roadWidthAt(y){const p=clamp((y-HORIZON)/(ROAD_BOTTOM-HORIZON),0,1);return lerp(84,500,Math.pow(p,.8))}
  renderEnvironment(dt){
    this.sceneryScroll=(this.sceneryScroll+dt*(.58+this.speed*.82))%1;
    const g=this.road;g.clear();
    g.fillStyle(0x080a0c,1);g.fillPoints([{x:W/2-46,y:HORIZON},{x:W/2+46,y:HORIZON},{x:W/2+260,y:ROAD_BOTTOM},{x:W/2-260,y:ROAD_BOTTOM}],true);
    g.fillStyle(0x273038,.11);g.fillPoints([{x:W/2-28,y:HORIZON},{x:W/2+20,y:HORIZON},{x:W/2+122,y:ROAD_BOTTOM},{x:W/2-92,y:ROAD_BOTTOM}],true);
    g.lineStyle(2.2,0x5d493a,.46);g.beginPath();g.moveTo(W/2-48,HORIZON);g.lineTo(W/2-263,ROAD_BOTTOM);g.moveTo(W/2+48,HORIZON);g.lineTo(W/2+263,ROAD_BOTTOM);g.strokePath();
    for(let i=0;i<18;i++){const z=(i/18+this.sceneryScroll)%1,p=Math.pow(z,1.6),y=lerp(HORIZON+6,ROAD_BOTTOM,p),rw=this.roadWidthAt(y),side=i%2?-1:1,x=W/2+side*rw*(.10+.055*Math.sin(i*2.1)),len=lerp(2,32,p);g.lineStyle(lerp(.5,2.3,p),0x9a8268,.045+p*.12);g.beginPath();g.moveTo(x,y);g.lineTo(x+side*lerp(1,7,p),y+len);g.strokePath()}
    for(let i=0;i<15;i++){const z=(i/15+this.sceneryScroll*.91+.12)%1,p=Math.pow(z,1.58),y=lerp(HORIZON+10,ROAD_BOTTOM,p),rw=this.roadWidthAt(y),x=W/2+Math.sin(i*2.7)*rw*.23,w=lerp(1,18,p);g.lineStyle(lerp(.45,1.8,p),0x5c6667,.035+p*.10);g.beginPath();g.moveTo(x-w,y);g.lineTo(x+w*.55,y+lerp(1,12,p));g.strokePath()}
    for(let side=-1;side<=1;side+=2){for(let i=0;i<11;i++){const z=(i/11+this.sceneryScroll*.82)%1,p=Math.pow(z,1.52),y=lerp(HORIZON+10,ROAD_BOTTOM,p),rw=this.roadWidthAt(y),x=W/2+side*(rw*.59),h=lerp(3,48,p);g.lineStyle(lerp(1,5,p),0x2a211c,.88);g.beginPath();g.moveTo(x,y);g.lineTo(x+side*3,y-h);g.strokePath();if(i%4===0){g.fillStyle(0xbd6227,.10+p*.20);g.fillCircle(x+side*3,y-h,lerp(1,5,p))}}}
    for(let side=-1;side<=1;side+=2){for(let i=0;i<7;i++){const z=(i/7+this.sceneryScroll*.66+.15)%1,p=Math.pow(z,1.6),y=lerp(HORIZON+20,ROAD_BOTTOM,p),rw=this.roadWidthAt(y),x=W/2+side*(rw*.72+24),h=lerp(5,104,p);g.lineStyle(lerp(1,10,p),0x100d0d,.96);g.beginPath();g.moveTo(x,y);g.lineTo(x,y-h);g.moveTo(x,y-h*.55);g.lineTo(x-side*h*.26,y-h*.83);g.lineTo(x-side*h*.31,y-h*.98);g.moveTo(x,y-h*.72);g.lineTo(x+side*h*.30,y-h);g.lineTo(x+side*h*.37,y-h*1.12);g.strokePath()}}
    const fb=this.fogBack;fb.clear();for(let i=0;i<4;i++){const y=274+i*43+Math.sin(this.time.now*.00055+i)*8;fb.fillStyle(0xaab8bc,.018+i*.005);fb.fillEllipse(W/2+Math.sin(this.time.now*.00024+i)*45,y,690-i*60,58+i*9)}
    const f=this.fog;f.clear();for(let i=0;i<5;i++){const y=470+i*110+Math.sin(this.time.now*.0008+i)*19;f.fillStyle(0xb6c1bf,.010+i*.003);f.fillEllipse(W/2+Math.sin(this.time.now*.00031+i)*72,y,700-i*58,74+i*12)}
    const v=this.vignette;v.clear();v.fillStyle(0x000000,.12);v.fillRect(0,0,34,H);v.fillRect(W-34,0,34,H);v.fillStyle(0x000000,.08);v.fillRect(0,0,W,44);v.fillRect(0,H-52,W,52);
    for(const l of this.leaves){l.x+=l.vx*dt*(.8+this.speed*.45);l.y+=l.vy*dt*(.8+this.speed*.5);l.rotation+=l.spin*dt;if(l.y>H+20||l.x<-20||l.x>W+20){l.x=Math.random()*W;l.y=HORIZON+Math.random()*160}}
  }
  startRun(){
    audioFx.unlock();audioFx.startWind();openScreen(null);$('hud').classList.remove('hidden');
    this.mode='playing';this.elapsed=0;this.distance=0;this.beans=0;this.score=0;this.speed=1;this.spawnClock=.55;this.targetX=0;this.targetAlt=0;this.boostTime=0;
    this.obstacles.forEach(o=>o.kill());this.pickups.forEach(o=>o.kill());this.boosts.forEach(o=>o.kill());
    this.player.root.setVisible(true).setAlpha(1);this.player.resetMotion();
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
    const travel=(.155*this.speed)*(this.boostTime>0?1.18:1),all=[...this.obstacles,...this.pickups,...this.boosts];
    for(const o of all){
      if(!o.active)continue;o.z-=travel*dt;const p=o.project();
      if(o.kind==='bean')o.container.rotation+=dt*(1.8+this.speed*.4);
      if(o.kind==='boost')o.container.rotation=Math.sin(this.time.now*.004)*.08;
      if(o.z<.105&&o.z>-.03){
        const laneNorm=o.lane*.64,dx=Math.abs(px-laneNorm);
        if(o.kind==='bean'&&dx<.29&&Math.abs(palt)<1.1){o.kill();this.beans++;this.score+=35;audioFx.bean();this.sparkBurst(o.container.x,o.container.y)}
        else if(o.kind==='boost'&&dx<.31){o.kill();this.boostTime=5;audioFx.boost();this.sparkBurst(o.container.x,o.container.y,0xffb04e)}
        else if((o.kind==='car'||o.kind==='tree')&&dx<.27){const hits=o.kind==='tree'||palt<o.hitAlt;if(hits){o.kill();this.endRun();return}}
      }
      if(o.z<-.08)o.kill();
    }
  }
  sparkBurst(x,y,color=0xff8b2d){for(let i=0;i<8;i++){const q=this.add.rectangle(x,y,2+Math.random()*3,5+Math.random()*8,color,.85).setDepth(95);this.tweens.add({targets:q,x:x+(Math.random()-.5)*70,y:y+(Math.random()-.5)*60,alpha:0,rotation:(Math.random()-.5)*4,duration:300+Math.random()*260,onComplete:()=>q.destroy()})}}
  maybeLightning(){if(this.mode!=='playing'||Math.random()>.16)return;this.flash.alpha=.095;this.tweens.add({targets:this.flash,alpha:0,duration:80,repeat:1,yoyo:true});audioFx.tone(72,.25,.035,'sawtooth')}
  updateHud(){$('hud-score').textContent=Math.floor(this.score).toLocaleString();$('hud-distance').textContent=`${this.distance.toFixed(2)} MI`;$('hud-beans').textContent=this.beans;$('hud-speed').textContent=`${this.speed.toFixed(1)}×`}
  update(time,delta){
    const dt=Math.min(delta/1000,.034);this.renderEnvironment(dt);if(this.mode!=='playing')return;
    let dx=0,dy=0;if(this.keys.LEFT.isDown||this.keys.A.isDown)dx=-1;if(this.keys.RIGHT.isDown||this.keys.D.isDown)dx=1;if(this.keys.UP.isDown||this.keys.W.isDown)dy=1;if(this.keys.DOWN.isDown||this.keys.S.isDown)dy=-1;
    if(dx)this.targetX=clamp(this.targetX+dx*dt*1.85,-1,1);if(dy)this.targetAlt=clamp(this.targetAlt+dy*dt*1.4,-.65,.8);
    this.elapsed+=dt;this.speed=1+Math.min(1.85,this.elapsed*.011);if(this.boostTime>0)this.boostTime=Math.max(0,this.boostTime-dt);
    const pose=this.player.update(dt,this.targetX,this.targetAlt,this.speed);audioFx.windLevel(this.speed);
    this.distance+=dt*(.0105*this.speed)*(this.boostTime>0?1.2:1);this.score+=dt*(11*this.speed)*(this.boostTime>0?1.5:1);
    this.spawnClock-=dt;if(this.spawnClock<=0){this.spawnPattern();this.spawnClock=Math.max(.72,1.36-this.speed*.20)+Math.random()*.16}
    this.updateObjects(dt,pose.x,pose.alt);if((Math.floor(this.elapsed*10)%3)===0)this.updateHud();
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