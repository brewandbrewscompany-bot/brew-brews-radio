import * as pc from 'playcanvas';

// Witch Ride 3D — Pass 14 mesh-only rider rebuild.
// Geometry/motion only. No production material pass is applied here.
const PASS_ID='witch-centerpiece-pass-v14';
const VERSION='pass-14-mesh-only-v1';
const REVIEW='neutral-clay-mesh-review-only';
const GAMEPLAY_SCALE=.18;
const REQUIRED=['cape','cape_left','cape_center','cape_right','hair_01','hair_02','hair_03','hair_04','hair_05','hat_tip','broom_handle','broom_bristles'];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

function spring(ch,target,dt,k,d){
  const step=Math.min(.033,Math.max(.001,dt||.016));
  ch.v+=(target-ch.x)*k*step;ch.v*=Math.exp(-d*step);ch.x+=ch.v*step;return ch.x;
}
function part(app,name){
  const node=app.root.findByName(name);if(!node)return null;
  return {node,base:node.getLocalEulerAngles().clone(),x:{x:0,v:0},y:{x:0,v:0},z:{x:0,v:0}};
}
function setDelta(p,x,y,z){if(p?.node)p.node.setLocalEulerAngles(p.base.x+x,p.base.y+y,p.base.z+z)}

function install(){
  const app=pc.app,wr=window.WitchRide3D;if(!app||!wr?.ready)return false;
  const witch=app.root.findByName('Witch Rig');if(!witch)return false;
  witch.setLocalScale(GAMEPLAY_SCALE,GAMEPLAY_SCALE,GAMEPLAY_SCALE);
  const parts={};for(const n of REQUIRED)parts[n]=part(app,n);
  const missing=REQUIRED.filter(n=>!parts[n]);
  if(missing.length){console.error('Pass 14 mesh roots missing:',missing.join(', '));return false}
  let t=0,prevSpeed=wr.state?.speed||1;
  const capeCfg=[['cape_left',8.8,10.0,-.30],['cape_center',10.4,10.8,0],['cape_right',8.8,10.0,.30]];
  const hair=['hair_01','hair_02','hair_03','hair_04','hair_05'];
  app.on('update',dt=>{
    if(!wr.state)return;dt=Math.min(dt||0,.05);t+=dt;
    const s=wr.state,playing=s.mode==='playing',speed=s.speed||1;
    const speedN=playing?clamp((speed-1)/2.8,0,1):0;
    const accel=playing?clamp((speed-prevSpeed)/Math.max(dt,.008),-3,3):0;prevSpeed=speed;
    const steer=playing?clamp((s.velocityX||0)/4.8,-1,1):0;
    const demand=playing?clamp(((s.targetX||0)-(s.x||0))/4.4,-1,1):0;
    const air=playing?(.08+speedN*.62):.02;

    const c=parts.cape;
    setDelta(c,
      spring(c.x,.10+speedN*.78+Math.max(0,accel)*.025,dt,8.4,10.2),
      spring(c.y,Math.sin(t*.42)*.020*air,dt,7.5,10.5),
      spring(c.z,-steer*.58-demand*.22,dt,8.6,10.0));
    for(let i=0;i<capeCfg.length;i++){
      const [name,k,d,side]=capeCfg[i],p=parts[name];
      setDelta(p,
        spring(p.x,.08+speedN*(.42+i*.05)+Math.sin(t*(.46+i*.03)+i)*.015*air,dt,k,d),
        spring(p.y,side*steer*.10,dt,k*.72,d+1),
        spring(p.z,-steer*(.52+i*.08)-demand*.18+side*speedN*.04,dt,k,d));
    }
    for(let i=0;i<hair.length;i++){
      const p=parts[hair[i]],phase=i*.74;
      setDelta(p,
        spring(p.x,speedN*(.15+i*.025)+Math.sin(t*.72+phase)*.025*air,dt,12.2+i*.4,9.0),
        spring(p.y,Math.sin(t*.45+phase)*.018*air,dt,11.5,9.2),
        spring(p.z,-steer*(.32+i*.055)-demand*.10+Math.sin(t*.58+phase)*.018*air,dt,12.0,9.0));
    }
    const tip=parts.hat_tip;
    setDelta(tip,0,0,0);
    const br=parts.broom_bristles;
    setDelta(br,
      spring(br.x,speedN*.025+Math.sin(t*.96)*.008*air,dt,24,11),
      spring(br.y,0,dt,25,11),
      spring(br.z,-steer*.045-demand*.015,dt,24,11));
  });
  window.WitchRideWitchCenterpiecePass={passId:PASS_ID,version:VERSION,review:REVIEW,active:true,visualOnly:true,meshOnly:true,gameplayScale:GAMEPLAY_SCALE,hatLocked:true,broomFlowAxis:'+Z toward chase camera/player',requiredNodes:REQUIRED.slice(),missing:[]};
  return true;
}
function boot(attempt=0){if(install())return;if(attempt<180)setTimeout(()=>boot(attempt+1),100);else console.error('Pass 14 mesh-only centerpiece runtime did not initialize')}
boot();
