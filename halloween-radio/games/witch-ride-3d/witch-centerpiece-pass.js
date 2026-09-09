import * as pc from 'playcanvas';

// Witch Ride 3D — Pass 15 materials/lookdev on the LOCKED Pass 14 mesh.
// The GLB geometry stays immutable; the approved gameplay scale and riding stance are enforced at runtime.
const PASS_ID='witch-centerpiece-pass-v15';
const VERSION='pass-15-materials-v2-pose-lock';
const REVIEW='locked-pass14-mesh-material-lookdev';
const LOCKED_GLB_BLOB='8ec46a27aa0b60244061ce8cc81c2d603a97b1c5';
const GAMEPLAY_SCALE=.24;
const STANCE_OFFSETS={leg_L:-.10,leg_R:.10,boot_L:-.14,boot_R:.14};
const REQUIRED=['cape','cape_left','cape_center','cape_right','hair_01','hair_02','hair_03','hair_04','hair_05','hat_tip','broom_handle','broom_bristles','leg_L','leg_R','boot_L','boot_R'];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

function spring(ch,target,dt,k,d){
  const step=Math.min(.033,Math.max(.001,dt||.016));
  ch.v+=(target-ch.x)*k*step;ch.v*=Math.exp(-d*step);ch.x+=ch.v*step;return ch.x;
}
function part(app,name){
  const node=app.root.findByName(name);if(!node)return null;
  return {node,base:node.getLocalEulerAngles().clone(),x:{x:0,v:0},y:{x:0,v:0},z:{x:0,v:0}};
}
function posePart(witch,name,offsetX){
  const node=witch.findByName(name);if(!node)return null;
  return {node,basePos:node.getLocalPosition().clone(),baseEuler:node.getLocalEulerAngles().clone(),offsetX};
}
function setDelta(p,x,y,z){if(p?.node)p.node.setLocalEulerAngles(p.base.x+x,p.base.y+y,p.base.z+z)}
function lockPosePart(p){
  if(!p?.node)return;
  p.node.setLocalPosition(p.basePos.x+p.offsetX,p.basePos.y,p.basePos.z);
  p.node.setLocalEulerAngles(p.baseEuler.x,p.baseEuler.y,p.baseEuler.z);
}
function color(hex){
  const s=hex.replace('#','');return new pc.Color(parseInt(s.slice(0,2),16)/255,parseInt(s.slice(2,4),16)/255,parseInt(s.slice(4,6),16)/255);
}
function material(name,hex,gloss,opts={}){
  const m=new pc.StandardMaterial();m.name=name;m.diffuse=color(hex);m.useMetalness=true;m.metalness=opts.metalness||0;m.gloss=gloss;
  m.emissive=opts.emissive?color(opts.emissive):new pc.Color(0,0,0);if(opts.emissiveIntensity!==undefined)m.emissiveIntensity=opts.emissiveIntensity;
  if(opts.doubleSided){m.cull=pc.CULLFACE_NONE;m.twoSidedLighting=true}
  m.update();return m;
}
function descendants(root){
  const out=[];const walk=n=>{out.push(n);for(const c of (n.children||[]))walk(c)};walk(root);return out;
}
function meshInstances(entity){
  const a=entity?.render?.meshInstances||[];const b=entity?.model?.meshInstances||[];return a.length?a:b;
}
function applyMaterial(entity,mat){
  let count=0;for(const mi of meshInstances(entity)){mi.material=mat;count++}return count;
}
function classify(name){
  if(name==='hat_brim'||name==='hat_crown')return 'felt';
  if(name.startsWith('mane_lock_')||name.startsWith('mane_shoulder_'))return 'hair';
  if(name.startsWith('cape_fold_')||name.startsWith('cape_yoke_')||name==='torso_core'||name.startsWith('arm_')||name.startsWith('leg_'))return 'wool';
  if(name.startsWith('hand_')||name.startsWith('finger_')||name.startsWith('boot_'))return 'leather';
  if(name==='seat_wrap')return 'oxblood';
  if(name==='broom_shaft')return 'wood';
  if(name.startsWith('straw_mass_')||name.startsWith('bristle_'))return 'straw';
  if(name==='head'||name==='neck')return 'skin';
  return null;
}
function installLookdev(app,witch){
  // Material values are intentionally rough/matte to avoid the old glossy blue/plastic response.
  const mats={
    felt:material('Pass15 aged black felt','#171419',.055,{doubleSided:true}),
    hair:material('Pass15 dense auburn hair','#4a1409',.16,{doubleSided:true}),
    wool:material('Pass15 heavy charcoal wool','#202025',.035,{doubleSided:true}),
    oxblood:material('Pass15 restrained oxblood lining','#3b0b13',.07,{doubleSided:true}),
    leather:material('Pass15 aged riding leather','#171315',.19),
    wood:material('Pass15 weathered crooked broom wood','#4a2713',.12),
    straw:material('Pass15 dark natural broom straw','#56331a',.045,{doubleSided:true}),
    skin:material('Pass15 shadowed warm skin','#68483e',.12)
  };
  const assigned={felt:0,hair:0,wool:0,oxblood:0,leather:0,wood:0,straw:0,skin:0};
  for(const e of descendants(witch)){
    const key=classify(e.name||'');if(key)assigned[key]+=applyMaterial(e,mats[key]);
  }
  let moon=app.root.findByName('Witch Pass15 Moon Rim');
  if(!moon){moon=new pc.Entity('Witch Pass15 Moon Rim');moon.addComponent('light',{type:'directional',color:new pc.Color(.45,.57,.78),intensity:.28,castShadows:false});moon.setLocalEulerAngles(42,-138,12);witch.addChild(moon)}
  let ember=app.root.findByName('Witch Pass15 Broom Bounce');
  if(!ember){ember=new pc.Entity('Witch Pass15 Broom Bounce');ember.addComponent('light',{type:'omni',color:new pc.Color(1,.20,.035),intensity:.24,range:4.7,castShadows:false});ember.setLocalPosition(0,.15,2.25);witch.addChild(ember)}
  return {assigned,materials:Object.fromEntries(Object.entries(mats).map(([k,m])=>[k,{name:m.name,gloss:m.gloss,metalness:m.metalness}]))};
}

