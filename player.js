(()=>{
  'use strict';
  const tracks=Array.isArray(window.BB_PLAYLIST)?window.BB_PLAYLIST:[];
  if(!tracks.length) return;

  const $=id=>document.getElementById(id);
  const audio=$('audio');
  const els={
    play:$('playBtn'),playLabel:$('playLabel'),playIcon:$('playIcon'),prev:$('prevBtn'),next:$('nextBtn'),
    title:$('trackTitle'),stationMeta:$('stationMeta'),time:$('timeText'),progress:$('progress'),onAir:$('onAir'),
    volume:$('volumeRange'),volumeKnob:$('volumeKnob'),volumeValue:$('volumeValue'),
    tune:$('tuneRange'),tuner:$('tunerRange'),tuneKnob:$('tuneKnob'),freqValue:$('frequencyValue'),needle:$('tunerNeedle'),
    stationName:$('stationName'),stationLocation:$('stationLocation'),meter:$('meterNeedle'),artwork:$('trackArtwork'),hint:$('stationHint')
  };

  const allTrackIds=tracks.map(track=>track.id);
  const STATIONS=[
    {
      id:'morning',frequency:91.7,name:'Morning Roast 91.7',shortName:'Morning Roast',location:'LOUISBURG, KS',
      trackIds:['love-in-every-brew','one-cup-at-a-time','brazilian-hangover','the-roasters-window','rain-on-main-street','take-the-long-way','until-tomorrow']
    },
    {
      id:'roastery',frequency:101.7,name:'Roastery 101.7',shortName:'Roastery Radio',location:'LOUISBURG, KS',
      trackIds:['heres-to-the-regulars','thats-our-house','brew-&-brews-radio','first-crack','no-label','VOODOO']
    },
    {
      id:'regular',frequency:103.1,name:'B&B 103.1',shortName:'Regular',location:'LOUISBURG, KS',trackIds:allTrackIds
    },
    {
      id:'after-hours',frequency:106.5,name:'After Hours 106.5',shortName:'After Hours',location:'LOUISBURG, KS',
      trackIds:['midnight-in-the-cafe','roastery-after-hours','rain-on-the-roastery','fireside-espresso','before-the-first-cup']
    }
  ];
  const stationById=new Map(STATIONS.map(station=>[station.id,station]));
  const trackIndexById=new Map(tracks.map((track,index)=>[track.id,index]));
  const stationIndexes=station=>station.trackIds.map(id=>trackIndexById.get(id)).filter(index=>Number.isInteger(index));
  const state={playbackIntent:false,playing:false,trackIndex:0,stationId:'regular',frequency:103.1,volume:.72,hasUserStarted:false};

  const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
  const formatTime=seconds=>{
    if(!Number.isFinite(seconds)||seconds<0) return '0:00';
    const minutes=Math.floor(seconds/60);
    const remaining=Math.floor(seconds%60);
    return `${minutes}:${String(remaining).padStart(2,'0')}`;
  };
  const currentStation=()=>stationById.get(state.stationId)||stationById.get('regular');
  const nearestStation=frequency=>STATIONS.reduce((best,station)=>{
    const delta=Math.abs(station.frequency-frequency);
    return !best||delta<best.delta?{station,delta}:best;
  },null);

  function setPressed(button){
    if(!button) return;
    button.classList.add('is-pressed');
    setTimeout(()=>button.classList.remove('is-pressed'),110);
  }

  function renderPresets(){
    document.querySelectorAll('.station-preset').forEach(button=>{
      const active=button.dataset.station===state.stationId&&Math.abs(Number(button.dataset.frequency)-state.frequency)<=.25;
      button.classList.toggle('is-active',active);
      if(active) button.setAttribute('aria-current','true');
      else button.removeAttribute('aria-current');
    });
  }

  function renderPlayback(){
    state.playing=!audio.paused&&!audio.ended;
    els.play.classList.toggle('is-playing',state.playing);
    els.play.setAttribute('aria-pressed',String(state.playing));
    els.play.setAttribute('aria-label',state.playing?'Pause':'Play');
    els.playLabel.textContent=state.playing?'PAUSE':'PLAY';
    els.playIcon.textContent=state.playing?'Ⅱ':'▶';
    els.onAir.classList.toggle('is-playing',state.playing);
    els.onAir.querySelector('span').textContent=state.playing?'ON AIR':'READY';
    document.querySelector('.tube')?.classList.toggle('is-playing',state.playing);
    if(els.hint){
      els.hint.textContent=state.playing
        ? `ON AIR · ${currentStation().shortName} · ${currentStation().frequency.toFixed(1)} FM`
        : 'Press PLAY to begin. Tuning and station presets never start audio by themselves.';
    }
  }

  function renderArtwork(){
    if(!els.artwork) return;
    const track=tracks[state.trackIndex];
    if(!state.hasUserStarted||!track?.cover){
      els.artwork.hidden=true;
      els.artwork.removeAttribute('src');
      els.artwork.alt='';
      return;
    }
    const encoded=encodeURI(track.cover);
    if(els.artwork.getAttribute('src')!==encoded) els.artwork.src=encoded;
    els.artwork.alt=`${track.title} artwork`;
    els.artwork.hidden=false;
  }

  function renderTrack(){
    const track=tracks[state.trackIndex];
    const station=currentStation();
    els.title.textContent=track.title;
    els.stationMeta.textContent=`${station.shortName} · ${station.frequency.toFixed(1)} FM`;
    document.title=`${track.title} · Brew & Brews Radio`;
    renderArtwork();
    if('mediaSession' in navigator){
      try{
        const metadata={title:track.title,artist:track.artist||'Brew & Brews Radio',album:`${station.shortName} · ${station.frequency.toFixed(1)} FM`};
        if(state.hasUserStarted&&track.cover) metadata.artwork=[{src:encodeURI(track.cover)}];
        navigator.mediaSession.metadata=new MediaMetadata(metadata);
      }catch(_){ }
    }
  }

  function loadTrack(index,{continuePlayback=false,position=0}={}){
    state.trackIndex=(index+tracks.length)%tracks.length;
    const track=tracks[state.trackIndex];
    audio.src=encodeURI(track.audio);
    audio.load();
    renderTrack();
    els.progress.value=0;
    els.time.textContent='0:00 / 0:00';
    if(position>0){
      audio.addEventListener('loadedmetadata',()=>{
        audio.currentTime=Math.min(position,audio.duration||position);
      },{once:true});
    }
    if(continuePlayback&&state.playbackIntent){
      audio.play().catch(()=>{
        state.playbackIntent=false;
        renderPlayback();
      });
    }
  }

  function stationTrackPosition(station,index){
    const indexes=stationIndexes(station);
    const position=indexes.indexOf(index);
    return {indexes,position};
  }

  function stepTrack(delta,{continueIfIntent=false}={}){
    const station=currentStation();
    const {indexes,position}=stationTrackPosition(station,state.trackIndex);
    if(!indexes.length) return;
    const currentPosition=position>=0?position:0;
    const nextPosition=(currentPosition+delta+indexes.length)%indexes.length;
    const shouldContinue=state.playbackIntent&&(continueIfIntent||!audio.paused);
    loadTrack(indexes[nextPosition],{continuePlayback:shouldContinue});
  }

  function setStation(stationId,{pressButton=null,fromTuner=false}={}){
    const station=stationById.get(stationId);
    if(!station) return;
    if(pressButton) setPressed(pressButton);
    const shouldContinue=state.playbackIntent&&!audio.paused;
    state.stationId=station.id;
    setFrequency(station.frequency,{commit:false});
    const {indexes,position}=stationTrackPosition(station,state.trackIndex);
    if(indexes.length&&position<0) loadTrack(indexes[0],{continuePlayback:shouldContinue});
    else renderTrack();
    renderPresets();
    if(els.hint&&!state.playing) els.hint.textContent=`${station.name} selected. Press PLAY to listen.`;
  }

  function explicitPlayToggle(){
    setPressed(els.play);
    if(audio.paused||audio.ended){
      state.playbackIntent=true;
      state.hasUserStarted=true;
      renderArtwork();
      renderTrack();
      if(!audio.src) loadTrack(state.trackIndex);
      audio.play().catch(()=>{
        state.playbackIntent=false;
        renderPlayback();
      });
    }else{
      state.playbackIntent=false;
      audio.pause();
    }
    renderPlayback();
  }

  function setVolume(value){
    state.volume=clamp(Number(value)||0,0,1);
    audio.volume=state.volume;
    els.volume.value=state.volume;
    els.volumeValue.textContent=`${Math.round(state.volume*100)}%`;
    els.volumeKnob.style.setProperty('--angle',`${-135+state.volume*270}deg`);
  }

  function setFrequency(value,{commit=false}={}){
    state.frequency=clamp(Math.round((Number(value)||103.1)*10)/10,88,108);
    els.tune.value=state.frequency;
    els.tuner.value=state.frequency;
    const proportion=(state.frequency-88)/20;
    els.needle.style.left=`${5+proportion*90}%`;
    els.tuneKnob.style.setProperty('--angle',`${-135+proportion*270}deg`);
    els.freqValue.textContent=`${state.frequency.toFixed(1)} FM`;
    els.tuner.setAttribute('aria-label',`FM tuning, ${state.frequency.toFixed(1)} megahertz`);

    const nearest=nearestStation(state.frequency);
    const locked=nearest&&nearest.delta<=.25;
    els.stationName.textContent=locked?nearest.station.name:`FM ${state.frequency.toFixed(1)}`;
    els.stationLocation.textContent=locked?nearest.station.location:'TUNING';
    const signal=nearest?clamp(1-nearest.delta/2.3,0,1):0;
    els.meter.style.transform=`rotate(${-42+signal*84}deg)`;
    renderPresets();

    if(commit&&locked&&nearest.station.id!==state.stationId){
      setStation(nearest.station.id,{fromTuner:true});
    }else if(commit&&locked){
      state.stationId=nearest.station.id;
      renderTrack();
      renderPresets();
      if(els.hint&&!state.playing) els.hint.textContent=`${nearest.station.name} selected. Press PLAY to listen.`;
    }else if(els.hint&&!state.playing&&!locked){
      els.hint.textContent='TUNING · Move the needle to a marked Brew & Brews station.';
    }
  }

  function seekFromControl(){
    if(!Number.isFinite(audio.duration)||audio.duration<=0) return;
    audio.currentTime=(Number(els.progress.value)/1000)*audio.duration;
  }

  els.play.addEventListener('click',explicitPlayToggle);
  els.prev.addEventListener('click',()=>{setPressed(els.prev);stepTrack(-1)});
  els.next.addEventListener('click',()=>{setPressed(els.next);stepTrack(1)});
  els.volume.addEventListener('input',event=>setVolume(event.target.value));
  [els.tune,els.tuner].forEach(control=>{
    control.addEventListener('input',event=>setFrequency(event.target.value,{commit:false}));
    control.addEventListener('change',event=>setFrequency(event.target.value,{commit:true}));
  });
  els.progress.addEventListener('input',seekFromControl);
  document.querySelectorAll('.station-preset').forEach(button=>{
    button.addEventListener('click',()=>setStation(button.dataset.station,{pressButton:button}));
  });

  audio.addEventListener('play',()=>{
    if(!state.playbackIntent){
      audio.pause();
      return;
    }
    renderPlayback();
  });
  audio.addEventListener('pause',renderPlayback);
  audio.addEventListener('ended',()=>{
    if(!state.playbackIntent){
      renderPlayback();
      return;
    }
    stepTrack(1,{continueIfIntent:true});
  });
  audio.addEventListener('loadedmetadata',()=>{
    els.time.textContent=`${formatTime(audio.currentTime)} / ${formatTime(audio.duration)}`;
  });
  audio.addEventListener('timeupdate',()=>{
    if(Number.isFinite(audio.duration)&&audio.duration>0){
      els.progress.value=Math.round(audio.currentTime/audio.duration*1000);
      els.time.textContent=`${formatTime(audio.currentTime)} / ${formatTime(audio.duration)}`;
    }
  });
  audio.addEventListener('error',()=>{
    state.playbackIntent=false;
    renderPlayback();
    els.time.textContent='Audio unavailable';
  });

  window.addEventListener('pageshow',()=>{
    state.playbackIntent=false;
    if(!audio.paused) audio.pause();
    renderPlayback();
  });
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden) renderPlayback();
  });

  if('mediaSession' in navigator){
    try{
      navigator.mediaSession.setActionHandler('play',()=>{
        state.playbackIntent=true;
        state.hasUserStarted=true;
        renderArtwork();
        audio.play().catch(()=>{
          state.playbackIntent=false;
          renderPlayback();
        });
      });
      navigator.mediaSession.setActionHandler('pause',()=>{
        state.playbackIntent=false;
        audio.pause();
      });
      navigator.mediaSession.setActionHandler('previoustrack',()=>stepTrack(-1));
      navigator.mediaSession.setActionHandler('nexttrack',()=>stepTrack(1));
    }catch(_){ }
  }

  setVolume(state.volume);
  setFrequency(state.frequency,{commit:false});
  loadTrack(0);
  setStation('regular');
  state.playbackIntent=false;
  renderPlayback();
  renderPresets();

  if('serviceWorker' in navigator&&location.protocol!=='file:'){
    navigator.serviceWorker.register('./service-worker.js').catch(()=>{});
  }

  window.__BB_RADIO__={state,stations:STATIONS,tracks,loadTrack,setFrequency,setVolume,setStation,stepTrack};
})();