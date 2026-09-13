import {ChristmasRadioEngine} from './audio-engine.js';

const STATIONS_URL='data/stations.json';
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
let lastPanelTrigger=null;

function scheduleAppShell(){
  if(!('serviceWorker'in navigator))return;
  const register=()=>navigator.serviceWorker.register('./sw.js',{scope:'./'}).catch(err=>console.warn('[B&B Christmas Radio] app shell unavailable',err));
  const schedule=()=>('requestIdleCallback'in window?requestIdleCallback(register,{timeout:1200}):setTimeout(register,0));
  if(document.readyState==='complete')schedule();else window.addEventListener('load',schedule,{once:true});
}

function paintKnob(input){
  if(!input)return;
  const min=Number(input.min)||0,max=Number(input.max)||1,value=Number(input.value)||0;
  const t=max===min?0:(value-min)/(max-min),angle=-125+(Math.min(1,Math.max(0,t))*250);
  input.closest('.knob-control')?.style.setProperty('--knob-angle',`${angle}deg`);
}

function formatTime(seconds){
  if(!Number.isFinite(seconds)||seconds<0)return'--:--';
  const total=Math.floor(seconds),minutes=Math.floor(total/60),secs=String(total%60).padStart(2,'0');
  return`${minutes}:${secs}`;
}

function closePanels({restoreFocus=true}={}){
  const open=$$('.app-panel').some(p=>!p.hidden),trigger=lastPanelTrigger;
  const scrim=$('#panelScrim');if(scrim)scrim.hidden=true;
  $$('.app-panel').forEach(p=>p.hidden=true);
  $$('.bottom-nav button').forEach(b=>b.removeAttribute('aria-current'));
  document.body.classList.remove('panel-open');lastPanelTrigger=null;
  if(restoreFocus&&open&&trigger?.isConnected)requestAnimationFrame(()=>trigger.focus({preventScroll:true}));
}

function openPanel(id,button){
  const panel=document.getElementById(id);if(!panel)return;
  if(!panel.hidden&&button.getAttribute('aria-current')==='page'){closePanels();return}
  closePanels({restoreFocus:false});lastPanelTrigger=button;
  $('#panelScrim').hidden=false;panel.hidden=false;button.setAttribute('aria-current','page');document.body.classList.add('panel-open');
  requestAnimationFrame(()=>{
    $('.panel-close',panel)?.focus({preventScroll:true});
    if(id==='stationsPanel')$('#stationGrid [aria-current="true"]')?.scrollIntoView({block:'nearest'});
  });
}

function trapPanelFocus(event){
  if(event.key!=='Tab')return;
  const panel=$$('.app-panel').find(p=>!p.hidden);if(!panel)return;
  const focusable=$$('button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',panel).filter(el=>!el.hidden);
  if(!focusable.length)return;
  const first=focusable[0],last=focusable.at(-1),active=document.activeElement;
  if(event.shiftKey&&active===first){event.preventDefault();last.focus()}
  else if(!event.shiftKey&&active===last){event.preventDefault();first.focus()}
}

function syncAudioUI(engine,el){
  const state=engine.snapshot(),track=state.track;
  const title=track?.title||(state.playbackIntent?'Christmas broadcast ready':'Tap Play to begin');
  const artist=track?.artist||(state.count?'Brew & Brews Christmas Radio':'Christmas broadcast ready');
  const duration=Number.isFinite(state.duration)?state.duration:Number(track?.durationSeconds);
  const elapsed=Math.max(0,Number(state.currentTime)||0),progress=Number.isFinite(duration)&&duration>0?Math.min(100,(elapsed/duration)*100):0;
  const next=state.stationId&&state.count>1?engine.trackAt(state.stationId,state.index+1):null;
  el.signal.textContent=state.playing?'ON AIR':'READY';
  el.title.textContent=title;el.artist.textContent=artist;
  el.panelTrack.textContent=title;el.panelArtist.textContent=artist;
  el.panelElapsed.textContent=formatTime(elapsed);el.panelDuration.textContent=formatTime(duration);
  el.panelProgress.style.setProperty('--progress',`${progress}%`);el.panelProgress.setAttribute('aria-valuenow',String(Math.round(progress)));
  el.panelNextTrack.textContent=next?.title||(state.count?'Rotation continues here':'Christmas broadcast ready');
  const pressed=state.playbackIntent?'true':'false',label=state.playbackIntent?'Pause Christmas Radio':'Play Christmas Radio';
  el.play.setAttribute('aria-pressed',pressed);el.play.setAttribute('aria-label',label);
  el.panelPlay.setAttribute('aria-pressed',pressed);el.panelPlay.setAttribute('aria-label',label);el.panelPlay.textContent=state.playbackIntent?'Ⅱ':'▶';
  $('.play-icon',el.play).textContent=state.playbackIntent?'Ⅱ':'▶';
  const disableTransport=state.count<2;el.panelPrev.disabled=disableTransport;el.panelNext.disabled=disableTransport;
}