function install(){
  const app=pc.app,wr=window.WitchRide3D;if(!app||!wr?.ready)return false;
  const witch=app.root.findByName('Witch Rig');if(!witch)return false;
  const parts={};for(const n of REQUIRED)parts[n]=part(app,n);
  const missing=REQUIRED.filter(n=>!parts[n]);
  if(missing.length){console.error('Pass 15 locked mesh roots missing:',missing.join(', '));return false}
  const stance={};for(const [name,offsetX] of Object.entries(STANCE_OFFSETS))stance[name]=posePart(witch,name,offsetX);
  if(Object.values(stance).some(x=>!x)){console.error('Pass 15 stance lock nodes unavailable');return false}
  const lookdev=installLookdev(app,witch);
  const assignedTotal=Object.values(lookdev.assigned).reduce((a,b)=>a+b,0);
  if(assignedTotal<250||lookdev.assigned.hair<16||lookdev.assigned.straw<250){console.error('Pass 15 material assignment incomplete',lookdev.assigned);return false}

  const lockGameplayPresentation=()=>{
    witch.setLocalScale(GAMEPLAY_SCALE,GAMEPLAY_SCALE,GAMEPLAY_SCALE);
    for(const p of Object.values(stance))lockPosePart(p);
  };
  lockGameplayPresentation();
  app.on('prerender',lockGameplayPresentation);

  let t=0,prevSpeed=wr.state?.speed||1;
  const capeCfg=[['cape_left',8.8,10.0,-.30],['cape_center',10.4,10.8,0],['cape_right',8.8,10.0,.30]];
  const hair=['hair_01','hair_02','hair_03','hair_04','hair_05'];
  app.on('update',dt=>{
    lockGameplayPresentation();
    if(!wr.state)return;dt=Math.min(dt||0,.05);t+=dt;
    const s=wr.state,playing=s.mode==='playing',speed=s.speed||1;
    const speedN=playing?clamp((speed-1)/2.8,0,1):0;
    const accel=playing?clamp((speed-prevSpeed)/Math.max(dt,.008),-3,3):0;prevSpeed=speed;
    const steer=playing?clamp((s.velocityX||0)/4.8,-1,1):0;
    const demand=playing?clamp(((s.targetX||0)-(s.x||0))/4.4,-1,1):0;
    const air=playing?(.08+speedN*.62):.02;
    const c=parts.cape;
    setDelta(c,spring(c.x,.10+speedN*.78+Math.max(0,accel)*.025,dt,8.4,10.2),spring(c.y,Math.sin(t*.42)*.020*air,dt,7.5,10.5),spring(c.z,-steer*.58-demand*.22,dt,8.6,10.0));
    for(let i=0;i<capeCfg.length;i++){
      const [name,k,d,side]=capeCfg[i],p=parts[name];
      setDelta(p,spring(p.x,.08+speedN*(.42+i*.05)+Math.sin(t*(.46+i*.03)+i)*.015*air,dt,k,d),spring(p.y,side*steer*.10,dt,k*.72,d+1),spring(p.z,-steer*(.52+i*.08)-demand*.18+side*speedN*.04,dt,k,d));
    }
    for(let i=0;i<hair.length;i++){
      const p=parts[hair[i]],phase=i*.74;
      setDelta(p,spring(p.x,speedN*(.15+i*.025)+Math.sin(t*.72+phase)*.025*air,dt,12.2+i*.4,9.0),spring(p.y,Math.sin(t*.45+phase)*.018*air,dt,11.5,9.2),spring(p.z,-steer*(.32+i*.055)-demand*.10+Math.sin(t*.58+phase)*.018*air,dt,12.0,9.0));
    }
    const tip=parts.hat_tip;setDelta(tip,0,0,0);
    const br=parts.broom_bristles;
    setDelta(br,spring(br.x,speedN*.025+Math.sin(t*.96)*.008*air,dt,24,11),spring(br.y,0,dt,25,11),spring(br.z,-steer*.045-demand*.015,dt,24,11));
    lockGameplayPresentation();
  });
  window.WitchRideWitchCenterpiecePass={passId:PASS_ID,version:VERSION,review:REVIEW,lockedMeshBlob:LOCKED_GLB_BLOB,active:true,visualOnly:true,meshOnly:false,materialsApplied:true,geometryLocked:true,gameplayScale:GAMEPLAY_SCALE,scaleEnforced:true,stanceLocked:true,stanceOffsets:{...STANCE_OFFSETS},hatLocked:true,broomFlowAxis:'+Z toward chase camera/player',requiredNodes:REQUIRED.slice(),missing:[],lookdev};
  return true;
}
function boot(attempt=0){if(install())return;if(attempt<180)setTimeout(()=>boot(attempt+1),100);else console.error('Pass 15 material centerpiece runtime did not initialize')}
boot();
