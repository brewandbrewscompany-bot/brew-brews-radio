(()=>{
  'use strict';

  const stations=[
    {freq:88.3,name:'Graveyard AM'},
    {freq:91.7,name:'Dead Air'},
    {freq:95.9,name:'The Grind'},
    {freq:99.5,name:'After Dark'},
    {freq:103.1,name:'B&B Radio'},
    {freq:106.7,name:'Witching Hour'}
  ];

  const stationProfiles={
    '88.3':{label:'AGED AM TUBE',hp:180,lp:3100,peakFreq:1200,peakGain:2.8,drive:18,mediaGain:.92,hiss:.050,noiseFreq:1350,noiseQ:.72,transition:760},
    '91.7':{label:'DISTANT / FADING',hp:250,lp:3550,peakFreq:900,peakGain:-1.8,drive:10,mediaGain:.82,hiss:.070,noiseFreq:1750,noiseQ:.82,transition:920},
    '95.9':{label:'DIRTY ROAST',hp:90,lp:6500,peakFreq:820,peakGain:2.4,drive:24,mediaGain:.94,hiss:.024,noiseFreq:1200,noiseQ:.60,transition:650},
    '99.5':{label:'WARM TUBE',hp:100,lp:5200,peakFreq:980,peakGain:1.6,drive:13,mediaGain:.93,hiss:.020,noiseFreq:1100,noiseQ:.55,transition:700},
    '103.1':{label:'CLEAR MAIN SIGNAL',hp:55,lp:13000,peakFreq:1500,peakGain:.2,drive:4,mediaGain:1,hiss:.006,noiseFreq:1500,noiseQ:.50,transition:520},
    '106.7':{label:'UNSTABLE NIGHT',hp:150,lp:4700,peakFreq:1850,peakGain:3.0,drive:16,mediaGain:.88,hiss:.040,noiseFreq:2100,noiseQ:.95,transition:840}
  };

  // MASTER STATE. Nothing except explicit Play may ever set playbackIntent=true.
  const state={
    playbackIntent:false,
    currentFreq:103.1,
    activeStationFreq:103.1,
    volume:.78,
    autoTune:true,
    userTuning:false,
    discovered:new Set(),
    audioCtx:null,
    audioGraph:null,
    ghostTimer:null,
    autoTuneTimer:null,
    toastTimer:null,
    transitionTimer:null,
    transitionToken:0,
    bumperTimer:null,
    bumperToken:0,
    manifestLoaded:false,
    broadcastsLoaded:false,
    tracks:[],
    broadcasts:null,
    playlists:new Map(),
    trackIndex:new Map(),
    songCounter:new Map(),
    insertIndex:new Map(),
    currentKind:'track'
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

  function installDisplayEnhancements(){
    const well=$('#nowBrewing');
    if(!well||$('#trackPosition')) return;
    const meta=document.createElement('div');
    meta.className='display-meta';
    meta.innerHTML='<span id="trackPosition">1 / 1</span><span id="trackTime">0:00 / --:--</span>';
    const signal=document.createElement('div');
    signal.className='display-signal-row';
    signal.innerHTML='<span id="stationProfile">CLEAR MAIN SIGNAL</span><span id="broadcastState">STANDBY</span>';
    well.append(meta,signal);
  }
  installDisplayEnhancements();

  const trackPosition=$('#trackPosition');
  const trackTime=$('#trackTime');
  const stationProfile=$('#stationProfile');
  const broadcastState=$('#broadcastState');

  audio.volume=state.volume;
  audio.loop=false;
  audio.pause();
  $('#prev').setAttribute('aria-label','Previous song');
  $('#next').setAttribute('aria-label','Next song');

  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const nearestStation=f=>stations.reduce((best,s)=>Math.abs(s.freq-f)<Math.abs(best.freq-f)?s:best,stations[0]);
  const freqPct=f=>clamp((f-88)/(108-88),0,1);
  const freqAngle=f=>-135+freqPct(f)*270;
  const keyFor=f=>Number(f).toFixed(1);
  const profileFor=f=>stationProfiles[keyFor(nearestStation(f).freq)]||stationProfiles['103.1'];

  function formatTime(seconds){
    if(!Number.isFinite(seconds)||seconds<0) return '--:--';
    const m=Math.floor(seconds/60);
    const s=Math.floor(seconds%60).toString().padStart(2,'0');
    return `${m}:${s}`;
  }

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
      display:['NOW BREWING','The receiver is pulling a real track from this frequency.'],
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

  function playlistFor(freq){
    return state.playlists.get(keyFor(freq))||[];
  }

  function currentTrackFor(freq=nearestStation(state.currentFreq).freq){
    const list=playlistFor(freq);
    if(!list.length) return null;
    const key=keyFor(freq);
    const idx=clamp(state.trackIndex.get(key)??0,0,list.length-1);
    state.trackIndex.set(key,idx);
    return list[idx];
  }

  function updateTimeDisplay(){
    if(!trackTime) return;
    if(state.currentKind!=='track') return;
    trackTime.textContent=`${formatTime(audio.currentTime)} / ${formatTime(audio.duration)}`;
  }

  function setBroadcastStatus(text){
    if(broadcastState) broadcastState.textContent=text;
  }

  function updateNowBrewing(st=nearestStation(state.currentFreq)){
    const list=playlistFor(st.freq);
    const track=currentTrackFor(st.freq);
    if(track){
      const idx=state.trackIndex.get(keyFor(st.freq))??0;
      liveTrack.textContent=track.title;
      liveStation.textContent=`${st.name} · ${st.freq.toFixed(1)}`;
      if(trackPosition) trackPosition.textContent=`${idx+1} / ${list.length}`;
      if(stationProfile) stationProfile.textContent=profileFor(st.freq).label;
      state.currentKind='track';
      setBroadcastStatus(state.playbackIntent?'ON AIR':'STANDBY');
      updateTimeDisplay();
    }else{
      liveTrack.textContent=st.name.toUpperCase();
      liveStation.textContent=`${st.freq.toFixed(1)} · SIGNAL SEARCH`;
      if(trackPosition) trackPosition.textContent='0 / 0';
      if(trackTime) trackTime.textContent='--:--';
      if(stationProfile) stationProfile.textContent=profileFor(st.freq).label;
      setBroadcastStatus('NO RECORD');
    }
  }

  function showTransitionDisplay(st){
    state.currentKind='transition';
    liveTrack.textContent='TUNING...';
    liveStation.textContent=`Seeking ${st.freq.toFixed(1)} · ${st.name}`;
    if(trackPosition) trackPosition.textContent='SIGNAL';
    if(trackTime) trackTime.textContent='---';
    if(stationProfile) stationProfile.textContent=profileFor(st.freq).label;
    setBroadcastStatus('TUNING');
  }

  function showBumperDisplay(bumper,st){
    state.currentKind='bumper';
    liveTrack.textContent=bumper.title||st.name.toUpperCase();
    liveStation.textContent=bumper.text||`${st.name} · ${st.freq.toFixed(1)}`;
    if(trackPosition) trackPosition.textContent='STATION ID';
    if(trackTime) trackTime.textContent='1.2s';
    if(stationProfile) stationProfile.textContent=profileFor(st.freq).label;
    setBroadcastStatus('SIGNAL ID');
  }

  function showInsertDisplay(insert,st){
    state.currentKind='insert';
    liveTrack.textContent=(insert.title||insert.id||'BROADCAST BREAK').toUpperCase();
    liveStation.textContent=`${st.name} · ${st.freq.toFixed(1)} · BROADCAST BREAK`;
    if(trackPosition) trackPosition.textContent='INSERT';
    if(trackTime) trackTime.textContent='0:00 / --:--';
    if(stationProfile) stationProfile.textContent=profileFor(st.freq).label;
    setBroadcastStatus('ON AIR');
  }

  function updateUI(){
    const p=7+freqPct(state.currentFreq)*86;
    needle.style.left=`${p}%`;
    tuner.setAttribute('aria-valuenow',state.currentFreq.toFixed(1));
    const st=nearestStation(state.currentFreq);
    readout.innerHTML=`<strong>${state.currentFreq.toFixed(1)}</strong> ${st.name.toUpperCase()}`;
    $$('.preset').forEach(b=>b.classList.toggle('active',Math.abs(parseFloat(b.dataset.frequency)-st.freq)<.01));
    $$('[data-station-tag]').forEach(t=>t.classList.toggle('active',Math.abs(parseFloat(t.dataset.stationTag)-st.freq)<.01));
    if(state.currentKind!=='transition'&&state.currentKind!=='bumper'&&state.currentKind!=='insert') updateNowBrewing(st);
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

  function driveCurve(amount=0){
    const n=512;
    const curve=new Float32Array(n);
    const drive=1+amount/9;
    const norm=Math.tanh(drive)||1;
    for(let i=0;i<n;i++){
      const x=i*2/(n-1)-1;
      curve[i]=Math.tanh(x*drive)/norm;
    }
    return curve;
  }

  function ensureAudioGraph(){
    if(state.audioGraph) return state.audioGraph;
    const ctx=ensureAudioContext();
    if(!ctx) return null;
    try{
      const source=ctx.createMediaElementSource(audio);
      const highpass=ctx.createBiquadFilter(); highpass.type='highpass';
      const lowpass=ctx.createBiquadFilter(); lowpass.type='lowpass';
      const peak=ctx.createBiquadFilter(); peak.type='peaking'; peak.Q.value=.75;
      const shaper=ctx.createWaveShaper(); shaper.oversample='2x';
      const mediaGain=ctx.createGain();
      const masterGain=ctx.createGain(); masterGain.gain.value=state.volume;
      source.connect(highpass).connect(lowpass).connect(peak).connect(shaper).connect(mediaGain).connect(masterGain).connect(ctx.destination);

      const length=ctx.sampleRate*2;
      const buffer=ctx.createBuffer(1,length,ctx.sampleRate);
      const data=buffer.getChannelData(0);
      let last=0;
      for(let i=0;i<length;i++){
        const white=Math.random()*2-1;
        last=last*.89+white*.11;
        data[i]=white*.42+last*.58;
      }
      const noiseSource=ctx.createBufferSource();
      noiseSource.buffer=buffer; noiseSource.loop=true;
      const noiseFilter=ctx.createBiquadFilter(); noiseFilter.type='bandpass';
      const noiseGain=ctx.createGain(); noiseGain.gain.value=0;
      noiseSource.connect(noiseFilter).connect(noiseGain).connect(masterGain);
      noiseSource.start();

      state.audioGraph={source,highpass,lowpass,peak,shaper,mediaGain,masterGain,noiseSource,noiseFilter,noiseGain};
      audio.volume=1;
      return state.audioGraph;
    }catch(err){
      state.audioGraph={fallback:true};
      audio.volume=state.volume;
      return state.audioGraph;
    }
  }

  function setBedNoise(value){
    const g=state.audioGraph;
    if(!g||g.fallback||!g.noiseGain) return;
    const now=state.audioCtx.currentTime;
    g.noiseGain.gain.cancelScheduledValues(now);
    g.noiseGain.gain.setTargetAtTime(Math.max(0,value),now,.035);
  }

  function applyStationProfile(st=nearestStation(state.currentFreq)){
    const p=profileFor(st.freq);
    if(stationProfile) stationProfile.textContent=p.label;
    const g=state.audioGraph;
    if(!g||g.fallback) return;
    const ctx=state.audioCtx;
    const now=ctx.currentTime;
    g.highpass.frequency.setTargetAtTime(p.hp,now,.03);
    g.lowpass.frequency.setTargetAtTime(p.lp,now,.03);
    g.peak.frequency.setTargetAtTime(p.peakFreq,now,.03);
    g.peak.gain.setTargetAtTime(p.peakGain,now,.03);
    g.mediaGain.gain.setTargetAtTime(p.mediaGain,now,.03);
    g.noiseFilter.frequency.setTargetAtTime(p.noiseFreq,now,.04);
    g.noiseFilter.Q.setTargetAtTime(p.noiseQ,now,.04);
    g.shaper.curve=driveCurve(p.drive);
    setBedNoise(state.playbackIntent&&state.currentKind==='track'?p.hiss:0);
  }

  function playTuningBurst(durationMs=700){
    if(!state.playbackIntent) return;
    const ctx=ensureAudioContext();
    if(!ctx) return;
    if(ctx.state==='suspended') ctx.resume().catch(()=>{});
    const duration=Math.max(.18,durationMs/1000);
    const length=Math.floor(ctx.sampleRate*duration);
    const buffer=ctx.createBuffer(1,length,ctx.sampleRate);
    const d=buffer.getChannelData(0);
    let last=0;
    for(let i=0;i<length;i++){
      const white=Math.random()*2-1;
      last=last*.84+white*.16;
      const env=Math.sin(Math.PI*i/length);
      d[i]=(white*.6+last*.4)*env;
    }
    const src=ctx.createBufferSource(); src.buffer=buffer;
    const filter=ctx.createBiquadFilter(); filter.type='bandpass'; filter.Q.value=.65;
    filter.frequency.setValueAtTime(650,ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(4200,ctx.currentTime+duration*.72);
    filter.frequency.exponentialRampToValueAtTime(1200,ctx.currentTime+duration);
    const gain=ctx.createGain();
    const max=state.audioGraph&&!state.audioGraph.fallback?.16:.16*state.volume;
    gain.gain.setValueAtTime(.001,ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(Math.max(.006,max),ctx.currentTime+duration*.15);
    gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+duration);
    const destination=state.audioGraph&&!state.audioGraph.fallback?state.audioGraph.masterGain:ctx.destination;
    src.connect(filter).connect(gain).connect(destination);
    src.start(); src.stop(ctx.currentTime+duration+.03);

    const osc=ctx.createOscillator();
    const og=ctx.createGain();
    osc.type='sine';
    osc.frequency.setValueAtTime(1780,ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(720,ctx.currentTime+duration);
    og.gain.setValueAtTime(.0001,ctx.currentTime);
    og.gain.exponentialRampToValueAtTime(state.audioGraph&&!state.audioGraph.fallback?.018:.018*state.volume,ctx.currentTime+duration*.18);
    og.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+duration*.88);
    osc.connect(og).connect(destination);
    osc.start(); osc.stop(ctx.currentTime+duration);
  }

  function cancelTransientTimers(){
    if(state.transitionTimer) clearTimeout(state.transitionTimer);
    if(state.bumperTimer) clearTimeout(state.bumperTimer);
    state.transitionTimer=null;
    state.bumperTimer=null;
    state.transitionToken++;
    state.bumperToken++;
  }

  function silenceAll(){
    audio.pause();
    setBedNoise(0);
    cancelTransientTimers();
    play.classList.remove('is-playing');
    play.setAttribute('aria-label','Play');
    document.documentElement.style.setProperty('--playGlow','0');
    setBroadcastStatus('STANDBY');
  }

  function setAudioItem(item,kind='track'){
    if(!item||!item.file) return false;
    const itemId=`${kind}:${item.id||item.file}`;
    if(audio.dataset.itemId===itemId) return false;
    audio.pause();
    audio.src=item.file;
    audio.dataset.itemId=itemId;
    audio.dataset.kind=kind;
    audio.load();
    return true;
  }

  async function outputForCurrentStation({restart=false}={}){
    if(!state.playbackIntent){silenceAll();return}
    const st=nearestStation(state.currentFreq);
    const track=currentTrackFor(st.freq);
    if(!track){
      audio.pause();
      setBedNoise(0);
      showToast('NO RECORD ON THIS FREQUENCY','This station has no uploaded track yet.');
      setBroadcastStatus('NO RECORD');
      return;
    }
    state.currentKind='track';
    ensureAudioGraph();
    applyStationProfile(st);
    const changed=setAudioItem(track,'track');
    if(restart&&!changed) audio.currentTime=0;
    if(state.audioGraph&&state.audioGraph.fallback) audio.volume=state.volume;
    try{
      await audio.play();
      play.classList.add('is-playing');
      play.setAttribute('aria-label','Pause');
      document.documentElement.style.setProperty('--playGlow','.62');
      updateNowBrewing(st);
      applyStationProfile(st);
    }catch(e){
      audio.pause();
      setBedNoise(0);
      showToast('PRESS PLAY AGAIN','The browser blocked the receiver from resuming.');
      play.classList.remove('is-playing');
      play.setAttribute('aria-label','Play');
      document.documentElement.style.setProperty('--playGlow','0');
    }
  }

  function beginStationTransition(st){
    if(!state.playbackIntent) return;
    if(state.transitionTimer) clearTimeout(state.transitionTimer);
    const token=++state.transitionToken;
    state.currentKind='transition';
    audio.pause();
    setBedNoise(0);
    showTransitionDisplay(st);
    const duration=profileFor(st.freq).transition;
    playTuningBurst(duration);
    state.transitionTimer=setTimeout(()=>{
      if(token!==state.transitionToken||!state.playbackIntent) return;
      if(Math.abs(nearestStation(state.currentFreq).freq-st.freq)>.01) return;
      state.transitionTimer=null;
      const track=currentTrackFor(st.freq);
      if(track) setAudioItem(track,'track');
      state.currentKind='track';
      applyStationProfile(st);
      outputForCurrentStation({restart:true});
    },duration+80);
  }

  function selectTrack(freq,index,{restart=false,announce=false}={}){
    cancelTransientTimers();
    const list=playlistFor(freq);
    if(!list.length) return;
    const key=keyFor(freq);
    const wrapped=(index%list.length+list.length)%list.length;
    state.trackIndex.set(key,wrapped);
    const st=nearestStation(freq);
    if(Math.abs(st.freq-nearestStation(state.currentFreq).freq)<.01){
      const track=list[wrapped];
      state.currentKind='track';
      setAudioItem(track,'track');
      updateNowBrewing(st);
      if(announce) showToast(track.title,`${st.name} · ${st.freq.toFixed(1)}`);
      if(state.playbackIntent) outputForCurrentStation({restart});
    }
  }

  function stepTrack(dir,{automatic=false}={}){
    const st=nearestStation(state.currentFreq);
    const list=playlistFor(st.freq);
    if(!list.length) return;
    const key=keyFor(st.freq);
    const idx=state.trackIndex.get(key)??0;
    selectTrack(st.freq,idx+dir,{restart:true,announce:!automatic});
  }

  function setFrequency(freq,{source='manual'}={}){
    const previousStation=nearestStation(state.currentFreq);
    state.currentFreq=Math.round(clamp(freq,88,108)*10)/10;
    const nextStation=nearestStation(state.currentFreq);
    const stationChanged=Math.abs(previousStation.freq-nextStation.freq)>.01;
    state.activeStationFreq=nextStation.freq;

    if(stationChanged){
      const track=currentTrackFor(nextStation.freq);
      if(track&&!state.playbackIntent) setAudioItem(track,'track');
      state.currentKind=state.playbackIntent?'transition':'track';
    }
    updateUI();

    // NEVER changes playbackIntent.
    if(stationChanged&&state.playbackIntent) beginStationTransition(nextStation);
    if(stationChanged&&!state.playbackIntent) updateNowBrewing(nextStation);
    if(source==='ghost') showToast('THE DIAL MOVED',`${nextStation.name} found you first.`);
  }

  function tuneToStation(st,source='manual'){setFrequency(st.freq,{source})}

  async function togglePlay(){
    if(!state.playbackIntent){
      // This is the only place in the entire file allowed to set playbackIntent=true.
      state.playbackIntent=true;
      const ctx=ensureAudioContext();
      if(ctx&&ctx.state==='suspended') await ctx.resume().catch(()=>{});
      ensureAudioGraph();
      applyStationProfile(nearestStation(state.currentFreq));
      await outputForCurrentStation();
    }else{
      state.playbackIntent=false;
      silenceAll();
      updateNowBrewing(nearestStation(state.currentFreq));
    }
  }

  function setVolume(v){
    state.volume=clamp(v,0,1);
    if(state.audioGraph&&!state.audioGraph.fallback){
      const now=state.audioCtx.currentTime;
      state.audioGraph.masterGain.gain.setTargetAtTime(state.volume,now,.025);
    }else{
      audio.volume=state.volume;
    }
    updateKnobs();
  }

  function bindHorizontalDrag(el,onDelta,onStart){
    let active=false,lastX=0;
    el.addEventListener('pointerdown',e=>{
      active=true;lastX=e.clientX;state.userTuning=true;
      el.setPointerCapture?.(e.pointerId);onStart?.();e.preventDefault();
    });
    el.addEventListener('pointermove',e=>{
      if(!active)return;
      const dx=e.clientX-lastX;lastX=e.clientX;onDelta(dx);e.preventDefault();
    });
    const stop=e=>{
      if(!active)return;
      active=false;state.userTuning=false;
      try{el.releasePointerCapture?.(e.pointerId)}catch(_){}
    };
    el.addEventListener('pointerup',stop);
    el.addEventListener('pointercancel',stop);
  }

  bindHorizontalDrag(tuner,dx=>setFrequency(state.currentFreq+dx*.035),()=>discover('tuner'));
  bindHorizontalDrag(tuneModule,dx=>setFrequency(state.currentFreq+dx*.035),()=>discover('tune'));
  bindHorizontalDrag(volumeModule,dx=>setVolume(state.volume+dx*.0045),()=>discover('volume'));

  tuner.addEventListener('keydown',e=>{
    if(e.key==='ArrowRight'||e.key==='ArrowUp'){setFrequency(state.currentFreq+.1);e.preventDefault()}
    if(e.key==='ArrowLeft'||e.key==='ArrowDown'){setFrequency(state.currentFreq-.1);e.preventDefault()}
  });
  tuneModule.addEventListener('keydown',e=>{
    if(e.key==='ArrowRight'||e.key==='ArrowUp'){setFrequency(state.currentFreq+.1);e.preventDefault()}
    if(e.key==='ArrowLeft'||e.key==='ArrowDown'){setFrequency(state.currentFreq-.1);e.preventDefault()}
  });
  volumeModule.addEventListener('keydown',e=>{
    if(e.key==='ArrowRight'||e.key==='ArrowUp'){setVolume(state.volume+.03);e.preventDefault()}
    if(e.key==='ArrowLeft'||e.key==='ArrowDown'){setVolume(state.volume-.03);e.preventDefault()}
  });

  play.addEventListener('click',togglePlay);
  $('#prev').addEventListener('click',()=>stepTrack(-1));
  $('#next').addEventListener('click',()=>stepTrack(1));
  $$('.preset').forEach(btn=>btn.addEventListener('click',()=>setFrequency(parseFloat(btn.dataset.frequency))));

  function enabledAudioInsertsFor(freq){
    const inserts=state.broadcasts?.plannedAudioInserts;
    if(!Array.isArray(inserts)) return [];
    return inserts.filter(i=>i.enabled===true&&i.file&&Number(i.station)===Number(freq));
  }

  function nextAudioInsert(freq){
    const list=enabledAudioInsertsFor(freq);
    if(!list.length) return null;
    const key=keyFor(freq);
    const idx=state.insertIndex.get(key)??0;
    state.insertIndex.set(key,(idx+1)%list.length);
    return list[idx%list.length];
  }

  async function playAudioInsert(insert,st){
    if(!state.playbackIntent||!insert?.file) return false;
    cancelTransientTimers();
    state.currentKind='insert';
    setBedNoise(0);
    setAudioItem(insert,'insert');
    showInsertDisplay(insert,st);
    applyStationProfile(st);
    try{
      await audio.play();
      return true;
    }catch(e){
      return false;
    }
  }

  function playSignalBumper(bumper,st){
    if(!state.playbackIntent){return}
    if(state.bumperTimer) clearTimeout(state.bumperTimer);
    const token=++state.bumperToken;
    audio.pause();
    setBedNoise(0);
    showBumperDisplay(bumper,st);
    playTuningBurst(900);
    state.bumperTimer=setTimeout(()=>{
      if(token!==state.bumperToken||!state.playbackIntent) return;
      state.bumperTimer=null;
      stepTrack(1,{automatic:true});
    },1220);
  }

  function handleTrackEnded(){
    if(!state.playbackIntent) return;
    const st=nearestStation(state.currentFreq);
    if(state.currentKind==='insert'){
      stepTrack(1,{automatic:true});
      return;
    }
    if(state.currentKind!=='track') return;

    const key=keyFor(st.freq);
    const count=(state.songCounter.get(key)??0)+1;
    state.songCounter.set(key,count);
    const bumper=state.broadcasts?.stationBumpers?.[key];
    const every=Math.max(1,Number(bumper?.every)||0);
    const due=Boolean(bumper)&&every>0&&count%every===0;

    if(due){
      const insert=nextAudioInsert(st.freq);
      if(insert){
        playAudioInsert(insert,st).then(ok=>{if(!ok&&state.playbackIntent) playSignalBumper(bumper,st)});
      }else{
        playSignalBumper(bumper,st);
      }
    }else{
      stepTrack(1,{automatic:true});
    }
  }

  audio.addEventListener('ended',handleTrackEnded);
  audio.addEventListener('timeupdate',updateTimeDisplay);
  audio.addEventListener('loadedmetadata',updateTimeDisplay);
  audio.addEventListener('error',()=>{
    if(!state.playbackIntent) return;
    if(state.currentKind==='insert'){
      showToast('INSERT SIGNAL LOST','The broadcast insert file could not be loaded.');
      stepTrack(1,{automatic:true});
      return;
    }
    const track=currentTrackFor();
    showToast('SIGNAL LOST',track?`${track.title} could not be loaded.`:'The selected track could not be loaded.');
  });

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
        if(target.freq===nearestStation(state.currentFreq).freq){
          target=stations[(stations.indexOf(target)+1)%stations.length];
        }
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
      // Auto Tune ON: ghost may appear but may never change station.
      // Auto Tune OFF: ghost may occasionally change station, still without creating playback intent.
      if(!state.autoTune&&!state.userTuning&&Math.random()<.48){
        setTimeout(()=>{
          if(!state.autoTune){
            const st=stations[Math.floor(Math.random()*stations.length)];
            tuneToStation(st,'ghost');
          }
        },2500);
      }
      setTimeout(scheduleGhost,5600);
    },wait);
  }

  function tubeCrackle(){
    tube.classList.remove('tube-shock');void tube.offsetWidth;tube.classList.add('tube-shock');
    const ctx=ensureAudioContext();
    if(!ctx)return;
    if(ctx.state==='suspended')ctx.resume().catch(()=>{});
    const duration=.22;
    const length=Math.floor(ctx.sampleRate*duration);
    const buffer=ctx.createBuffer(1,length,ctx.sampleRate);
    const d=buffer.getChannelData(0);
    for(let i=0;i<length;i++){
      const env=Math.pow(1-i/length,2.5);
      d[i]=(Math.random()*2-1)*env*(Math.random()>.92?1:.18);
    }
    const src=ctx.createBufferSource();src.buffer=buffer;
    const filter=ctx.createBiquadFilter();filter.type='highpass';filter.frequency.value=900;
    const gain=ctx.createGain();gain.gain.value=.28;
    src.connect(filter).connect(gain).connect(ctx.destination);src.start();
  }

  tube.addEventListener('click',tubeCrackle);

  document.addEventListener('click',e=>{
    const target=e.target.closest('[data-discovery]');
    if(target)discover(target.dataset.discovery);
  });
  document.addEventListener('keydown',e=>{
    if((e.key==='Enter'||e.key===' ')&&e.target.matches('[data-discovery][role="button"]')){
      discover(e.target.dataset.discovery);e.preventDefault();
    }
  });

  async function loadManifest(){
    try{
      const res=await fetch('data/tracks.json',{cache:'no-store'});
      if(!res.ok) throw new Error(`HTTP ${res.status}`);
      const manifest=await res.json();
      state.tracks=Array.isArray(manifest.tracks)?manifest.tracks:[];
      state.playlists.clear();
      state.trackIndex.clear();
      state.songCounter.clear();

      for(const st of stations){
        const list=state.tracks
          .filter(t=>Number(t.station)===st.freq)
          .sort((a,b)=>(a.order??999)-(b.order??999));
        state.playlists.set(keyFor(st.freq),list);
        state.trackIndex.set(keyFor(st.freq),0);
        state.songCounter.set(keyFor(st.freq),0);
      }

      const defaultTrack=state.tracks.find(t=>t.status==='current-default')||
        playlistFor(manifest.defaultStation??103.1)[0]||
        state.tracks[0]||null;

      if(defaultTrack){
        const st=nearestStation(Number(defaultTrack.station)||103.1);
        state.currentFreq=st.freq;
        state.activeStationFreq=st.freq;
        const list=playlistFor(st.freq);
        const idx=Math.max(0,list.findIndex(t=>t.id===defaultTrack.id));
        state.trackIndex.set(keyFor(st.freq),idx);
        setAudioItem(defaultTrack,'track');
      }

      state.manifestLoaded=true;
      state.currentKind='track';
      updateUI();
    }catch(err){
      state.manifestLoaded=false;
      state.playlists.set(keyFor(103.1),[{
        id:'ironclad',title:'IRONCLAD',file:'audio/ironclad.mp3',station:103.1,order:1
      }]);
      state.trackIndex.set(keyFor(103.1),0);
      setAudioItem(currentTrackFor(103.1),'track');
      state.currentKind='track';
      updateUI();
      showToast('PLAYLIST FALLBACK','The manifest could not be loaded, so 103.1 is using IRONCLAD.');
    }
  }

  async function loadBroadcasts(){
    try{
      const res=await fetch('data/broadcasts.json',{cache:'no-store'});
      if(!res.ok) throw new Error(`HTTP ${res.status}`);
      state.broadcasts=await res.json();
      state.broadcastsLoaded=true;
    }catch(err){
      state.broadcasts=null;
      state.broadcastsLoaded=false;
    }
  }

  // Initial state is intentionally silent.
  state.playbackIntent=false;
  silenceAll();
  state.currentKind='track';
  updateUI();
  Promise.allSettled([loadManifest(),loadBroadcasts()]).then(()=>updateUI());
  scheduleAutoTune();
  scheduleGhost();
})();
