import * as pc from 'playcanvas';

// Witch Ride 3D — Pass 12 silhouette correction runtime.
// Visual-only: scoring, collision, station state and audio intent remain untouched.
const PASS_ID='witch-centerpiece-pass-v12';
const ASSET_BUILD='witch-realism-pass-v3';
const VERSION='pass-12-silhouette-correction-v1';
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
      if(n.includes('felt')){m.gloss=.018;m.bumpiness=.40}
      else if(n.includes('charcoal wool')){m.gloss=.006;m.bumpiness=.22}
      else if(n.includes('oxblood')||n.includes('lining')){m.gloss=.016;m.bumpiness=.27}
      else if(n.includes('cape seam')){m.gloss=.012;m.bumpiness=.30}
      else if(n.includes('auburn hair')){m.gloss=.105;m.bumpiness=.38}
      else if(n.includes('leather')||n.includes('riding boot')){m.gloss=.14;m.bumpiness=.56}
      else if(n.includes('broom')&&n.includes('ash')){m.gloss=.065;m.bumpiness=.54}
      else if(n.includes('broom straw')){m.gloss=.010;m.bumpiness=.42}
      else if(n.includes('brass')){m.gloss=.34}
      if(!n.includes('brass')){m.metalness=0;m.reflectivity=.025}
      m.update?.();
    }
  }
}
function applySilhouetteScales(witch,parts){
  // Shorten the cloak vertically and keep it close to the rider so legs/boots remain human-readable.
  multiplyScale(parts.cape?.node,1.08,.78,.94);
  // Each animated hair root carries broad geometry; widen the mane rather than lengthening it.
  for(const name of ['hair_01','hair_02','hair_03','hair_04','hair_05'])multiplyScale(parts[name]?.node,1.28,.98,.96);
  // Make the production broom unmistakable at 430 px without turning it into a flame plume.
  multiplyScale(parts.broom_bristles?.node,1.62,1.48,1.34);
  multiplyScale(witch.findByName('broom_shaft'),1.28,1.28,1.0);
  multiplyScale(witch.findByName('torso_taper'),1.05,1.0,1.0);
  multiplyScale(witch.findByName('shoulder_-1'),1.10,1.0,1.0);
  multiplyScale(witch.findByName('shoulder_1'),1.10,1.0,1.0);
}
function makeSparks(witch){
  const out=[];
  for(let i=0;i<4;i++){
    const mat=new pc.StandardMaterial();
    mat.name=`Pass12 ember spark ${i}`;mat.diffuse=new pc.Color(.10,.020,.003);mat.emissive=new pc.Color(.90,.11,.010);mat.emissiveIntensity=.50;
    mat.opacity=.56;mat.blendType=pc.BLEND_ADDITIVE;mat.depthWrite=false;mat.useLighting=false;mat.update();
    const e=new pc.Entity(`Pass12 Broom Spark ${i}`);e.addComponent('render',{type:'sphere'});e.render.material=mat;e.render.castShadows=false;e.render.receiveShadows=false;
    e.setLocalScale(.014,.014,.021);e.setLocalPosition(0,-.84,4.12+i*.09);witch.addChild(e);out.push({e,mat,phase:i*1.71});
  }
  return out;
}
function install(){
  const app=pc.app,wr=window.WitchRide3D;if(!app||!wr?.ready)return false;
  const witch=app.root.findByName('Witch Rig')||app.root.findByName('Witch Rig Fallback');if(!witch)return false;
  const parts={};for(const name of REQUIRED)parts[name]=motionNode(app,name);
  const missing=REQUIRED.filter(n=>!parts[n]);
  if(missing.length){console.error('Pass 12 centerpiece missing motion nodes:',missing.join(', '));return false}
  tuneWitchMaterials(witch);
  applySilhouetteScales(witch,parts);
  const sparks=makeSparks(witch);
  let t=0,prevSpeed=wr.state?.speed||1,lightClock=0;
  const capeCfg=[
    ['cape_left',9.8,7.7,1.05,-.42],
    ['cape_center',11.4,8.6,.72,0],
    ['cape_right',10.1,7.9,.98,.40]
  ];
  const hairNames=['hair_01','hair_02','hair_03','hair_04','hair_05'];

  function tuneLights(){
    const rim=witch.findByName('Witch Rim Glow');if(rim?.light){rim.light.intensity=.39;rim.light.range=8.0;rim.light.color=new pc.Color(.24,.30,.40)}
    const ember=witch.findByName('Broom Ember Light');if(ember?.light){ember.light.intensity=.27;ember.light.range=5.5;ember.light.color=new pc.Color(.92,.17,.022)}
    const warm=witch.findByName('Witch Warm Underfill');if(warm?.light){warm.light.intensity=.12;warm.light.range=4.5;warm.light.color=new pc.Color(.86,.14,.020)}
    const broom=witch.findByName('Broom Warm Underfill');if(broom?.light){broom.light.intensity=.17;broom.light.range=5.1;broom.light.color=new pc.Color(.94,.17,.020)}
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
    const air=playing?(.10+speedN*.90):.04;

    // Cape behaves as weighted wool: lower-frequency response, steering lag and restrained overshoot.
    const root=parts.cape;
    const rootX=spring(root.x,.45+speedN*2.7+Math.max(0,accel)*.11,dt,9.2,8.1);
    const rootY=spring(root.y,Math.sin(t*.60)*.08*air,dt,7.8,8.4);
    const rootZ=spring(root.z,-steer*1.75-demand*.92,dt,9.4,7.9);
    setDelta(root,rootX,rootY,rootZ);

    for(let i=0;i<capeCfg.length;i++){
      const [name,k,d,lag,side]=capeCfg[i],p=parts[name];
      const clothRoll=Math.sin(t*(.62+i*.055)+i*1.7)*(.055+.075*air);
      const x=spring(p.x,.38+speedN*(2.45+i*.14)+Math.max(0,accel)*.10+clothRoll,dt,k,d);
      const y=spring(p.y,side*steer*.43+Math.sin(t*.47+i)*.055*air,dt,k*.72,d+.9);
      const z=spring(p.z,-steer*(2.5*lag)-demand*(1.34*lag)+side*speedN*.22,dt,k,d);
      setDelta(p,x,y,z);
    }

    // Hair stays soft and delayed, with slightly different timing per broad lock group.
    for(let i=0;i<hairNames.length;i++){
      const p=parts[hairNames[i]],delay=.84+i*.08;
      const soft=Math.sin(t*(1.12+i*.042)+i*.89)*(.17+i*.030)*air;
      const x=spring(p.x,speedN*(.72+i*.18)+air*.17+soft,dt,14.2+i*.72,7.5+i*.10);
      const y=spring(p.y,Math.sin(t*(.64+i*.023)+i*.66)*.09*air,dt,12.0+i*.55,7.7);
      const z=spring(p.z,-steer*(1.45+i*.28)-demand*(.61+i*.16)*delay+soft*.25,dt,13.8+i*.62,7.3+i*.10);
      setDelta(p,x,y,z);
    }

    const tip=parts.hat_tip;
    setDelta(tip,
      spring(tip.x,speedN*.55+Math.sin(t*.70)*.14*air,dt,9.8,7.2),
      spring(tip.y,Math.sin(t*.43)*.07*air,dt,9.2,7.4),
      spring(tip.z,-steer*.64-demand*.28+Math.sin(t*.53+1.3)*.15*air,dt,9.6,7.1));

    const br=parts.broom_bristles;
    setDelta(br,
      spring(br.x,speedN*.48+Math.sin(t*1.42)*.09*air,dt,25,9.6),
      spring(br.y,0,dt,26,9.8),
      spring(br.z,-steer*.34-demand*.13+Math.sin(t*1.18+.6)*.08*air,dt,25,9.4));

    const sparkDrive=playing?(.18+.82*air):.06;
    for(let i=0;i<sparks.length;i++){
      const sp=sparks[i],pulse=Math.sin(t*(5.0+i*.29)+sp.phase);
      sp.e.enabled=pulse>.52&&sparkDrive>.17;
      if(!sp.e.enabled)continue;
      const life=(pulse-.52)/.48;
      sp.e.setLocalPosition((i-1.5)*.030+Math.sin(t*4.0+sp.phase)*.015,-.84-Math.abs(Math.sin(t*2.6+sp.phase))*.055,4.10+i*.10+speedN*.18);
      const size=.006+.012*life;sp.e.setLocalScale(size,size,size*1.4);
      sp.mat.emissiveIntensity=.24+life*.28;sp.mat.opacity=.20+life*.27;sp.mat.update();
    }
  });

  window.WitchRideWitchCenterpiecePass={passId:PASS_ID,assetBuild:ASSET_BUILD,version:VERSION,active:true,requiredNodes:REQUIRED.slice(),missing:[],visualOnly:true,sparkCount:sparks.length};
  return true;
}
function boot(attempt=0){
  if(install())return;
  if(attempt<180)setTimeout(()=>boot(attempt+1),100);
  else console.error('Pass 12 centerpiece runtime did not initialize');
}
boot();
