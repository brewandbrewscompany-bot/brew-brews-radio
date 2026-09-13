import * as pc from 'playcanvas';

const VERSION='pass18-traffic-collision-cleanup-v1';
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const LEGACY_NAMES=Array.from({length:7},(_,i)=>`1938 Coupe ${i}`);
const MOVING_NAMES=Array.from({length:4},(_,i)=>`Oncoming Traffic ${i}`);
const START_Z=[-42,-88,-138,-190];
const PLAYER_Z=2.0;
const PLAYER_HALF_X=.78;
const PLAYER_HALF_Z=1.18;
const TRUCK_HALF_X=1.08;
const TRUCK_HALF_Z=2.42;
const COLLISION_X=PLAYER_HALF_X+TRUCK_HALF_X;
const COLLISION_Z=PLAYER_HALF_Z+TRUCK_HALF_Z;

function hideLegacyTraffic(cars){
  let hidden=0;
  for(const car of cars){
    if(!car)continue;
    car.__active=false;
    if(car.enabled!==false){car.enabled=false;hidden++}
  }
  return hidden;
}

function setMovingTraffic(cars,enabled,reset=false){
  for(let i=0;i<cars.length;i++){
    const car=cars[i];if(!car)continue;
    if(reset){const lane=Number.isFinite(car.__lane)?car.__lane:car.getPosition().x;car.setPosition(lane,0,START_Z[i]??(-42-i*46))}
    car.__pass18Active=!!enabled;
    car.enabled=!!enabled;
  }
}

function enterExistingGameOver(car){
  const w=window.WitchRide3D,s=w?.state;
  if(!w||!s||s.mode!=='playing')return false;
  s.mode='over';
  document.getElementById('hud')?.classList.add('hidden');
  for(const el of document.querySelectorAll('.screen'))el.classList.remove('open');
  const score=document.getElementById('over-score'),distance=document.getElementById('over-distance'),beans=document.getElementById('over-beans'),over=document.getElementById('over');
  if(score)score.textContent=Math.floor(s.score).toLocaleString();
  if(distance)distance.textContent=s.distance.toFixed(2)+' MI';
  if(beans)beans.textContent=String(s.beans);
  over?.classList.add('open');
  w.pass18CollisionCount=(w.pass18CollisionCount||0)+1;
  w.pass18LastCollision={name:car?.name||'moving traffic',x:car?.getPosition?.().x??null,z:car?.getPosition?.().z??null,at:performance.now()};
  window.dispatchEvent(new CustomEvent('witchride:gameover',{detail:{reason:'traffic-collision',vehicle:car?.name||null}}));
  return true;
}

function sweptTrafficCollision(previousZ,currentZ,carX,playerX){
  const lateral=Math.abs(carX-playerX)<COLLISION_X;
  if(!lateral)return false;
  if(previousZ===null||previousZ===undefined)return Math.abs(currentZ-PLAYER_Z)<=COLLISION_Z;
  if(currentZ<previousZ-60)return false;
  const lo=Math.min(previousZ,currentZ),hi=Math.max(previousZ,currentZ);
  return hi>=PLAYER_Z-COLLISION_Z&&lo<=PLAYER_Z+COLLISION_Z;
}

async function install(){
  for(let i=0;i<420;i++){
    const app=pc.app,w=window.WitchRide3D,p17=window.WitchRidePass17Environment;
    if(app&&w?.ready&&p17?.active===true){
      try{
        const legacy=LEGACY_NAMES.map(name=>app.root.findByName(name)).filter(Boolean);
        const moving=MOVING_NAMES.map(name=>app.root.findByName(name)).filter(Boolean);
        if(legacy.length!==7)throw new Error(`expected 7 legacy traffic roots, found ${legacy.length}`);
        if(moving.length!==4)throw new Error(`expected 4 moving traffic roots, found ${moving.length}`);
        hideLegacyTraffic(legacy);
        setMovingTraffic(moving,false,false);
        const previousZ=new WeakMap();
        let wasPlaying=false,collisionLatched=false;

        const enforceLegacy=()=>hideLegacyTraffic(legacy);
        app.on('prerender',enforceLegacy);
        app.on('update',()=>{
          const state=w.state||{},playing=state.mode==='playing';
          hideLegacyTraffic(legacy);

          if(!playing){
            if(wasPlaying)setMovingTraffic(moving,false,false);
            else for(const car of moving)if(car.enabled!==false)car.enabled=false;
            wasPlaying=false;
            return;
          }

          if(!wasPlaying){
            collisionLatched=false;
            setMovingTraffic(moving,true,true);
            for(const car of moving)previousZ.set(car,car.getPosition().z);
            wasPlaying=true;
            return;
          }

          for(const car of moving){
            if(!car.__pass18Active)continue;
            if(car.enabled!==true)car.enabled=true;
            const p=car.getPosition(),prev=previousZ.get(car);
            if(!collisionLatched&&sweptTrafficCollision(prev,p.z,p.x,state.x)){
              collisionLatched=true;
              if(enterExistingGameOver(car))setMovingTraffic(moving,false,false);
              break;
            }
            previousZ.set(car,p.z);
          }
        });

        const detail={
          legacyTrafficRetired:legacy.length,
          movingTrafficManaged:moving.length,
          collisionMethod:'swept-lane-volume',
          playerHalfX:PLAYER_HALF_X,
          playerHalfZ:PLAYER_HALF_Z,
          truckHalfX:TRUCK_HALF_X,
          truckHalfZ:TRUCK_HALF_Z,
          collisionHalfWidthTotal:COLLISION_X,
          collisionHalfDepthTotal:COLLISION_Z,
          visualSourcesChanged:false,
          pass17TrafficVisualsPreserved:true,
          pass17RoadReflectionsPreserved:true
        };
        w.pass18TrafficPass=VERSION;
        w.pass18TrafficDetail=detail;
        window.WitchRidePass18Traffic={active:true,version:VERSION,detail,legacyNames:[...LEGACY_NAMES],movingNames:[...MOVING_NAMES]};
        document.body.classList.add('pass18-traffic-ready');
        console.info('Witch Ride Pass 18 traffic collision/cleanup ready',VERSION,detail);
        return;
      }catch(err){
        console.error('Witch Ride Pass 18 traffic cleanup failed',err);
        if(w){w.pass18TrafficPass='fallback';w.pass18TrafficError=err?.stack||err?.message||String(err)}
        return;
      }
    }
    await wait(50);
  }
  const w=window.WitchRide3D;if(w){w.pass18TrafficPass='fallback';w.pass18TrafficError='timed out waiting for Pass 17 environment'}
}

install();
