import * as pc from 'playcanvas';

const VERSION='pass23-traffic-spacing-v1';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const ROW_SPAN=10.0;
const STAGGER_STEP=24.0;
const MIN_REAR_GAP=16.0;
const MAX_ACTIVE_PER_ROW=2;
const SAFE_ADJUST_Z=-14.0;

function movingTraffic(app,p20){
  const originals=Array.from({length:4},(_,i)=>app.root.findByName(`Oncoming Traffic ${i}`)).filter(Boolean);
  const extras=(p20?.extraTraffic||[]).filter(Boolean);
  return [...originals,...extras];
}

function isActiveTruck(e){
  if(!e||e.enabled!==true)return false;
  if(e.name?.startsWith('Oncoming Traffic '))return e.__pass18Active===true;
  if(e.name?.startsWith('Pass20 Oncoming Traffic '))return e.__pass20Active===true;
  return false;
}

function findSafeRearZ(victim,all){
  let z=victim.getPosition().z-STAGGER_STEP;
  for(let tries=0;tries<12;tries++){
    const clear=all.every(other=>other===victim||Math.abs(other.getPosition().z-z)>=MIN_REAR_GAP);
    if(clear)return z;
    z-=STAGGER_STEP;
  }
  return z;
}

function resolveThreeTruckRows(trucks,stats){
  let adjusted=0;
  for(let guard=0;guard<8;guard++){
    const active=trucks.filter(isActiveTruck).sort((a,b)=>a.getPosition().z-b.getPosition().z);
    let triple=null;
    for(let i=0;i<=active.length-3;i++){
      const a=active[i],b=active[i+1],c=active[i+2];
      if(c.getPosition().z-a.getPosition().z<=ROW_SPAN){triple=[a,b,c];break}
    }
    if(!triple)break;

    // Move only the farthest-back truck, and only while the group is still safely ahead of the rider.
    // This prevents a three-wide wall without changing lanes, visuals, materials, reflections or collision sizes.
    const victim=triple[0];
    const p=victim.getPosition();
    if(p.z>SAFE_ADJUST_Z)break;
    const targetZ=findSafeRearZ(victim,active);
    victim.setPosition(p.x,p.y,targetZ);
    adjusted++;
    stats.interventions++;
    stats.lastAdjustment={name:victim.name,fromZ:p.z,toZ:targetZ,at:performance.now()};
  }
  return adjusted;
}

function maxRowCount(trucks){
  const active=trucks.filter(isActiveTruck).sort((a,b)=>a.getPosition().z-b.getPosition().z);
  let max=0;
  for(let i=0;i<active.length;i++){
    const start=active[i].getPosition().z;
    let count=1;
    for(let j=i+1;j<active.length;j++){
      if(active[j].getPosition().z-start<=ROW_SPAN)count++;else break;
    }
    max=Math.max(max,count);
  }
  return max;
}

async function install(){
  for(let attempt=0;attempt<480;attempt++){
    const app=pc.app,w=window.WitchRide3D,p20=window.WitchRidePass20Gameplay,p22=window.WitchRidePass22Bean;
    if(app&&w?.ready&&p20?.active===true&&p22?.active===true){
      try{
        const trucks=movingTraffic(app,p20);
        if(trucks.length!==7)throw new Error(`Pass23 expected 7 moving trucks, found ${trucks.length}`);
        const stats={interventions:0,lastAdjustment:null,maxObservedRow:0};
        const enforce=()=>{
          if(w.state?.mode!=='playing')return;
          resolveThreeTruckRows(trucks,stats);
          stats.maxObservedRow=Math.max(stats.maxObservedRow,maxRowCount(trucks));
        };
        app.on('update',enforce);
        document.getElementById('play')?.addEventListener('click',()=>setTimeout(enforce,0));
        document.getElementById('again')?.addEventListener('click',()=>setTimeout(enforce,0));
        document.getElementById('resume')?.addEventListener('click',()=>setTimeout(enforce,0));

        const detail={
          trucksManaged:trucks.length,
          maxActivePerRow:MAX_ACTIVE_PER_ROW,
          rowSpan:ROW_SPAN,
          staggerStep:STAGGER_STEP,
          minimumRearGap:MIN_REAR_GAP,
          lanePositionsChanged:false,
          truckVisualsChanged:false,
          truckMaterialsChanged:false,
          reflectionsChanged:false,
          collisionVolumesChanged:false,
          witchChanged:false,
          beanChanged:false,
          hazardsChanged:false,
          boostChanged:false,
          roadChanged:false,
          cameraChanged:false,
          stats
        };
        window.WitchRidePass23TrafficSpacing={active:true,version:VERSION,detail,trucks,test:{resolve:()=>resolveThreeTruckRows(trucks,stats),maxRow:()=>maxRowCount(trucks)}};
        document.body.classList.add('pass23-traffic-spacing-ready');
        console.info('Witch Ride Pass 23 traffic spacing ready',VERSION,detail);
        return;
      }catch(err){
        console.error('Pass23 traffic spacing failed',err);
        window.WitchRidePass23TrafficSpacing={active:false,version:VERSION,error:String(err)};
        return;
      }
    }
    await wait(50);
  }
  console.error('Pass23 traffic spacing timed out');
}

install();
