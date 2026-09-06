import * as pc from 'playcanvas';

const VERSION='variation-pass-v8';
const wait=ms=>new Promise(r=>setTimeout(r,ms));

const CAR_PALETTES=[
  {name:'Midnight Black',color:[.024,.030,.036],metal:.47,gloss:.77,worn:[.095,.082,.073]},
  {name:'Oxblood',color:[.105,.024,.026],metal:.38,gloss:.68,worn:[.145,.070,.058]},
  {name:'Forest Black',color:[.030,.050,.041],metal:.40,gloss:.65,worn:[.085,.095,.073]},
  {name:'Faded Navy',color:[.031,.047,.071],metal:.42,gloss:.66,worn:[.080,.086,.098]},
  {name:'Charcoal',color:[.060,.061,.062],metal:.44,gloss:.61,worn:[.115,.105,.096]},
  {name:'Tobacco Umber',color:[.075,.045,.029],metal:.34,gloss:.58,worn:[.130,.087,.058]},
  {name:'Funeral Black',color:[.015,.017,.019],metal:.50,gloss:.73,worn:[.070,.062,.057]}
];
const BEAN_TONES=[
  {name:'City Roast',color:[.215,.067,.020],gloss:.55,emissive:[.17,.035,.006]},
  {name:'Full City',color:[.155,.043,.013],gloss:.48,emissive:[.12,.022,.004]},
  {name:'Dark Roast',color:[.100,.025,.010],gloss:.43,emissive:[.085,.014,.002]},
  {name:'French Dark',color:[.062,.016,.008],gloss:.39,emissive:[.060,.010,.002]}
];
const BARK_TONES=[[.155,.105,.080],[.120,.080,.062],[.185,.128,.095],[.105,.073,.060]];
const PUMPKIN_TONES=[[.36,.105,.018],[.44,.145,.024],[.30,.082,.014],[.39,.118,.017]];
const PRESERVED_TRIM=['pitted chrome','smoky glass','period rubber','aged whitewall','warm headlamp','ruby tail lamp'];

