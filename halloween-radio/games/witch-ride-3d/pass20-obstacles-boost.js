import * as pc from 'playcanvas';

const VERSION='pass20-obstacles-boost-v1';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const PLAYER_Z=2.0,PLAYER_HALF_X=.78,PLAYER_HALF_Z=1.18,TRUCK_HALF_X=1.08,TRUCK_HALF_Z=2.42;
const EXTRA_LANES=[0,-4.15,4.15],EXTRA_START=[-66,-116,-166];
const BOOST_MULTIPLIER=1.45,BOOST_DURATION=4.0,BOOST_SPEED_CAP=3.45;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

function walk(root,fn){if(!root)return;fn(root);for(const c of root.children||[])walk(c,fn)}
function material(name,diffuse,emissive,intensity,opacity=1,additive=false,gloss=.15){const m=new pc.StandardMaterial();m.name=name;m.diffuse=new pc.Color(...diffuse);m.emissive=new pc.Color(...emissive);m.emissiveIntensity=intensity;m.opacity=opacity;m.gloss=gloss;m.useMetalness=true;m.metalness=0;if(opacity<1||additive){m.blendType=additive?pc.BLEND_ADDITIVE:pc.BLEND_NORMAL;m.depthWrite=false;m.cull=pc.CULLFACE_NONE}m.update();return m}
function primitive(name,type,scale,pos,mat,parent,rot=null){const e=new pc.Entity(name);e.addComponent('render',{type});e.setLocalScale(...scale);e.setLocalPosition(...pos);if(rot)e.setLocalEulerAngles(...rot);e.render.material=mat;e.render.castShadows=false;e.render.receiveShadows=false;parent.addChild(e);return e}

function existingGameOver(source,reason){const w=window.WitchRide3D,s=w?.state;if(!w||!s||s.mode!=='playing')return false;s.mode='over';document.getElementById('hud')?.classList.add('hidden');for(const el of document.querySelectorAll('.screen'))el.classList.remove('open');const score=document.getElementById('over-score'),distance=document.getElementById('over-distance'),beans=document.getElementById('over-beans'),over=document.getElementById('over');if(score)score.textContent=Math.floor(s.score).toLocaleString();if(distance)distance.textContent=s.distance.toFixed(2)+' MI';if(beans)beans.textContent=String(s.beans);over?.classList.add('open');window.dispatchEvent(new CustomEvent('witchride:gameover',{detail:{reason,obstacle:source?.name||null}}));return true}
function sweptHit(prevZ,z,x,playerX,halfX=TRUCK_HALF_X,halfZ=TRUCK_HALF_Z){if(Math.abs(x-playerX)>=PLAYER_HALF_X+halfX)return false;if(prevZ==null)return Math.abs(z-PLAYER_Z)<=PLAYER_HALF_Z+halfZ;if(z<prevZ-60)return false;const lo=Math.min(prevZ,z),hi=Math.max(prevZ,z),d=PLAYER_HALF_Z+halfZ;return hi>=PLAYER_Z-d&&lo<=PLAYER_Z+d}

function addBeanBurningHalos(app){
  const inner=material('Pass20 bean ember flame',[.34,.055,.003],[1,.18,.012],.52,.13,true,.08),outer=material('Pass20 bean amber flame',[.26,.085,.005],[1,.38,.035],.34,.095,true,.06),aura=material('Pass20 bean ember aura',[.28,.055,.003],[1,.16,.010],.22,.026,true,.04);
  const roots=[];let beans=0,flames=0;
  for(let i=0;i<16;i++){
    const bean=app.root.findByName(`Coffee Bean ${i}`);if(!bean)continue;beans++;
    const haloRoot=new pc.Entity(`Pass20 Bean Burning Halo ${i}`);bean.addChild(haloRoot);roots.push(haloRoot);
    primitive(`Pass20 Bean Ember Aura ${i}`,'sphere',[.64,.78,.42],[0,0,0],aura,haloRoot);
    for(let n=0;n<8;n++){
      const a=n*Math.PI/4,r=.40+(n%2)*.035,x=Math.cos(a)*r,z=Math.sin(a)*r,y=-.02+(n%3)*.055;
      const f=primitive(`Pass20 Bean Flame ${i} ${n}`,'cone',[.060+(n%2)*.014,.17+(n%3)*.025,.060+(n%2)*.014],[x,y,z],n%2?outer:inner,haloRoot,[0,-n*45,0]);f.__baseY=y;f.__phase=i*.41+n*.83;flames++;
    }
  }
  return {roots,beans,flames};
}

