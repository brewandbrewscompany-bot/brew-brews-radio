(() => {
const tracks=window.BB_PLAYLIST||[],$=id=>document.getElementById(id),audio=$("audio");
let current=Number(localStorage.getItem("bbCurrentTrack")||0);if(!tracks[current])current=0;
let genre="All",shuffle=localStorage.getItem("bbShuffle")==="true",repeat=localStorage.getItem("bbRepeat")==="true",restore=Number(localStorage.getItem("bbPosition")||0);
const favs=new Set(JSON.parse(localStorage.getItem("bbFavorites")||"[]"));
const ids=["miniCover","miniTitle","miniArtist","miniFavorite","miniProgress","miniCurrent","miniDuration","playBtn","prevBtn","nextBtn","shuffleBtn","repeatBtn","fullPlayer","fullBackdrop","closeFullPlayer","fullCover","fullTitle","fullArtist","fullProgress","fullCurrent","fullDuration","fullPlay","fullPrev","fullNext","fullShuffle","fullRepeat","fullFavorite","volume","searchInput","genreFilters","trackGrid","openFullPlayer"];
const e={};ids.forEach(id=>e[id]=$(id));
const fmt=s=>Number.isFinite(s)?`${Math.floor(s/60)}:${Math.floor(s%60).toString().padStart(2,"0")}`:"0:00";
function saveFavs(){localStorage.setItem("bbFavorites",JSON.stringify([...favs]))}
function state(){[e.shuffleBtn,e.fullShuffle].forEach(x=>x.classList.toggle("active-control",shuffle));[e.repeatBtn,e.fullRepeat].forEach(x=>x.classList.toggle("active-control",repeat));const f=favs.has(tracks[current].id);e.miniFavorite.textContent=f?"♥":"♡";e.fullFavorite.textContent=f?"♥ Favorited":"♡ Favorite"}
function genres(){const all=["All","Favorites",...new Set(tracks.map(t=>t.genre.split(",")[0].trim()))];e.genreFilters.innerHTML="";all.forEach(g=>{const b=document.createElement("button");b.className="chip"+(g===genre?" active":"");b.textContent=g;b.onclick=()=>{genre=g;genres();render()};e.genreFilters.appendChild(b)})}
function render(){const q=e.searchInput.value.toLowerCase();e.trackGrid.innerHTML="";tracks.forEach((t,i)=>{if(genre!=="All"&&!(genre==="Favorites"?favs.has(t.id):t.genre.toLowerCase().includes(genre.toLowerCase())))return;if(q&&!`${t.title} ${t.artist} ${t.genre}`.toLowerCase().includes(q))return;const b=document.createElement("button");b.className="card"+(i===current?" active":"");b.innerHTML=`<span class="badge">NOW PLAYING</span><img src="${t.cover}" alt=""><h3>${t.title}</h3><p>${t.genre}</p>`;b.onclick=()=>i===current?toggle():load(i,0,true);e.trackGrid.appendChild(b)})}
function sync(){const t=tracks[current];e.miniCover.src=e.fullCover.src=t.cover;e.miniTitle.textContent=e.fullTitle.textContent=t.title;e.miniArtist.textContent=e.fullArtist.textContent=t.artist;e.fullBackdrop.style.backgroundImage=`url("${t.cover}")`;state();render();if("mediaSession"in navigator)navigator.mediaSession.metadata=new MediaMetadata({title:t.title,artist:t.artist,album:"Brew & Brews Radio",artwork:[{src:t.cover,sizes:"512x512",type:"image/png"}]})}
function load(i,start=0,auto=false){current=i;localStorage.setItem("bbCurrentTrack",current);restore=start;audio.src=tracks[current].audio;audio.loop=repeat;sync();if(auto)play()}
async function play(){try{await audio.play()}catch(err){console.error(err)}}function pause(){audio.pause()}function toggle(){audio.paused?play():pause()}
function next(){let n;if(shuffle&&tracks.length>1){do{n=Math.floor(Math.random()*tracks.length)}while(n===current)}else n=(current+1)%tracks.length;load(n,0,true)}
function prev(){if(audio.currentTime>4){audio.currentTime=0;return}load((current-1+tracks.length)%tracks.length,0,true)}
function fav(){const id=tracks[current].id;favs.has(id)?favs.delete(id):favs.add(id);saveFavs();state();if(genre==="Favorites")render()}
function seek(input){if(audio.duration)audio.currentTime=Number(input.value)/100*audio.duration}
e.playBtn.onclick=e.fullPlay.onclick=toggle;e.prevBtn.onclick=e.fullPrev.onclick=prev;e.nextBtn.onclick=e.fullNext.onclick=next;
e.shuffleBtn.onclick=e.fullShuffle.onclick=()=>{shuffle=!shuffle;localStorage.setItem("bbShuffle",shuffle);state()};
e.repeatBtn.onclick=e.fullRepeat.onclick=()=>{repeat=!repeat;audio.loop=repeat;localStorage.setItem("bbRepeat",repeat);state()};
e.miniFavorite.onclick=e.fullFavorite.onclick=fav;e.openFullPlayer.onclick=()=>{e.fullPlayer.hidden=false;document.body.style.overflow="hidden"};e.closeFullPlayer.onclick=()=>{e.fullPlayer.hidden=true;document.body.style.overflow=""};
e.miniProgress.oninput=()=>seek(e.miniProgress);e.fullProgress.oninput=()=>seek(e.fullProgress);e.searchInput.oninput=render;
e.volume.oninput=()=>{audio.volume=Number(e.volume.value);localStorage.setItem("bbVolume",e.volume.value)};
audio.onloadedmetadata=()=>{e.miniDuration.textContent=e.fullDuration.textContent=fmt(audio.duration);if(restore>0&&restore<audio.duration-2)audio.currentTime=restore;restore=0};
audio.ontimeupdate=()=>{const p=audio.duration?audio.currentTime/audio.duration*100:0;e.miniProgress.value=e.fullProgress.value=p;e.miniCurrent.textContent=e.fullCurrent.textContent=fmt(audio.currentTime);e.miniDuration.textContent=e.fullDuration.textContent=fmt(audio.duration);localStorage.setItem("bbPosition",audio.currentTime)};
audio.onplay=()=>{e.playBtn.textContent=e.fullPlay.textContent="❚❚";render()};audio.onpause=()=>{e.playBtn.textContent=e.fullPlay.textContent="▶";render()};audio.onended=()=>{localStorage.setItem("bbPosition","0");if(!repeat)next()};
const v=Number(localStorage.getItem("bbVolume"));audio.volume=Number.isFinite(v)?v:.8;e.volume.value=audio.volume;
if("mediaSession"in navigator){navigator.mediaSession.setActionHandler("play",play);navigator.mediaSession.setActionHandler("pause",pause);navigator.mediaSession.setActionHandler("previoustrack",prev);navigator.mediaSession.setActionHandler("nexttrack",next)}
if("serviceWorker"in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("service-worker.js"));
genres();load(current,restore,false);
})();