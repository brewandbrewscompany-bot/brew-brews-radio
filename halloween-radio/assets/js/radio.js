(()=>{
  'use strict';

  const stations=[
    {freq:88.3,name:'Graveyard AM',mode:'static'},
    {freq:91.7,name:'Dead Air',mode:'static'},
    {freq:95.9,name:'The Grind',mode:'static'},
    {freq:99.5,name:'After Dark',mode:'static'},
    {freq:103.1,name:'B&B Radio',mode:'track'},
    {freq:106.7,name:'Witching Hour',mode:'static'}
  ];

  // MASTER STATE. Nothing except explicit Play may ever set this true.
  const state={
    playbackIntent:false,
    currentFreq:103.1,
    volume:.78,
    autoTune:true,
    userTuning:false,
    discovered:new Set(),
    staticSource:null,
    staticGain:null,
    audioCtx:null,
    ghostTimer:null,
    autoTuneTimer:null,
    toastTimer:null
  };

  const $=s=>document.querySelector(s);
  const $$=s=>[...document.querySelectorAll(s)];
  const audio=$('#radioAudio');
  const needle=$('#tunerNeedle');
  const tuner=$('#tunerGlass');
  const readout=$('#tunerReadout');
  const tuneModule=$('#tuneModule');
  const volumeModule=$('#volumeModule');
  const play=$('#play');
  const meterNeedle=$('#meterNeedleGroup');
  const meterCaption=$('#meterCaption');
  const liveTrack=$('#liveTrackTitle');
  const liveStation=$('#liveStationName');
  const toast=$('#toast');
  const ghost=$('#ghost');
  const autoToggle=$('#autoTuneToggle');
  const autoText=$('#autoTuneText');
  const tube=$('#tube');

  audio.volume=state.volume;
  audio.pause();

  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const nearestStation=f=>stations.reduce((best,s)=>Math.abs(s.freq-f)<Math.abs(best.freq-f)?s:best,stations[0]);
  const stationIndex=f=>stations.indexOf(nearestStation(f));
  const freqPct=f=>clamp((f-88)/(108-88),0,1);
  const freqAngle=f=>-135+freqPct(f)*270;

  function showToast(title,text=''){
    clearTimeout(state.toastTimer);
    toast.innerHTML=`<strong>${title}</strong>${text}`;
    toast.classList.add('show');
    state.toastTimer=setTimeout(()=>toast.classList.remove('show'),2100);
  }

  function discover(id){
    if(state.discovered.has(id)) return;
    const cards={
      tube:['VACUUM TUBE AWAKENED','Glass, filament, socket — and a little too much voltage.'],
      brand:['STATION CREST FOUND','Brew & Brews Coffee Roastery is still broadcasting.'],
      mug:['THE NIGHT ROAST','The cup never stops steaming. Nobody remembers pouring it.'],
      tuner:['THE DEEP DIAL','The glass sits far behind the iron bezel. Something sits farther back.'],
      volume:['HEAVY CONTROL','Machined ridges, old brass, and enough resistance to feel real.'],
      tune:['FORBIDDEN FREQUENCY','Some stations are easier to find than they are to leave.'],
      display:['NOW BREWING','IRONCLAD · Brew & Brews Radio · 103.1'],
      meter:['SIGNAL INSTRUMENT','The needle knows when the room is listening.'],
      speaker:['VOICE IN THE CABINET','The grille is deeper than it should be.']
    };
    state.discovered.add(id);
    const c=cards[id]||['DISCOVERY','Something moved.'];
    showToast(c[0],c[1]);
    $('#discoveryCounter').textContent=`Haunts Found ${state.discovered.size} / 9`;
  }

  function stationStrength(freq){
    const d=Math.abs(nearestStation(freq).freq-freq);
    return clamp(1-d/1.55,0,.98);
  }

  function updateMeter(){
    const strength=stationStrength(state.currentFreq);
    const angle=-47+strength*94;
    meterNeedle.style.transform=`rotate(${angle.toFixed(1)}deg)`;
    const st=nearestStation(state.currentFreq);
    meterCaption.textContent=`${strength>.82?'Strong':strength>.5?'Fading':'Weak'} · ${st.freq.toFixed(1)}`;
    document.documentElement.style.setProperty('--meterGlow',(0.28+strength*.22).toFixed(2));
  }

  function updateKnobs(){
    const tuneRot=freqAngle(state.currentFreq);
    $('#tuneKnob').style.setProperty('--knobRot',`${tuneRot}deg`);
    $('#tuneIndicator').style.setProperty('--knobRot',`${tuneRot}deg`);
    $('#tuneValue').textContent=`${state.currentFreq.toFixed(1)} FM`;
    tuneModule.setAttribute('aria-valuenow',state.currentFreq.toFixed(1));
    const volRot=-135+state.volume*270;
    $('#volumeKnob').style.setProperty('--knobRot',`${volRot}deg`);
    $('#volumeIndicator').style.setProperty('--knobRot',`${volRot}deg`);
    $('#volumeValue').textContent=`${Math.round(state.volume*100)}%`;
    volumeModule.setAttribute('aria-valuenow',Math.round(state.volume*100));
  }

  function updateNowBrewing(st){
    if(st.mode==='track'){
      liveTrack.textContent='IRONCLAD';
      liveStation.textContent=`Brew & Brews Radio · ${st.freq.toFixed(1)}`;
    }else{
      liveTrack.textContent=st.name.toUpperCase();
      liveStation.textContent=`${st.freq.toFixed(1)} · STATIC / PLACEHOLDER`;
    }
  }

  function updateUI(){
    const p=7+freqPct(state.currentFreq)*86;
    needle.style.left=`${p}%`;
    tuner.setAttribute('aria-valuenow',state.currentFreq.toFixed(1));
    const st=nearestStation(state.currentFreq);
    readout.innerHTML=`<strong>${state.currentFreq.toFixed(1)}</strong> ${st.name.toUpperCase()}`;
    $$('.preset').forEach(b=>b.classList.toggle('active',Math.abs(parseFloat(b.dataset.frequency)-st.freq)<.01));
    $$('[data-station-tag]').forEach(t=>t.classList.toggle('active',Math.abs(parseFloat(t.dataset.stationTag)-st.freq)<.01));
    updateNowBrewing(st);
    updateMeter();
    updateKnobs();
  }

  function ensureAudioContext(){
    if(state.audioCtx) return state.audioCtx;
    const AC=window.AudioContext||window.webkitAudioContext;
    if(!AC) return null;
    state.audioCtx=new AC();
    return state.audioCtx;
  }

  function stopStatic(){
    if(state.staticSource){try{state.staticSource.stop()}catch(e){};try{state.staticSource.disconnect()}catch(e){};state.staticSource=null}
    if(state.staticGain){try{state.staticGain.disconnect()}catch(e){};state.staticGain=null}
  }

  function startStatic(){
    if(!state.playbackIntent) return;
    const ctx=ensureAudioContext();
    if(!ctx) return;
    if(ctx.state==='suspended') ctx.resume().catch(()=>{});
    stopStatic();
    const length=ctx.sampleRate*2;
    const buffer=ctx.createBuffer(1,length,ctx.sampleRate);
    const data=buffer.getChannelData(0);
    let last=0;
    for(let i=0;i<length;i++){
      const white=Math.random()*2-1;
      last=last*.92+white*.08;
      data[i]=(white*.22+last*.78)*.28;
    }
    const src=ctx.createBufferSource();src.buffer=buffer;src.loop=true;
    const filter=ctx.createBiquadFilter();filter.type='bandpass';filter.frequency.value=1250;filter.Q.value=.6;
    const gain=ctx.createGain();gain.gain.value=state.volume*.34;
    src.connect(filter).connect(gain).connect(ctx.destination);src.start();
    state.staticSource=src;state.staticGain=gain;
  }

  async function outputForCurrentStation(){
    // Station changes may alter already-requested playback, but they can never create playback intent.
    if(!state.playbackIntent){silenceAll();return}
    const st=nearestStation(state.currentFreq);
    if(st.mode==='track'){
      stopStatic();
      audio.volume=state.volume;
      try{await audio.play()}catch(e){showToast('PRESS PLAY AGAIN','The browser blocked the receiver from resuming.')}
    }else{
      audio.pause();
      startStatic();
    }
  }

  function silenceAll(){
    audio.pause();
    stopStatic();
    play.classList.remove('is-playing');
    play.setAttribute('aria-label','Play');
    document.documentElement.style.setProperty('--playGlow','0');
  }

  function setFrequency(freq,{source='manual'}={}){
    state.currentFreq=Math.round(clamp(freq,88,108)*10)/10;
    updateUI();
    // NEVER changes playbackIntent.
    if(state.playbackIntent) outputForCurrentStation();
    if(source==='ghost') showToast('THE DIAL MOVED',`${nearestStation(state.currentFreq).name} found you first.`);
  }

  function tuneToStation(st,source='manual'){setFrequency(st.freq,{source})}

  async function togglePlay(){
    if(!state.playbackIntent){
      // This is the only place in the entire file allowed to set playbackIntent=true.
      state.playbackIntent=true;
      const ctx=ensureAudioContext();if(ctx&&ctx.state==='suspended') await ctx.resume().catch(()=>{});
      play.classList.add('is-playing');play.setAttribute('aria-label','Pause');document.documentElement.style.setProperty('--playGlow','.62');
      await outputForCurrentStation();
    }else{
      state.playbackIntent=false;
      silenceAll();
    }
  }

  function stepStation(dir){
    const idx=stationIndex(state.currentFreq);
    tuneToStation(stations[(idx+dir+stations.length)%stations.length]);
  }

  function setVolume(v){
    state.volume=clamp(v,0,1);audio.volume=state.volume;if(state.staticGain)state.staticGain.gain.value=state.volume*.34;updateKnobs();
  }

  function bindHorizontalDrag(el,onDelta,onStart){
    let active=false,lastX=0;
    el.addEventListener('pointerdown',e=>{active=true;lastX=e.clientX;state.userTuning=true;el.setPointerCapture?.(e.pointerId);onStart?.();e.preventDefault()});
    el.addEventListener('pointermove',e=>{if(!active)return;const dx=e.clientX-lastX;lastX=e.clientX;onDelta(dx);e.preventDefault()});
    const stop=e=>{if(!active)return;active=false;state.userTuning=false;try{el.releasePointerCapture?.(e.pointerId)}catch(_){}};
    el.addEventListener('pointerup',stop);el.addEventListener('pointercancel',stop);
  }

  bindHorizontalDrag(tuner,dx=>setFrequency(state.currentFreq+dx*.035),()=>discover('tuner'));
  bindHorizontalDrag(tuneModule,dx=>setFrequency(state.currentFreq+dx*.035),()=>discover('tune'));
  bindHorizontalDrag(volumeModule,dx=>setVolume(state.volume+dx*.0045),()=>discover('volume'));

  tuner.addEventListener('keydown',e=>{if(e.key==='ArrowRight'||e.key==='ArrowUp'){setFrequency(state.currentFreq+.1);e.preventDefault()}if(e.key==='ArrowLeft'||e.key==='ArrowDown'){setFrequency(state.currentFreq-.1);e.preventDefault()}});
  tuneModule.addEventListener('keydown',e=>{if(e.key==='ArrowRight'||e.key==='ArrowUp'){setFrequency(state.currentFreq+.1);e.preventDefault()}if(e.key==='ArrowLeft'||e.key==='ArrowDown'){setFrequency(state.currentFreq-.1);e.preventDefault()}});
  volumeModule.addEventListener('keydown',e=>{if(e.key==='ArrowRight'||e.key==='ArrowUp'){setVolume(state.volume+.03);e.preventDefault()}if(e.key==='ArrowLeft'||e.key==='ArrowDown'){setVolume(state.volume-.03);e.preventDefault()}});

  play.addEventListener('click',togglePlay);
  $('#prev').addEventListener('click',()=>stepStation(-1));
  $('#next').addEventListener('click',()=>stepStation(1));
  $$('.preset').forEach(btn=>btn.addEventListener('click',()=>setFrequency(parseFloat(btn.dataset.frequency))));

  autoToggle.addEventListener('click',()=>{
    state.autoTune=!state.autoTune;
    autoToggle.setAttribute('aria-pressed',String(state.autoTune));
    autoToggle.setAttribute('aria-label',state.autoTune?'Turn haunted auto tune off':'Turn haunted auto tune on');
    autoText.textContent=`Haunted Auto Tune · ${state.autoTune?'On':'Off'}`;
    scheduleAutoTune(true);
  });

  function scheduleAutoTune(reset=false){
    if(reset&&state.autoTuneTimer)clearTimeout(state.autoTuneTimer);
    if(!state.autoTune){state.autoTuneTimer=null;return}
    const wait=18000+Math.random()*26000;
    state.autoTuneTimer=setTimeout(()=>{
      if(state.autoTune&&!state.userTuning&&Math.random()<.64){
        let target=stations[Math.floor(Math.random()*stations.length)];
        if(target.freq===nearestStation(state.currentFreq).freq) target=stations[(stations.indexOf(target)+1)%stations.length];
        tuneToStation(target,'auto');
      }
      scheduleAutoTune();
    },wait);
  }

  function scheduleGhost(){
    clearTimeout(state.ghostTimer);
    const wait=15000+Math.random()*25000;
    state.ghostTimer=setTimeout(()=>{
      ghost.classList.remove('visit');void ghost.offsetWidth;ghost.classList.add('visit');
      // Rule: with Auto Tune ON the ghost may appear but may NEVER change station.
      // With Auto Tune OFF it may occasionally change station, still without creating playback intent.
      if(!state.autoTune&&!state.userTuning&&Math.random()<.48){
        setTimeout(()=>{if(!state.autoTune){const st=stations[Math.floor(Math.random()*stations.length)];tuneToStation(st,'ghost')}},2500);
      }
      setTimeout(scheduleGhost,5600);
    },wait);
  }

  function tubeCrackle(){
    tube.classList.remove('tube-shock');void tube.offsetWidth;tube.classList.add('tube-shock');
    const ctx=ensureAudioContext();if(!ctx)return;if(ctx.state==='suspended')ctx.resume().catch(()=>{});
    const duration=.22,length=Math.floor(ctx.sampleRate*duration);const buffer=ctx.createBuffer(1,length,ctx.sampleRate);const d=buffer.getChannelData(0);
    for(let i=0;i<length;i++){const env=Math.pow(1-i/length,2.5);d[i]=(Math.random()*2-1)*env*(Math.random()>.92?1:.18)}
    const src=ctx.createBufferSource();src.buffer=buffer;const filter=ctx.createBiquadFilter();filter.type='highpass';filter.frequency.value=900;const gain=ctx.createGain();gain.gain.value=.28;src.connect(filter).connect(gain).connect(ctx.destination);src.start();
  }

  tube.addEventListener('click',()=>tubeCrackle());

  document.addEventListener('click',e=>{
    const target=e.target.closest('[data-discovery]');if(target)discover(target.dataset.discovery);
  });
  document.addEventListener('keydown',e=>{
    if((e.key==='Enter'||e.key===' ')&&e.target.matches('[data-discovery][role="button"]')){discover(e.target.dataset.discovery);e.preventDefault()}
  });

  // Initial state is intentionally silent.
  state.playbackIntent=false;
  silenceAll();
  updateUI();
  scheduleAutoTune();
  scheduleGhost();
})();
