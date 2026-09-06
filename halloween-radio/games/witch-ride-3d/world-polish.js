import * as pc from 'playcanvas';

const VERSION='world-polish-v4';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

function material(color,emissive=null,opacity=1,additive=false){
  const m=new pc.StandardMaterial();m.diffuse=new pc.Color(...color);m.useMetalness=true;m.metalness=0;m.gloss=.12;
  if(emissive){m.emissive=new pc.Color(...emissive);m.emissiveIntensity=1.15}
  if(opacity<1){m.opacity=opacity;m.blendType=additive?pc.BLEND_ADDITIVE:pc.BLEND_NORMAL;m.depthWrite=false;m.cull=pc.CULLFACE_NONE}
  m.update();return m;
}
function primitive(app,name,type,scale,pos,mat,parent=null){
  const e=new pc.Entity(name);e.addComponent('render',{type});e.setLocalScale(...scale);e.setLocalPosition(...pos);e.render.material=mat;e.render.castShadows=false;e.render.receiveShadows=false;(parent||app.root).addChild(e);return e;
}
function canvasSignTexture(app){
  const c=document.createElement('canvas');c.width=512;c.height=256;const x=c.getContext('2d');
  const g=x.createLinearGradient(0,0,0,256);g.addColorStop(0,'#2a1a10');g.addColorStop(.55,'#130e0b');g.addColorStop(1,'#080707');x.fillStyle=g;x.fillRect(0,0,512,256);
  x.strokeStyle='#795033';x.lineWidth=12;x.strokeRect(8,8,496,240);x.strokeStyle='#2e1e16';x.lineWidth=3;x.strokeRect(20,20,472,216);
  x.textAlign='center';x.fillStyle='#d4b28c';x.font='700 48px Georgia';x.fillText('BREW & BREWS',256,84);x.fillStyle='#c77a3d';x.font='700 34px Georgia';x.fillText('COFFEE ROASTERY',256,135);x.fillStyle='#9e8973';x.font='600 22px Arial';x.fillText('ROASTED LOCALLY · LOUISBURG, KS',256,188);
  x.globalAlpha=.18;for(let i=0;i<85;i++){x.fillStyle=i%3?'#000':'#d8a36b';x.fillRect(Math.random()*512,Math.random()*256,2+Math.random()*8,1+Math.random()*3)}x.globalAlpha=1;
  const t=new pc.Texture(app.graphicsDevice,{width:512,height:256,format:pc.PIXELFORMAT_R8_G8_B8_A8,mipmaps:true});t.setSource(c);t.addressU=pc.ADDRESS_CLAMP_TO_EDGE;t.addressV=pc.ADDRESS_CLAMP_TO_EDGE;return t;
}
function signMaterial(texture){const m=new pc.StandardMaterial();m.diffuseMap=texture;m.emissiveMap=texture;m.emissive=new pc.Color(.10,.055,.025);m.emissiveIntensity=.25;m.useMetalness=true;m.metalness=.05;m.gloss=.18;m.update();return m}
async function worldManifest(){try{const r=await fetch('assets/world-material-pass.json',{cache:'no-store'});if(!r.ok)return 'base-world';const j=await r.json();return j.version||'base-world'}catch{return 'base-world'}}
function addCarEffects(app){
  const beam=material([.32,.15,.045],[.55,.22,.035],.105,true);const mist=material([.25,.28,.29],null,.055,false);let count=0;
  for(let i=0;i<7;i++){
    const car=app.root.findByName(`1938 Coupe ${i}`);if(!car)continue;
    for(const x of [-.72,.72]){const b=primitive(app,`Headlight Road Beam ${i} ${x}`,'plane',[1.15,1,9.5],[x,.055,6.1],beam,car);b.setLocalEulerAngles(0,0,0);count++}
    const spray=primitive(app,`Tire Road Mist ${i}`,'plane',[2.8,1,3.4],[0,.07,-2.7],mist,car);spray.setLocalEulerAngles(0,0,0);
  }
  return count;
}
function addEmbers(app,witch){
  const ember=material([.28,.055,.008],[1,.18,.018],.78,true);const sparks=[];if(!witch)return sparks;
  for(let i=0;i<12;i++){const e=primitive(app,`Broom Spark ${i}`,'sphere',[.025+(i%3)*.009,.025,.055],[((i%4)-1.5)*.09,-.78,3.25+i*.27],ember,witch);e.__phase=i*.71;e.__base=3.25+i*.27;sparks.push(e)}return sparks;
}
function addLeaves(app){
  const leafMat=material([.18,.075,.018],null,.82,false);const leaves=[];
  for(let i=0;i<16;i++){const side=i%2?-1:1,e=primitive(app,`Wind Leaf ${i}`,'box',[.06,.012,.14],[side*(2.5+(i%5)*1.7),.25+(i%4)*.55,-18-i*12],leafMat);e.__phase=i*.83;e.__side=side;e.__reset=175+(i%5)*13;leaves.push(e)}return leaves;
}
function addRoasterySign(app){
  const root=new pc.Entity('Brew & Brews Roadside Roastery Sign');app.root.addChild(root);root.setPosition(8.7,0,-78);
  const wood=material([.11,.065,.035],null,1);const plate=signMaterial(canvasSignTexture(app));
  primitive(app,'Sign Post L','box',[.16,2.7,.16],[-1.55,1.33,.12],wood,root);primitive(app,'Sign Post R','box',[.16,2.7,.16],[1.55,1.33,.12],wood,root);primitive(app,'Brew & Brews Sign Face','box',[3.7,1.75,.12],[0,2.55,0],plate,root);root.setEulerAngles(0,-8,0);return root;
}
function animateSmoke(app,t){for(let i=0;i<5;i++){const s=app.root.findByName(`Roastery Smoke ${i}`);if(!s)continue;const p=s.getLocalPosition();p.x=Math.sin(t*.25+i)*(.15+i*.025);p.y=7.65+i*.46+Math.sin(t*.32+i*.5)*.10;s.setLocalPosition(p)}}
function impactFlash(){document.body.classList.remove('witch-impact');void document.body.offsetWidth;document.body.classList.add('witch-impact');setTimeout(()=>document.body.classList.remove('witch-impact'),280)}
async function install(){
  for(let tries=0;tries<260;tries++){
    const app=pc.app,w=window.WitchRide3D;
    if(app&&w?.ready&&w?.materialPass==='witch-material-pass-v2'){
      try{
        const worldPass=await worldManifest();if(worldPass!=='world-material-pass-v3')throw new Error('world material manifest not ready');
        const witch=app.root.findByName('Witch Rig')||app.root.findByName('Witch Rig Fallback');const camera=app.root.findByName('Chase Camera');
        const beams=addCarEffects(app),sparks=addEmbers(app,witch),leaves=addLeaves(app),sign=addRoasterySign(app);
        let t=0,prevX=w.state.x,roll=0,prevMode=w.state.mode;
        app.on('update',dt=>{
          t+=dt;const state=w.state,speed=state.speed||1,travel=11.2*speed;
          if(state.mode==='playing'){
            const turn=(state.x-prevX)/Math.max(dt,.001);prevX=state.x;const desired=clamp(-turn*.52,-2.15,2.15);roll+=(desired-roll)*Math.min(1,dt*5.5);
            if(camera){camera.rotateLocal(0,0,roll);const p=camera.getPosition();p.y+=Math.sin(t*(14+speed*2))*.0085*Math.min(1,speed-.25);camera.setPosition(p)}
            for(const e of leaves){const p=e.getPosition();p.z+=travel*dt*1.18;p.x+=e.__side*dt*.34+Math.sin(t*1.8+e.__phase)*dt*.45;p.y+=Math.sin(t*2.2+e.__phase)*dt*.12;e.setPosition(p);e.rotateLocal(dt*85,dt*43,dt*61);if(p.z>15)e.setPosition(e.__side*(3+Math.random()*6),.3+Math.random()*2.3,-e.__reset-Math.random()*60)}
            if(sign){const p=sign.getPosition();p.z+=travel*dt;if(p.z>22){p.z=-225;p.x=p.x>0?-8.7:8.7;sign.setPosition(p);sign.setEulerAngles(0,p.x>0?-8:8,0)}}
            for(let i=0;i<sparks.length;i++){const e=sparks[i],p=e.getLocalPosition();p.z+=dt*(2.8+speed*1.5);p.y+=Math.sin(t*8+e.__phase)*dt*.11;e.setLocalPosition(p);if(p.z>7.3)e.setLocalPosition(((i%4)-1.5)*.09,-.78,e.__base)}
          }else{roll*=Math.exp(-dt*5);prevX=state.x}
          animateSmoke(app,t);if(prevMode==='playing'&&state.mode==='over')impactFlash();prevMode=state.mode;
        });
        w.worldMaterialPass=worldPass;w.worldPolish=VERSION;w.worldPolishStats={headlightBeams:beams,leaves:leaves.length,embers:sparks.length,sign:!!sign};document.body.classList.add('world-polish-ready');console.info('Witch Ride world polish ready',worldPass,w.worldPolishStats);return;
      }catch(err){console.error('Witch Ride world polish failed',err);w.worldPolish='fallback'}
    }
    await wait(50);
  }
  console.warn('Witch Ride world polish timed out');
}
install();
