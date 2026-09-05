(()=>{
'use strict';
const STORAGE_KEY='bb-halloween-radio-state-v1';
const audio=document.getElementById('radioAudio');
const api=window.BBRadio;
if(!audio||!api)return;

let restoring=true;
let saveTimer=null;
let lastTimeSave=0;

function readSaved(){
  try{
    const raw=localStorage.getItem(STORAGE_KEY);
    if(!raw)return null;
    const saved=JSON.parse(raw);
    return saved&&typeof saved==='object'?saved:null;
  }catch{return null}
}

function snapshot(){
  const s=api.snapshot();
  return {
    version:1,
    currentFreq:s.currentFreq,
    trackId:s.trackId,
    volume:s.volume,
    autoTune:s.autoTune,
    shuffle:s.shuffle,
    repeat:s.repeat,
    currentTime:Number.isFinite(audio.currentTime)?Math.max(0,audio.currentTime):0
  };
}

function saveNow(){
  if(restoring)return;
  clearTimeout(saveTimer);
  saveTimer=null;
  try{localStorage.setItem(STORAGE_KEY,JSON.stringify(snapshot()))}catch{}
}

function queueSave(delay=180){
  if(restoring)return;
  clearTimeout(saveTimer);
  saveTimer=setTimeout(saveNow,delay);
}

function restore(){
  const saved=readSaved();
  if(saved){
    api.restore(saved);
    const wanted=Number(saved.currentTime)||0;
    if(wanted>0){
      const applyPosition=()=>{
        const duration=audio.duration;
        if(Number.isFinite(duration)&&duration>0){
          audio.currentTime=Math.min(wanted,Math.max(0,duration-.25));
          updatePositionState();
        }
      };
      if(audio.readyState>=1)applyPosition();
      else audio.addEventListener('loadedmetadata',applyPosition,{once:true});
    }
  }
  // Never restore playback intent. Every page load remains silent until Play is explicitly requested.
  audio.pause();
  restoring=false;
  updateMediaSession();
  queueSave(0);
}

function updateMetadata(){
  if(!('mediaSession' in navigator)||typeof MediaMetadata==='undefined')return;
  const s=api.snapshot();
  navigator.mediaSession.metadata=new MediaMetadata({
    title:s.trackTitle||'Brew & Brews Halloween Radio',
    artist:'Brew & Brews Halloween Radio',
    album:`${s.stationName||'B&B Radio'} · ${Number(s.currentFreq||103.1).toFixed(1)} FM`
  });
}

function updatePositionState(){
  if(!('mediaSession' in navigator)||typeof navigator.mediaSession.setPositionState!=='function')return;
  const duration=audio.duration;
  const position=audio.currentTime;
  if(!Number.isFinite(duration)||duration<=0||!Number.isFinite(position)||position<0||position>duration)return;
  try{navigator.mediaSession.setPositionState({duration,playbackRate:audio.playbackRate||1,position})}catch{}
}

function updatePlaybackState(){
  if(!('mediaSession' in navigator))return;
  try{navigator.mediaSession.playbackState=audio.paused?'paused':'playing'}catch{}
}

function updateMediaSession(){
  updateMetadata();
  updatePlaybackState();
  updatePositionState();
}

function installMediaHandlers(){
  if(!('mediaSession' in navigator))return;
  const set=(name,fn)=>{try{navigator.mediaSession.setActionHandler(name,fn)}catch{}};
  set('play',()=>{if(audio.paused)api.togglePlay()});
  set('pause',()=>{if(!audio.paused)api.togglePlay()});
  set('previoustrack',()=>api.previous());
  set('nexttrack',()=>api.next());
  set('seekbackward',details=>{audio.currentTime=Math.max(0,audio.currentTime-(details.seekOffset||10));updatePositionState()});
  set('seekforward',details=>{const end=Number.isFinite(audio.duration)?audio.duration:audio.currentTime+(details.seekOffset||10);audio.currentTime=Math.min(end,audio.currentTime+(details.seekOffset||10));updatePositionState()});
  set('seekto',details=>{if(Number.isFinite(details.seekTime)){audio.currentTime=details.seekTime;updatePositionState()}});
}

const observer=new MutationObserver(()=>{
  queueSave();
  updateMetadata();
});
observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['aria-pressed','class']});

audio.addEventListener('play',()=>{updatePlaybackState();queueSave()});
audio.addEventListener('pause',()=>{updatePlaybackState();queueSave()});
audio.addEventListener('loadedmetadata',()=>{updateMediaSession();queueSave()});
audio.addEventListener('volumechange',()=>queueSave());
audio.addEventListener('timeupdate',()=>{
  updatePositionState();
  const now=Date.now();
  if(now-lastTimeSave>5000){lastTimeSave=now;queueSave(50)}
});
audio.addEventListener('ended',()=>{updateMediaSession();queueSave(50)});
document.addEventListener('pointerup',()=>queueSave(50),true);
document.addEventListener('click',()=>queueSave(80),true);
window.addEventListener('pagehide',saveNow);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')saveNow()});

installMediaHandlers();
restore();
})();
