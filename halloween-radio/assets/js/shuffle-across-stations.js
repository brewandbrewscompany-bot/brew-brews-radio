(()=>{
'use strict';
const VERSION='pass26-shuffle-across-stations-v1';
const STATIONS=[88.3,91.7,95.9,99.5,103.1,106.7];
const audio=document.getElementById('radioAudio');
const toast=document.getElementById('toast');
const sr=document.getElementById('sr');
const shuffleSwitch=document.getElementById('shuffleSwitch');
if(!audio||!window.BBRadio)return;

const api=window.BBRadio;
const coreNext=api.next.bind(api);
let inFlight=false;
let hopCount=0;
let staticCount=0;
let lastHop=null;
let toastTimer=null;
let noiseCtx=null;

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const sameFreq=(a,b)=>Math.abs(Number(a)-Number(b))<.01;

function showToast(title,text=''){
  if(!toast)return;
  clearTimeout(toastTimer);
  toast.innerHTML=`<strong>${title}</strong>${text}`;
  if(sr)sr.textContent=`${title} ${text}`;
  toast.classList.add('show');
  toastTimer=setTimeout(()=>toast.classList.remove('show'),2100);
}

function pickDifferentStation(currentFreq){
  const choices=STATIONS.filter(f=>!sameFreq(f,currentFreq));
  return choices[Math.floor(Math.random()*choices.length)]||choices[0]||103.1;
}

function playShuffleStatic(durationMs=520,volume=.78){
  staticCount++;
  const AC=window.AudioContext||window.webkitAudioContext;
  if(!AC)return;
  try{
    if(!noiseCtx||noiseCtx.state==='closed')noiseCtx=new AC();
    const ctx=noiseCtx;
    if(ctx.state==='suspended')ctx.resume().catch(()=>{});
    const length=Math.max(1,Math.floor(ctx.sampleRate*(durationMs/1000)));
    const buffer=ctx.createBuffer(1,length,ctx.sampleRate);
    const data=buffer.getChannelData(0);
    let last=0;
    for(let i=0;i<length;i++){
      const white=Math.random()*2-1;
      last=last*.86+white*.14;
      data[i]=(white*.48+last*.52)*.42;
    }
    const source=ctx.createBufferSource();
    source.buffer=buffer;
    const filter=ctx.createBiquadFilter();
    filter.type='bandpass';
    filter.frequency.value=1450;
    filter.Q.value=.7;
    const gain=ctx.createGain();
    gain.gain.value=Math.max(.025,Math.min(.18,Number(volume||.78)*.15));
    source.connect(filter).connect(gain).connect(ctx.destination);
    source.start();
    source.stop(ctx.currentTime+durationMs/1000);
  }catch{}
}

async function shuffleHop(reason='next'){
  if(inFlight)return false;
  const before=api.snapshot();
  if(!before.shuffle)return false;
  if(reason==='ended'&&before.repeat)return false;
  if(reason==='ended'&&before.trackId==='the-town-goes-quiet')return false;

  inFlight=true;
  try{
    const targetFreq=pickDifferentStation(before.currentFreq);
    const wasPlaying=!!before.playbackIntent;
    const previousTrack=before.trackId;

    if(wasPlaying){
      audio.pause();
      showToast('Shuffle Tuning…',`${targetFreq.toFixed(1)} FM`);
      playShuffleStatic(520,before.volume);
      await sleep(520);
    }

    api.restore({...before,currentFreq:targetFreq,trackId:null,shuffle:true,playbackIntent:false});

    // Start at a randomized position within the newly selected station.
    const advance=Math.floor(Math.random()*5);
    for(let i=0;i<advance;i++)coreNext();

    // Never use the B&B signoff as a random shuffle destination.
    let selected=api.snapshot();
    if(selected.trackId==='the-town-goes-quiet'){
      coreNext();
      selected=api.snapshot();
    }

    // Defensive: if the destination track somehow matches, advance once more.
    if(selected.trackId&&selected.trackId===previousTrack){
      coreNext();
      selected=api.snapshot();
      if(selected.trackId==='the-town-goes-quiet'){
        coreNext();
        selected=api.snapshot();
      }
    }

    if(wasPlaying)await api.togglePlay();
    const after=api.snapshot();
    hopCount++;
    lastHop={reason,fromFreq:before.currentFreq,toFreq:after.currentFreq,fromTrack:previousTrack,toTrack:after.trackId,wasPlaying,playbackIntent:after.playbackIntent};
    showToast('Shuffle Jump',`${after.currentFreq.toFixed(1)} FM · ${after.stationName}`);
    window.dispatchEvent(new CustomEvent('bbradio:shufflehop',{detail:lastHop}));
    return true;
  }finally{
    inFlight=false;
  }
}

// Wrap the public Next API used by secondary panels/integrations.
api.next=()=>api.snapshot().shuffle?shuffleHop('api-next'):coreNext();

// Intercept physical/visual NEXT buttons before the core same-station handler.
document.addEventListener('click',event=>{
  const button=event.target?.closest?.('[data-hit="next"]');
  if(!button||!api.snapshot().shuffle)return;
  event.preventDefault();
  event.stopImmediatePropagation();
  shuffleHop('next');
},true);

// On natural track end, Shuffle jumps stations. Repeat and final signoff keep core behavior.
audio.addEventListener('ended',event=>{
  const snap=api.snapshot();
  if(!snap.shuffle||snap.repeat||snap.trackId==='the-town-goes-quiet')return;
  event.preventDefault();
  event.stopImmediatePropagation();
  shuffleHop('ended');
},true);

// Replace the old mode message so the user knows exactly what Shuffle now does.
shuffleSwitch?.addEventListener('click',()=>{
  setTimeout(()=>{
    const on=api.snapshot().shuffle;
    showToast('Shuffle',on?'On · jumping across all 6 stations':'Off · staying on the selected station');
  },0);
});

window.BBShuffleAcrossStations={
  active:true,
  version:VERSION,
  stations:[...STATIONS],
  hop:shuffleHop,
  get inFlight(){return inFlight},
  get hopCount(){return hopCount},
  get staticCount(){return staticCount},
  get lastHop(){return lastHop}
};
})();
