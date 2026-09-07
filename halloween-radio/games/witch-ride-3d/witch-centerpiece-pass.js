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
function tuneWitchMaterials(witch){
  const seen=new Set();
  for(const render of witch.findComponents?.('render')||[]){
    for(const mi of render.meshInstances||[]){
      const m=mi.material;if(!m||seen.has(m))continue;seen.add(m);
      const n=(m.name||'').toLowerCase();
      if(n.includes('felt')){m.gloss=.045;m.bumpiness=.90}
      else if(n.includes('charcoal wool')){m.gloss=.035;m.bumpiness=.98}
      else if(n.includes('oxblood')||n.includes('lining')){m.gloss=.075;m.bumpiness=.95}
      else if(n.includes('cape seam')){m.gloss=.045;m.bumpiness=.96}
      else if(n.includes('auburn hair')){m.gloss=.24;m.bumpiness=.82}
      else if(n.includes('leather')||n.includes('riding boot')){m.gloss=.24;m.bumpiness=.88}
      else if(n.includes('broom')&&n.includes('ash')){m.gloss=.12;m.bumpiness=.96}
      else if(n.includes('broom straw')){m.gloss=.025;m.bumpiness=1.0}
      else if(n.includes('brass')){m.gloss=.42}
      m.update?.();
    }
  }
}
function makeSparks(witch){
  const out=[];
  for(let i=0;i<4;i++){
    const mat=new pc.StandardMaterial();
    mat.name=`Pass12 ember spark ${i}`;mat.diffuse=new pc.Color(.12,.025,.004);mat.emissive=new pc.Color(.92,.12,.012);mat.emissiveIntensity=.58;
    mat.opacity=.62;mat.blendType=pc.BLEND_ADDITIVE;mat.depthWrite=false;mat.useLighting=false;mat.update();
    const e=new pc.Entity(`Pass12 Broom Spark ${i}`);e.addComponent('render',{type:'sphere'});e.render.material=mat;e.render.castShadows=false;e.render.receiveShadows=false;
    e.setLocalScale(.016,.016,.023);e.setLocalPosition(0,-.84,4.12+i*.09);witch.addChild(e);out.push({e,mat,phase:i*1.71});
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
  const sparks=makeSparks(witch);
  let t=0,prevSpeed=wr.state?.speed||1,lightClock=0;
  const capeCfg=[
    ['cape_left',10.8,7.15,1.05,-.42],
    ['cape_center',12.6,8.05,.72,0],
    ['cape_right',11.1,7.35,.98,.40]
  ];
  const hairNames=['hair_01','hair_02','hair_03','hair_04','hair_05'];

  function tuneLights(){
    const rim=witch.findByName('Witch Rim Glow');if(rim?.light){rim.light.intensity=.64;rim.light.range=8.6;rim.light.color=new pc.Color(.28,.36,.52)}
    const ember=witch.findByName('Broom Ember Light');if(ember?.light){ember.light.intensity=.31;ember.light.range=5.7;ember.light.color=new pc.Color(.92,.18,.025)}
    const warm=witch.findByName('Witch Warm Underfill');if(warm?.light){warm.light.intensity=.15;warm.light.range=4.8;warm.light.color=new pc.Color(.88,.16,.025)}
    const broom=witch.findByName('Broom Warm Underfill');if(broom?.light){broom.light.intensity=.18;broom.light.range=4.9;broom.light.color=new pc.Color(.94,.18,.022)}
  }
  tuneLights();

  app.on('update',dt=>{
    if(!wr.state)return;t+=Math.min(dt||0,.05);lightClock+=dt||0;
    if(lightClock>1){lightClock=0;tuneLights()}
    const s=wr.state,playing=s.mode==='playing';
    const speed=s.speed||1,speedN=playing?clamp((speed-1)/2.8,0,1):0;
    const accel=playing?clamp((speed-prevSpeed)/Math.max(dt,.008),-3.2,3.2):0;prevSpeed=speed;
    const steer=playing?clamp((s.velocityX||0)/4.8,-1,1):0;
    const demand=playing?clamp(((s.targetX||0)-(s.x||0))/4.4,-1,1):0;
    const air=playing?(.12+speedN*.88):.05;

    // Cape behaves as weighted wool: lower-frequency response, steering lag and small overshoot only.
    const root=parts.cape;
    const rootX=spring(root.x,.7+speedN*3.7+Math.max(0,accel)*.17,dt,10.2,7.4);
    const rootY=spring(root.y,Math.sin(t*.70)*.14*air,dt,8.5,7.8);
    const rootZ=spring(root.z,-steer*2.4-demand*1.35,dt,10.5,7.2);
    setDelta(root,rootX,rootY,rootZ);

    for(let i=0;i<capeCfg.length;i++){
      const [name,k,d,lag,side]=capeCfg[i],p=parts[name];
      const clothRoll=Math.sin(t*(.76+i*.07)+i*1.7)*(.12+.14*air);
      const x=spring(p.x,.6+speedN*(3.8+i*.22)+Math.max(0,accel)*.18+clothRoll,dt,k,d);
      const y=spring(p.y,side*steer*.75+Math.sin(t*.54+i)*.10*air,dt,k*.72,d+.9);
      const z=spring(p.z,-steer*(3.55*lag)-demand*(1.95*lag)+side*speedN*.38,dt,k,d);
      setDelta(p,x,y,z);
    }

    // Hair stays soft and delayed, with slightly different timing per broad lock group.
    for(let i=0;i<hairNames.length;i++){
      const p=parts[hairNames[i]],delay=.84+i*.08;
      const soft=Math.sin(t*(1.34+i*.045)+i*.89)*(.24+i*.045)*air;
      const x=spring(p.x,speedN*(1.0+i*.26)+air*.25+soft,dt,15.5+i*.8,7.15+i*.10);
      const y=spring(p.y,Math.sin(t*(.72+i*.025)+i*.66)*.14*air,dt,12.8+i*.6,7.4);
      const z=spring(p.z,-steer*(1.8+i*.38)-demand*(.82+i*.20)*delay+soft*.34,dt,14.8+i*.7,6.95+i*.11);
      setDelta(p,x,y,z);
    }

    const tip=parts.hat_tip;
    setDelta(tip,
      spring(tip.x,speedN*.72+Math.sin(t*.78)*.20*air,dt,10.2,6.8),
      spring(tip.y,Math.sin(t*.47)*.10*air,dt,9.6,7.0),
      spring(tip.z,-steer*.82-demand*.38+Math.sin(t*.59+1.3)*.22*air,dt,10.0,6.7));

    const br=parts.broom_bristles;
    setDelta(br,
      spring(br.x,speedN*.74+Math.sin(t*1.65)*.15*air,dt,24,9.0),
      spring(br.y,0,dt,25,9.4),
      spring(br.z,-steer*.48-demand*.19+Math.sin(t*1.35+.6)*.13*air,dt,24,8.8));

    const sparkDrive=playing?(.20+.80*air):.08;
    for(let i=0;i<sparks.length;i++){
      const sp=sparks[i],pulse=Math.sin(t*(5.2+i*.31)+sp.phase);
      sp.e.enabled=pulse>.46&&sparkDrive>.18;
      if(!sp.e.enabled)continue;
      const life=(pulse-.46)/.54;
      sp.e.setLocalPosition((i-1.5)*.032+Math.sin(t*4.1+sp.phase)*.018,-.84-Math.abs(Math.sin(t*2.7+sp.phase))*.065,4.10+i*.10+speedN*.20);
      const size=.007+.014*life;sp.e.setLocalScale(size,size,size*1.45);
      sp.mat.emissiveIntensity=.28+life*.34;sp.mat.opacity=.24+life*.30;sp.mat.update();
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
