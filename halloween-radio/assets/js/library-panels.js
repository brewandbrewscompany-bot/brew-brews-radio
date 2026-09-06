(()=>{
'use strict';
const api=window.BBRadio;
const audio=document.getElementById('radioAudio');
if(!api||!audio)return;

const FAVORITES_KEY='bb-halloween-radio-favorites-v1';
const fallback={
  stations:[
    {frequency:88.3,name:'Graveyard AM'},{frequency:91.7,name:'Dead Air'},{frequency:95.9,name:'The Grind'},
    {frequency:99.5,name:'After Dark'},{frequency:103.1,name:'B&B Radio'},{frequency:106.7,name:'Witching Hour'}
  ],
  tracks:[
    ['welcome-to-the-haunted-roast','Welcome to the Haunted Roast',88.3,1,309.5],['midnight-static','Midnight Static',88.3,2,179.6],['dead-of-night','Dead of Night',88.3,3,238.4],['run-from-the-shadows','Run from the Shadows',88.3,4,92.8],['it-knows-youre-awake',"It Knows You're Awake",88.3,5,314.1],['coffin-lid-rag','Coffin Lid Rag',88.3,6,141.5],
    ['haunted-roast','Haunted Roast',91.7,1,268],['static-on-the-highway','Static on the Highway',91.7,2,177.4],['when-the-lights-go-out-v2','When the Lights Go Out (Version 2)',91.7,3,263.5],['run-away-from-shadows','Run Away from Shadows',91.7,4,149.8],['dead-air-interlude','Dead Air Interlude',91.7,5,131.9],
    ['ironclad-walk','Ironclad Walk',95.9,1,149.8],['they-prefer-the-dark-roast','They Prefer the Dark Roast',95.9,2,153.7],['goblin-chase','Goblin Chase',95.9,3,150.2],['do-the-goblin-stomp','Do the Goblin Stomp',95.9,4,198.8],['roaster-rattle','Roaster Rattle',95.9,5,172.8],['black-cat-boogie','Black Cat Boogie',95.9,6,180.4],
    ['brew-and-brews-after-dark','Brew & Brews After Dark',99.5,1,258.8],['the-witching-hour-v2','The Witching Hour (Version 2)',99.5,2,57],['when-the-lights-go-out','When the Lights Go Out',99.5,3,298.6],['skeleton-shuffle','Skeleton Shuffle',99.5,4,103],['brew-and-brews-after-dark-v2','Brew & Brews After Dark (Version 2)',99.5,5,289.8],['lanterns-in-the-fog','Lanterns in the Fog',99.5,6,203.3],
    ['ironclad','IRONCLAD',103.1,1,164.8],['voodoo-after-midnight','Voodoo after Midnight',103.1,2,149.5],['monsters-in-the-house','Monsters in the House',103.1,3,228.7],['phantom-groove','Phantom Groove',103.1,4,150],['last-cup-before-dawn','Last Cup Before Dawn',103.1,5,174.6],['the-town-goes-quiet','The Town Goes Quiet',103.1,6,272.1],
    ['the-witching-hour','The Witching Hour',106.7,1,79.7],['full-moon-frequency','Full Moon Frequency',106.7,2,242.2],['howling-in-the-dark','Howling in the Dark',106.7,3,40.7],['when-the-night-comes-alive','When the Night Comes Alive',106.7,4,282.1],['boiler-room-bones','Boiler Room Bones',106.7,5,154.2]
  ].map(([id,title,station,order,durationSec])=>({id,title,station,order,durationSec}))
};

const backdrop=document.getElementById('radioLibraryBackdrop');
const schedulePanel=document.getElementById('schedulePanel');
const showsPanel=document.getElementById('showsPanel');
const scheduleBody=document.getElementById('scheduleBody');
const showsBody=document.getElementById('showsBody');
const showsSub=showsPanel?.querySelector('.library-sub');
if(showsSub)showsSub.textContent='Stay here while the radio plays, jump to another song, or save haunted favorites for next time.';

let manifest=fallback;
let favorites=readFavorites();
let activePanel=null;
let showsTab='signal';
let lastSnapshot='';

function esc(s=''){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function fmt(sec){sec=Number(sec)||0;const m=Math.floor(sec/60),s=String(Math.floor(sec%60)).padStart(2,'0');return`${m}:${s}`}
function stationFor(freq){return manifest.stations.find(s=>Math.abs(Number(s.frequency)-Number(freq))<.01)||{frequency:freq,name:`${Number(freq).toFixed(1)} FM`}}
function tracksFor(freq){return manifest.tracks.filter(t=>Math.abs(Number(t.station)-Number(freq))<.01).sort((a,b)=>a.order-b.order)}
function trackById(id){return manifest.tracks.find(t=>t.id===id)||null}
function readFavorites(){try{const v=JSON.parse(localStorage.getItem(FAVORITES_KEY)||'[]');return Array.isArray(v)?v.filter(Boolean):[]}catch{return[]}}
function saveFavorites(){try{localStorage.setItem(FAVORITES_KEY,JSON.stringify(favorites))}catch{}}
function isFavorite(id){return favorites.includes(id)}
function favoriteMarkup(on){return `<span class="favorite-heart" aria-hidden="true">${on?'♥':'♡'}</span>`}

function installMainFavoriteButtons(){
  document.querySelectorAll('.skin-stage').forEach(stage=>{
    if(stage.querySelector('[data-main-favorite]'))return;
    const button=document.createElement('button');
    button.type='button';
    button.className='main-favorite-button';
    button.setAttribute('data-main-favorite','');
    button.innerHTML=favoriteMarkup(false);
    stage.appendChild(button);
  });
  syncMainFavoriteButtons();
}
function syncMainFavoriteButtons(){
  const id=api.snapshot().trackId;
  const on=!!id&&isFavorite(id);
  document.querySelectorAll('[data-main-favorite]').forEach(button=>{
    button.classList.toggle('active',on);
    button.setAttribute('aria-label',on?'Remove current song from favorites':'Favorite current song');
    button.setAttribute('aria-pressed',String(on));
    button.innerHTML=favoriteMarkup(on);
  });
}
function toggleFavorite(id){
  if(!id)return;
  if(isFavorite(id))favorites=favorites.filter(x=>x!==id);else favorites.push(id);
  saveFavorites();
  syncMainFavoriteButtons();
  renderOpenPanel();
}
function preservedState(){const s=api.snapshot();return{currentFreq:s.currentFreq,trackId:s.trackId,volume:s.volume,autoTune:s.autoTune,shuffle:s.shuffle,repeat:s.repeat,playbackIntent:s.playbackIntent}}
function chooseTrack(track,{forcePlay=false}={}){
  if(!track)return;
  const before=preservedState();
  api.restore({currentFreq:track.station,trackId:track.id,volume:before.volume,autoTune:before.autoTune,shuffle:before.shuffle,repeat:before.repeat});
  if(before.playbackIntent||forcePlay)api.togglePlay();
  lastSnapshot='';
  syncMainFavoriteButtons();
  renderOpenPanel();
}
function closeDrawer(){const drawer=document.getElementById('drawer');drawer?.classList.remove('open');drawer?.setAttribute('aria-hidden','true')}
function openPanel(which){
  closeDrawer();
  activePanel=which;
  const panel=which==='schedule'?schedulePanel:showsPanel;
  const other=which==='schedule'?showsPanel:schedulePanel;
  other.classList.remove('open');other.setAttribute('aria-hidden','true');
  panel.classList.add('open');panel.setAttribute('aria-hidden','false');
  backdrop.classList.add('open');backdrop.setAttribute('aria-hidden','false');
  document.body.classList.add('library-panel-open');
  renderOpenPanel();
  panel.querySelector('.library-close')?.focus({preventScroll:true});
}
function closePanel(){
  activePanel=null;
  schedulePanel.classList.remove('open');showsPanel.classList.remove('open');
  schedulePanel.setAttribute('aria-hidden','true');showsPanel.setAttribute('aria-hidden','true');
  backdrop.classList.remove('open');backdrop.setAttribute('aria-hidden','true');
  document.body.classList.remove('library-panel-open');
}
function renderOpenPanel(){
  syncMainFavoriteButtons();
  if(activePanel==='schedule')renderSchedule();else if(activePanel==='shows')renderShows();
  lastSnapshot=currentFingerprint();
}

function scheduleRow(t,currentId){
  const current=t.id===currentId;
  const final=t.id==='the-town-goes-quiet';
  const fav=isFavorite(t.id);
  return `<div class="schedule-track${current?' current':''}" data-track-row="${esc(t.id)}">
    <div class="track-copy"><div class="track-title-line"><span class="track-number">${t.order}.</span><span class="track-title-text">${esc(t.title)}</span>${final?'<span class="track-final">Ending</span>':''}</div><div class="track-meta-line">${fmt(t.durationSec)}</div></div>
    <button class="start-button" type="button" data-start-track="${esc(t.id)}">START HERE</button>
    <button class="favorite-button${fav?' active':''}" type="button" data-favorite="${esc(t.id)}" aria-pressed="${fav}" aria-label="${fav?'Remove from favorites':'Add to favorites'}">${favoriteMarkup(fav)}</button>
  </div>`
}
function renderSchedule(){
  const s=api.snapshot();
  const jumps=manifest.stations.map(st=>`<button type="button" class="station-jump${Math.abs(st.frequency-s.currentFreq)<.01?' active':''}" data-jump-station="${st.frequency}">${Number(st.frequency).toFixed(1)} · ${esc(st.name)}</button>`).join('');
  const blocks=manifest.stations.map(st=>`<section class="station-block${Math.abs(st.frequency-s.currentFreq)<.01?' current':''}" id="schedule-station-${String(st.frequency).replace('.','-')}">
    <div class="station-block-head"><span class="station-name">${esc(st.name)}</span><span class="station-freq">${Number(st.frequency).toFixed(1)} FM</span></div>
    <div class="station-track-list">${tracksFor(st.frequency).map(t=>scheduleRow(t,s.trackId)).join('')}</div>
  </section>`).join('');
  scheduleBody.innerHTML=`<div class="station-jumpbar">${jumps}</div>${blocks}`;
}

function showRow(t,currentId){
  const st=stationFor(t.station),current=t.id===currentId,fav=isFavorite(t.id);
  return `<div class="show-track${current?' current':''}">
    <div class="track-copy"><div class="track-title-line">${current?'<span class="live-dot"></span>':''}<span class="track-title-text">${esc(t.title)}</span></div><div class="track-meta-line">${Number(st.frequency).toFixed(1)} · ${esc(st.name)} · ${fmt(t.durationSec)}</div></div>
    <button class="play-track-button" type="button" data-play-track="${esc(t.id)}">▶ PLAY</button>
    <button class="favorite-button${fav?' active':''}" type="button" data-favorite="${esc(t.id)}" aria-pressed="${fav}" aria-label="${fav?'Remove from favorites':'Add to favorites'}">${favoriteMarkup(fav)}</button>
  </div>`
}
function renderShows(){
  const s=api.snapshot(),st=stationFor(s.currentFreq),current=trackById(s.trackId);
  const total=Number.isFinite(audio.duration)&&audio.duration>0?audio.duration:(current?.durationSec||0);
  const favTracks=favorites.map(trackById).filter(Boolean);
  const currentFav=current&&isFavorite(current.id);
  const signalRows=tracksFor(st.frequency).map(t=>showRow(t,s.trackId)).join('');
  const favoriteRows=favTracks.map(t=>showRow(t,s.trackId)).join('');
  showsBody.innerHTML=`
    <div class="now-card">
      <div><div class="now-label">Now Playing</div><div class="now-title">${esc(current?.title||'Signal Search')}</div><div class="now-meta">${Number(st.frequency).toFixed(1)} FM · ${esc(st.name)} · ${fmt(audio.currentTime)} / ${fmt(total)}</div></div>
      <div class="now-controls">
        <button class="library-control" type="button" data-show-prev aria-label="Previous song">◀</button>
        <button class="library-control play-main" type="button" data-show-play>${s.playbackIntent?'❚❚ PAUSE':'▶ PLAY'}</button>
        <button class="library-control" type="button" data-show-next aria-label="Next song">▶</button>
        ${current?`<button class="favorite-button${currentFav?' active':''}" type="button" data-favorite="${esc(current.id)}" aria-pressed="${currentFav}" aria-label="${currentFav?'Remove current song from favorites':'Favorite current song'}">${favoriteMarkup(currentFav)}</button>`:''}
      </div>
    </div>
    <div class="shows-tabs"><button class="shows-tab${showsTab==='signal'?' active':''}" type="button" data-shows-tab="signal">CURRENT SIGNAL</button><button class="shows-tab${showsTab==='favorites'?' active':''}" type="button" data-shows-tab="favorites">FAVORITES · ${favTracks.length}</button></div>
    <section class="shows-section${showsTab==='signal'?' active':''}" data-shows-section="signal"><div class="favorites-summary"><span>${Number(st.frequency).toFixed(1)} FM · ${esc(st.name)}</span><span>${tracksFor(st.frequency).length} songs</span></div><div class="show-list">${signalRows}</div></section>
    <section class="shows-section${showsTab==='favorites'?' active':''}" data-shows-section="favorites"><div class="favorites-summary"><span>Your saved Halloween rotation</span><span>${favTracks.length} saved</span></div>${favTracks.length?`<div class="favorites-list">${favoriteRows}</div>`:'<div class="favorite-empty">Tap the haunted heart beside any song to build your favorites list. It will still be here the next time you open the radio.</div>'}</section>`;
}

function currentFingerprint(){const s=api.snapshot();return[s.currentFreq,s.trackId,s.playbackIntent,s.shuffle,s.repeat,Math.floor(audio.currentTime),favorites.join(',')].join('|')}
function refreshIfNeeded(){
  syncMainFavoriteButtons();
  if(!activePanel)return;
  const f=currentFingerprint();
  if(f===lastSnapshot)return;
  lastSnapshot=f;
  renderOpenPanel();
}

async function loadManifest(){
  try{const r=await fetch('data/tracks.json',{cache:'no-store'});if(r.ok){const data=await r.json();if(Array.isArray(data.stations)&&Array.isArray(data.tracks)){manifest=data}}}catch{}
  syncMainFavoriteButtons();
  renderOpenPanel();
}

document.addEventListener('click',e=>{
  const scheduleHit=e.target.closest('[data-hit="schedule"]');
  const showsHit=e.target.closest('[data-hit="shows"]');
  if(scheduleHit||showsHit){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();openPanel(scheduleHit?'schedule':'shows');return}
},true);

document.addEventListener('click',e=>{
  const mainFavorite=e.target.closest('[data-main-favorite]');if(mainFavorite){e.preventDefault();e.stopPropagation();toggleFavorite(api.snapshot().trackId);return}
  const close=e.target.closest('[data-library-close]');if(close){closePanel();return}
  const jump=e.target.closest('[data-jump-station]');if(jump){document.getElementById(`schedule-station-${String(jump.dataset.jumpStation).replace('.','-')}`)?.scrollIntoView({behavior:'smooth',block:'start'});return}
  const start=e.target.closest('[data-start-track]');if(start){chooseTrack(trackById(start.dataset.startTrack),{forcePlay:false});return}
  const play=e.target.closest('[data-play-track]');if(play){chooseTrack(trackById(play.dataset.playTrack),{forcePlay:true});return}
  const favorite=e.target.closest('[data-favorite]');if(favorite){toggleFavorite(favorite.dataset.favorite);return}
  const tab=e.target.closest('[data-shows-tab]');if(tab){showsTab=tab.dataset.showsTab;renderShows();return}
  if(e.target.closest('[data-show-prev]')){api.previous();lastSnapshot='';syncMainFavoriteButtons();renderShows();return}
  if(e.target.closest('[data-show-next]')){api.next();lastSnapshot='';syncMainFavoriteButtons();renderShows();return}
  if(e.target.closest('[data-show-play]')){api.togglePlay();lastSnapshot='';setTimeout(renderShows,50);return}
  if(activePanel&&e.target.closest('[data-hit="home"]'))closePanel();
});
backdrop.addEventListener('click',closePanel);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&activePanel){e.preventDefault();e.stopImmediatePropagation();closePanel()}},true);
audio.addEventListener('play',()=>{lastSnapshot='';syncMainFavoriteButtons();renderOpenPanel()});
audio.addEventListener('pause',()=>{lastSnapshot='';syncMainFavoriteButtons();renderOpenPanel()});
audio.addEventListener('loadedmetadata',()=>{lastSnapshot='';syncMainFavoriteButtons();renderOpenPanel()});
audio.addEventListener('ended',()=>{lastSnapshot='';setTimeout(()=>{syncMainFavoriteButtons();renderOpenPanel()},40)});
installMainFavoriteButtons();
setInterval(refreshIfNeeded,750);
loadManifest();
})();
