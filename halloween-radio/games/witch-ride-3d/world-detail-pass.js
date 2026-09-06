import * as pc from 'playcanvas';

const VERSION='world-detail-pass-v6';
const wait=ms=>new Promise(r=>setTimeout(r,ms));

function material(name,diffuse,metalness=0,roughness=.8,emissive=null,opacity=1,blend=pc.BLEND_NORMAL){
  const m=new pc.StandardMaterial();m.name=name;m.diffuse=new pc.Color(...diffuse);m.useMetalness=true;m.metalness=metalness;m.gloss=1-roughness;
  if(emissive){m.emissive=new pc.Color(...emissive);m.emissiveIntensity=1}
  if(opacity<1){m.opacity=opacity;m.blendType=blend;m.depthWrite=false;m.cull=pc.CULLFACE_NONE}
  m.update();return m;
}
function entity(name,type,scale,pos,mat,parent,rot=null){
  const e=new pc.Entity(name);e.addComponent('render',{type});e.setLocalScale(...scale);e.setLocalPosition(...pos);if(rot)e.setLocalEulerAngles(...rot);e.render.material=mat;e.render.castShadows=false;e.render.receiveShadows=false;(parent||pc.app.root).addChild(e);return e;
}
function signTexture(app){
  const c=document.createElement('canvas');c.width=512;c.height=256;const g=c.getContext('2d');
  const grad=g.createLinearGradient(0,0,512,256);grad.addColorStop(0,'#1b120d');grad.addColorStop(.5,'#302015');grad.addColorStop(1,'#130d09');g.fillStyle=grad;g.fillRect(0,0,512,256);
  for(let i=0;i<38;i++){const y=(i*37)%256;g.globalAlpha=.12+(i%4)*.025;g.strokeStyle=i%3?'#6f4c32':'#090705';g.lineWidth=1+(i%2);g.beginPath();g.moveTo(0,y);g.bezierCurveTo(120,y+((i%5)-2)*4,380,y-((i%7)-3)*3,512,y+((i%3)-1)*2);g.stroke()}
  g.globalAlpha=1;g.strokeStyle='#5c4829';g.lineWidth=7;g.strokeRect(12,12,488,232);g.strokeStyle='#a27b38';g.lineWidth=2;g.strokeRect(20,20,472,216);
  g.textAlign='center';g.fillStyle='#d4b56e';g.shadowColor='rgba(0,0,0,.8)';g.shadowBlur=5;g.font='700 58px Georgia, serif';g.fillText('BREW & BREWS',256,91);g.font='700 34px Georgia, serif';g.fillStyle='#efe1bd';g.fillText('COFFEE ROASTERY',256,145);g.shadowBlur=0;g.fillStyle='#9d8451';g.font='600 20px Georgia, serif';g.fillText('LOUISBURG, KANSAS',256,190);
  for(let i=0;i<24;i++){const x=(i*83)%500+6,y=(i*47)%242+7;g.fillStyle=`rgba(8,5,3,${.10+(i%4)*.025})`;g.fillRect(x,y,10+(i%5)*7,2+(i%3))}
  const tex=new pc.Texture(app.graphicsDevice,{width:c.width,height:c.height,mipmaps:true,minFilter:pc.FILTER_LINEAR_MIPMAP_LINEAR,magFilter:pc.FILTER_LINEAR,addressU:pc.ADDRESS_CLAMP_TO_EDGE,addressV:pc.ADDRESS_CLAMP_TO_EDGE});tex.name='Brew Brews weathered roastery sign';tex.setSource(c);return tex;
}
function signFaceMaterial(tex){const m=material('weathered roastery sign face',[1,1,1],0,.69,[.12,.085,.035]);m.diffuseMap=tex;m.emissiveMap=tex;m.emissiveIntensity=.22;m.update();return m}
function fogMaterial(tex,opacity=.13){const m=material('coffee steam',[.45,.48,.50],0,.98,[.035,.04,.045],opacity);m.diffuseMap=tex;m.opacityMap=tex;m.opacityMapChannel='a';m.emissiveMap=tex;m.emissiveIntensity=.18;m.update();return m}

