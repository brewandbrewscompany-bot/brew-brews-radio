import * as pc from 'playcanvas';

// Witch Ride 3D — Pass 13 rear rider silhouette runtime.
// Visual-only: scoring, collision, station state and audio intent remain untouched.
const PASS_ID='witch-centerpiece-pass-v13';
const ASSET_BUILD='witch-realism-pass-v3';
const VERSION='pass-13-rear-silhouette-v1';
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
function multiplyScale(node,x=1,y=1,z=1){
  if(!node)return;
  const s=node.getLocalScale();
  node.setLocalScale(s.x*x,s.y*y,s.z*z);
}
function tuneWitchMaterials(witch){
  const seen=new Set();
  for(const render of witch.findComponents?.('render')||[]){
    for(const mi of render.meshInstances||[]){
      const m=mi.material;if(!m||seen.has(m))continue;seen.add(m);
      const n=(m.name||'').toLowerCase();
      if(n.includes('felt')){m.gloss=.008;m.bumpiness=.24}
      else if(n.includes('charcoal wool')){m.gloss=.002;m.bumpiness=.10}
      else if(n.includes('oxblood')||n.includes('lining')){m.gloss=.006;m.bumpiness=.14}
      else if(n.includes('cape seam')){m.gloss=.004;m.bumpiness=.16}
      else if(n.includes('auburn hair')){m.gloss=.040;m.bumpiness=.22}
      else if(n.includes('leather')||n.includes('riding boot')){m.gloss=.070;m.bumpiness=.34}
      else if(n.includes('broom')&&n.includes('ash')){m.gloss=.030;m.bumpiness=.36}
      else if(n.includes('broom straw')){m.gloss=.003;m.bumpiness=.20}
      else if(n.includes('brass')){m.gloss=.22}
      if(!n.includes('brass')){m.metalness=0;m.reflectivity=.008}
      m.update?.();
    }
  }
}
function applySilhouetteScales(witch,parts){
  // Geometry now carries the proportions; runtime only makes small camera-readability corrections.
  multiplyScale(parts.cape?.node,1.02,.98,.96);
  for(const name of ['hair_01','hair_02','hair_03','hair_04','hair_05'])multiplyScale(parts[name]?.node,1.08,.98,.96);
  multiplyScale(parts.broom_bristles?.node,1.18,1.12,1.08);
  multiplyScale(witch.findByName('broom_shaft'),1.10,1.10,1.0);
  multiplyScale(witch.findByName('torso_taper'),1.03,1.0,1.0);
  multiplyScale(witch.findByName('shoulder_-1'),1.06,1.0,1.0);
  multiplyScale(witch.findByName('shoulder_1'),1.06,1.0,1.0);
}
function makeSparks(witch){
  const out=[];
  for(let i=0;i<4;i++){
    const mat=new pc.StandardMaterial();
    mat.name=`Pass13 ember spark ${i}`;mat.diffuse=new pc.Color(.08,.014,.002);mat.emissive=new pc.Color(.78,.075,.006);mat.emissiveIntensity=.36;
    mat.opacity=.44;mat.blendType=pc.BLEND_ADDITIVE;mat.depthWrite=false;mat.useLighting=false;mat.update();
    const e=new pc.Entity(`Pass13 Broom Spark ${i}`);e.addComponent('render',{type:'sphere'});e.render.material=mat;e.render.castShadows=false;e.render.receiveShadows=false;
    e.setLocalScale(.010,.010,.016);e.setLocalPosition(0,-.76,4.05+i*.08);witch.addChild(e);out.push({e,mat,phase:i*1.71});
  }
  return out;
}
function install(){
  const app=pc.app,wr=window.WitchRide3D;if(!app||!wr?.ready)return false;
  const witch=app.root.findByName('Witch Rig')||app.root.findByName('Witch Rig Fallback');if(!witch)return false;
  const parts={};for(const name of REQUIRED)parts[name]=motionNode(app,name);
  const missing=REQUIRED.filter(n=>!parts[n]);
  if(missing.length){console.error('Pass 13 centerpiece missing motion nodes:',missing.join(', '));return false}
  tuneWitchMaterials(witch);
  applySilhouetteScales(witch,parts);
  const sparks=makeSparks(witch);
  let t=0,prevSpeed=wr.state?.speed||1,lightClock=0;
  const capeCfg=[
    ['cape_left',8.6,8.8,.92,-.36],
    ['cape_center',9.8,9.6,.70,0],
    ['cape_right',8.8,9.0,.90,.36]
  ];
  const hairNames=['hair_01','hair_02','hair_03','hair_04','hair_05'];

  function tuneLights(){
    const rim=witch.findByName('Witch Rim Glow');if(rim?.light){rim.light.intensity=.28;rim.light.range=7.2;rim.light.color=new pc.Color(.20,.24,.31)}
    const ember=witch.findByName('Broom Ember Light');if(ember?.light){ember.light.intensity=.22;ember.light.range=4.8;ember.light.color=new pc.Color(.82,.12,.012)}
    const warm=witch.findByName('Witch Warm Underfill');if(warm?.light){warm.light.intensity=.085;warm.light.range=4.0;warm.light.color=new pc.Color(.72,.10,.010)}
    const broom=witch.findByName('Broom Warm Underfill');if(broom?.light){broom.light.intensity=.13;broom.light.range=4.6;broom.light.color=new pc.Color(.82,.12,.010)}
  }
  tuneLights();

  app.on('update',dt=>{
    if(!wr.state)return;t+=Math.min(dt||0,.05);lightClock+=dt||0;
    if(lightClock>1){lightClock=0;tuneLights()}
    const s=wr.state,playing=s.mode==='playing';
    const speed=s.speed||1,speedN=playing?clamp((speed-1)/2.8,0,1):0;
    const accel=playing?clamp((speed-prevSpeed)/Math.max(dt,.008),-3.0,3.0):0;prevSpeed=speed;
    const steer=playing?clamp((s.velocityX||0)/4.8,-1,1):0;
    const demand=playing?clamp(((s.targetX||0)-(s.x||0))/4.4,-1,1):0;
    const air=playing?(.08+speedN*.74):.025;

    // Cape behaves as short weighted wool attached at the shoulders, not a flag.
    const root=parts.cape;
    const rootX=spring(root.x,.26+speedN*1.80+Math.max(0,accel)*.07,dt,8.4,9.2);
    const rootY=spring(root.y,Math.sin(t*.52)*.045*air,dt,7.2,9.6);
    const rootZ=spring(root.z,-steer*1.14-demand*.54,dt,8.6,9.0);
    setDelta(root,rootX,rootY,rootZ);

    for(let i=0;i<capeCfg.length;i++){
      const [name,k,d,lag,side]=capeCfg[i],p=parts[name];
      const clothRoll=Math.sin(t*(.48+i*.045)+i*1.7)*(.025+.035*air);
      const x=spring(p.x,.22+speedN*(1.35+i*.10)+Math.max(0,accel)*.06+clothRoll,dt,k,d);
      const y=spring(p.y,side*steer*.22+Math.sin(t*.41+i)*.030*air,dt,k*.70,d+1.0);
      const z=spring(p.z,-steer*(1.45*lag)-demand*(.72*lag)+side*speedN*.10,dt,k,d);
      setDelta(p,x,y,z);
    }

    // Hair trails softly as five broad lock groups with slight timing offsets.
    for(let i=0;i<hairNames.length;i++){
      const p=parts[hairNames[i]],delay=.78+i*.07;
      const soft=Math.sin(t*(.92+i*.035)+i*.89)*(.10+i*.018)*air;
      const x=spring(p.x,speedN*(.44+i*.11)+air*.09+soft,dt,13.2+i*.60,8.0+i*.10);
      const y=spring(p.y,Math.sin(t*(.56+i*.020)+i*.66)*.050*air,dt,11.4+i*.48,8.2);
      const z=spring(p.z,-steer*(.92+i*.17)-demand*(.34+i*.09)*delay+soft*.20,dt,12.8+i*.55,7.9+i*.10);
      setDelta(p,x,y,z);
    }

    const tip=parts.hat_tip;
    setDelta(tip,
      spring(tip.x,speedN*.34+Math.sin(t*.60)*.075*air,dt,9.0,8.0),
      spring(tip.y,Math.sin(t*.39)*.040*air,dt,8.7,8.2),
      spring(tip.z,-steer*.38-demand*.16+Math.sin(t*.47+1.3)*.075*air,dt,8.9,7.9));

    const br=parts.broom_bristles;
    setDelta(br,
      spring(br.x,speedN*.28+Math.sin(t*1.18)*.050*air,dt,24,10.2),
      spring(br.y,0,dt,25,10.5),
      spring(br.z,-steer*.20-demand*.07+Math.sin(t*.98+.6)*.045*air,dt,24,10.0));

    const sparkDrive=playing?(.15+.72*air):.04;
    for(let i=0;i<sparks.length;i++){
      const sp=sparks[i],pulse=Math.sin(t*(4.6+i*.25)+sp.phase);
      sp.e.enabled=pulse>.60&&sparkDrive>.14;
      if(!sp.e.enabled)continue;
      const life=(pulse-.60)/.40;
      sp.e.setLocalPosition((i-1.5)*.025+Math.sin(t*3.6+sp.phase)*.010,-.76-Math.abs(Math.sin(t*2.3+sp.phase))*.040,4.04+i*.08+speedN*.12);
      const size=.004+.008*life;sp.e.setLocalScale(size,size,size*1.35);
      sp.mat.emissiveIntensity=.16+life*.18;sp.mat.opacity=.15+life*.20;sp.mat.update();
    }
  });

  window.WitchRideWitchCenterpiecePass={passId:PASS_ID,assetBuild:ASSET_BUILD,version:VERSION,active:true,requiredNodes:REQUIRED.slice(),missing:[],visualOnly:true,sparkCount:sparks.length};
  return true;
}
function boot(attempt=0){
  if(install())return;
  if(attempt<180)setTimeout(()=>boot(attempt+1),100);
  else console.error('Pass 13 centerpiece runtime did not initialize');
}
boot();