class ChristmasStationController{
  constructor(stations,engine,el){this.stations=stations;this.engine=engine;this.el=el;this.currentIndex=0}
  renderCards(){
    const f=document.createDocumentFragment();
    this.stations.forEach((s,i)=>{
      const b=document.createElement('button');b.type='button';b.className='station-card';b.dataset.stationId=s.id;
      const count=this.engine.stationTrackCount(s.id),countText=count===1?'1 track':`${count} tracks`,description=s.description||s.tagline;
      b.setAttribute('aria-label',`${s.frequency} ${s.name}. ${s.tagline}`);
      b.innerHTML=`<small class="station-frequency">${s.frequency}</small><h3>${s.name}</h3><p>${s.tagline}</p><span class="station-description">${description}</span><span class="station-meta"><span class="station-count">${countText}</span><span class="station-state">TAP TO TUNE</span></span>`;
      b.addEventListener('click',async()=>{await this.tune(i,'card');closePanels()});f.append(b);
    });
    this.el.grid.replaceChildren(f);
  }
  async tune(index,source='tuner'){
    const i=Math.min(this.stations.length-1,Math.max(0,Number(index)||0)),s=this.stations[i];this.currentIndex=i;
    const frequency=Number.parseFloat(s.frequency),dialT=Number.isFinite(frequency)?Math.min(1,Math.max(0,(frequency-88)/(110-88))):i/(this.stations.length-1);
    document.body.dataset.station=s.id;document.body.dataset.scene=s.scene||s.id;
    document.documentElement.style.setProperty('--station-position',`${8+(dialT*84)}%`);
    this.el.frequency.textContent=s.frequency;this.el.name.textContent=s.name;this.el.tagline.textContent=s.tagline;
    this.el.panelStation.textContent=`${s.frequency} · ${s.name}`;
    if(source!=='tuner')this.el.tuner.value=String(i);
    if(source!=='knob')this.el.tuningKnob.value=String(i);
    paintKnob(this.el.tuningKnob);
    [...this.el.grid.children].forEach((card,n)=>{
      const active=n===i;card.setAttribute('aria-current',active?'true':'false');
      const state=$('.station-state',card);if(state)state.textContent=active?'TUNED':'TAP TO TUNE';
    });
    this.el.grid.setAttribute('aria-label',`Christmas stations. Currently tuned to ${s.frequency} ${s.name}.`);
    await this.engine.selectStation(s.id,{autoplay:this.engine.playbackIntent});
    syncAudioUI(this.engine,this.el);
  }
}

async function init(){
  const el={
    frequency:$('#frequencyLabel'),name:$('#stationName'),tagline:$('#stationTagline'),signal:$('#signalLabel'),
    title:$('#nowPlayingTitle'),artist:$('#nowPlayingArtist'),tuner:$('#stationTuner'),tuningKnob:$('#tuningKnob'),
    grid:$('#stationGrid'),play:$('#playButton'),volume:$('#volumeControl'),audio:$('#christmasRadioAudio'),
    panelStation:$('#panelStation'),panelTrack:$('#panelTrack'),panelArtist:$('#panelArtist'),
    panelPrev:$('#panelPrev'),panelPlay:$('#panelPlay'),panelNext:$('#panelNext'),panelElapsed:$('#panelElapsed'),panelDuration:$('#panelDuration'),
    panelProgress:$('#panelProgress'),panelNextTrack:$('#panelNextTrack')
  };
  const engine=new ChristmasRadioEngine(el.audio);
  try{
    const [stationResponse]=await Promise.all([fetch(STATIONS_URL,{cache:'default'}),engine.init()]);
    if(!stationResponse.ok)throw new Error(`Station manifest ${stationResponse.status}`);
    const stationManifest=await stationResponse.json(),stations=stationManifest.stations||[];
    if(!stations.length)throw new Error('Station manifest is empty');

    const controller=new ChristmasStationController(stations,engine,el);controller.renderCards();
    el.tuner.max=el.tuningKnob.max=String(stations.length-1);

    const savedVolume=engine.savedVolume(.8);el.volume.value=String(savedVolume);engine.setVolume(savedVolume);
    paintKnob(el.volume);paintKnob(el.tuningKnob);

    const stored=sessionStorage.getItem('bbxmas:station');
    const restoredIndex=stations.findIndex(s=>s.id===stored);
    const defaultIndex=Math.max(0,stations.findIndex(s=>s.id===stationManifest.defaultStationId));
    await controller.tune(restoredIndex>=0?restoredIndex:defaultIndex,'boot');

    const update=()=>syncAudioUI(engine,el);
    ['ready','track','trackchange','station','playback','volume','error','time'].forEach(type=>engine.addEventListener(type,update));
    const togglePlayback=async()=>{if(engine.playbackIntent)engine.pause();else await engine.play();syncAudioUI(engine,el)};

    el.tuner.addEventListener('input',e=>controller.tune(e.target.value,'tuner'));
    el.tuningKnob.addEventListener('input',e=>{paintKnob(e.target);controller.tune(e.target.value,'knob')});
    el.volume.addEventListener('input',e=>{engine.setVolume(e.target.value);paintKnob(e.target)});
    [el.play,el.panelPlay].forEach(button=>button.addEventListener('pointerdown',()=>engine.prepare(),{passive:true}));
    el.play.addEventListener('click',togglePlayback);el.panelPlay.addEventListener('click',togglePlayback);
    el.panelPrev.addEventListener('click',async()=>{await engine.previous();syncAudioUI(engine,el)});
    el.panelNext.addEventListener('click',async()=>{await engine.next({reason:'panel'});syncAudioUI(engine,el)});

    $$('.bottom-nav button').forEach(b=>b.addEventListener('click',()=>openPanel(b.dataset.panel,b)));
    $$('.panel-close').forEach(b=>b.addEventListener('click',()=>closePanels()));
    $('#panelScrim').addEventListener('click',()=>closePanels());
    document.addEventListener('keydown',e=>{if(e.key==='Escape')closePanels();else trapPanelFocus(e)});
    syncAudioUI(engine,el);
  }catch(err){
    console.error('[B&B Christmas Radio]',err);el.signal.textContent='OFFLINE';
    el.title.textContent='Broadcast setup incomplete';el.artist.textContent='Christmas Radio could not load its manifests';
  }
}

scheduleAppShell();
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init,{once:true}):init();