function decorateRoastery(app){
  const r=app.root.findByName('Brew & Brews Haunted Roastery');if(!r)return {windows:[],lights:[],furnace:null,spill:[]};
  const warmA=material('roastery tungsten window A',[.29,.115,.025],0,.42,[1,.24,.035]);warmA.emissiveIntensity=1.85;warmA.update();
  const warmB=material('roastery tungsten window B',[.22,.07,.014],0,.46,[.82,.15,.018]);warmB.emissiveIntensity=1.28;warmB.update();
  const windows=[],spots=[[-3.7,3.18,2.73],[-2.15,3.18,2.73],[-.60,3.18,2.73],[1.10,3.18,2.73],[2.65,3.18,2.73],[4.20,3.18,2.73]];
  spots.forEach((p,i)=>{const w=entity(`Roastery Window Glow ${i}`,'box',[1.03,.78,.025],p,i%2?warmB:warmA,r);windows.push(w)});
  const furnace=entity('Roastery Furnace Glow','box',[1.20,.62,.03],[4.18,1.34,2.76],warmA,r);
  const spillMat=material('roastery wet ground spill',[.40,.12,.015],0,.08,[.55,.12,.018],.09,pc.BLEND_ADDITIVE),spill=[];
  for(const x of [-2.3,2.4])spill.push(entity(`Roastery Wet Light Spill ${x}`,'plane',[2.8,1,5.2],[x,.045,4.1],spillMat,r));
  const lights=[];for(const [i,x] of [[0,-2.5],[1,2.7]]){const l=new pc.Entity(`Roastery Exterior Lamp ${i}`);l.addComponent('light',{type:'point',color:new pc.Color(1,.37,.075),intensity:.48,range:8.5,castShadows:false});l.setLocalPosition(x,3.4,3.1);r.addChild(l);lights.push(l)}
  return {windows,lights,furnace,spill,warmA,warmB};
}
function buildRoadsideSigns(app,tex){
  const wood=material('weathered sign timber',[.085,.052,.032],0,.91),iron=material('blackened sign iron',[.055,.048,.043],.55,.63),face=signFaceMaterial(tex),signs=[];
  const setup=[[-1,-54,7], [1,-132,-6],[-1,-208,5]];
  setup.forEach(([side,z,lean],i)=>{
    const root=new pc.Entity(`Brew & Brews Roadside Roastery Sign ${i}`);root.setPosition(side*9.7,0,z);root.setEulerAngles(0,side<0?8:-8,lean);app.root.addChild(root);root.__side=side;root.__reset=246;
    entity('sign post','box',[.22,3.1,.22],[0,1.45,0],wood,root);entity('sign post brace','box',[.14,2.35,.14],[side*.55,1.7,.05],wood,root,[0,0,side*14]);
    entity('sign board','box',[3.55,1.52,.16],[0,3.75,0],wood,root);entity('sign face','plane',[3.25,1,1.28],[0,3.75,.18],face,root,[90,0,0]);
    for(const x of [-1.66,1.66])entity('iron edge','box',[.07,1.48,.21],[x,3.75,0],iron,root);for(const y of [3.05,4.45])entity('iron edge','box',[3.4,.07,.21],[0,y,0],iron,root);
    signs.push(root);
  });return signs;
}
function decorateBeans(app,fogTex){
  const haloMat=material('coffee collectible amber halo',[.58,.10,.012],0,.18,[1,.18,.012],.11,pc.BLEND_ADDITIVE),steamMat=fogMaterial(fogTex,.16),halos=[],steam=[];
  for(let i=0;i<16;i++){
    const bean=app.root.findByName(`Coffee Bean ${i}`);if(!bean)continue;
    const halo=entity(`Coffee Bean Halo ${i}`,'sphere',[.66,.66,.66],[0,0,0],haloMat,bean);halo.__phase=i*.67;halos.push(halo);
    for(let s=0;s<2;s++){const w=entity(`Coffee Steam ${i}-${s}`,'plane',[.34+(s*.08),1,.56],[s?-.13:.14,.62+s*.23,0],steamMat,bean,[90,s?15:-16,0]);w.__phase=i*.51+s*1.7;w.__baseY=.62+s*.23;steam.push(w)}
  }
  return {halos,steam};
}
function animate(app,detail){
  let t=0;app.on('update',dt=>{
    t+=dt;const state=window.WitchRide3D?.state||{},playing=state.mode==='playing',speed=state.speed||1,travel=playing?11.2*speed:.18;
    if(detail.warmA){detail.warmA.emissiveIntensity=1.70+Math.sin(t*5.7)*.08+Math.sin(t*1.17)*.055;detail.warmA.update()}
    if(detail.warmB){detail.warmB.emissiveIntensity=1.18+Math.sin(t*4.3+1.1)*.055;detail.warmB.update()}
    if(detail.furnace?.render?.material){detail.furnace.render.material.emissiveIntensity=1.75+Math.sin(t*7.2)*.11;detail.furnace.render.material.update()}
    for(let i=0;i<detail.lights.length;i++)detail.lights[i].light.intensity=.45+Math.sin(t*(4.1+i*.7)+i)*.035;
    for(const s of detail.signs){s.translate(0,0,travel*dt);const p=s.getPosition();if(p.z>26)s.setPosition(s.__side*9.7,0,p.z-s.__reset)}
    for(let i=0;i<detail.halos.length;i++){const h=detail.halos[i],pulse=.96+Math.sin(t*3.4+h.__phase)*.075;h.setLocalScale(.66*pulse,.66*pulse,.66*pulse)}
    for(let i=0;i<detail.steam.length;i++){const w=detail.steam[i],cycle=(t*.30+w.__phase*.15)%1,p=w.getLocalPosition();p.y=w.__baseY+cycle*.48;p.x=(i%2?-.13:.14)+Math.sin(t*1.7+w.__phase)*.055;w.setLocalPosition(p);const fade=.78-cycle*.28;w.setLocalScale((.34+(i%2)*.08)*fade,1,.56*(1+cycle*.32))}
  });
}
async function install(){
  for(let i=0;i<320;i++){
    const app=pc.app;
    if(app&&window.WitchRide3D?.ready&&window.WitchRide3D?.atmospherePass==='atmosphere-pass-v5'){
      try{
        const fogAsset=app.assets.find('fog-sheet.png','texture'),fogTex=fogAsset?.resource;if(!fogTex)throw new Error('fog-sheet texture unavailable for coffee steam');
        const tex=signTexture(app),roastery=decorateRoastery(app),signs=buildRoadsideSigns(app,tex),beans=decorateBeans(app,fogTex);
        const anim={...roastery,signs,halos:beans.halos,steam:beans.steam};animate(app,anim);
        const detail={roasteryWindows:roastery.windows.length,roasteryLights:roastery.lights.length,roasteryGroundSpills:roastery.spill.length,furnaceGlow:roastery.furnace?1:0,roadsideSigns:signs.length,beanHalos:beans.halos.length,beanSteam:beans.steam.length};
        window.WitchRide3D.worldDetailPass=VERSION;window.WitchRide3D.worldDetail=detail;document.body.classList.add('world-detail-pass-ready');console.info('Witch Ride world detail pass ready',VERSION,detail);return;
      }catch(err){console.error('Witch Ride world detail pass failed',err);window.WitchRide3D.worldDetailPass='fallback';window.WitchRide3D.worldDetail={};return}
    }
    await wait(50);
  }
  console.warn('Witch Ride world detail pass timed out waiting for atmosphere pass');
}
install();
