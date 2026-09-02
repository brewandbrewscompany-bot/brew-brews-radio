// Louisburg Local V4 — isolated Wildcat schedule data bridge.
// Keeps Arbiter home/away athletics available to Wildcat Territory without weakening town-feed locality rules.
(function(){
  let snapshotItems=[];
  let townStateItems=null;
  let screenWrapped=false;
  const normalRenderEvents=typeof renderEvents==='function'?renderEvents:null;

  function mark(item){
    return Object.assign({},item,{
      __wildcatSnapshot:true,
      rankScore:Number(item.rankScore||0),
      designationLabels:Array.isArray(item.designationLabels)?item.designationLabels:[]
    });
  }

  function isSnapshot(item){return !!(item&&item.__wildcatSnapshot)}
  function isArbiter(item){return /arbiterlive\.com/i.test(String(item&&item.originalUrl||''))}
  function ymd(item){return String(item&&item.date||'').slice(0,10)}
  function isSchoolish(item){
    const org=String(item&&item.organization||'').toLowerCase();
    const url=String(item&&item.originalUrl||'').toLowerCase();
    const body=[item&&item.headline,item&&item.summary,item&&item.organization].filter(Boolean).join(' ').toLowerCase();
    return /arbiterlive\.com/.test(url)||/usd 416|louisburg high school|louisburg middle school|broadmoor|rockville|circle grove/.test(org)||/\busd 416\b/.test(body);
  }

  function activateWildcatsDataset(){
    if(!snapshotItems.length||!state||!Array.isArray(state.items))return;
    if(state.items.some(isSnapshot))return;

    // Preserve the exact town/Hub Feed state before the school-only schedule is attached.
    townStateItems=state.items.slice();

    // Arbiter items already accepted by Hub Feed (normally home games) are temporarily
    // replaced by the richer official snapshot while Wildcat Territory is open.
    // They are restored untouched as soon as the user leaves Wildcat Territory.
    const territoryBase=townStateItems.filter(i=>!isArbiter(i));
    state.items=[...territoryBase,...snapshotItems.map(mark)];
  }

  function restoreTownDataset(){
    if(!state||!Array.isArray(state.items))return;
    if(state.items.some(isSnapshot)&&Array.isArray(townStateItems))state.items=townStateItems.slice();
    else if(state.items.some(isSnapshot))state.items=state.items.filter(i=>!isSnapshot(i));
    townStateItems=null;
  }

  function installScreenIsolation(){
    if(screenWrapped||typeof showScreen!=='function')return;
    screenWrapped=true;
    const normalShowScreen=showScreen;
    showScreen=function(name){
      if(name==='wildcats')activateWildcatsDataset();
      else restoreTownDataset();
      return normalShowScreen(name);
    };
  }

  function restoreNormalTownEvents(){
    // wildcats-territory.js adds the page/jump UI, but the normal Events page must keep
    // the backend locality decision. That lets accepted HOME games remain town events
    // while AWAY snapshot-only games can never enter the ordinary town event list.
    if(normalRenderEvents)renderEvents=normalRenderEvents;
  }

  function refreshTerritoryIfOpen(){
    if(!state||state.screen!=='wildcats')return;
    if(!state.items.some(isSnapshot))activateWildcatsDataset();
    if(typeof window.showWildcatsTerritory==='function')window.showWildcatsTerritory();
  }

  function itemById(id){
    const all=[...(Array.isArray(state&&state.items)?state.items:[]),...snapshotItems,...(Array.isArray(townStateItems)?townStateItems:[])];
    return all.find(i=>String(i&&i.id||'')===String(id||''))||null;
  }

  function minutesFromTime(value){
    const raw=String(value||'').trim().toUpperCase();
    if(!raw)return null;
    let m=raw.match(/\b(\d{1,2})(?::(\d{2}))?\s*(AM|PM)\b/);
    if(m){
      let h=Number(m[1])%12,min=Number(m[2]||0);
      if(m[3]==='PM')h+=12;
      return h*60+min;
    }
    m=raw.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
    return m?Number(m[1])*60+Number(m[2]):null;
  }

  function isTownEvent(item){
    if(!item||isSnapshot(item)||isSchoolish(item)||ymd(item)<String(typeof lbToday==='function'?lbToday():'').slice(0,10))return false;
    if(typeof fresh==='function'&&!fresh(item))return false;
    if(String(item.type||'').toUpperCase()==='EVENT')return true;
    return typeof catMatch==='function'?catMatch(item,'EVENTS'):false;
  }

  function townEventsSameDate(item){
    const base=Array.isArray(townStateItems)?townStateItems:(Array.isArray(state&&state.items)?state.items:[]);
    const date=ymd(item);
    return base.filter(t=>isTownEvent(t)&&ymd(t)===date);
  }

  function rangesOverlap(a,b){
    const aStart=minutesFromTime(a&&a.time),bStart=minutesFromTime(b&&b.time);
    if(aStart==null||bStart==null)return false;
    const aEnd=minutesFromTime(a&&a.endTime),bEnd=minutesFromTime(b&&b.endTime);
    if(aEnd!=null||bEnd!=null){
      const ae=aEnd!=null?(aEnd<aStart?aEnd+1440:aEnd):aStart;
      const be=bEnd!=null?(bEnd<bStart?bEnd+1440:bEnd):bStart;
      return Math.max(aStart,bStart)<=Math.min(ae,be);
    }
    // Without published end times, keep the warning conservative: only starts within 60 minutes.
    return Math.abs(aStart-bStart)<=60;
  }

  function overlapText(item){
    const same=townEventsSameDate(item);
    if(!same.length)return '';
    return same.some(t=>rangesOverlap(item,t))?'Possible time overlap':'Town event also this day';
  }

  function installSourceStyle(){
    if(document.getElementById('wildcats-source-link-style'))return;
    const style=document.createElement('style');
    style.id='wildcats-source-link-style';
    style.textContent='.wtOfficialLink{display:inline-flex;align-items:center;gap:4px;margin-top:7px;border:1px solid #d9cde0;border-radius:999px;padding:6px 9px;background:#fff;color:var(--purple);font-size:9px;font-weight:900;text-decoration:none}.wtListCard.town .wtOfficialLink{color:#76551b;border-color:#e5d6b8;background:#fffaf0}';
    document.head.appendChild(style);
  }

  function enhanceTerritory(root=document){
    installSourceStyle();
    root.querySelectorAll&&root.querySelectorAll('.wtListCard[data-id]').forEach(card=>{
      const item=itemById(card.dataset.id);if(!item)return;
      if(card.classList.contains('school')){
        const label=overlapText(item),conflict=card.querySelector('.wtConflict');
        if(conflict&&label)conflict.textContent=`⚑ ${label}`;
      }
      const info=card.querySelector('.wtListInfo'),url=String(item.originalUrl||'');
      if(info&&/^https?:\/\//i.test(url)&&!info.querySelector('[data-wt-source]')){
        const a=document.createElement('a');
        a.className='wtOfficialLink';a.dataset.wtSource='1';a.href=url;a.target='_blank';a.rel='noopener noreferrer';
        a.textContent=card.classList.contains('school')?(isArbiter(item)?'Official ArbiterLive source ↗':'Official school source ↗'):'Town event source ↗';
        a.addEventListener('click',e=>e.stopPropagation());
        info.appendChild(a);
      }
    });
    root.querySelectorAll&&root.querySelectorAll('.wtMini.school[data-id]').forEach(card=>{
      const item=itemById(card.dataset.id),label=item?overlapText(item):'';
      const em=card.querySelector('em');if(em&&label)em.textContent=label;
    });
  }

  function installTerritoryObserver(){
    enhanceTerritory();
    if(!window.MutationObserver)return;
    const observer=new MutationObserver(mutations=>{
      for(const m of mutations){
        if(m.target&&m.target.closest&&m.target.closest('#wildcatsScreen')){enhanceTerritory(m.target.closest('#wildcatsScreen'));break;}
        for(const n of m.addedNodes||[]){
          if(n.nodeType===1&&(n.id==='wildcatsScreen'||(n.closest&&n.closest('#wildcatsScreen')))){enhanceTerritory(n.id==='wildcatsScreen'?n:n.closest('#wildcatsScreen'));return;}
        }
      }
    });
    observer.observe(document.body,{subtree:true,childList:true});
  }

  function loadTerritoryScript(){
    if(document.querySelector('script[data-wildcats-territory]'))return;
    const s=document.createElement('script');
    s.src='wildcats-territory.js';
    s.async=false;
    s.dataset.wildcatsTerritory='1';
    s.onload=()=>{
      restoreNormalTownEvents();
      installTerritoryObserver();
      refreshTerritoryIfOpen();
    };
    document.body.appendChild(s);
  }

  installScreenIsolation();

  fetch('wildcats-schedule.json',{cache:'no-store'})
    .then(r=>{if(!r.ok)throw new Error(`Wildcats snapshot HTTP ${r.status}`);return r.json()})
    .then(data=>{
      snapshotItems=Array.isArray(data.items)?data.items:[];
      refreshTerritoryIfOpen();
      // The base feed request begins before this bridge. If it finishes while Wildcat
      // Territory is open, re-attach the isolated snapshot without changing town state.
      [500,1200,2400,4200].forEach(ms=>setTimeout(refreshTerritoryIfOpen,ms));
    })
    .catch(err=>console.warn('Wildcats schedule snapshot unavailable; using verified Hub Feed school items only.',err))
    .finally(loadTerritoryScript);
})();