function buildExtraTraffic(app){
  const source=app.root.findByName('Oncoming Traffic 0');if(!source?.clone)throw new Error('Pass20 moving traffic source unavailable');
  const cars=[];
  for(let i=0;i<EXTRA_LANES.length;i++){
    const e=source.clone();e.name=`Pass20 Oncoming Traffic ${i}`;e.enabled=false;e.__pass20Active=false;e.__lane=EXTRA_LANES[i];e.__reset=190+i*17;e.setPosition(e.__lane,0,EXTRA_START[i]);app.root.addChild(e);cars.push(e);
  }
  return cars;
}

function ghostMaterials(){return {body:material('Pass20 ghost ectoplasm',[.34,.43,.48],[.20,.42,.50],.26,.34,false,.08),edge:material('Pass20 ghost edge',[.36,.60,.67],[.28,.72,.78],.44,.12,true,.04),eye:material('Pass20 ghost eyes',[.55,.75,.78],[.72,1,1],.82,1,false,.18)}}
function buildGhost(name,m){const r=new pc.Entity(name);primitive('ghost body','capsule',[.62,1.20,.54],[0,1.28,0],m.body,r);primitive('ghost head','sphere',[.58,.58,.52],[0,2.18,.02],m.body,r);primitive('ghost trail L','cone',[.22,.72,.20],[-.34,.22,0],m.edge,r,[180,0,0]);primitive('ghost trail C','cone',[.24,.82,.22],[0,.12,0],m.edge,r,[180,0,0]);primitive('ghost trail R','cone',[.22,.72,.20],[.34,.22,0],m.edge,r,[180,0,0]);primitive('ghost eye L','sphere',[.075,.10,.05],[-.19,2.26,.48],m.eye,r);primitive('ghost eye R','sphere',[.075,.10,.05],[.19,2.26,.48],m.eye,r);r.__type='ghost';r.__halfX=.72;r.__halfZ=.70;r.__baseY=.35;return r}
function goblinMaterials(){return {skin:material('Pass20 goblin skin',[.12,.17,.055],[.025,.045,.008],.08,1,false,.12),cloth:material('Pass20 goblin cloth',[.085,.026,.018],[.018,.003,.001],.04,1,false,.09),eye:material('Pass20 goblin eyes',[.62,.16,.012],[1,.20,.012],.92,1,false,.22)}}
function buildGoblin(name,m){const r=new pc.Entity(name);primitive('goblin body','capsule',[.56,.92,.48],[0,.92,0],m.cloth,r);primitive('goblin head','sphere',[.52,.48,.47],[0,1.78,.05],m.skin,r);primitive('goblin ear L','cone',[.17,.42,.12],[-.52,1.82,.02],m.skin,r,[0,0,90]);primitive('goblin ear R','cone',[.17,.42,.12],[.52,1.82,.02],m.skin,r,[0,0,-90]);primitive('goblin eye L','sphere',[.065,.075,.045],[-.18,1.86,.45],m.eye,r);primitive('goblin eye R','sphere',[.065,.075,.045],[.18,1.86,.45],m.eye,r);primitive('goblin leg L','capsule',[.17,.50,.17],[-.22,.22,0],m.skin,r);primitive('goblin leg R','capsule',[.17,.50,.17],[.22,.22,0],m.skin,r);r.__type='goblin';r.__halfX=.62;r.__halfZ=.58;r.__baseY=.02;return r}
function buildCrossingHazards(app){const gm=ghostMaterials(),bm=goblinMaterials(),out=[];for(let i=0;i<4;i++){const e=i%2===0?buildGhost(`Pass20 Crossing Ghost ${i/2|0}`,gm):buildGoblin(`Pass20 Crossing Goblin ${i/2|0}`,bm);e.enabled=false;e.__pass20Active=false;e.__phase=i*1.11;app.root.addChild(e);out.push(e)}return out}

