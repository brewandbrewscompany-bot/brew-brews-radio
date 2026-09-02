// Louisburg Local V4 — isolated Wildcat schedule data bridge.
// Keeps Arbiter home/away athletics available to Wildcat Territory without weakening town-feed locality rules.
(function(){
  let snapshotItems=[];
  let townStateItems=null;
  let screenWrapped=false;
  const normalRenderEvents=typeof renderEvents==='function'?renderEvents:null;

  function mark(item){return Object.assign({},item,{__wildcatSnapshot:true,rankScore:Number(item.rankScore||0),designationLabels:Array.isArray(item.designationLabels)?item.designationLabels:[]})}
  function isSnapshot(item){return !!(item&&item.__wildcatSnapshot)}
  function isArbiter(item){return /arbiterlive\.com/i.test(String(item&&item.originalUrl||''))}

  function activateWildcatsDataset(){
    if(!snapshotItems.length||!state||!Array.isArray(state.items)||state.items.some(isSnapshot))return;
    townStateItems=state.items.slice();
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
    showScreen=function(name){if(name==='wildcats')activateWildcatsDataset();else restoreTownDataset();return normalShowScreen(name)};
  }
  function restoreNormalTownEvents(){if(normalRenderEvents)renderEvents=normalRenderEvents}
  function refreshTerritoryIfOpen(){
    if(!state||state.screen!=='wildcats')return;
    if(!state.items.some(isSnapshot))activateWildcatsDataset();
    if(typeof window.refreshWildcatsTerritory==='function')window.refreshWildcatsTerritory();
    else if(typeof window.showWildcatsTerritory==='function')window.showWildcatsTerritory();
  }
  function loadTerritoryScript(){
    if(document.querySelector('script[data-wildcats-territory]'))return;
    const s=document.createElement('script');s.src='wildcats-territory.js';s.async=false;s.dataset.wildcatsTerritory='1';
    s.onload=()=>{restoreNormalTownEvents();refreshTerritoryIfOpen()};
    document.body.appendChild(s);
  }

  installScreenIsolation();
  fetch('wildcats-schedule.json',{cache:'no-store'})
    .then(r=>{if(!r.ok)throw new Error(`Wildcats snapshot HTTP ${r.status}`);return r.json()})
    .then(data=>{
      snapshotItems=Array.isArray(data.items)?data.items:[];
      refreshTerritoryIfOpen();
      // Allow the base feed to settle without repeatedly rescanning or mutating the Wildcat DOM.
      [900,2200].forEach(ms=>setTimeout(refreshTerritoryIfOpen,ms));
    })
    .catch(err=>console.warn('Wildcats schedule snapshot unavailable; using verified Hub Feed school items only.',err))
    .finally(loadTerritoryScript);
})();
