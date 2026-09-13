import * as pc from 'playcanvas';

const VERSION='pass22-bean-readability-v1';
const wait=ms=>new Promise(r=>setTimeout(r,ms));

const BODY_DIFFUSE=[.31,.105,.028];
const BODY_EMISSIVE=[.034,.0085,.0015];
const CREASE_DIFFUSE=[.060,.017,.006];
const CREASE_EMISSIVE=[.010,.0018,.0003];

function walk(root,fn){if(!root)return;fn(root);for(const c of root.children||[])walk(c,fn)}

function isPass20HaloNode(node){
  const n=String(node?.name||'');
  return n.startsWith('Pass20 Bean Burning Halo')||n.startsWith('Pass20 Bean Ember Aura')||n.startsWith('Pass20 Bean Flame');
}

function tuneBeanBody(bean,index,stats){
  walk(bean,node=>{
    if(isPass20HaloNode(node)||/^Coffee Bean Halo/.test(node.name||''))return;
    for(const mi of node?.render?.meshInstances||[]){
      const src=mi.material;
      if(!src?.clone)continue;
      const name=`${node.name||''} ${src.name||''}`.toLowerCase();
      if(/halo|flame|ember|aura|spark|boost/.test(name))continue;
      const m=src.clone();
      m.name=`Pass22 medium roast bean ${index}`;
      m.diffuse=new pc.Color(...BODY_DIFFUSE);
      m.emissive=new pc.Color(...BODY_EMISSIVE);
      m.emissiveIntensity=.16;
      m.useMetalness=true;m.metalness=0;m.gloss=.43;
      m.update();mi.material=m;stats.bodyMaterials++;
    }
  });
}

function makeCreaseMaterial(){
  const m=new pc.StandardMaterial();
  m.name='Pass22 coffee bean center crease';
  m.diffuse=new pc.Color(...CREASE_DIFFUSE);
  m.emissive=new pc.Color(...CREASE_EMISSIVE);m.emissiveIntensity=.08;
  m.useMetalness=true;m.metalness=0;m.gloss=.12;
  m.update();return m;
}

function addReadabilityCrease(bean,index,mat,stats){
  const old=bean.findByName?.(`Pass22 Bean Crease ${index}`);if(old){old.destroy();}
  const crease=new pc.Entity(`Pass22 Bean Crease ${index}`);
  crease.addComponent('render',{type:'capsule'});
  crease.render.material=mat;
  crease.render.castShadows=false;crease.render.receiveShadows=false;
  // Thin recessed-looking mark on the player-facing side. It follows the bean's own spin/rotation.
  crease.setLocalScale(.060,.42,.038);
  crease.setLocalPosition(.018,.005,.325);
  crease.setLocalEulerAngles(0,0,7);
  bean.addChild(crease);
  stats.creases++;

  // A tiny warm edge beside the dark split keeps the groove readable without becoming neon.
  const edgeMat=mat.clone();edgeMat.name=`Pass22 crease warm edge ${index}`;
  edgeMat.diffuse=new pc.Color(.24,.070,.016);edgeMat.emissive=new pc.Color(.035,.006,.0006);edgeMat.emissiveIntensity=.10;edgeMat.gloss=.20;edgeMat.update();
  const edge=new pc.Entity(`Pass22 Bean Crease Edge ${index}`);edge.addComponent('render',{type:'capsule'});edge.render.material=edgeMat;edge.render.castShadows=false;edge.render.receiveShadows=false;
  edge.setLocalScale(.022,.34,.020);edge.setLocalPosition(.075,.010,.342);edge.setLocalEulerAngles(0,0,5);bean.addChild(edge);
  stats.creaseEdges++;
}

function tuneBeans(app){
  const stats={beans:0,bodyMaterials:0,creases:0,creaseEdges:0,scalePreserved:0,burningHalosPreserved:0};
  const creaseMat=makeCreaseMaterial();
  for(let i=0;i<16;i++){
    const bean=app.root.findByName(`Coffee Bean ${i}`);if(!bean)continue;
    stats.beans++;
    const scale=bean.getLocalScale().clone();
    tuneBeanBody(bean,i,stats);
    addReadabilityCrease(bean,i,creaseMat,stats);
    if(bean.findByName?.(`Pass20 Bean Burning Halo ${i}`))stats.burningHalosPreserved++;
    if(scale.equals(bean.getLocalScale()))stats.scalePreserved++;
  }
  return stats;
}

async function install(){
  for(let attempt=0;attempt<480;attempt++){
    const app=pc.app,w=window.WitchRide3D,p21=window.WitchRidePass21Gameplay,p20=window.WitchRidePass20Gameplay;
    if(app&&w?.ready&&p20?.active===true&&p21?.active===true){
      try{
        const stats=tuneBeans(app);
        if(stats.beans!==16||stats.scalePreserved!==16||stats.burningHalosPreserved!==16)throw new Error(`Pass22 bean targets incomplete: ${JSON.stringify(stats)}`);
        window.WitchRidePass22Bean={active:true,version:VERSION,detail:{stats,bodyDiffuse:BODY_DIFFUSE,bodyEmissive:BODY_EMISSIVE,rootScaleChanged:false,pickupLogicChanged:false,haloChanged:false,witchChanged:false,trafficChanged:false,hazardsChanged:false,boostChanged:false,roadChanged:false,reflectionsChanged:false,cameraChanged:false}};
        console.info('Witch Ride Pass 22 bean readability ready',VERSION,window.WitchRidePass22Bean.detail);
        return;
      }catch(err){console.error('Pass22 install failed',err);window.WitchRidePass22Bean={active:false,version:VERSION,error:String(err)};return}
    }
    await wait(50);
  }
  console.error('Pass22 install timed out');
}

install();
