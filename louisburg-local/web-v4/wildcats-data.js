// Louisburg Local V4 — isolated Wildcat schedule data bridge.
// Keeps Arbiter home/away athletics available to Wildcat Territory without weakening town-feed locality rules.
(function(){
  const RESILIENCE_VERSION='20260909-r1';

  function loadResilience(boot){
    if(window.__llV4ResilienceLoaded){boot();return}
    const existing=document.querySelector('script[data-ll-v4-resilience]');
    if(existing){
      existing.addEventListener('load',boot,{once:true});
      existing.addEventListener('error',boot,{once:true});
      return;
    }
    const s=document.createElement('script');
    s.src=`resilience.js?v=${RESILIENCE_VERSION}`;
    s.async=false;
    s.dataset.llV4Resilience='1';
    s.onload=boot;s.onerror=boot;
    document.body.appendChild(s);
  }

  loadResilience(function boot(){
    let snapshotItems=[];
    let townStateItems=null;
    let screenWrapped=false;
    let scheduleBusy=false;
    const WILDCAT_CACHE_KEY='ll_v4_wildcats_cache_v1';
    const normalRenderEvents=typeof renderEvents==='function'?renderEvents:null;

    function mark(item){return Object.assign({},item,{__wildcatSnapshot:true,rankScore:Number(item.rankScore||0),designationLabels:Array.isArray(item.designationLabels)?item.designationLabels:[]})}
    function isSnapshot(item){return !!(item&&item.__wildcatSnapshot)}
    function isArbiter(item){return /arbiterlive\.com/i.test(String(item&&item.originalUrl||''))}
    function validItems(items){return Array.isArray(items)&&items.every(i=>i&&typeof i==='object')}
    function readCache(){
      try{
        const raw=localStorage.getItem(WILDCAT_CACHE_KEY),data=raw?JSON.parse(raw):null;
        return data&&validItems(data.items)&&data.items.length?data:null;
      }catch(e){return null}
    }
    function saveCache(items){
      if(!validItems(items)||!items.length)return;
      try{localStorage.setItem(WILDCAT_CACHE_KEY,JSON.stringify({version:RESILIENCE_VERSION,ts:Date.now(),items}))}catch(e){}
    }

    const cached=readCache();
    if(cached)snapshotItems=cached.items.slice();

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
      showScreen=function(name){
        if(name==='wildcats')activateWildcatsDataset();
        else restoreTownDataset();
        return normalShowScreen(name);
      };
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
      const s=document.createElement('script');
      s.src=`wildcats-territory.js?v=${RESILIENCE_VERSION}`;
      s.async=false;s.dataset.wildcatsTerritory='1';
      s.onload=()=>{
        restoreNormalTownEvents();refreshTerritoryIfOpen();
        if(window.__llV4Resilience&&typeof window.__llV4Resilience.restoreUi==='function')setTimeout(window.__llV4Resilience.restoreUi,30);
      };
      document.body.appendChild(s);
    }

    async function refreshSnapshot(){
      if(scheduleBusy||navigator.onLine===false)return false;
      scheduleBusy=true;
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),9000);
      try{
        const r=await fetch(`wildcats-schedule.json?v=${Date.now()}`,{cache:'no-store',signal:controller.signal});
        if(!r.ok)throw new Error(`Wildcats snapshot HTTP ${r.status}`);
        const data=await r.json(),items=Array.isArray(data&&data.items)?data.items:[];
        if(!validItems(items))throw new Error('Invalid Wildcats snapshot');
        if(!items.length&&snapshotItems.length)throw new Error('Refusing empty Wildcats snapshot over last-known-good data');
        if(items.length){snapshotItems=items;saveCache(items);refreshTerritoryIfOpen()}
        [900,2200].forEach(ms=>setTimeout(refreshTerritoryIfOpen,ms));
        return true;
      }catch(err){
        if(!snapshotItems.length)console.warn('Wildcats schedule snapshot unavailable; using verified Hub Feed school items only.',err);
        return false;
      }finally{clearTimeout(timer);scheduleBusy=false}
    }

    installScreenIsolation();
    loadTerritoryScript();
    refreshSnapshot();
    window.addEventListener('online',refreshSnapshot);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshSnapshot()});
    setInterval(()=>{if(!document.hidden)refreshSnapshot()},5*60*1000);
  });
})();