function meshInstances(root){const out=[];for(const r of root.findComponents?.('render')||[])for(const mi of r.meshInstances||[])out.push(mi);return out}
function cloneSurface(base,name,color,metalness,gloss,emissive=null){
  const m=base.clone();m.name=name;m.diffuse=new pc.Color(...color);m.useMetalness=true;m.metalness=metalness;m.gloss=gloss;
  if(emissive){m.emissive=new pc.Color(...emissive);m.emissiveIntensity=.32}
  m.update();return m
}
function materialMatches(mi,terms){const n=(mi.material?.name||'').toLowerCase();return terms.some(t=>n.includes(t))}
function materialInventory(instances){return [...new Set(instances.map(mi=>mi.material?.name||'(unnamed)').filter(Boolean))].sort()}
function applyCarVariants(app){
  const preserved=new Set(),detail={cars:0,paintAssignments:0,wornAssignments:0,palettes:[],headlightTunes:0,preservedTrimKinds:0};
  for(let i=0;i<7;i++){
    const car=app.root.findByName(`1938 Coupe ${i}`);if(!car)continue;const spec=CAR_PALETTES[i],instances=meshInstances(car),main=[],worn=[];
    for(const mi of instances){const n=(mi.material?.name||'').toLowerCase();for(const trim of PRESERVED_TRIM)if(n.includes(trim))preserved.add(trim);if(n.includes('aged black lacquer'))main.push(mi);else if(n.includes('worn lacquer'))worn.push(mi)}
    if(!main.length)throw new Error(`car ${i} production lacquer material not found; materials=${materialInventory(instances).join(' | ')}`);
    const mainMat=cloneSurface(main[0].material,`v8 ${spec.name} lacquer`,spec.color,spec.metal,spec.gloss);
    const wornBase=worn[0]?.material||main[0].material,wornMat=cloneSurface(wornBase,`v8 ${spec.name} weathering`,spec.worn,Math.max(.16,spec.metal-.17),Math.max(.31,spec.gloss-.25));
    main.forEach(mi=>{mi.material=mainMat;detail.paintAssignments++});worn.forEach(mi=>{mi.material=wornMat;detail.wornAssignments++});
    car.__visualVariant=spec.name;detail.palettes.push(spec.name);detail.cars++;
    const lamps=car.children.filter(c=>c.name?.startsWith('Headlight Glow')&&c.light);for(const lamp of lamps){lamp.light.intensity=.45+(i%3)*.045;lamp.light.color=new pc.Color(1,.43+(i%2)*.035,.105+(i%3)*.014);detail.headlightTunes++}
  }
  detail.preservedTrimKinds=preserved.size;detail.preservedTrim=[...preserved];return detail;
}
function collectNamed(app,prefix,count){const out=[];for(let i=0;i<count;i++){const e=app.root.findByName(`${prefix} ${i}`);if(e)out.push(e)}return out}
function scaleEntity(e,mx,my,mz){const s=e.getLocalScale();e.setLocalScale(s.x*mx,s.y*my,s.z*mz)}
function applyScenerySilhouettes(app){
  const trees=collectNamed(app,'Dead Tree',24),fences=collectNamed(app,'Fence',10),pumpkins=collectNamed(app,'Pumpkin',10);let barkAssignments=0,pumpkinAssignments=0;
  const barkPool=new Map(),pumpkinPool=new Map();
  trees.forEach((e,i)=>{
    const width=.88+(i%5)*.045,height=.94+((i*3)%7)*.025,depth=.91+((i*5)%6)*.032;scaleEntity(e,width,height,depth);const r=e.getLocalEulerAngles();e.setLocalEulerAngles(r.x+((i%3)-1)*1.8,r.y+((i*29)%43)-21,r.z+((i%5)-2)*1.35);
    for(const mi of meshInstances(e)){if(!materialMatches(mi,['dead bark']))continue;const k=i%4;if(!barkPool.has(k))barkPool.set(k,cloneSurface(mi.material,`v8 dead bark ${k}`,BARK_TONES[k],0,.12));mi.material=barkPool.get(k);barkAssignments++}
  });
  fences.forEach((e,i)=>{scaleEntity(e,.91+(i%4)*.055,.96+((i+2)%3)*.035,.94+(i%2)*.05);const r=e.getLocalEulerAngles();e.setLocalEulerAngles(r.x,r.y+((i%5)-2)*2.1,r.z+((i%4)-1.5)*1.7)});
  pumpkins.forEach((e,i)=>{
    scaleEntity(e,.78+(i%5)*.09,.83+((i*2)%5)*.072,.80+((i*3)%5)*.065);const r=e.getLocalEulerAngles();e.setLocalEulerAngles(r.x,r.y+((i*47)%91)-45,r.z+((i%3)-1)*2.2);
    for(const mi of meshInstances(e)){if(!materialMatches(mi,['old pumpkin']))continue;const k=i%4;if(!pumpkinPool.has(k))pumpkinPool.set(k,cloneSurface(mi.material,`v8 pumpkin skin ${k}`,PUMPKIN_TONES[k],0,.23));mi.material=pumpkinPool.get(k);pumpkinAssignments++}
  });
  return {treeSilhouettes:trees.length,fenceSilhouettes:fences.length,pumpkinSilhouettes:pumpkins.length,barkAssignments,pumpkinAssignments};
}
function applyBeanRoastDepth(app){
  const beans=collectNamed(app,'Coffee Bean',16),pool=new Map();let assignments=0;
  beans.forEach((bean,i)=>{
    const k=i%BEAN_TONES.length,tone=BEAN_TONES[k];for(const mi of meshInstances(bean)){if(!materialMatches(mi,['roasted coffee']))continue;if(!pool.has(k))pool.set(k,cloneSurface(mi.material,`v8 bean ${tone.name}`,tone.color,0,tone.gloss,tone.emissive));mi.material=pool.get(k);assignments++}bean.__roastVariant=tone.name;
  });
  return {beanVariants:beans.length,beanRoastTones:pool.size,beanAssignments:assignments};
}
async function install(){
  for(let i=0;i<320;i++){
    const app=pc.app,w=window.WitchRide3D;
    if(app&&w?.ready&&w?.cinematicPass==='cinematic-camera-pass-v7'){
      try{
        const cars=applyCarVariants(app),scenery=applyScenerySilhouettes(app),beans=applyBeanRoastDepth(app);
        const detail={...cars,...scenery,...beans,uniqueCarPalettes:new Set(cars.palettes).size};
        w.variationError='';w.variationPass=VERSION;w.variationDetail=detail;document.body.classList.add('variation-pass-ready');console.info('Witch Ride variation pass ready',VERSION,detail);return;
      }catch(err){const detail=err?.stack||err?.message||String(err);console.error('Witch Ride variation pass failed',err);w.variationError=detail;w.variationPass='fallback';w.variationDetail={};return}
    }
    await wait(50);
  }
  const w=window.WitchRide3D;if(w){w.variationError='timed out waiting for cinematic pass';w.variationPass='fallback';w.variationDetail={}}console.warn('Witch Ride variation pass timed out waiting for cinematic pass');
}
install();