function buildBoost(app){
  const source=app.root.findByName('Coffee Bean 0');if(!source?.clone)throw new Error('Pass20 boost bean source unavailable');
  const boost=source.clone();boost.name='Pass20 Brew Boost';boost.enabled=false;boost.__active=false;boost.setLocalScale(1.08,1.08,1.08);app.root.addChild(boost);
  walk(boost,node=>{for(const mi of node?.render?.meshInstances||[]){const src=mi.material;if(!src?.clone)continue;const m=src.clone(),halo=/halo/i.test(node.name||'')||/halo/i.test(src.name||'');if(halo){m.diffuse=new pc.Color(.10,.38,.45);m.emissive=new pc.Color(.12,.78,.95);m.emissiveIntensity=.72;m.opacity=.12;m.blendType=pc.BLEND_ADDITIVE;m.depthWrite=false}else{m.diffuse=new pc.Color(.24,.075,.010);m.emissive=new pc.Color(.08,.012,.001);m.emissiveIntensity=.12;m.gloss=.38}m.update();mi.material=m}});
  const sparkMat=material('Pass20 boost spark',[.10,.48,.58],[.16,.92,1],.82,.55,true,.08),orbit=new pc.Entity('Pass20 Boost Orbit');boost.addChild(orbit);for(let i=0;i<4;i++){const a=i*Math.PI/2;primitive(`Pass20 Boost Spark ${i}`,'sphere',[.075,.075,.075],[Math.cos(a)*.58,Math.sin(a)*.18,Math.sin(a)*.58],sparkMat,orbit)}
  const light=new pc.Entity('Pass20 Boost Light');light.addComponent('light',{type:'point',color:new pc.Color(.18,.78,1),intensity:.24,range:3.2,castShadows:false});boost.addChild(light);
  boost.__orbit=orbit;return boost;
}

function installBoostSpeedBridge(state){
  let baseSpeed=Number(state.speed)||1,multiplier=1,remaining=0;
  Object.defineProperty(state,'speed',{configurable:true,enumerable:true,get(){return Math.min(BOOST_SPEED_CAP,baseSpeed*multiplier)},set(v){const n=Number(v);if(Number.isFinite(n))baseSpeed=n}});
  return {activate(){remaining=BOOST_DURATION;multiplier=BOOST_MULTIPLIER},reset(){remaining=0;multiplier=1},tick(dt,playing){if(playing&&remaining>0){remaining=Math.max(0,remaining-dt);if(remaining===0)multiplier=1}},get remaining(){return remaining},get multiplier(){return multiplier},get baseSpeed(){return baseSpeed}};
}
function makeBoostBadge(){const e=document.createElement('div');e.id='pass20-boost-status';Object.assign(e.style,{position:'absolute',left:'50%',top:'76px',transform:'translateX(-50%)',zIndex:'18',pointerEvents:'none',fontFamily:'system-ui,sans-serif',fontWeight:'900',fontSize:'12px',letterSpacing:'1.5px',padding:'6px 10px',borderRadius:'999px',border:'1px solid rgba(110,225,255,.45)',background:'rgba(4,15,19,.68)',color:'#a9f3ff',textShadow:'0 0 8px rgba(80,220,255,.48)',display:'none'});document.getElementById('shell')?.appendChild(e);return e}

