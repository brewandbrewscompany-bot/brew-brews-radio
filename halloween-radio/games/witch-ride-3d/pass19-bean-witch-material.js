import * as pc from 'playcanvas';

const VERSION='pass19-bean-witch-material-v1';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const palette={
  skin:{diffuse:[.50,.30,.225],gloss:.24,metalness:0},
  hair:{diffuse:[.060,.026,.018],gloss:.38,metalness:0},
  cape:{diffuse:[.105,.025,.135],gloss:.27,metalness:0},
  hat:{diffuse:[.075,.018,.100],gloss:.24,metalness:0},
  cloth:{diffuse:[.055,.044,.070],gloss:.22,metalness:0},
  leather:{diffuse:[.038,.022,.018],gloss:.50,metalness:.015},
  broomWood:{diffuse:[.185,.078,.028],gloss:.33,metalness:0},
  straw:{diffuse:[.225,.112,.038],gloss:.13,metalness:0},
  bean:{diffuse:[.175,.050,.018],gloss:.47,metalness:0},
  beanCrease:{diffuse:[.055,.012,.006],gloss:.24,metalness:0}
};
function walk(root,fn,path=''){
  if(!root)return;
  const here=path?`${path}/${root.name||'unnamed'}`:(root.name||'unnamed');
  fn(root,here);
  for(const child of root.children||[])walk(child,fn,here);
}
function classify(label){
  const s=String(label||'').toLowerCase();
  if(/broom.*(bristle|straw|bundle|brush)|bristle|straw|bundle/.test(s))return 'straw';
  if(/broom.*(handle|shaft|wood)|broom_handle|handle/.test(s))return 'broomWood';
  if(/hair|mane|lock|strand|haircap/.test(s))return 'hair';
  if(/cape|cloak/.test(s))return 'cape';
  if(/hat|brim|crown/.test(s))return 'hat';
  if(/boot|shoe|leather|belt|glove/.test(s))return 'leather';
  if(/skin|face|head|hand|arm|nose|neck/.test(s))return 'skin';
  if(/dress|bodice|torso|body|sleeve|skirt|cloth|garment|pants|trouser|thigh|calf|leg/.test(s))return 'cloth';
  return null;
}
function tuneMaterial(m,kind,name){
  const p=palette[kind];if(!m||!p)return;
  m.name=`Pass19 ${kind} ${name}`;
  m.diffuse=new pc.Color(...p.diffuse);
  m.useMetalness=true;m.metalness=p.metalness;m.gloss=p.gloss;
  if(kind!=='bean'&&kind!=='beanCrease'){m.emissive=new pc.Color(0,0,0);m.emissiveIntensity=0}
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
    const m=source.clone();tuneMaterial(m,kind,`${stats.cloned}-${i}`);mi.material=m;stats.cloned++;stats[kind]=(stats[kind]||0)+1;
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
    m.emissive=new pc.Color(.024,.0035,.001);m.emissiveIntensity=.10;
  }else if(kind==='beanCrease'){
    m.emissive=new pc.Color(0,0,0);m.emissiveIntensity=0;
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
        const label=`${path} ${mi.material?.name||''}`.toLowerCase(),crease=/seam|crease|groove|split/.test(label),m=cloneBeanMaterial(mi,`Bean ${i} ${stats.bodyMaterials+stats.creaseMaterials}`,crease?'beanCrease':'bean');
        if(m){if(crease)stats.creaseMaterials++;else stats.bodyMaterials++}
      }
    });
    const halo=bean.findByName?.(`Coffee Bean Halo ${i}`);
    if(halo){
      stats.halos++;
      for(const mi of halo?.render?.meshInstances||[]){
        const source=mi.material;if(!source?.clone)continue;const m=source.clone();m.name=`Pass19 amber bean halo ${i}`;
        m.diffuse=new pc.Color(.48,.075,.006);m.emissive=new pc.Color(1,.20,.025);m.emissiveIntensity=.42;m.opacity=.050;m.blendType=pc.BLEND_NORMAL;m.depthWrite=false;m.cull=pc.CULLFACE_NONE;m.update();mi.material=m;stats.haloMaterials++;
      }
    }
    const light=bean.findByName?.(`Pass11 Bean Warm Light ${i}`);
    if(light?.light){light.light.intensity=.105;light.light.range=2.45;light.light.color=new pc.Color(1,.30,.075);stats.lights++}
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
