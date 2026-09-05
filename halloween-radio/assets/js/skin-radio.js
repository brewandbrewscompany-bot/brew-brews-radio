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
const tracks=[
{id:'welcome-to-the-haunted-roast',title:'Welcome to the Haunted Roast',file:'https://brewandbrewscompany-bot.github.io/brew-brews-radio/halloween-radio/audio/welcome-to-the-haunted-roast.mp3',station:88.3,order:1,durationSec:309.5},
{id:'midnight-static',title:'Midnight Static',file:'https://brewandbrewscompany-bot.github.io/brew-brews-radio/halloween-radio/audio/midnight-static.mp3',station:88.3,order:2,durationSec:179.6},
{id:'dead-of-night',title:'Dead of Night',file:'https://brewandbrewscompany-bot.github.io/brew-brews-radio/halloween-radio/audio/dead-of-night.mp3',station:88.3,order:3,durationSec:238.4},
{id:'run-from-the-shadows',title:'Run from the Shadows',file:'https://brewandbrewscompany-bot.github.io/brew-brews-radio/halloween-radio/audio/run-from-the-shadows.mp3',station:88.3,order:4,durationSec:92.8},
{id:'it-knows-youre-awake',title:"It Knows You're Awake",file:'https://brewandbrewscompany-bot.github.io/brew-brews-radio/halloween-radio/audio/it-knows-youre-awake.mp3',station:88.3,order:5,durationSec:314.1},
{id:'coffin-lid-rag',title:'Coffin Lid Rag',file:'https://brewandbrewscompany-bot.github.io/brew-brews-radio/halloween-radio/audio/coffin-lid-rag.mp3',station:88.3,order:6,durationSec:141.5},
{id:'haunted-roast',title:'Haunted Roast',file:'https://brewandbrewscompany-bot.github.io/brew-brews-radio/halloween-radio/audio/haunted-roast.mp3',station:91.7,order:1,durationSec:268.0},
{id:'static-on-the-highway',title:'Static on the Highway',file:'https://brewandbrewscompany-bot.github.io/brew-brews-radio/halloween-radio/audio/static-on-the-highway.mp3',station:91.7,order:2,durationSec:177.4},
{id:'when-the-lights-go-out-v2',title:'When the Lights Go Out (Version 2)',file:'https://brewandbrewscompany-bot.github.io/brew-brews-radio/halloween-radio/audio/when-the-lights-go-out-v2.mp3',station:91.7,order:3,durationSec:263.5},
{id:'run-away-from-shadows',title:'Run Away from Shadows',file:'https://brewandbrewscompany-bot.github.io/brew-brews-radio/halloween-radio/audio/run-away-from-shadows.mp3',station:91.7,order:4,durationSec:149.8},
{id:'dead-air-interlude',title:'Dead Air Interlude',file:'https://brewandbrewscompany-bot.github.io/brew-brews-radio/halloween-radio/audio/dead-air-interlude.mp3',station:91.7,order:5,durationSec:131.9},
{id:'ironclad-walk',title:'Ironclad Walk',file:'https://brewandbrewscompany-bot.github.io/brew-brews-radio/halloween-radio/audio/ironclad-walk.mp3',station:95.9,order:1,durationSec:149.8},
{id:'they-prefer-the-dark-roast',title:'They Prefer the Dark Roast',file:'https://brewandbrewscompany-bot.github.io/brew-brews-radio/halloween-radio/audio/they-prefer-the-dark-roast.mp3',station:95.9,order:2,durationSec:153.7},
{id:'goblin-chase',title:'Goblin Chase',file:'https://brewandbrewscompany-bot.github.io/brew-brews-radio/halloween-radio/audio/goblin-chase.mp3',station:95.9,order:3,durationSec:150.2},
{id:'do-the-goblin-stomp',title:'Do the Goblin Stomp',file:'https://brewandbrewscompany-bot.github.io/brew-brews-radio/halloween-radio/audio/do-the-goblin-stomp.mp3',station:95.9,order:4,durationSec:198.8},
{id:'roaster-rattle',title:'Roaster Rattle',file:'https://brewandbrewscompany-bot.github.io/brew-brews-radio/halloween-radio/audio/roaster-rattle.mp3',station:95.9,order:5,durationSec:172.8},
{id:'black-cat-boogie',title:'Black Cat Boogie',file:'https://brewandbrewscompany-bot.github.io/brew-brews-radio/halloween-radio/audio/black-cat-boogie.mp3',station:95.9,order:6,durationSec:180.4},
{id:'brew-and-brews-after-dark',title:'Brew & Brews After Dark',file:'https://brewandbrewscompany-bot.github.io/brew-brews-radio/halloween-radio/audio/brew-and-brews-after-dark.mp3',station:99.5,order:1,durationSec:258.8},
{id:'the-witching-hour-v2',title:'The Witching Hour (Version 2)',file:'https://brewandbrewscompany-bot.github.io/brew-brews-radio/halloween-radio/audio/the-witching-hour-v2.mp3',station:99.5,order:2,durationSec:57.0},
{id:'when-the-lights-go-out',title:'When the Lights Go Out',file:'https://brewandbrewscompany-bot.github.io/brew-brews-radio/halloween-radio/audio/when-the-lights-go-out.mp3',station:99.5,order:3,durationSec:298.6},
{id:'skeleton-shuffle',title:'Skeleton Shuffle',file:'https://brewandbrewscompany-bot.github.io/brew-brews-radio/halloween-radio/audio/skeleton-shuffle.mp3',station:99.5,order:4,durationSec:103.0},
{id:'brew-and-brews-after-dark-v2',title:'Brew & Brews After Dark (Version 2)',file:'https://brewandbrewscompany-bot.github.io/brew-brews-radio/halloween-radio/audio/brew-and-brews-after-dark-v2.mp3',station:99.5,order:5,durationSec:289.8},
{id:'lanterns-in-the-fog',title:'Lanterns in the Fog',file:'https://brewandbrewscompany-bot.github.io/brew-brews-radio/halloween-radio/audio/lanterns-in-the-fog.mp3',station:99.5,order:6,durationSec:203.3},
{id:'ironclad',title:'IRONCLAD',file:'https://brewandbrewscompany-bot.github.io/brew-brews-radio/halloween-radio/audio/ironclad.mp3',station:103.1,order:1,durationSec:164.8},
{id:'voodoo-after-midnight',title:'Voodoo after Midnight',file:'https://brewandbrewscompany-bot.github.io/brew-brews-radio/halloween-radio/audio/voodoo-after-midnight.mp3',station:103.1,order:2,durationSec:149.5},
{id:'monsters-in-the-house',title:'Monsters in the House',file:'https://brewandbrewscompany-bot.github.io/brew-brews-radio/halloween-radio/audio/monsters-in-the-house.mp3',station:103.1,order:3,durationSec:228.7},
{id:'phantom-groove',title:'Phantom Groove',file:'https://brewandbrewscompany-bot.github.io/brew-brews-radio/halloween-radio/audio/phantom-groove.mp3',station:103.1,order:4,durationSec:150.0},
{id:'last-cup-before-dawn',title:'Last Cup Before Dawn',file:'https://brewandbrewscompany-bot.github.io/brew-brews-radio/halloween-radio/audio/last-cup-before-dawn.mp3',station:103.1,order:5,durationSec:174.6},
{id:'the-town-goes-quiet',title:'The Town Goes Quiet',file:'https://brewandbrewscompany-bot.github.io/brew-brews-radio/halloween-radio/audio/the-town-goes-quiet.mp3',station:103.1,order:6,durationSec:272.1},
{id:'the-witching-hour',title:'The Witching Hour',file:'https://brewandbrewscompany-bot.github.io/brew-brews-radio/halloween-radio/audio/the-witching-hour.mp3',station:106.7,order:1,durationSec:79.7},
{id:'full-moon-frequency',title:'Full Moon Frequency',file:'https://brewandbrewscompany-bot.github.io/brew-brews-radio/halloween-radio/audio/full-moon-frequency.mp3',station:106.7,order:2,durationSec:242.2},
{id:'howling-in-the-dark',title:'Howling in the Dark',file:'https://brewandbrewscompany-bot.github.io/brew-brews-radio/halloween-radio/audio/howling-in-the-dark.mp3',station:106.7,order:3,durationSec:40.7},
{id:'when-the-night-comes-alive',title:'When the Night Comes Alive',file:'https://brewandbrewscompany-bot.github.io/brew-brews-radio/halloween-radio/audio/when-the-night-comes-alive.mp3',station:106.7,order:4,durationSec:282.1},
{id:'boiler-room-bones',title:'Boiler Room Bones',file:'https://brewandbrewscompany-bot.github.io/brew-brews-radio/halloween-radio/audio/boiler-room-bones.mp3',station:106.7,order:5,durationSec:154.2}
];
const state={playbackIntent:false,currentFreq:103.1,volume:.78,autoTune:true,shuffle:false,repeat:false,trackIndex:new Map(),shuffleOrder:new Map(),audioCtx:null,staticNode:null,staticGain:null,transitionToken:0,drag:null,toastTimer:null,ghostTimer:null,autoTimer:null,discovered:new Set()};
const audio=document.getElementById('radioAudio');
const drawer=document.getElementById('drawer');
const autoSwitch=document.getElementById('autoSwitch');
const shuffleSwitch=document.getElementById('shuffleSwitch');
const repeatSwitch=document.getElementById('repeatSwitch');
const toast=document.getElementById('toast');
const sr=document.getElementById('sr');
audio.volume=state.volume;audio.pause();
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const key=f=>Number(f).toFixed(1);
const nearestStation=f=>stations.reduce((best,s)=>Math.abs(s.freq-f)<Math.abs(best.freq-f)?s:best,stations[0]);
const basePlaylist=f=>tracks.filter(t=>Math.abs(t.station-f)<.01).sort((a,b)=>a.order-b.order);
const shuffleCopy=list=>{const a=[...list];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
function buildShuffledPlaylist(freq,preserveId=null){const base=basePlaylist(freq);const ending=base.find(t=>t.id==='the-town-goes-quiet')||null;let pool=base.filter(t=>!ending||t.id!==ending.id);let first=null;if(preserveId){first=pool.find(t=>t.id===preserveId)||null;if(first)pool=pool.filter(t=>t.id!==first.id)}const ordered=[...(first?[first]:[]),...shuffleCopy(pool)];if(ending)ordered.push(ending);return ordered}
function playlist(freq){if(!state.shuffle)return basePlaylist(freq);const k=key(freq);let ids=state.shuffleOrder.get(k);if(!ids){const base=basePlaylist(freq),idx=clamp(state.trackIndex.get(k)??0,0,Math.max(0,base.length-1)),preserveId=base[idx]?.id||null;const shuffled=buildShuffledPlaylist(freq,preserveId);ids=shuffled.map(t=>t.id);state.shuffleOrder.set(k,ids);state.trackIndex.set(k,Math.max(0,shuffled.findIndex(t=>t.id===preserveId)))}const byId=new Map(basePlaylist(freq).map(t=>[t.id,t]));return ids.map(id=>byId.get(id)).filter(Boolean)}
const currentTrack=()=>{const st=nearestStation(state.currentFreq);const list=playlist(st.freq);const i=clamp(state.trackIndex.get(key(st.freq))??0,0,Math.max(0,list.length-1));state.trackIndex.set(key(st.freq),i);return list[i]||null};
const isFinalSignoff=t=>!!t&&t.id==='the-town-goes-quiet'&&Math.abs(nearestStation(state.currentFreq).freq-103.1)<.01;
const formatTime=n=>{if(!Number.isFinite(n)||n<0)return'--:--';const m=Math.floor(n/60),s=String(Math.floor(n%60)).padStart(2,'0');return`${m}:${s}`};
const shortNames={'88.3':'GRAVEYARD','91.7':'DEAD AIR','95.9':'THE GRIND','99.5':'AFTER DARK','103.1':'B&B RADIO','106.7':'WITCHING'};
const DIAL_MIN_FREQ=88;
const DIAL_MAX_FREQ=108;
const TUNE_KNOB_MIN_FREQ=88.3;
const TUNE_KNOB_MAX_FREQ=106.7;
const dialPct=f=>clamp((f-DIAL_MIN_FREQ)/(DIAL_MAX_FREQ-DIAL_MIN_FREQ),0,1);
const tuneKnobPct=f=>clamp((f-TUNE_KNOB_MIN_FREQ)/(TUNE_KNOB_MAX_FREQ-TUNE_KNOB_MIN_FREQ),0,1);
function showToast(title,text=''){clearTimeout(state.toastTimer);toast.innerHTML=`<strong>${title}</strong>${text}`;sr.textContent=`${title} ${text}`;toast.classList.add('show');state.toastTimer=setTimeout(()=>toast.classList.remove('show'),2100)}
function ensureCtx(){if(state.audioCtx)return state.audioCtx;const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return null;state.audioCtx=new AC();return state.audioCtx}
function stopStatic(){if(state.staticNode){try{state.staticNode.stop()}catch{};try{state.staticNode.disconnect()}catch{};state.staticNode=null}if(state.staticGain){try{state.staticGain.disconnect()}catch{};state.staticGain=null}}
function startStatic(level=.26){if(!state.playbackIntent)return;const ctx=ensureCtx();if(!ctx)return;if(ctx.state==='suspended')ctx.resume().catch(()=>{});stopStatic();const len=Math.floor(ctx.sampleRate*1.5),buf=ctx.createBuffer(1,len,ctx.sampleRate),d=buf.getChannelData(0);let last=0;for(let i=0;i<len;i++){const w=Math.random()*2-1;last=last*.9+w*.1;d[i]=(w*.33+last*.67)*.55}const src=ctx.createBufferSource();src.buffer=buf;src.loop=true;const filter=ctx.createBiquadFilter();filter.type='bandpass';filter.frequency.value=1350;filter.Q.value=.65;const gain=ctx.createGain();gain.gain.value=state.volume*level;src.connect(filter).connect(gain).connect(ctx.destination);src.start();state.staticNode=src;state.staticGain=gain}
function setStagePlaying(v){document.querySelectorAll('.skin-stage').forEach(s=>s.classList.toggle('is-playing',v));document.querySelectorAll('[data-hit="play"]').forEach(b=>b.setAttribute('aria-label',v?'Pause':'Play'))}
function trackUrl(file){const liveBase='https://brewandbrewscompany-bot.github.io/brew-brews-radio/halloween-radio/';return location.protocol==='file:'&&!/^https?:/i.test(file)?liveBase+file:file}
function setTrackSource(track){if(!track)return;const src=trackUrl(track.file);if(audio.getAttribute('src')!==src){audio.src=src;audio.load()}}
function updateStationLayers(){document.querySelectorAll('[data-stations]').forEach(layer=>{layer.innerHTML='';stations.forEach(st=>{const b=document.createElement('button');b.className='station-label'+(nearestStation(state.currentFreq).freq===st.freq?' active':'');b.type='button';b.innerHTML=`<strong>${st.freq.toFixed(1)}</strong><span>${shortNames[key(st.freq)]}</span>`;b.addEventListener('click',e=>{e.stopPropagation();tuneTo(st.freq)});layer.appendChild(b)})})}
function updateNeedles(){const p=dialPct(state.currentFreq);const knobP=tuneKnobPct(state.currentFreq);document.querySelectorAll('[data-needle]').forEach((n,i)=>{n.style.left=i===0?`${38.8+p*32.8}%`:`${18.0+p*62.5}%`});const strength=clamp(1-Math.abs(nearestStation(state.currentFreq).freq-state.currentFreq)/1.45,0,.98);document.querySelectorAll('[data-meter]').forEach(m=>m.style.transform=`translateX(-50%) rotate(${-43+strength*86}deg)`);document.querySelectorAll('[data-tune-marker]').forEach(m=>m.style.setProperty('--rot',`${-132+knobP*264}deg`));document.querySelectorAll('[data-volume-marker]').forEach(m=>m.style.setProperty('--rot',`${-135+state.volume*270}deg`))}
function updateNow(){const st=nearestStation(state.currentFreq),list=playlist(st.freq),track=currentTrack(),idx=state.trackIndex.get(key(st.freq))??0;document.querySelectorAll('[data-title]').forEach(e=>e.textContent=track?track.title:'SIGNAL SEARCH');document.querySelectorAll('[data-meta]').forEach(e=>e.textContent=`${st.name} · ${st.freq.toFixed(1)}`);document.querySelectorAll('[data-position]').forEach(e=>e.textContent=track?`${idx+1} / ${list.length}`:'0 / 0');document.querySelectorAll('[data-time]').forEach(e=>e.textContent=`${formatTime(audio.currentTime)} / ${formatTime(Number.isFinite(audio.duration)?audio.duration:track?.durationSec)}`);const pct=Number.isFinite(audio.duration)&&audio.duration>0?clamp(audio.currentTime/audio.duration,0,1)*100:0;document.querySelectorAll('[data-progress]').forEach(e=>e.style.width=`${pct}%`);document.getElementById('drawerFreq').textContent=`${st.freq.toFixed(1)} FM`;document.getElementById('drawerStation').textContent=st.name}
function updateUI(){updateStationLayers();updateNeedles();updateNow()}
async function playCurrent(){const track=currentTrack();if(!track)return;setTrackSource(track);audio.volume=state.volume;stopStatic();try{await audio.play()}catch{showToast('Press Play Again','The browser blocked playback.')}}
function silence(){audio.pause();stopStatic();setStagePlaying(false)}
async function togglePlay(){if(!state.playbackIntent){state.playbackIntent=true;const ctx=ensureCtx();if(ctx&&ctx.state==='suspended')await ctx.resume().catch(()=>{});setStagePlaying(true);await playCurrent();showToast('Live On Air',`${nearestStation(state.currentFreq).freq.toFixed(1)} · ${nearestStation(state.currentFreq).name}`)}else{state.playbackIntent=false;silence();showToast('Receiver Silent','Playback stopped.')}updateUI()}
async function transitionToStation(freq){const token=++state.transitionToken;const wasPlaying=state.playbackIntent;if(wasPlaying){audio.pause();startStatic(.36);showToast('Tuning…',`${freq.toFixed(1)} FM`);await new Promise(r=>setTimeout(r,620));if(token!==state.transitionToken)return;stopStatic()}state.currentFreq=freq;const st=nearestStation(freq);state.trackIndex.set(key(st.freq),state.trackIndex.get(key(st.freq))??0);setTrackSource(currentTrack());updateUI();if(wasPlaying){setStagePlaying(true);await playCurrent()}}
function tuneTo(freq){const st=nearestStation(freq);transitionToStation(st.freq)}
function changeTrack(dir,{announce=true}={}){const st=nearestStation(state.currentFreq);let list=playlist(st.freq);if(!list.length)return;let idx=state.trackIndex.get(key(st.freq))??0;if(state.shuffle&&dir>0&&idx===list.length-1&&!isFinalSignoff(list[idx])){const shuffled=buildShuffledPlaylist(st.freq);state.shuffleOrder.set(key(st.freq),shuffled.map(t=>t.id));list=shuffled;idx=0}else{idx=(idx+dir+list.length)%list.length}state.trackIndex.set(key(st.freq),idx);setTrackSource(currentTrack());audio.currentTime=0;updateUI();if(state.playbackIntent)playCurrent();if(announce)showToast(dir>0?'Next Song':'Previous Song',currentTrack()?.title||'')}
function setShuffle(enabled){const saved=new Map();stations.forEach(st=>{const list=playlist(st.freq),idx=clamp(state.trackIndex.get(key(st.freq))??0,0,Math.max(0,list.length-1));saved.set(key(st.freq),list[idx]?.id||null)});state.shuffle=enabled;state.shuffleOrder.clear();stations.forEach(st=>{const id=saved.get(key(st.freq));if(enabled){const shuffled=buildShuffledPlaylist(st.freq,id);state.shuffleOrder.set(key(st.freq),shuffled.map(t=>t.id));state.trackIndex.set(key(st.freq),Math.max(0,shuffled.findIndex(t=>t.id===id)))}else{const base=basePlaylist(st.freq);state.trackIndex.set(key(st.freq),Math.max(0,base.findIndex(t=>t.id===id)))}});setTrackSource(currentTrack());updateUI()}
function setRepeat(enabled){state.repeat=enabled;repeatSwitch.classList.toggle('on',enabled);repeatSwitch.setAttribute('aria-pressed',String(enabled))}
function setVolume(v,announce=false){state.volume=clamp(v,0,1);audio.volume=state.volume;if(state.staticGain)state.staticGain.gain.value=state.volume*.34;updateNeedles();if(announce)showToast('Volume',`${Math.round(state.volume*100)}%`)}
function discover(id,title,text){if(state.discovered.has(id)){showToast(title,text);return}state.discovered.add(id);document.getElementById('hauntCount').textContent=`${state.discovered.size} / 9`;showToast(title,text)}
function toggleDrawer(open=!drawer.classList.contains('open')){drawer.classList.toggle('open',open);drawer.setAttribute('aria-hidden',String(!open))}
function bindDrag(el,type){el.addEventListener('pointerdown',e=>{state.drag={type,lastX:e.clientX};el.setPointerCapture?.(e.pointerId);e.preventDefault()});el.addEventListener('pointermove',e=>{if(!state.drag||state.drag.type!==type)return;const dx=e.clientX-state.drag.lastX;state.drag.lastX=e.clientX;if(type==='volume')setVolume(state.volume+dx*.0048);else{state.currentFreq=Math.round(clamp(state.currentFreq+dx*.035,88,108)*10)/10;updateUI()}e.preventDefault()});const finish=()=>{if(!state.drag||state.drag.type!==type)return;const was=state.drag.type;state.drag=null;if(was==='volume')showToast('Volume',`${Math.round(state.volume*100)}%`);else tuneTo(nearestStation(state.currentFreq).freq)};el.addEventListener('pointerup',finish);el.addEventListener('pointercancel',finish)}
document.querySelectorAll('[data-hit="play"]').forEach(b=>b.addEventListener('click',togglePlay));
document.querySelectorAll('[data-hit="prev"]').forEach(b=>b.addEventListener('click',()=>changeTrack(-1)));
document.querySelectorAll('[data-hit="next"]').forEach(b=>b.addEventListener('click',()=>changeTrack(1)));
document.querySelectorAll('[data-hit="volume"]').forEach(b=>bindDrag(b,'volume'));
document.querySelectorAll('[data-hit="tune"],[data-hit="tuner"]').forEach(b=>bindDrag(b,'tune'));
document.querySelectorAll('[data-hit="mug"]').forEach(b=>b.addEventListener('click',()=>discover('mug','The Night Roast','The cup never stops steaming.')));
document.querySelectorAll('[data-hit="tube"]').forEach(b=>b.addEventListener('click',()=>{discover('tube','Vacuum Tube Awakened','Glass, filament, and a little too much voltage.');if(state.playbackIntent){const ctx=ensureCtx();if(ctx&&ctx.state==='suspended')ctx.resume().catch(()=>{});startStatic(.13);setTimeout(()=>{if(state.playbackIntent){stopStatic();playCurrent()}},180)}}));
document.querySelectorAll('[data-hit="display"]').forEach(b=>b.addEventListener('click',()=>discover('display','Now Brewing',currentTrack()?.title||'Signal search')));
document.querySelectorAll('[data-hit="meter"]').forEach(b=>b.addEventListener('click',()=>discover('meter','Signal Instrument','The needle knows when the room is listening.')));
document.querySelectorAll('[data-hit="witch"]').forEach(b=>b.addEventListener('click',()=>discover('witch','Witching Hour','Midnight – 5AM · Darker tunes. Deeper brews.')));
document.querySelectorAll('[data-hit="brand"]').forEach(b=>b.addEventListener('click',()=>discover('brand','Station Crest Found','Brew & Brews Coffee Roastery is still broadcasting.')));
document.querySelectorAll('[data-hit="home"]').forEach(b=>b.addEventListener('click',()=>showToast('Home','You are already at the receiver.')));
document.querySelectorAll('[data-hit="schedule"]').forEach(b=>b.addEventListener('click',()=>showToast('Schedule','Witching Hour · Midnight – 5AM')));
document.querySelectorAll('[data-hit="shows"]').forEach(b=>b.addEventListener('click',()=>showToast('Shows','Six haunted frequencies are loaded.')));
document.querySelectorAll('[data-hit="merch"]').forEach(b=>b.addEventListener('click',()=>showToast('Merch','Broadcast shop link can be connected here.')));
document.querySelectorAll('[data-hit="contact"]').forEach(b=>b.addEventListener('click',()=>showToast('Contact','Contact link can be connected here.')));
document.querySelectorAll('[data-hit="menu"]').forEach(b=>b.addEventListener('click',()=>toggleDrawer(true)));
document.getElementById('closeDrawer').addEventListener('click',()=>toggleDrawer(false));
function setAutoTune(enabled,announce=false){state.autoTune=!!enabled;autoSwitch.classList.toggle('on',state.autoTune);autoSwitch.setAttribute('aria-pressed',String(state.autoTune));if(announce)showToast('Haunted Auto Tune',state.autoTune?'On':'Off');scheduleAuto(true)}
autoSwitch.addEventListener('click',()=>setAutoTune(!state.autoTune,true));
shuffleSwitch.addEventListener('click',()=>{const enabled=!state.shuffle;setShuffle(enabled);shuffleSwitch.classList.toggle('on',enabled);shuffleSwitch.setAttribute('aria-pressed',String(enabled));showToast('Shuffle',enabled?'On · signoff stays last':'Off · station order restored')});
repeatSwitch.addEventListener('click',()=>{setRepeat(!state.repeat);showToast('Repeat Track',state.repeat?'On':'Off')});

window.BBRadio={
  snapshot:()=>{const st=nearestStation(state.currentFreq),t=currentTrack();return{currentFreq:st.freq,stationName:st.name,trackId:t?.id||null,trackTitle:t?.title||'',volume:state.volume,autoTune:state.autoTune,shuffle:state.shuffle,repeat:state.repeat,playbackIntent:state.playbackIntent}},
  restore:(saved={})=>{
    state.playbackIntent=false;silence();
    if(Number.isFinite(Number(saved.volume)))setVolume(Number(saved.volume),false);
    setAutoTune(saved.autoTune!==false,false);
    setRepeat(!!saved.repeat);
    state.shuffle=false;state.shuffleOrder.clear();
    const chosen=tracks.find(t=>t.id===saved.trackId)||null;
    const targetFreq=chosen?chosen.station:nearestStation(Number(saved.currentFreq)||103.1).freq;
    state.currentFreq=targetFreq;
    if(chosen){const base=basePlaylist(targetFreq);state.trackIndex.set(key(targetFreq),Math.max(0,base.findIndex(t=>t.id===chosen.id)))}
    else state.trackIndex.set(key(targetFreq),state.trackIndex.get(key(targetFreq))??0);
    setTrackSource(currentTrack());
    if(saved.shuffle)setShuffle(true);
    shuffleSwitch.classList.toggle('on',state.shuffle);shuffleSwitch.setAttribute('aria-pressed',String(state.shuffle));
    repeatSwitch.classList.toggle('on',state.repeat);repeatSwitch.setAttribute('aria-pressed',String(state.repeat));
    silence();updateUI();
  },
  setVolume:v=>setVolume(Number(v),false),
  setAutoTune:enabled=>setAutoTune(enabled,false),
  setShuffle:enabled=>{setShuffle(!!enabled);shuffleSwitch.classList.toggle('on',state.shuffle);shuffleSwitch.setAttribute('aria-pressed',String(state.shuffle))},
  setRepeat:enabled=>setRepeat(!!enabled),
  next:()=>changeTrack(1,{announce:false}),
  previous:()=>changeTrack(-1,{announce:false}),
  togglePlay
};

function scheduleAuto(reset=false)
{if(reset&&state.autoTimer)clearTimeout(state.autoTimer);if(!state.autoTune)return;state.autoTimer=setTimeout(()=>{if(state.autoTune&&!state.drag&&!isFinalSignoff(currentTrack())&&Math.random()<.62){let st=stations[Math.floor(Math.random()*stations.length)];if(st.freq===nearestStation(state.currentFreq).freq)st=stations[(stations.indexOf(st)+1)%stations.length];transitionToStation(st.freq)}scheduleAuto()},19000+Math.random()*26000)}
function scheduleGhost(){clearTimeout(state.ghostTimer);state.ghostTimer=setTimeout(()=>{const ghost=matchMedia('(max-width:760px)').matches?document.querySelector('.phone [data-ghost]'):document.querySelector('.desktop [data-ghost]');ghost.classList.remove('visit');void ghost.offsetWidth;ghost.classList.add('visit');if(!state.autoTune&&!isFinalSignoff(currentTrack())&&Math.random()<.42){const st=stations[Math.floor(Math.random()*stations.length)];setTimeout(()=>{if(!isFinalSignoff(currentTrack()))transitionToStation(st.freq)},2300)}scheduleGhost()},15000+Math.random()*24000)}
audio.addEventListener('timeupdate',updateNow);
audio.addEventListener('loadedmetadata',updateNow);
audio.addEventListener('ended',()=>{const t=currentTrack();if(isFinalSignoff(t)){state.playbackIntent=false;silence();showToast('Transmission Ended','Good night, Louisburg.');updateUI();return}if(state.repeat&&state.playbackIntent){audio.currentTime=0;playCurrent();updateUI();return}changeTrack(1,{announce:false})});
document.addEventListener('keydown',e=>{if(e.key===' '&&!['INPUT','TEXTAREA','BUTTON'].includes(document.activeElement?.tagName)){e.preventDefault();togglePlay()}if(e.key==='Escape')toggleDrawer(false)});
// Initial state: load metadata only, never play.
state.playbackIntent=false;state.shuffle=false;state.repeat=false;shuffleSwitch.classList.remove('on');shuffleSwitch.setAttribute('aria-pressed','false');repeatSwitch.classList.remove('on');repeatSwitch.setAttribute('aria-pressed','false');setTrackSource(currentTrack());silence();updateUI();scheduleAuto();scheduleGhost();
})();
