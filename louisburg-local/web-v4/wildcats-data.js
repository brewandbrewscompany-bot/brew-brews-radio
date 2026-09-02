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

  function normalizeOverlapWording(root=document){
    root.querySelectorAll&&root.querySelectorAll('.wtConflict,.wtMini em').forEach(el=>{
      if(/same-time town event/i.test(el.textContent||''))el.textContent=(el.textContent||'').replace(/same-time town event/i,'Possible time overlap');
    });
  }

  function installTerritoryObserver(){
    normalizeOverlapWording();
    if(!window.MutationObserver)return;
    const observer=new MutationObserver(mutations=>{
      for(const m of mutations){
        if(m.target&&m.target.closest&&m.target.closest('#wildcatsScreen')){normalizeOverlapWording(m.target.closest('#wildcatsScreen'));break;}
        for(const n of m.addedNodes||[]){
          if(n.nodeType===1&&(n.id==='wildcatsScreen'||(n.closest&&n.closest('#wildcatsScreen')))){normalizeOverlapWording(n.id==='wildcatsScreen'?n:n.closest('#wildcatsScreen'));return;}
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
