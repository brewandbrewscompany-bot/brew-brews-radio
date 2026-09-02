// Louisburg Local V4 — isolated Wildcat schedule data bridge.
// Keeps Arbiter home/away athletics available to Wildcat Territory without weakening town-feed locality rules.
(function(){
  let snapshotItems=[];
  let renderHomeWrapped=false;

  function mark(item){
    return Object.assign({},item,{
      __wildcatSnapshot:true,
      rankScore:Number(item.rankScore||0),
      designationLabels:Array.isArray(item.designationLabels)?item.designationLabels:[]
    });
  }

  function installTownFeedGuard(){
    if(renderHomeWrapped)return;
    renderHomeWrapped=true;
    const originalFilteredHome=filteredHome;
    filteredHome=function(){return originalFilteredHome().filter(i=>!i.__wildcatSnapshot)};
  }

  function mergeSnapshot(){
    if(!snapshotItems.length)return;
    installTownFeedGuard();
    const nonArbiter=state.items.filter(i=>!i.__wildcatSnapshot&&!/arbiterlive\.com/i.test(String(i.originalUrl||'')));
    state.items=[...nonArbiter,...snapshotItems.map(mark)];
    if(state.screen==='wildcats'&&typeof window.showWildcatsTerritory==='function')window.showWildcatsTerritory();
  }

  function loadTerritoryScript(){
    if(document.querySelector('script[data-wildcats-territory]'))return;
    const s=document.createElement('script');
    s.src='wildcats-territory.js';
    s.async=false;
    s.dataset.wildcatsTerritory='1';
    document.body.appendChild(s);
  }

  fetch('wildcats-schedule.json',{cache:'no-store'})
    .then(r=>{if(!r.ok)throw new Error(`Wildcats snapshot HTTP ${r.status}`);return r.json()})
    .then(data=>{
      snapshotItems=Array.isArray(data.items)?data.items:[];
      mergeSnapshot();
      // The base feed request begins before this bridge. Re-merge briefly so a later feed response cannot wipe the school-only snapshot.
      [500,1200,2400,4200].forEach(ms=>setTimeout(mergeSnapshot,ms));
    })
    .catch(err=>console.warn('Wildcats schedule snapshot unavailable; using verified Hub Feed school items only.',err))
    .finally(loadTerritoryScript);
})();
