import * as pc from 'playcanvas';

const VERSION='pass21-surprise-hazards-manual-boost-v1';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const MANUAL_MULTIPLIER=1.45;
const MANUAL_DURATION=3.0;
const MANUAL_COOLDOWN=8.0;
const TOTAL_SPEED_CAP=3.45;

function makeBoostButton(){
  const button=document.createElement('button');
  button.id='pass21-manual-boost';
  button.type='button';
  button.setAttribute('aria-label','Witch speed boost');
  button.innerHTML='<span class="pass21-boost-main">BOOST</span><span class="pass21-boost-sub">READY</span>';
  Object.assign(button.style,{
    position:'absolute',left:'16px',bottom:'calc(env(safe-area-inset-bottom, 0px) + 104px)',width:'92px',height:'92px',
    zIndex:'24',display:'none',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:'1px',
    borderRadius:'50%',border:'1px solid rgba(255,150,55,.70)',background:'radial-gradient(circle at 50% 42%, rgba(111,38,8,.92), rgba(20,8,7,.93) 66%, rgba(4,5,7,.96))',
    boxShadow:'0 0 0 2px rgba(255,104,24,.08), 0 0 18px rgba(255,91,23,.25), inset 0 0 18px rgba(255,92,20,.12)',
    color:'#ffd6a1',fontFamily:'system-ui,sans-serif',fontWeight:'900',letterSpacing:'1.5px',touchAction:'none',userSelect:'none',WebkitUserSelect:'none',
    WebkitTapHighlightColor:'transparent',cursor:'pointer',padding:'0',outline:'none'
  });
  const main=button.querySelector('.pass21-boost-main'),sub=button.querySelector('.pass21-boost-sub');
  Object.assign(main.style,{fontSize:'15px',lineHeight:'16px',fontWeight:'950'});
  Object.assign(sub.style,{fontSize:'9px',lineHeight:'11px',letterSpacing:'1px',opacity:'.86'});
  document.getElementById('shell')?.appendChild(button);
  return {button,main,sub};
}

function installManualSpeedLayer(state){
  const prior=Object.getOwnPropertyDescriptor(state,'speed');
  if(!prior?.configurable||typeof prior.get!=='function'||typeof prior.set!=='function')throw new Error('Pass20 speed bridge descriptor unavailable');
  let multiplier=1,activeRemaining=0,cooldownRemaining=0;
  Object.defineProperty(state,'speed',{
    configurable:true,enumerable:true,
    get(){return Math.min(TOTAL_SPEED_CAP,prior.get.call(state)*multiplier)},
    set(v){prior.set.call(state,v)}
  });
  return {
    activate(){if(activeRemaining>0||cooldownRemaining>0)return false;activeRemaining=MANUAL_DURATION;multiplier=MANUAL_MULTIPLIER;return true},
    reset(){multiplier=1;activeRemaining=0;cooldownRemaining=0},
    tick(dt,playing){
      if(!playing)return;
      if(activeRemaining>0){activeRemaining=Math.max(0,activeRemaining-dt);if(activeRemaining===0){multiplier=1;cooldownRemaining=MANUAL_COOLDOWN}}
      else if(cooldownRemaining>0)cooldownRemaining=Math.max(0,cooldownRemaining-dt);
    },
    get activeRemaining(){return activeRemaining},get cooldownRemaining(){return cooldownRemaining},get multiplier(){return multiplier},
    get ready(){return activeRemaining<=0&&cooldownRemaining<=0},get state(){return activeRemaining>0?'active':cooldownRemaining>0?'cooldown':'ready'}
  };
}

function updateButton(ui,manual,mode){
  const show=mode==='playing';ui.button.style.display=show?'flex':'none';if(!show)return;
  if(manual.state==='active'){
    ui.main.textContent='BOOST!';ui.sub.textContent=`${manual.activeRemaining.toFixed(1)}s`;
    ui.button.disabled=true;ui.button.style.opacity='1';ui.button.style.transform='scale(1.045)';
    ui.button.style.borderColor='rgba(255,195,90,.96)';ui.button.style.boxShadow='0 0 0 2px rgba(255,120,25,.16), 0 0 27px rgba(255,112,27,.52), inset 0 0 22px rgba(255,126,25,.25)';
  }else if(manual.state==='cooldown'){
    ui.main.textContent='RECHARGE';ui.sub.textContent=`${manual.cooldownRemaining.toFixed(1)}s`;
    ui.button.disabled=true;ui.button.style.opacity='.48';ui.button.style.transform='scale(.96)';
    ui.button.style.borderColor='rgba(150,112,91,.42)';ui.button.style.boxShadow='0 0 10px rgba(70,42,28,.18), inset 0 0 12px rgba(35,19,12,.18)';
  }else{
    ui.main.textContent='BOOST';ui.sub.textContent='READY';ui.button.disabled=false;ui.button.style.opacity='1';ui.button.style.transform='scale(1)';
    ui.button.style.borderColor='rgba(255,150,55,.70)';ui.button.style.boxShadow='0 0 0 2px rgba(255,104,24,.08), 0 0 18px rgba(255,91,23,.25), inset 0 0 18px rgba(255,92,20,.12)';
  }
}

