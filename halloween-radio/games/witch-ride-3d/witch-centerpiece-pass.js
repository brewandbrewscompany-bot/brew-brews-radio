import * as pc from 'playcanvas';

// Witch Ride 3D — Pass 11 centerpiece runtime motion / material restraint.
// Visual-only: no scoring, collision, radio, station, shuffle or playback state is touched.
const VERSION='pass-11-reference-match-v1';
const REQUIRED=['cape','cape_left','cape_center','cape_right','hair_01','hair_02','hair_03','hair_04','hair_05','hat_tip','broom_handle','broom_bristles'];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

function spring(channel,target,dt,stiffness,damping){
  const step=Math.min(.033,Math.max(.001,dt||.016));
  channel.v+=(target-channel.x)*stiffness*step;
  channel.v*=Math.exp(-damping*step);
  channel.x+=channel.v*step;
  return channel.x;
}
function motionNode(app,name){
  const node=app.root.findByName(name);if(!node)return null;
  return {node,base:node.getLocalEulerAngles().clone(),x:{x:0,v:0},y:{x:0,v:0},z:{x:0,v:0}};
}
function setDelta(part,dx,dy,dz){
  if(!part?.node)return;
  part.node.setLocalEulerAngles(part.base.x+dx,part.base.y+dy,part.base.z+dz);
}
function tuneWitchMaterials(witch){
  const seen=new Set();
  for(const render of witch.findComponents?.('render')||[]){
    for(const mi of render.meshInstances||[]){
      const m=mi.material;if(!m||seen.has(m))continue;seen.add(m);
      const n=(m.name||'').toLowerCase();
      if(n.includes('felt')){m.gloss=.08;m.bumpiness=.82}
      else if(n.includes('charcoal wool')){m.gloss=.105;m.bumpiness=.92}
      else if(n.includes('oxblood')||n.includes('lining')){m.gloss=.17;m.bumpiness=.88}
      else if(n.includes('cape seam')){m.gloss=.12;m.bumpiness=.9}
      else if(n.includes('auburn hair')){m.gloss=.38;m.bumpiness=.72}
      else if(n.includes('leather')||n.includes('riding boot')){m.gloss=.39;m.bumpiness=.82}
      else if(n.includes('broom')&&n.includes('ash')){m.gloss=.23;m.bumpiness=.9}
      else if(n.includes('broom straw')){m.gloss=.065;m.bumpiness=.95}
      else if(n.includes('brass')){m.gloss=.56}
      m.update?.();
    }
  }
}
function makeSparks(witch){
  const out=[];
  for(let i=0;i<5;i++){
    const mat=new pc.StandardMaterial();
    mat.name=`Pass11 ember spark ${i}`;mat.diffuse=new pc.Color(.18,.035,.005);mat.emissive=new pc.Color(1,.18,.025);mat.emissiveIntensity=.85;
    mat.opacity=.78;mat.blendType=pc.BLEND_ADDITIVE;mat.depthWrite=false;mat.useLighting=false;mat.update();
    const e=new pc.Entity(`Pass11 Broom Spark ${i}`);e.addComponent('render',{type:'sphere'});e.render.material=mat;e.render.castShadows=false;e.render.receiveShadows=false;
    e.setLocalScale(.025,.025,.025);e.setLocalPosition(0,-.78,4.15+i*.10);witch.addChild(e);out.push({e,mat,phase:i*1.47});
  }
  return out;
}
function install(){
  const app=pc.app,wr=window.WitchRide3D;if(!app||!wr?.ready)return false;
  const witch=app.root.findByName('Witch Rig')||app.root.findByName('Witch Rig Fallback');if(!witch)return false;
  const parts={};for(const name of REQUIRED)parts[name]=motionNode(app,name);
  const missing=REQUIRED.filter(n=>!parts[n]);
  if(missing.length){console.error('Pass 11 centerpiece missing motion nodes:',missing.join(', '));return false}
  tuneWitchMaterials(witch);
  const sparks=makeSparks(witch);
  let t=0,prevSpeed=wr.state?.speed||1,lightClock=0;
  const capeCfg=[
    ['cape_left',14.5,5.05,1.08,-.55],
    ['cape_center',18.0,6.25,.72,0],
    ['cape_right',15.2,5.25,.98,.48]
  ];
  const hairNames=['hair_01','hair_02','hair_03','hair_04','hair_05'];

  function tuneLights(){
    const rim=witch.findByName('Witch Rim Glow');if(rim?.light){rim.light.intensity=.82;rim.light.range=9.2;rim.light.color=new pc.Color(.29,.45,.72)}
    const ember=witch.findByName('Broom Ember Light');if(ember?.light){ember.light.intensity=.48;ember.light.range=7.4;ember.light.color=new pc.Color(1,.25,.035)}
    const warm=witch.findByName('Witch Warm Underfill');if(warm?.light){warm.light.intensity=.28;warm.light.range=6.2;warm.light.color=new pc.Color(1,.24,.045)}
    const broom=witch.findByName('Broom Warm Underfill');if(broom?.light){broom.light.intensity=.24;broom.light.range=5.7;broom.light.color=new pc.Color(1,.23,.035)}
  }
  tuneLights();

  app.on('update',dt=>{
    if(!wr.state)return;t+=Math.min(dt||0,.05);lightClock+=dt||0;
    if(lightClock>1){lightClock=0;tuneLights()}
    const s=wr.state,playing=s.mode==='playing';
    const speed=s.speed||1,speedN=playing?clamp((speed-1)/2.8,0,1):0;
    const accel=playing?clamp((speed-prevSpeed)/Math.max(dt,.008),-4,4):0;prevSpeed=speed;
    const steer=playing?clamp((s.velocityX||0)/4.8,-1,1):0;
    const demand=playing?clamp(((s.targetX||0)-(s.x||0))/4.4,-1,1):0;
    const air=playing?(.18+speedN*.82):.08;

    const root=parts.cape;
    const rootX=spring(root.x,1.5+speedN*6.4+Math.max(0,accel)*.34,dt,16,5.8);
    const rootY=spring(root.y,Math.sin(t*1.15)*.35*air,dt,12,6.1);
    const rootZ=spring(root.z,-steer*4.0-demand*2.2,dt,17,5.5);
    setDelta(root,rootX,rootY,rootZ);

    for(let i=0;i<capeCfg.length;i++){
      const [name,k,d,lag,side]=capeCfg[i],p=parts[name];
      const lowFlutter=Math.sin(t*(1.55+i*.17)+i*1.9)*(.45+.32*air);
      const x=spring(p.x,2.0+speedN*(7.8+i*.5)+Math.max(0,accel)*.42+lowFlutter,dt,k,d);
      const y=spring(p.y,side*steer*1.7+Math.sin(t*.82+i)*.28*air,dt,k*.72,d+.7);
      const z=spring(p.z,-steer*(7.0*lag)-demand*(4.0*lag)+side*speedN*1.1,dt,k,d);
      setDelta(p,x,y,z);
    }

    for(let i=0;i<hairNames.length;i++){
      const p=parts[hairNames[i]],length=.82+i*.12;
      const soft=Math.sin(t*(2.0+i*.08)+i*.91)*(.55+i*.09)*air;
      const x=spring(p.x,speedN*(2.0+i*.55)+air*.65+soft,dt,21+i*1.3,6.4+i*.15);
      const y=spring(p.y,Math.sin(t*(1.05+i*.04)+i*.7)*.35*air,dt,17+i,6.8);
      const z=spring(p.z,-steer*(3.2+i*.82)-demand*(1.7+i*.36)*length+soft*.55,dt,20+i*1.1,6.1+i*.17);
      setDelta(p,x,y,z);
    }

    const tip=parts.hat_tip;
    setDelta(tip,
      spring(tip.x,speedN*1.35+Math.sin(t*1.18)*.42*air,dt,13.5,5.2),
      spring(tip.y,Math.sin(t*.73)*.25*air,dt,12,5.6),
      spring(tip.z,-steer*1.65-demand*.82+Math.sin(t*.91+1.3)*.5*air,dt,13,5.0));

    const br=parts.broom_bristles;
    setDelta(br,
      spring(br.x,speedN*1.65+Math.sin(t*2.6)*.45*air,dt,26,7.4),
      spring(br.y,0,dt,25,7.7),
      spring(br.z,-steer*1.2-demand*.48+Math.sin(t*2.1+.6)*.38*air,dt,25,7.2));

    const sparkDrive=playing?(.30+.70*air):.12;
    for(let i=0;i<sparks.length;i++){
      const sp=sparks[i],pulse=Math.sin(t*(6.1+i*.37)+sp.phase);
      sp.e.enabled=pulse>.18&&sparkDrive>.2;
      if(!sp.e.enabled)continue;
      const life=(pulse-.18)/.82;
      sp.e.setLocalPosition((i-2)*.045+Math.sin(t*5+sp.phase)*.035,-.80-Math.abs(Math.sin(t*3.1+sp.phase))*.12,4.12+i*.14+speedN*.38);
      const size=.012+.026*life;sp.e.setLocalScale(size,size,size*1.7);
      sp.mat.emissiveIntensity=.45+life*.55;sp.mat.opacity=.38+life*.34;sp.mat.update();
    }
  });

  window.WitchRideWitchCenterpiecePass={version:VERSION,active:true,requiredNodes:REQUIRED.slice(),missing:[],visualOnly:true};
  return true;
}
function boot(attempt=0){
  if(install())return;
  if(attempt<180)setTimeout(()=>boot(attempt+1),100);
  else console.error('Pass 11 centerpiece runtime did not initialize');
}
boot();
