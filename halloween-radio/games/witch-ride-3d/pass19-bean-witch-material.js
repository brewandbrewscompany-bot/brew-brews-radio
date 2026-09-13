import * as pc from 'playcanvas';

const VERSION='pass19-bean-witch-material-v2';
const wait=ms=>new Promise(r=>setTimeout(r,ms));

// Final surface treatment only. Geometry, pose, gameplay scale, traffic and world lighting stay locked.
const palette={
  skin:{diffuse:[.39,.215,.155],gloss:.16,metalness:0},
  hair:{diffuse:[.026,.012,.009],gloss:.17,metalness:0},
  cape:{diffuse:[.070,.016,.047],gloss:.14,metalness:0},
  hat:{diffuse:[.036,.010,.040],gloss:.13,metalness:0},
  cloth:{diffuse:[.026,.023,.032],gloss:.11,metalness:0},
  leather:{diffuse:[.030,.015,.010],gloss:.25,metalness:.008},
  broomWood:{diffuse:[.115,.045,.015],gloss:.17,metalness:0},
  straw:{diffuse:[.175,.074,.020],gloss:.075,metalness:0},
  bean:{diffuse:[.105,.025,.006],gloss:.34,metalness:0},
  beanCrease:{diffuse:[.255,.105,.022],gloss:.18,metalness:0}
};