function surpriseSpec(type,speed){
  const s=Math.max(1,Math.min(3.2,Number(speed)||1));
  return {
    z:-(15+5.2*s+Math.random()*1.8),
    x:6.05,
    crossSpeed:type==='ghost'?(5.55+.32*s+Math.random()*.34):(4.72+.26*s+Math.random()*.30)
  };
}

async function install(){
  for(let attempt=0;attempt<480;attempt++){
    const app=pc.app,w=window.WitchRide3D,p20=window.WitchRidePass20Gameplay;
    if(app&&w?.ready&&p20?.active===true){
      try{
        const state=w.state,crossers=p20.crossers||[];
        if(crossers.length!==4)throw new Error(`Pass20 crossing pool unavailable: ${crossers.length}`);
        const manual=installManualSpeedLayer(state),ui=makeBoostButton(),wasActive=new WeakMap();
        let repositionCount=0,lastMode=state.mode;
        for(const e of crossers)wasActive.set(e,!!e.__pass20Active);

        const resetManual=()=>{manual.reset();updateButton(ui,manual,state.mode)};
        const activateManual=()=>{
          if(state.mode!=='playing'||!manual.activate())return false;
          state.score+=35;updateButton(ui,manual,state.mode);
          window.dispatchEvent(new CustomEvent('witchride:manualboost',{detail:{multiplier:MANUAL_MULTIPLIER,duration:MANUAL_DURATION,cooldown:MANUAL_COOLDOWN}}));
          return true;
        };
        const rezone=(e)=>{
          if(!e?.__pass20Active)return false;
          const spec=surpriseSpec(e.__type,state.speed),dir=e.__dir===-1?-1:1;
          e.__dir=dir;e.__crossSpeed=spec.crossSpeed;e.setPosition(dir>0?-spec.x:spec.x,e.__baseY,spec.z);repositionCount++;
          e.__pass21Surprise=true;e.__pass21SpawnZ=spec.z;e.__pass21ReactionDistance=Math.abs(spec.z-2);
          return true;
        };
        const spawnSurprise=(type='ghost')=>{
          const e=crossers.find(x=>!x.__pass20Active&&x.__type===type)||crossers.find(x=>!x.__pass20Active);if(!e)return null;
          e.__dir=Math.random()<.5?1:-1;e.__pass20Active=true;e.enabled=true;rezone(e);wasActive.set(e,true);return e;
        };

        const stopPointer=e=>{e.preventDefault();e.stopPropagation()};
        ui.button.addEventListener('pointerdown',e=>{stopPointer(e);activateManual()});
        ui.button.addEventListener('pointermove',stopPointer);ui.button.addEventListener('pointerup',stopPointer);ui.button.addEventListener('pointercancel',stopPointer);
        ui.button.addEventListener('click',e=>{stopPointer(e);activateManual()});
        document.getElementById('play')?.addEventListener('click',resetManual);
        document.getElementById('again')?.addEventListener('click',resetManual);
        window.addEventListener('witchride:gameover',resetManual);

        app.on('update',dt=>{
          dt=Math.min(dt||0,.05);const mode=state.mode,playing=mode==='playing';
          manual.tick(dt,playing);
          for(const e of crossers){
            const now=!!e.__pass20Active,prev=!!wasActive.get(e);
            if(now&&!prev)rezone(e);
            wasActive.set(e,now);
          }
          if(lastMode!=='over'&&mode==='over')resetManual();
          if((lastMode==='over'||lastMode==='title')&&mode==='playing'&&manual.state!=='ready')resetManual();
          lastMode=mode;updateButton(ui,manual,mode);
        });

        const detail={
          lockedPass20Commit:'6f67411c8985844730ce339ed071ebfd1426f441',
          hazardMode:'closer-speed-aware-surprise-crossing',targetReactionSeconds:'~1.0-2.0',
          ghostCrossSpeedRange:'speed-aware ~5.9-6.9',goblinCrossSpeedRange:'speed-aware ~5.0-5.8',
          manualBoostMultiplier:MANUAL_MULTIPLIER,manualBoostDuration:MANUAL_DURATION,manualBoostCooldown:MANUAL_COOLDOWN,totalSpeedCap:TOTAL_SPEED_CAP,
          buttonSide:'left',pass20VisualsChanged:false,witchChanged:false,roadChanged:false,reflectionsChanged:false,beanHaloChanged:false,trafficVisualsChanged:false,broomFireAdded:false
        };
        window.WitchRidePass21Gameplay={active:true,version:VERSION,detail,manual,ui,crossers,get repositionCount(){return repositionCount},test:{activateManual,resetManual,rezone,spawnSurprise}};
        document.body.classList.add('pass21-gameplay-ready');console.info('Witch Ride Pass 21 surprise hazards/manual boost ready',VERSION,detail);return;
      }catch(err){console.error('Pass21 install failed',err);window.WitchRidePass21Gameplay={active:false,version:VERSION,error:String(err)};return}
    }
    await wait(50);
  }
  console.error('Pass21 install timed out');
}

install();
