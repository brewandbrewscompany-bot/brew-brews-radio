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

  // MASTER STATE. Nothing except explicit Play may ever set playbackIntent true.
  const state={
    playbackIntent:false,
    currentFreq:103.1,
    activeStationFreq:103.1,
    volume:.78,
    autoTune:true,
    userTuning:false,
    discovered:new Set(),
    audioCtx:null,
    ghostTimer:null,
    autoTuneTimer:null,
    toastTimer:null,
    manifestLoaded:false,
    tracks:[],
    playlists:new Map(),
    trackIndex:new Map()
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
  audio.loop=false;
  audio.pause();
  $('#prev').setAttribute('aria-label','Previous song');
  $('#next').setAttribute('aria-label','Next song');

  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const nearestStation=f=>stations.reduce((best,s)=>Math.abs(s.freq-f)<Math.abs(best.freq-f)?s:best,stations[0]);
  const stationIndex=f=>stations.indexOf(nearestStation(f));
  const freqPct=f=>clamp((f-88)/(108-88),0,1);
  const freqAngle=f=>-135+freqPct(f)*270;
  const keyFor=f=>Number(f).toFixed(1);

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

  function updateNowBrewing(st=nearestStation(state.currentFreq)){
    const track=currentTrackFor(st.freq);
    if(track){
      liveTrack.textContent=track.title;
      liveStation.textContent=`${st.name} · ${st.freq.toFixed(1)}`;
    }else{
      liveTrack.textContent=st.name.toUpperCase();
      liveStation.textContent=`${st.freq.toFixed(1)} · SIGNAL SEARCH`;
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

  function silenceAll(){
    audio.pause();
    play.classList.remove('is-playing');
    play.setAttribute('aria-label','Play');
    document.documentElement.style.setProperty('--playGlow','0');
  }

  function setAudioTrack(track){
    if(!track) return false;
    if(audio.dataset.trackId===track.id) return false;
    audio.pause();
    audio.src=track.file;
    audio.dataset.trackId=track.id;
    audio.load();
    return true;
  }

  async function outputForCurrentStation({restart=false}={}){
    // Station/track changes may alter already-requested playback, but they can never create playback intent.
    if(!state.playbackIntent){silenceAll();return}
    const st=nearestStation(state.currentFreq);
    const track=currentTrackFor(st.freq);
    if(!track){
      silenceAll();
      showToast('NO RECORD ON THIS FREQUENCY','This station has no uploaded track yet.');
      return;
    }
    const changed=setAudioTrack(track);
    if(restart&&!changed) audio.currentTime=0;
    audio.volume=state.volume;
    try{
      await audio.play();
      play.classList.add('is-playing');
      play.setAttribute('aria-label','Pause');
      document.documentElement.style.setProperty('--playGlow','.62');
    }catch(e){
      silenceAll();
      showToast('PRESS PLAY AGAIN','The browser blocked the receiver from resuming.');
    }
  }

  function selectTrack(freq,index,{restart=false,announce=false}={}){
    const list=playlistFor(freq);
    if(!list.length) return;
    const key=keyFor(freq);
    const wrapped=(index%list.length+list.length)%list.length;
    state.trackIndex.set(key,wrapped);
    const st=nearestStation(freq);
    if(Math.abs(st.freq-nearestStation(state.currentFreq).freq)<.01){
      const track=list[wrapped];
      setAudioTrack(track);
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
    updateUI();

    // NEVER changes playbackIntent.
    if(stationChanged){
      const track=currentTrackFor(nextStation.freq);
      if(track) setAudioTrack(track);
      if(state.playbackIntent) outputForCurrentStation();
    }
    if(source==='ghost') showToast('THE DIAL MOVED',`${nextStation.name} found you first.`);
  }

  function tuneToStation(st,source='manual'){setFrequency(st.freq,{source})}

  async function togglePlay(){
    if(!state.playbackIntent){
      // This is the only place in the entire file allowed to set playbackIntent=true.
      state.playbackIntent=true;
      const ctx=ensureAudioContext();
      if(ctx&&ctx.state==='suspended') await ctx.resume().catch(()=>{});
      await outputForCurrentStation();
    }else{
      state.playbackIntent=false;
      silenceAll();
    }
  }

  function setVolume(v){
    state.volume=clamp(v,0,1);
    audio.volume=state.volume;
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

  audio.addEventListener('ended',()=>{
    // Natural continuation is allowed only because playback intent already exists.
    if(state.playbackIntent) stepTrack(1,{automatic:true});
  });

  audio.addEventListener('error',()=>{
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
      // Rule: with Auto Tune ON the ghost may appear but may NEVER change station.
      // With Auto Tune OFF it may occasionally change station, still without creating playback intent.
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
    const src=ctx.createBufferSource();
    src.buffer=buffer;
    const filter=ctx.createBiquadFilter();
    filter.type='highpass';filter.frequency.value=900;
    const gain=ctx.createGain();gain.gain.value=.28;
    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start();
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

      for(const st of stations){
        const list=state.tracks
          .filter(t=>Number(t.station)===st.freq)
          .sort((a,b)=>(a.order??999)-(b.order??999));
        state.playlists.set(keyFor(st.freq),list);
        state.trackIndex.set(keyFor(st.freq),0);
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
        setAudioTrack(defaultTrack);
      }

      state.manifestLoaded=true;
      updateUI();
    }catch(err){
      state.manifestLoaded=false;
      state.playlists.set(keyFor(103.1),[{
        id:'ironclad',
        title:'IRONCLAD',
        file:'audio/ironclad.mp3',
        station:103.1,
        order:1
      }]);
      state.trackIndex.set(keyFor(103.1),0);
      setAudioTrack(currentTrackFor(103.1));
      updateUI();
      showToast('PLAYLIST FALLBACK','The manifest could not be loaded, so 103.1 is using IRONCLAD.');
    }
  }

  // Initial state is intentionally silent.
  state.playbackIntent=false;
  silenceAll();
  updateUI();
  loadManifest();
  scheduleAutoTune();
  scheduleGhost();
})();
