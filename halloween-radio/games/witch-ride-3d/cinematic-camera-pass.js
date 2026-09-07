import * as pc from 'playcanvas';

const VERSION='cinematic-camera-pass-v7';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

function styleNear(root){root.findComponents?.('render')?.forEach(r=>{r.castShadows=false;r.receiveShadows=true});return root}
function instantiate(asset,name){const e=asset.resource.instantiateRenderEntity();e.name=name;styleNear(e);return e}
function noiseData(){
  const c=document.createElement('canvas');c.width=96;c.height=96;const g=c.getContext('2d'),img=g.createImageData(96,96),d=img.data;
  let x=0x9e3779b9;for(let i=0;i<d.length;i+=4){x^=x<<13;x^=x>>>17;x^=x<<5;const v=118+(x&31);d[i]=v;d[i+1]=v;d[i+2]=v;d[i+3]=255}g.putImageData(img,0,0);return c.toDataURL('image/png')
}
function buildGrade(){
  const shell=document.getElementById('shell');
  const grade=document.createElement('div');grade.id='cinematic-grade-v7';Object.assign(grade.style,{position:'absolute',inset:'0',zIndex:'13',pointerEvents:'none',background:'radial-gradient(ellipse at 50% 44%, transparent 31%, rgba(2,5,8,.025) 58%, rgba(0,0,0,.21) 100%), linear-gradient(180deg, rgba(12,20,27,.035), transparent 31%, rgba(37,12,4,.025) 78%, rgba(0,0,0,.075))',boxShadow:'inset 0 0 90px rgba(0,0,0,.18)'});shell.appendChild(grade);
  const grain=document.createElement('div');grain.id='cinematic-grain-v7';Object.assign(grain.style,{position:'absolute',inset:'-12%',zIndex:'14',pointerEvents:'none',opacity:'.024',backgroundImage:`url(${noiseData()})`,backgroundRepeat:'repeat',backgroundSize:'96px 96px',mixBlendMode:'soft-light',willChange:'background-position'});shell.appendChild(grain);
  return {grade,grain};
}
function buildForeground(app){
  const treeAsset=app.assets.find('dead-tree.glb','container'),fenceAsset=app.assets.find('haunted-fence.glb','container');
  if(!treeAsset?.resource||!fenceAsset?.resource)throw new Error('foreground production assets unavailable');
  const trees=[],treeSetup=[[-1,-8,1.42,7], [1,-34,1.62,-11],[-1,-68,1.72,13],[1,-101,1.48,-7],[-1,-143,1.82,9],[1,-186,1.58,-13]];
  treeSetup.forEach(([side,z,scale,lean],i)=>{const e=instantiate(treeAsset,`Cinematic Foreground Tree ${i}`);e.setPosition(side*(12.0+(i%3)*.72),-.16,z);e.setLocalScale(scale,scale,scale);e.setEulerAngles(0,(i*61+17)%360,side*lean);e.__side=side;e.__reset=220;e.__speed=1.12+(i%3)*.035;app.root.addChild(e);trees.push(e)});
  const fences=[],fenceSetup=[[-1,-24,1.16,6],[1,-77,1.26,-8],[-1,-126,1.18,7],[1,-174,1.30,-6]];
  fenceSetup.forEach(([side,z,scale,lean],i)=>{const e=instantiate(fenceAsset,`Cinematic Foreground Fence ${i}`);e.setPosition(side*9.75,-.06,z);e.setLocalScale(scale,scale,scale);e.setEulerAngles(0,side<0?8:-8,lean);e.__side=side;e.__reset=214;e.__speed=1.08+(i%2)*.035;app.root.addChild(e);fences.push(e)});
  return {trees,fences};
}
function installMotion(app,camera,foreground,grain){
  let lag=0,lagV=0,roll=0,rollV=0,grainClock=0,grainStep=0;
  const baseFov=61;
  const diag=window.WitchRide3D.cinematicMotion={cameraLagX:0,cameraRoll:0,foregroundTravel:0,cameraFov:baseFov};
  app.on('update',dt=>{
    dt=Math.min(dt,.04);const s=window.WitchRide3D?.state||{},playing=s.mode==='playing',vel=s.velocityX||0,targetErr=(s.targetX||0)-(s.x||0),speed=s.speed||1;
    const targetLag=playing?clamp(-vel*.072-targetErr*.025,-.34,.34):0;lagV+=(targetLag-lag)*18*dt;lagV*=Math.exp(-7.6*dt);lag+=lagV*dt;
    const targetRoll=playing?clamp(-vel*.19,-1.45,1.45):0;rollV+=(targetRoll-roll)*15*dt;rollV*=Math.exp(-7.1*dt);roll+=rollV*dt;
    const base=camera.getPosition();camera.setPosition(base.x+lag,base.y+Math.min(.045,Math.abs(vel)*.012),base.z);
    camera.lookAt((s.x||0)*.42+lag*.38,1.25+Math.min(.035,Math.abs(vel)*.008),-18);camera.rotateLocal(0,0,roll);camera.camera.fov=baseFov+Math.min(1.05,Math.max(0,speed-1)*.48);
    const travel=(playing?11.2*speed:.16)*dt;for(const e of [...foreground.trees,...foreground.fences]){e.translate(0,0,travel*e.__speed);const p=e.getPosition();if(p.z>24)e.setPosition(e.__side*(e.name.includes('Tree')?12.0+(Number(e.name.split(' ').pop())%3)*.72:9.75),p.y,p.z-e.__reset)}
    grainClock+=dt;if(grainClock>.115){grainClock=0;grainStep=(grainStep+1)%8;grain.style.backgroundPosition=`${(grainStep*17)%79}px ${(grainStep*29)%83}px`}
    diag.cameraLagX=lag;diag.cameraRoll=roll;diag.foregroundTravel+=travel;diag.cameraFov=camera.camera.fov;
  });
}
async function install(){
  for(let i=0;i<320;i++){
    const app=pc.app,w=window.WitchRide3D;
    if(app&&w?.ready&&w?.worldDetailPass==='world-detail-pass-v6'){
      try{
        const camera=app.root.findByName('Chase Camera');if(!camera?.camera)throw new Error('chase camera unavailable');
        const foreground=buildForeground(app),overlay=buildGrade();installMotion(app,camera,foreground,overlay.grain);
        const detail={foregroundTrees:foreground.trees.length,foregroundFences:foreground.fences.length,cameraInertia:1,filmicGrade:1,filmGrain:1};
        w.cinematicPass=VERSION;w.cinematicDetail=detail;document.body.classList.add('cinematic-camera-pass-ready');console.info('Witch Ride cinematic camera pass ready',VERSION,detail);return;
      }catch(err){console.error('Witch Ride cinematic camera pass failed',err);w.cinematicPass='fallback';w.cinematicDetail={};return}
    }
    await wait(50);
  }
  console.warn('Witch Ride cinematic camera pass timed out waiting for world detail pass');
}
install();