function walk(root,fn,path=''){
  if(!root)return;
  const here=path?`${path}/${root.name||'unnamed'}`:(root.name||'unnamed');
  fn(root,here);
  for(const child of root.children||[])walk(child,fn,here);
}
function classify(label){
  const s=String(label||'').toLowerCase();
  if(/bundle_neck|seat_wrap|broom.*(tie|wrap)|\btie\b|\bwrap\b/.test(s))return 'leather';
  if(/broom.*(bristle|straw|brush)|bristle|straw|straw_mass|straw_primary/.test(s))return 'straw';
  if(/broom.*(handle|shaft|wood)|broom_handle|handle/.test(s))return 'broomWood';
  if(/hair|mane|lock|strand|haircap/.test(s))return 'hair';
  if(/cape|cloak/.test(s))return 'cape';
  if(/hat|brim|crown/.test(s))return 'hat';
  if(/boot|shoe|leather|belt|glove/.test(s))return 'leather';
  if(/skin|face|head|hand|finger|arm|nose|neck/.test(s))return 'skin';
  if(/dress|bodice|torso|body|sleeve|skirt|cloth|garment|pants|trouser|thigh|calf|leg/.test(s))return 'cloth';
  return null;
}
function tuneMaterial(m,kind,name){
  const p=palette[kind];if(!m||!p)return;
  m.name=`Pass19 ${kind} ${name}`;
  m.diffuse=new pc.Color(...p.diffuse);
  m.useMetalness=true;m.metalness=p.metalness;m.gloss=p.gloss;
  if(kind!=='bean'&&kind!=='beanCrease'){
    m.emissive=new pc.Color(0,0,0);m.emissiveIntensity=0;
  }
  m.update();
}
function isolateAndTuneNode(node,path,stats){
  const instances=node?.render?.meshInstances||[];
  for(let i=0;i<instances.length;i++){
    const mi=instances[i],source=mi.material;
    if(!source?.clone)continue;
    const label=`${path} ${(source.name||'material')}`;
    const kind=classify(label);
    stats.labels.push(label);
    if(!kind){stats.unknown++;continue}
    const m=source.clone();
    tuneMaterial(m,kind,`${stats.cloned}-${i}`);
    mi.material=m;stats.cloned++;stats[kind]=(stats[kind]||0)+1;
  }
}
function polishWitch(app){
  const witch=app.root.findByName('Witch Rig')||app.root.findByName('Witch Rig Fallback');
  if(!witch)return null;
  const before={position:witch.getPosition().clone(),scale:witch.getLocalScale().clone()};
  const stats={cloned:0,unknown:0,skin:0,hair:0,cape:0,hat:0,cloth:0,leather:0,broomWood:0,straw:0,labels:[]};
  walk(witch,(node,path)=>isolateAndTuneNode(node,path,stats));
  const after={position:witch.getPosition().clone(),scale:witch.getLocalScale().clone()};
  stats.rootTransformPreserved=before.position.equals(after.position)&&before.scale.equals(after.scale);
  stats.labels=stats.labels.slice(0,120);
  return stats;
}
function cloneBeanMaterial(mi,name,kind='bean'){
  const source=mi?.material;if(!source?.clone)return null;
  const m=source.clone();tuneMaterial(m,kind,name);
  if(kind==='bean'){
    // Rich roasted body: readable highlight, but not a glowing orange object.
    m.emissive=new pc.Color(.012,.0022,.0004);m.emissiveIntensity=.055;
  }else{
    // A warm crease makes the small model unmistakably read as a coffee bean at phone size.
    m.emissive=new pc.Color(.060,.012,.0015);m.emissiveIntensity=.10;
  }
  m.update();mi.material=m;return m;
}
function polishBeans(app){
  const stats={beans:0,bodyMaterials:0,creaseMaterials:0,halos:0,haloMaterials:0,lights:0,scalePreserved:0};
  for(let i=0;i<16;i++){
    const bean=app.root.findByName(`Coffee Bean ${i}`);if(!bean)continue;
    stats.beans++;
    const scale=bean.getLocalScale().clone();
    walk(bean,(node,path)=>{
      if((node.name||'').startsWith('Coffee Bean Halo'))return;
      for(const mi of node?.render?.meshInstances||[]){
        const label=`${path} ${mi.material?.name||''}`.toLowerCase();
        const crease=/seam|crease|groove|split/.test(label);
        const m=cloneBeanMaterial(mi,`Bean ${i} ${stats.bodyMaterials+stats.creaseMaterials}`,crease?'beanCrease':'bean');
        if(m){if(crease)stats.creaseMaterials++;else stats.bodyMaterials++}
      }
    });
    const halo=bean.findByName?.(`Coffee Bean Halo ${i}`);
    if(halo){
      stats.halos++;
      for(const mi of halo?.render?.meshInstances||[]){
        const source=mi.material;if(!source?.clone)continue;
        const m=source.clone();m.name=`Pass19 soft amber bean halo ${i}`;
        m.diffuse=new pc.Color(.50,.105,.012);
        m.emissive=new pc.Color(1,.245,.035);m.emissiveIntensity=.62;
        m.opacity=.090;m.blendType=pc.BLEND_NORMAL;m.depthWrite=false;m.cull=pc.CULLFACE_NONE;
        m.update();mi.material=m;stats.haloMaterials++;
      }
    }
    const light=bean.findByName?.(`Pass11 Bean Warm Light ${i}`);
    if(light?.light){
      light.light.intensity=.145;light.light.range=2.70;light.light.color=new pc.Color(1,.36,.095);stats.lights++;
    }
    if(scale.equals(bean.getLocalScale()))stats.scalePreserved++;
  }
  return stats;
}
async function install(){
  for(let i=0;i<480;i++){
    const app=pc.app,w=window.WitchRide3D;
    if(app&&w?.ready&&window.WitchRideWitchCenterpiecePass?.active===true&&window.WitchRidePass17Environment?.active===true&&window.WitchRidePass18Traffic?.active===true){
      try{
        const witch=polishWitch(app),beans=polishBeans(app);
        if(!witch||beans.beans!==16)throw new Error(`Pass19 targets unavailable: witch=${!!witch} beans=${beans.beans}`);
        window.WitchRideWitchCenterpiecePass.materialsApplied=true;
        window.WitchRidePass19Material={active:true,version:VERSION,detail:{witch,beans,geometryChanged:false,poseChanged:false,scaleChanged:false,trafficChanged:false,environmentChanged:false,broomFireAdded:false}};
        return;
      }catch(err){console.error('Pass19 install failed',err);window.WitchRidePass19Material={active:false,version:VERSION,error:String(err)};return}
    }
    await wait(50);
  }
  console.error('Pass19 install timed out');
}
install();
