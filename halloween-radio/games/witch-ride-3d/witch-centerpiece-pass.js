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
function offsetPosition(node,x=0,y=0,z=0){
  if(!node)return;
  const p=node.getLocalPosition();
  node.setLocalPosition(p.x+x,p.y+y,p.z+z);
}
function flattenMaterial(m,n){
  m.metalness=0;
  m.reflectivity=0;
  m.useSkybox=false;
  if('normalMap' in m)m.normalMap=null;
  if('clearCoat' in m)m.clearCoat=0;
  if('clearCoatGloss' in m)m.clearCoatGloss=0;
  if('sheen' in m)m.sheen=null;
  if(n.includes('felt')){
    m.gloss=0;m.bumpiness=0;m.specular=new pc.Color(.012,.012,.014);
  }else if(n.includes('charcoal wool')){
    m.gloss=0;m.bumpiness=0;m.specular=new pc.Color(.010,.010,.012);
  }else if(n.includes('oxblood')||n.includes('lining')){
    m.gloss=0;m.bumpiness=0;m.specular=new pc.Color(.012,.006,.007);
  }else if(n.includes('cape seam')){
    m.gloss=0;m.bumpiness=0;m.specular=new pc.Color(.012,.010,.011);
  }else if(n.includes('auburn hair')){
    m.gloss=.006;m.bumpiness=0;m.specular=new pc.Color(.025,.008,.004);m.diffuse=new pc.Color(.36,.085,.028);
  }else if(n.includes('broom straw')){
    m.gloss=0;m.bumpiness=.03;m.specular=new pc.Color(.012,.008,.004);
  }else if(n.includes('broom')&&n.includes('ash')){
    m.gloss=.012;m.bumpiness=.12;m.specular=new pc.Color(.030,.018,.009);
  }else if(n.includes('leather')||n.includes('riding boot')){
    m.gloss=.018;m.bumpiness=.08;m.specular=new pc.Color(.035,.031,.032);
  }else if(n.includes('brass')){
    m.gloss=.14;m.reflectivity=.12;
  }
}
function tuneWitchMaterials(witch){
  const seen=new Set();
  for(const render of witch.findComponents?.('render')||[]){
    for(const mi of render.meshInstances||[]){
      const m=mi.material;if(!m||seen.has(m))continue;seen.add(m);
      const n=(m.name||'').toLowerCase();
      flattenMaterial(m,n);
      m.update?.();
    }
  }
}
function tuneStaticHair(witch){
  // Break the flat fringe: roots remain dense at the skull but end at staggered lengths.
  for(const side of [-1,1]){
    for(let row=0;row<3;row++){
      for(let k=0;k<4;k++){
        const n=witch.findByName(`hair_root_${side}_${row}_${k}`);
        const y=[.78,.92,1.04,.85][(k+row*2)%4];
        const x=[.96,1.03,.94,1.00][(k+row)%4];
        multiplyScale(n,x,y,.88);
        offsetPosition(n,0,(k%2?-.018:.018)+(row-1)*.012,0);
      }
    }
    for(let k=0;k<2;k++){
      const n=witch.findByName(`hair_under_${side}_${k}`);
      multiplyScale(n,k===0?1.02:.94,k===0?.92:1.05,.88);
      offsetPosition(n,0,k===0?.015:-.025,0);
    }
  }
}
function applySilhouetteScales(witch,parts){
  // Phone-camera correction: stronger shoulders, compact irregular mane, shorter/wider wool cape.
  multiplyScale(parts.cape?.node,1.24,.92,.90);
  const hairScale={
    hair_01:[1.02,.78,.88],hair_02:[1.10,.94,.86],hair_03:[1.04,1.04,.84],hair_04:[1.12,.90,.86],hair_05:[1.00,.75,.90]
  };
  const hairLift={hair_01:.055,hair_02:.005,hair_03:-.055,hair_04:.018,hair_05:.070};
  for(const name of Object.keys(hairScale)){
    const [x,y,z]=hairScale[name];multiplyScale(parts[name]?.node,x,y,z);offsetPosition(parts[name]?.node,0,hairLift[name],0);
  }
  tuneStaticHair(witch);

  // Hat brim stays witch-like without overpowering the shoulders.
  multiplyScale(witch.findByName('hat_brim'),.80,1,.86);
  multiplyScale(witch.findByName('hat_brim_edge'),.80,1,.86);
  multiplyScale(witch.findByName('hat_band'),.90,1,.90);

  multiplyScale(witch.findByName('body_core'),1.10,1.0,.96);
  multiplyScale(witch.findByName('torso_taper'),1.13,.98,.94);
  multiplyScale(witch.findByName('coat_skirt'),1.08,.94,.96);
  multiplyScale(witch.findByName('cape_yoke'),1.18,1.0,.94);
  multiplyScale(witch.findByName('shoulder_-1'),1.18,1.02,.96);
  multiplyScale(witch.findByName('shoulder_1'),1.18,1.02,.96);

  // A full straw fan must remain readable behind the rider at 430 px.
  multiplyScale(parts.broom_bristles?.node,1.58,1.16,.90);
  multiplyScale(witch.findByName('broom_shaft'),1.14,1.14,1.0);
  if(parts.broom_handle?.node){
    parts.broom_handle.base.y+=4.0;
    parts.broom_handle.node.setLocalEulerAngles(parts.broom_handle.base.x,parts.broom_handle.base.y,parts.broom_handle.base.z);
  }
}
function makeSparks(witch){
  const out=[];
  for(let i=0;i<4;i++){
    const mat=new pc.StandardMaterial();
    mat.name=`Pass13 ember spark ${i}`;mat.diffuse=new pc.Color(.06,.010,.001);mat.emissive=new pc.Color(.66,.050,.003);mat.emissiveIntensity=.24;
    mat.opacity=.34;mat.blendType=pc.BLEND_ADDITIVE;mat.depthWrite=false;mat.useLighting=false;mat.update();
    const e=new pc.Entity(`Pass13 Broom Spark ${i}`);e.addComponent('render',{type:'sphere'});e.render.material=mat;e.render.castShadows=false;e.render.receiveShadows=false;
    e.setLocalScale(.008,.008,.012);e.setLocalPosition(0,-.66,3.25+i*.06);witch.addChild(e);out.push({e,mat,phase:i*1.71});
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
    ['cape_left',8.6,9.4,.90,-.36],
    ['cape_center',10.2,10.0,.68,0],
    ['cape_right',8.8,9.5,.88,.36]
  ];
  const hairNames=['hair_01','hair_02','hair_03','hair_04','hair_05'];

  function tuneLights(){
    const rim=witch.findByName('Witch Rim Glow');if(rim?.light){rim.light.intensity=.19;rim.light.range=6.6;rim.light.color=new pc.Color(.16,.19,.25)}
    const ember=witch.findByName('Broom Ember Light');if(ember?.light){ember.light.intensity=.16;ember.light.range=4.2;ember.light.color=new pc.Color(.72,.085,.006)}
    const warm=witch.findByName('Witch Warm Underfill');if(warm?.light){warm.light.intensity=.055;warm.light.range=3.7;warm.light.color=new pc.Color(.62,.065,.005)}
    const broom=witch.findByName('Broom Warm Underfill');if(broom?.light){broom.light.intensity=.09;broom.light.range=4.1;broom.light.color=new pc.Color(.70,.075,.005)}
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
    const rootX=spring(root.x,.20+speedN*1.35+Math.max(0,accel)*.05,dt,8.2,9.8);
    const rootY=spring(root.y,Math.sin(t*.48)*.030*air,dt,7.0,10.0);
    const rootZ=spring(root.z,-steer*.90-demand*.40,dt,8.4,9.7);
    setDelta(root,rootX,rootY,rootZ);

    for(let i=0;i<capeCfg.length;i++){
      const [name,k,d,lag,side]=capeCfg[i],p=parts[name];
      const clothRoll=Math.sin(t*(.44+i*.04)+i*1.7)*(.018+.026*air);
      const x=spring(p.x,.16+speedN*(.92+i*.07)+Math.max(0,accel)*.04+clothRoll,dt,k,d);
      const y=spring(p.y,side*steer*.16+Math.sin(t*.38+i)*.022*air,dt,k*.70,d+1.0);
      const z=spring(p.z,-steer*(1.05*lag)-demand*(.48*lag)+side*speedN*.07,dt,k,d);
      setDelta(p,x,y,z);
    }

    // Broad hair masses move softly; each group keeps a separate delay without rope-like flapping.
    for(let i=0;i<hairNames.length;i++){
      const p=parts[hairNames[i]],delay=.78+i*.07;
      const soft=Math.sin(t*(.82+i*.03)+i*.89)*(.060+i*.010)*air;
      const x=spring(p.x,speedN*(.30+i*.075)+air*.055+soft,dt,12.8+i*.55,8.6+i*.12);
      const y=spring(p.y,Math.sin(t*(.50+i*.018)+i*.66)*.032*air,dt,11.2+i*.45,8.8);
      const z=spring(p.z,-steer*(.64+i*.11)-demand*(.24+i*.055)*delay+soft*.14,dt,12.5+i*.50,8.5+i*.12);
      setDelta(p,x,y,z);
    }

    const tip=parts.hat_tip;
    setDelta(tip,
      spring(tip.x,speedN*.26+Math.sin(t*.56)*.050*air,dt,9.0,8.5),
      spring(tip.y,Math.sin(t*.36)*.025*air,dt,8.7,8.7),
      spring(tip.z,-steer*.28-demand*.11+Math.sin(t*.43+1.3)*.050*air,dt,8.9,8.4));

    const br=parts.broom_bristles;
    setDelta(br,
      spring(br.x,speedN*.18+Math.sin(t*1.08)*.035*air,dt,25,10.8),
      spring(br.y,0,dt,26,11.0),
      spring(br.z,-steer*.14-demand*.05+Math.sin(t*.90+.6)*.030*air,dt,25,10.6));

    const sparkDrive=playing?(.13+.60*air):.03;
    for(let i=0;i<sparks.length;i++){
      const sp=sparks[i],pulse=Math.sin(t*(4.2+i*.22)+sp.phase);
      sp.e.enabled=pulse>.68&&sparkDrive>.13;
      if(!sp.e.enabled)continue;
      const life=(pulse-.68)/.32;
      sp.e.setLocalPosition((i-1.5)*.020+Math.sin(t*3.2+sp.phase)*.008,-.66-Math.abs(Math.sin(t*2.1+sp.phase))*.030,3.24+i*.06+speedN*.08);
      const size=.003+.006*life;sp.e.setLocalScale(size,size,size*1.30);
      sp.mat.emissiveIntensity=.10+life*.12;sp.mat.opacity=.10+life*.14;sp.mat.update();
    }
  });

  window.WitchRideWitchCenterpiecePass={passId:PASS_ID,assetBuild:ASSET_BUILD,version:VERSION,active:true,requiredNodes:REQUIRED.slice(),missing:[],visualOnly:true,sparkCount:sparks.length,phoneSilhouette:'staggered-mane-matte-wool'};
  return true;
}
function boot(attempt=0){
  if(install())return;
  if(attempt<180)setTimeout(()=>boot(attempt+1),100);
  else console.error('Pass 13 centerpiece runtime did not initialize');
}
boot();