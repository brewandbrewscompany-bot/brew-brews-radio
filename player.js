(()=>{
  'use strict';
  const tracks=Array.isArray(window.BB_PLAYLIST)?window.BB_PLAYLIST:[];
  if(!tracks.length) return;
  const $=id=>document.getElementById(id);
  const audio=$('audio');
  const els={play:$('playBtn'),playLabel:$('playLabel'),playIcon:$('playIcon'),prev:$('prevBtn'),next:$('nextBtn'),title:$('trackTitle'),stationMeta:$('stationMeta'),time:$('timeText'),progress:$('progress'),onAir:$('onAir'),volume:$('volumeRange'),volumeKnob:$('volumeKnob'),volumeValue:$('volumeValue'),tune:$('tuneRange'),tuner:$('tunerRange'),tuneKnob:$('tuneKnob'),freqValue:$('frequencyValue'),needle:$('tunerNeedle'),stationName:$('stationName'),stationLocation:$('stationLocation'),meter:$('meterNeedle')};
  const STATION={frequency:103.1,name:'B&B 103.1',shortName:'B&B Radio',location:'LOUISBURG, KS'};
  const state={playbackIntent:false,playing:false,trackIndex:0,frequency:STATION.frequency,volume:.72};
  const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
  const formatTime=s=>{if(!Number.isFinite(s)||s<0)return '0:00';const m=Math.floor(s/60),sec=Math.floor(s%60);return `${m}:${String(sec).padStart(2,'0')}`};
  function setPressed(button){button.classList.add('is-pressed');setTimeout(()=>button.classList.remove('is-pressed'),110)}
  function renderPlayback(){state.playing=!audio.paused&&!audio.ended;els.play.classList.toggle('is-playing',state.playing);els.play.setAttribute('aria-pressed',String(state.playing));els.play.setAttribute('aria-label',state.playing?'Pause':'Play');els.playLabel.textContent=state.playing?'PAUSE':'PLAY';els.playIcon.textContent=state.playing?'Ⅱ':'▶';els.onAir.classList.toggle('is-playing',state.playing);els.onAir.querySelector('span').textContent=state.playing?'ON AIR':'READY';document.querySelector('.tube')?.classList.toggle('is-playing',state.playing)}
  function renderTrack(){const t=tracks[state.trackIndex];els.title.textContent=t.title;els.stationMeta.textContent=`Brew & Brews Radio · ${STATION.frequency.toFixed(1)}`;document.title=`${t.title} · Brew & Brews Radio`;if('mediaSession'in navigator){try{navigator.mediaSession.metadata=new MediaMetadata({title:t.title,artist:t.artist||'Brew & Brews Radio',album:'Brew & Brews Radio · 103.1'})}catch(_){}}}
  function loadTrack(index,{continuePlayback=false,position=0}={}){state.trackIndex=(index+tracks.length)%tracks.length;const t=tracks[state.trackIndex];audio.src=encodeURI(t.audio);audio.load();renderTrack();els.progress.value=0;els.time.textContent='0:00 / 0:00';if(position>0)audio.addEventListener('loadedmetadata',()=>{audio.currentTime=Math.min(position,audio.duration||position)},{once:true});if(continuePlayback&&state.playbackIntent)audio.play().catch(()=>{state.playbackIntent=false;renderPlayback()})}
  function explicitPlayToggle(){setPressed(els.play);if(audio.paused||audio.ended){state.playbackIntent=true;if(!audio.src)loadTrack(state.trackIndex);audio.play().catch(()=>{state.playbackIntent=false;renderPlayback()})}else{state.playbackIntent=false;audio.pause()}renderPlayback()}
  function stepTrack(delta){const shouldContinue=state.playbackIntent&&!audio.paused;loadTrack(state.trackIndex+delta,{continuePlayback:shouldContinue})}
  function setVolume(value){state.volume=clamp(Number(value)||0,0,1);audio.volume=state.volume;els.volume.value=state.volume;els.volumeValue.textContent=`${Math.round(state.volume*100)}%`;els.volumeKnob.style.setProperty('--angle',`${-135+state.volume*270}deg`)}
  function setFrequency(value){state.frequency=clamp(Math.round((Number(value)||STATION.frequency)*10)/10,88,108);els.tune.value=state.frequency;els.tuner.value=state.frequency;const p=(state.frequency-88)/20;els.needle.style.left=`${5+p*90}%`;els.tuneKnob.style.setProperty('--angle',`${-135+p*270}deg`);els.freqValue.textContent=`${state.frequency.toFixed(1)} FM`;els.tuner.setAttribute('aria-label',`FM tuning, ${state.frequency.toFixed(1)} megahertz`);const delta=Math.abs(state.frequency-STATION.frequency);const locked=delta<=.2;els.stationName.textContent=locked?STATION.name:`FM ${state.frequency.toFixed(1)}`;els.stationLocation.textContent=locked?STATION.location:'TUNING';const signal=clamp(1-delta/4,0,1);els.meter.style.transform=`rotate(${-42+signal*84}deg)`}
  function seekFromControl(){if(!Number.isFinite(audio.duration)||audio.duration<=0)return;audio.currentTime=(Number(els.progress.value)/1000)*audio.duration}
  els.play.addEventListener('click',explicitPlayToggle);
  els.prev.addEventListener('click',()=>{setPressed(els.prev);stepTrack(-1)});
  els.next.addEventListener('click',()=>{setPressed(els.next);stepTrack(1)});
  els.volume.addEventListener('input',e=>setVolume(e.target.value));
  els.tune.addEventListener('input',e=>setFrequency(e.target.value));
  els.tuner.addEventListener('input',e=>setFrequency(e.target.value));
  els.progress.addEventListener('input',seekFromControl);
  audio.addEventListener('play',()=>{if(!state.playbackIntent){audio.pause();return}renderPlayback()});
  audio.addEventListener('pause',renderPlayback);
  audio.addEventListener('ended',()=>{if(!state.playbackIntent){renderPlayback();return}loadTrack(state.trackIndex+1,{continuePlayback:true})});
  audio.addEventListener('loadedmetadata',()=>{els.time.textContent=`${formatTime(audio.currentTime)} / ${formatTime(audio.duration)}`});
  audio.addEventListener('timeupdate',()=>{if(Number.isFinite(audio.duration)&&audio.duration>0){els.progress.value=Math.round(audio.currentTime/audio.duration*1000);els.time.textContent=`${formatTime(audio.currentTime)} / ${formatTime(audio.duration)}`}});
  audio.addEventListener('error',()=>{state.playbackIntent=false;renderPlayback();els.time.textContent='Audio unavailable'});
  window.addEventListener('pageshow',()=>{state.playbackIntent=false;if(!audio.paused)audio.pause();renderPlayback()});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)renderPlayback()});
  if('mediaSession'in navigator){try{navigator.mediaSession.setActionHandler('play',()=>{state.playbackIntent=true;audio.play().catch(()=>{state.playbackIntent=false;renderPlayback()})});navigator.mediaSession.setActionHandler('pause',()=>{state.playbackIntent=false;audio.pause()});navigator.mediaSession.setActionHandler('previoustrack',()=>stepTrack(-1));navigator.mediaSession.setActionHandler('nexttrack',()=>stepTrack(1))}catch(_){}}
  setVolume(state.volume);setFrequency(state.frequency);loadTrack(0);state.playbackIntent=false;renderPlayback();
  if('serviceWorker'in navigator&&location.protocol!=='file:') navigator.serviceWorker.register('./service-worker.js').catch(()=>{});
  window.__BB_RADIO__={state,station:STATION,tracks,loadTrack,setFrequency,setVolume};
})();