async function install(){
  for(let attempt=0;attempt<480;attempt++){
    const app=pc.app,w=window.WitchRide3D,p18=window.WitchRidePass18Traffic,p19=window.WitchRidePass19Material;
    if(app&&w?.ready&&p18?.active===true&&p19?.active===true){
      try{
        const state=w.state,extraTraffic=buildExtraTraffic(app),crossers=buildCrossingHazards(app),boost=buildBoost(app),burning=addBeanBurningHalos(app),speedBridge=installBoostSpeedBridge(state),badge=makeBoostBadge(),prevZ=new WeakMap();
        let trafficWasPlaying=false,collisionLatched=false,crossClock=3.6,boostClock=8.0,t=0;
        const rememberCars=()=>extraTraffic.forEach(c=>prevZ.set(c,c.getPosition().z));
        const setTraffic=(enabled,reset=false)=>{extraTraffic.forEach((c,i)=>{if(reset)c.setPosition(c.__lane,0,EXTRA_START[i]);c.__pass20Active=enabled;c.enabled=enabled});if(enabled)rememberCars()};
        const resetCrossers=()=>crossers.forEach(e=>{e.enabled=false;e.__pass20Active=false});
        const resetBoost=()=>{boost.enabled=false;boost.__active=false;speedBridge.reset();badge.style.display='none'};
        const resetRun=()=>{collisionLatched=false;setTraffic(true,true);resetCrossers();resetBoost();crossClock=3.6;boostClock=8.0;trafficWasPlaying=true};
        const spawnCrosser=()=>{const e=crossers.find(x=>!x.__pass20Active);if(!e)return;const dir=Math.random()<.5?1:-1;e.__dir=dir;e.__crossSpeed=(e.__type==='ghost'?2.45:2.15)+Math.random()*.50;e.__pass20Active=true;e.enabled=true;e.setPosition(dir>0?-7.1:7.1,e.__baseY,-92-Math.random()*24)};
        const spawnBoost=()=>{if(boost.__active)return;const lanes=[-4,0,4];boost.__active=true;boost.enabled=true;boost.setPosition(lanes[Math.floor(Math.random()*lanes.length)],1.2,-106-Math.random()*15)};
        const activateBoost=()=>{speedBridge.activate();state.score+=75;badge.style.display='block';window.dispatchEvent(new CustomEvent('witchride:boost',{detail:{multiplier:BOOST_MULTIPLIER,duration:BOOST_DURATION}}))};
        const stopForGameOver=()=>{setTraffic(false,false);resetCrossers();boost.enabled=false;boost.__active=false;speedBridge.reset();badge.style.display='none';trafficWasPlaying=false};
        document.getElementById('play')?.addEventListener('click',resetRun);document.getElementById('again')?.addEventListener('click',resetRun);document.getElementById('resume')?.addEventListener('click',()=>{if(state.mode==='playing'){setTraffic(true,false);trafficWasPlaying=true}});document.getElementById('pause')?.addEventListener('click',()=>{if(state.mode!=='playing'){setTraffic(false,false);trafficWasPlaying=false}});window.addEventListener('witchride:gameover',stopForGameOver);

        app.on('update',dt=>{
          dt=Math.min(dt||0,.05);t+=dt;const playing=state.mode==='playing';speedBridge.tick(dt,playing);
          if(speedBridge.remaining>0){badge.style.display='block';badge.textContent=`BREW BOOST  ${speedBridge.remaining.toFixed(1)}s`}else badge.style.display='none';
          for(let i=0;i<burning.roots.length;i++){const root=burning.roots[i];root.rotateLocal(0,22*dt,0);for(const f of root.children||[]){if(!f.name?.startsWith('Pass20 Bean Flame'))continue;const pulse=.92+Math.sin(t*7.2+(f.__phase||0))*.12,s=f.getLocalScale();f.setLocalScale(s.x,.18*pulse,s.z);const p=f.getLocalPosition();f.setLocalPosition(p.x,(f.__baseY||0)+Math.sin(t*5.6+(f.__phase||0))*.028,p.z)}}
          if(boost.__orbit)boost.__orbit.rotateLocal(0,150*dt,0);
          if(!playing){if(trafficWasPlaying)setTraffic(false,false);trafficWasPlaying=false;return}
          if(!trafficWasPlaying){setTraffic(true,false);trafficWasPlaying=true;rememberCars()}
          const roadTravel=11.2*state.speed;
          for(const car of extraTraffic){if(!car.__pass20Active)continue;if(car.enabled!==true)car.enabled=true;const prev=prevZ.get(car);car.translate(0,0,(roadTravel+8.0+state.speed*1.9)*dt);const p=car.getPosition();if(p.z>24){car.setPosition(car.__lane,0,p.z-car.__reset);prevZ.set(car,car.getPosition().z);continue}if(!collisionLatched&&sweptHit(prev,p.z,p.x,state.x)){collisionLatched=true;if(existingGameOver(car,'pass20-traffic-collision'))stopForGameOver();break}prevZ.set(car,p.z)}
          if(state.mode!=='playing')return;
          crossClock-=dt;if(crossClock<=0){spawnCrosser();crossClock=6.2+Math.random()*2.6}
          for(const e of crossers){if(!e.__pass20Active)continue;const p=e.getPosition();e.setPosition(p.x+e.__dir*e.__crossSpeed*dt,e.__baseY+(e.__type==='ghost'?Math.sin(t*3.1+e.__phase)*.16:Math.abs(Math.sin(t*5.3+e.__phase))*.05),p.z+roadTravel*dt);e.rotateLocal(0,(e.__type==='ghost'?12:5)*dt*e.__dir,0);const q=e.getPosition();if(q.z>18||Math.abs(q.x)>8.4){e.enabled=false;e.__pass20Active=false;continue}if(Math.abs(q.x-state.x)<PLAYER_HALF_X+e.__halfX&&Math.abs(q.z-PLAYER_Z)<PLAYER_HALF_Z+e.__halfZ){collisionLatched=true;if(existingGameOver(e,`pass20-${e.__type}-collision`))stopForGameOver();break}}
          if(state.mode!=='playing')return;
          boostClock-=dt;if(boostClock<=0){spawnBoost();boostClock=13+Math.random()*4}
          if(boost.__active){boost.translate(0,0,roadTravel*dt);boost.rotateLocal(0,105*dt,0);const p=boost.getPosition();if(p.z>16){boost.enabled=false;boost.__active=false}else if(p.z>0&&p.z<4.5&&Math.abs(p.x-state.x)<1.22){boost.enabled=false;boost.__active=false;activateBoost()}}
        });

        const detail={lockedSourceCommit:'597505f01d41dac972b488fa066084e05bf732b1',extraMovingTrucks:extraTraffic.length,centerLaneTrucks:extraTraffic.filter(c=>Math.abs(c.__lane)<.1).length,totalMovingTrucks:4+extraTraffic.length,crossingGhosts:crossers.filter(e=>e.__type==='ghost').length,crossingGoblins:crossers.filter(e=>e.__type==='goblin').length,beanBurningHalos:burning.beans,beanFlameTongues:burning.flames,boostMultiplier:BOOST_MULTIPLIER,boostDuration:BOOST_DURATION,boostSpeedCap:BOOST_SPEED_CAP,witchVisualChanged:false,pass19MaterialsChanged:false,roadChanged:false,reflectionChanged:false,cameraChanged:false};
        window.WitchRidePass20Gameplay={active:true,version:VERSION,detail,extraTraffic,crossers,boost,speedBridge,test:{spawnCrosser,spawnBoost,activateBoost,resetRun}};
        document.body.classList.add('pass20-gameplay-ready');console.info('Witch Ride Pass 20 gameplay ready',VERSION,detail);return;
      }catch(err){console.error('Pass20 install failed',err);window.WitchRidePass20Gameplay={active:false,version:VERSION,error:String(err)};return}
    }
    await wait(50);
  }
  console.error('Pass20 install timed out');
}
install();
