const STATIONS_URL='data/stations.json';
const $=(s,r=document)=>r.querySelector(s);

class ChristmasAudioEngine{
  constructor(audio){this.audio=audio;this.userWantsPlayback=false;this.currentTrack=null;this.audio.preload='none'}
  setVolume(v){const n=Math.min(1,Math.max(0,Number(v)));this.audio.volume=Number.isFinite(n)?n:.8}
  async play(){this.userWantsPlayback=true;if(!this.currentTrack?.src)return{started:false,reason:'no-track'};await this.audio.play();return{started:true}}
  pause(){this.userWantsPlayback=false;this.audio.pause()}
  async loadTrack(track,{autoplay=false}={}){this.currentTrack=track||null;if(!track?.src){this.audio.removeAttribute('src');this.audio.load();return}const href=new URL(track.src,document.baseURI).href;if(this.audio.src!==href){this.audio.src=track.src;this.audio.load()}if(autoplay&&this.userWantsPlayback)await this.audio.play()}
}

class ChristmasStationController{
  constructor(stations,engine,el){this.stations=stations;this.engine=engine;this.el=el;this.currentIndex=0}
  renderCards(){const f=document.createDocumentFragment();this.stations.forEach((s,i)=>{const b=document.createElement('button');b.type='button';b.className='station-card';b.innerHTML=`<small>${s.frequency}</small><h3>${s.name}</h3><p>${s.description}</p>`;b.addEventListener('click',()=>this.tune(i,'card'));f.append(b)});this.el.grid.replaceChildren(f)}
  tune(index,source='tuner'){const i=Math.min(this.stations.length-1,Math.max(0,Number(index)||0)),s=this.stations[i];this.currentIndex=i;document.body.dataset.station=s.id;this.el.frequency.textContent=s.frequency;this.el.name.textContent=s.name;this.el.tagline.textContent=s.tagline;this.el.signal.textContent=this.engine.userWantsPlayback?'ON AIR':'READY';if(source!=='tuner')this.el.tuner.value=String(i);[...this.el.grid.children].forEach((card,n)=>card.setAttribute('aria-current',n===i?'true':'false'));this.noTrack()}
  noTrack(){this.el.title.textContent='Christmas broadcast ready';this.el.artist.textContent=this.engine.userWantsPlayback?'Music is being added to this station':'Press Play when you’re ready'}
}

async function init(){
  const el={frequency:$('#frequencyLabel'),name:$('#stationName'),tagline:$('#stationTagline'),signal:$('#signalLabel'),title:$('#nowPlayingTitle'),artist:$('#nowPlayingArtist'),tuner:$('#stationTuner'),grid:$('#stationGrid'),play:$('#playButton'),volume:$('#volumeControl'),audio:$('#christmasRadioAudio')};
  const engine=new ChristmasAudioEngine(el.audio);engine.setVolume(el.volume.value);
  try{
    const res=await fetch(STATIONS_URL,{cache:'no-cache'});if(!res.ok)throw new Error(`Station manifest ${res.status}`);const manifest=await res.json(),stations=manifest.stations||[];if(!stations.length)throw new Error('Station manifest is empty');
    const controller=new ChristmasStationController(stations,engine,el);controller.renderCards();const d=Math.max(0,stations.findIndex(s=>s.id===manifest.defaultStationId));el.tuner.max=String(stations.length-1);controller.tune(d,'boot');
    el.tuner.addEventListener('input',e=>controller.tune(e.target.value));el.volume.addEventListener('input',e=>engine.setVolume(e.target.value));
    el.play.addEventListener('click',async()=>{if(engine.userWantsPlayback){engine.pause();el.play.setAttribute('aria-pressed','false');$('.play-icon',el.play).textContent='▶';$('.play-text',el.play).textContent='PLAY';el.signal.textContent='READY';controller.noTrack();return}const result=await engine.play();el.play.setAttribute('aria-pressed','true');$('.play-icon',el.play).textContent='Ⅱ';$('.play-text',el.play).textContent='PAUSE';el.signal.textContent=result.started?'ON AIR':'READY';controller.noTrack()});
  }catch(err){console.error('[B&B Christmas Radio]',err);el.signal.textContent='OFFLINE';el.title.textContent='Broadcast setup incomplete';el.artist.textContent='Christmas Radio could not load its station manifest'}
}

document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init,{once:true}):init();
