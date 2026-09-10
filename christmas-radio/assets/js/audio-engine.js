const DEFAULT_POLICY={initialPreload:'none',prepareNextAfterPlaybackStarts:true,crossfadeMs:280,rotationMode:'curated-loop'};
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const trackSrc=t=>t?.src||t?.file||'';

export class ChristmasRadioEngine extends EventTarget{
  constructor(audio,{manifestUrl='data/tracks.json'}={}){
    super();
    this.audio=audio;this.manifestUrl=manifestUrl;this.policy={...DEFAULT_POLICY};
    this.playbackIntent=false;this.activeStationId=null;this.currentTrack=null;
    this.playlists=new Map();this.indices=new Map();this.switchToken=0;this.errorSkips=0;this.ready=false;
    this.preloader=new Audio();this.preloader.preload='none';
    this.audio.preload='none';this.audio.loop=false;
    this.audio.addEventListener('ended',()=>this.next({reason:'ended'}));
    this.audio.addEventListener('timeupdate',()=>this.#emit('time',this.snapshot()));
    this.audio.addEventListener('play',()=>this.#emit('playback',this.snapshot()));
    this.audio.addEventListener('pause',()=>this.#emit('playback',this.snapshot()));
    this.audio.addEventListener('canplay',()=>{this.errorSkips=0});
    this.audio.addEventListener('error',()=>this.#handleMediaError());
  }

  async init(){
    const res=await fetch(this.manifestUrl,{cache:'no-cache'});
    if(!res.ok)throw new Error(`Track manifest ${res.status}`);
    const manifest=await res.json();
    this.policy={...DEFAULT_POLICY,...(manifest.audioPolicy||{})};
    this.#buildPlaylists(Array.isArray(manifest.tracks)?manifest.tracks:[]);
    this.ready=true;this.#installMediaSession();this.#emit('ready',this.snapshot());
    return manifest;
  }

  #buildPlaylists(tracks){
    this.playlists.clear();
    for(const raw of tracks){
      const stationId=raw.stationId||raw.station||null,src=trackSrc(raw);
      if(!stationId||!src)continue;
      const track={...raw,stationId:String(stationId),src};
      if(!this.playlists.has(track.stationId))this.playlists.set(track.stationId,[]);
      this.playlists.get(track.stationId).push(track);
    }
    for(const [stationId,list] of this.playlists){
      list.sort((a,b)=>(a.order??9999)-(b.order??9999));
      const stored=Number(sessionStorage.getItem(`bbxmas:index:${stationId}`));
      this.indices.set(stationId,Number.isInteger(stored)?clamp(stored,0,Math.max(0,list.length-1)):0);
    }
  }

  hasTracks(stationId=this.activeStationId){return (this.playlists.get(String(stationId))||[]).length>0}
  playlist(stationId=this.activeStationId){return this.playlists.get(String(stationId))||[]}
  currentIndex(stationId=this.activeStationId){return this.indices.get(String(stationId))??0}
  trackAt(stationId,index){const list=this.playlist(stationId);return list.length?list[(index+list.length)%list.length]:null}
  selectedTrack(stationId=this.activeStationId){return this.trackAt(stationId,this.currentIndex(stationId))}
  stationTrackCount(stationId=this.activeStationId){return this.playlist(stationId).length}

  setVolume(value){
    const volume=clamp(Number(value)||0,0,1);this.audio.volume=volume;
    localStorage.setItem('bbxmas:volume',String(volume));this.#emit('volume',{...this.snapshot(),volume});
  }
  savedVolume(fallback=.8){const n=Number(localStorage.getItem('bbxmas:volume'));return Number.isFinite(n)?clamp(n,0,1):fallback}

  async selectStation(stationId,{autoplay=this.playbackIntent}={}){
    const id=String(stationId),changed=id!==this.activeStationId;
    if(changed)this.errorSkips=0;
    this.activeStationId=id;sessionStorage.setItem('bbxmas:station',id);
    const track=this.selectedTrack(id);
    if(changed||!this.currentTrack||this.currentTrack.stationId!==id)await this.#loadTrack(track,{autoplay,fade:changed});
    else if(autoplay&&!this.audio.paused)this.#prepareNext();
    this.#emit('station',this.snapshot());return this.snapshot();
  }

  async play(){
    this.playbackIntent=true;
    if(!this.activeStationId)return{started:false,reason:'no-station'};
    const track=this.currentTrack?.stationId===this.activeStationId?this.currentTrack:this.selectedTrack();
    if(!track){this.#emit('playback',this.snapshot());return{started:false,reason:'no-track'}}
    if(this.currentTrack!==track)await this.#loadTrack(track,{autoplay:false});
    try{await this.audio.play();this.#prepareNext();this.#updateMediaSession();return{started:true,track:this.currentTrack}}
    catch(error){this.playbackIntent=false;this.#emit('error',{type:'play',error,snapshot:this.snapshot()});return{started:false,reason:'play-rejected',error}}
  }

  pause(){this.playbackIntent=false;this.audio.pause();this.#updateMediaSession()}

  async next({reason='user'}={}){
    const list=this.playlist();if(!list.length)return false;
    const index=(this.currentIndex()+1)%list.length;this.#setIndex(this.activeStationId,index);
    await this.#loadTrack(this.trackAt(this.activeStationId,index),{autoplay:this.playbackIntent,fade:reason!=='ended'});
    this.#emit('trackchange',{reason,...this.snapshot()});return true;
  }

  async previous(){
    const list=this.playlist();if(!list.length)return false;
    const elapsed=this.audio.currentTime||0;let index=this.currentIndex();
    if(elapsed<4)index=(index-1+list.length)%list.length;
    this.#setIndex(this.activeStationId,index);
    await this.#loadTrack(this.trackAt(this.activeStationId,index),{autoplay:this.playbackIntent,fade:true});
    this.#emit('trackchange',{reason:'previous',...this.snapshot()});return true;
  }

  #setIndex(stationId,index){if(!stationId)return;this.indices.set(stationId,index);sessionStorage.setItem(`bbxmas:index:${stationId}`,String(index))}

  async #loadTrack(track,{autoplay=false,fade=false}={}){
    const token=++this.switchToken;
    if(!track){
      this.currentTrack=null;this.audio.pause();this.audio.removeAttribute('src');this.audio.load();this.preloader.removeAttribute('src');
      this.#updateMediaSession();this.#emit('track',this.snapshot());return;
    }
    const wasAudible=!this.audio.paused&&this.audio.volume>0,targetVolume=this.savedVolume(this.audio.volume||.8);
    if(fade&&wasAudible)await this.#fadeTo(0,this.policy.crossfadeMs/2,token);
    if(token!==this.switchToken)return;
    const absolute=new URL(track.src,document.baseURI).href;
    if(this.audio.src!==absolute){this.audio.src=track.src;this.audio.preload=autoplay?'auto':'metadata';this.audio.load()}
    this.currentTrack=track;this.#updateMediaSession();this.#emit('track',this.snapshot());
    if(autoplay&&this.playbackIntent){
      this.audio.volume=fade?0:targetVolume;
      try{await this.audio.play();if(fade)await this.#fadeTo(targetVolume,this.policy.crossfadeMs/2,token);this.#prepareNext()}
      catch(error){this.#emit('error',{type:'autoplay-after-tune',error,snapshot:this.snapshot()})}
    }else this.audio.volume=targetVolume;
  }

  #prepareNext(){
    if(!this.policy.prepareNextAfterPlaybackStarts||!this.playbackIntent||!this.activeStationId)return;
    const list=this.playlist();if(list.length<2)return;
    const next=this.trackAt(this.activeStationId,this.currentIndex()+1);if(!next?.src)return;
    const absolute=new URL(next.src,document.baseURI).href;
    if(this.preloader.src!==absolute){this.preloader.src=next.src;this.preloader.preload='metadata';this.preloader.load()}
  }

  #fadeTo(target,duration,token=this.switchToken){
    const from=this.audio.volume,ms=Math.max(0,Number(duration)||0);
    if(ms<20){this.audio.volume=target;return Promise.resolve()}
    return new Promise(resolve=>{const start=performance.now();const tick=now=>{if(token!==this.switchToken){resolve();return}const t=clamp((now-start)/ms,0,1);this.audio.volume=from+(target-from)*t;if(t<1)requestAnimationFrame(tick);else resolve()};requestAnimationFrame(tick)});
  }

  async #handleMediaError(){
    const list=this.playlist();if(!this.playbackIntent||!list.length)return;
    this.#emit('error',{type:'media',snapshot:this.snapshot()});
    if(this.errorSkips>=list.length-1){this.playbackIntent=false;this.audio.pause();this.#emit('error',{type:'media-exhausted',snapshot:this.snapshot()});this.#emit('playback',this.snapshot());return}
    this.errorSkips+=1;await this.next({reason:'error-skip'});
  }

  snapshot(){
    const list=this.playlist();
    return{ready:this.ready,playbackIntent:this.playbackIntent,playing:!this.audio.paused&&!this.audio.ended,stationId:this.activeStationId,track:this.currentTrack,index:this.currentIndex(),count:list.length,currentTime:this.audio.currentTime||0,duration:Number.isFinite(this.audio.duration)?this.audio.duration:null,volume:this.audio.volume};
  }

  #installMediaSession(){
    if(!('mediaSession'in navigator))return;
    const safe=(action,fn)=>{try{navigator.mediaSession.setActionHandler(action,fn)}catch{}};
    safe('play',()=>this.play());safe('pause',()=>this.pause());safe('nexttrack',()=>this.next({reason:'media-session'}));safe('previoustrack',()=>this.previous());
    safe('seekto',details=>{if(Number.isFinite(details.seekTime))this.audio.currentTime=clamp(details.seekTime,0,this.audio.duration||details.seekTime)});
    this.#updateMediaSession();
  }

  #updateMediaSession(){
    if(!('mediaSession'in navigator))return;
    try{
      const track=this.currentTrack;
      if(track)navigator.mediaSession.metadata=new MediaMetadata({title:track.title||'B&B Christmas Radio',artist:track.artist||'Brew & Brews',album:track.album||'Brew & Brews Christmas Radio'});
      navigator.mediaSession.playbackState=this.playbackIntent&&!this.audio.paused?'playing':'paused';
    }catch{}
  }

  #emit(type,detail){this.dispatchEvent(new CustomEvent(type,{detail}))}
}
