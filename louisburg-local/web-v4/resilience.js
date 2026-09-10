// Louisburg Local V4 — mobile resilience / stale-while-revalidate layer.
// Keeps last-known-good data visible, restores UI state, and refreshes quietly in the background.
(function(){
  if(window.__llV4ResilienceLoaded)return;
  window.__llV4ResilienceLoaded=true;

  const VERSION='20260909-r1';
  const FEED_KEY='ll_v4_feed_cache_v1';
  const REGISTRY_KEY='ll_v4_registry_cache_v1';
  const UI_KEY='ll_v4_ui_state_v1';
  const TIMEOUT_MS=9000;
  const RETRY_MS=30000;
  const PERIODIC_MS=5*60*1000;
  let restoring=false;
  let refreshBusy=false;
  let registryRefreshBusy=false;
  let retryTimer=0;
  let pendingTownItems=null;
  let cachedFeedTimestamp=0;
  let cachedRegistryTimestamp=0;
  let lastCachedFeedSig='';
  let lastCachedRegistrySig='';
  let initialRestoreDone=false;

  function storageGet(store,key){try{const raw=store.getItem(key);return raw?JSON.parse(raw):null}catch(e){return null}}
  function storageSet(store,key,value){try{store.setItem(key,JSON.stringify(value));return true}catch(e){return false}}
  function townItems(items){return Array.isArray(items)?items.filter(i=>!(i&&i.__wildcatSnapshot)):[]}
  function validItems(items){return Array.isArray(items)&&items.every(i=>i&&typeof i==='object')}
  function validRegistry(items){return validItems(items)&&items.every(i=>String(i.organization||'').trim())}
  function norm(v){return String(v||'').toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim()}
  function signature(items){
    if(!Array.isArray(items))return '';
    return items.map(i=>[i.id||'',i.organization||'',i.headline||'',i.date||'',i.discoveryDate||'',i.updatedAt||'',i.rankScore||''].join('|')).join('~');
  }
  function registrySignature(items){
    if(!Array.isArray(items))return '';
    return items.map(i=>[i.organization||'',i.category||'',i.address||'',i.website||'',i.facebook||'',i.instagram||'',i.calendar||'',Array.isArray(i.designationLabels)?i.designationLabels.join(','):''].join('|')).join('~');
  }
  function ageText(ts){
    if(!ts)return 'saved copy';
    const min=Math.max(0,Math.floor((Date.now()-ts)/60000));
    if(min<1)return 'saved just now';
    if(min<60)return `saved ${min}m ago`;
    const hr=Math.floor(min/60);if(hr<24)return `saved ${hr}h ago`;
    return `saved ${Math.floor(hr/24)}d ago`;
  }
  function setFeedStatus(text){const el=document.querySelector('#feedStatus');if(el)el.textContent=text}
  function renderTownViews(){
    if(typeof renderHome==='function')renderHome();
    if(typeof renderDirectory==='function')renderDirectory();
    if(typeof renderEvents==='function')renderEvents();
    if(typeof renderDeals==='function')renderDeals();
  }
  function cacheFeed(items,touch=false){
    const clean=townItems(items);if(!validItems(clean)||!clean.length)return;
    const sig=signature(clean);if(!touch&&sig===lastCachedFeedSig)return;
    cachedFeedTimestamp=Date.now();lastCachedFeedSig=sig;
    storageSet(localStorage,FEED_KEY,{version:VERSION,ts:cachedFeedTimestamp,items:clean});
  }
  function cacheRegistry(items,touch=false){
    if(!validRegistry(items)||!items.length)return;
    const sig=registrySignature(items);if(!touch&&sig===lastCachedRegistrySig)return;
    cachedRegistryTimestamp=Date.now();lastCachedRegistrySig=sig;
    storageSet(localStorage,REGISTRY_KEY,{version:VERSION,ts:cachedRegistryTimestamp,items});
  }
  function rebuildRegistryMap(){
    if(!state||!Array.isArray(state.registry))return;
    state.registryMap=new Map(state.registry.map(r=>[norm(r.organization),r]));
  }

  const savedUi=storageGet(sessionStorage,UI_KEY)||{};
  const stateFields=['cat','section','q','dirQ','dirCat','dirQuick','eventFilter','dealCat','source','recent','currentOnly'];
  stateFields.forEach(k=>{if(Object.prototype.hasOwnProperty.call(savedUi,k)&&state&&Object.prototype.hasOwnProperty.call(state,k))state[k]=savedUi[k]});

  const cachedFeed=storageGet(localStorage,FEED_KEY);
  if(cachedFeed&&validItems(cachedFeed.items)&&cachedFeed.items.length){
    cachedFeedTimestamp=Number(cachedFeed.ts||0);lastCachedFeedSig=signature(cachedFeed.items);
    if(state&&(!Array.isArray(state.items)||!state.items.length)){
      restoring=true;state.items=cachedFeed.items.slice();renderTownViews();restoring=false;
      setFeedStatus(navigator.onLine===false?`offline · ${ageText(cachedFeedTimestamp)}`:`${ageText(cachedFeedTimestamp)} · updating…`);
    }
  }

  const cachedRegistry=storageGet(localStorage,REGISTRY_KEY);
  if(cachedRegistry&&validRegistry(cachedRegistry.items)&&cachedRegistry.items.length){
    cachedRegistryTimestamp=Number(cachedRegistry.ts||0);lastCachedRegistrySig=registrySignature(cachedRegistry.items);
    if(state&&(!Array.isArray(state.registry)||!state.registry.length)){
      state.registry=cachedRegistry.items.slice();rebuildRegistryMap();
      if(state.screen==='directory'&&typeof renderDirectory==='function')renderDirectory();
    }
  }

  if(typeof renderHome==='function'){
    const baseRenderHome=renderHome;
    renderHome=function(){
      let protectedCache=false;
      if(!restoring&&state&&Array.isArray(state.items)&&!townItems(state.items).length&&cachedFeed&&cachedFeed.items&&cachedFeed.items.length){
        restoring=true;state.items=cachedFeed.items.slice();protectedCache=true;
      }
      const out=baseRenderHome();
      if(protectedCache){restoring=false;setFeedStatus(navigator.onLine===false?`offline · ${ageText(cachedFeedTimestamp)}`:`${ageText(cachedFeedTimestamp)} · updating…`)}
      else if(!restoring&&state&&Array.isArray(state.items))cacheFeed(state.items,false);
      return out;
    };
  }
  if(typeof renderDirectory==='function'){
    const baseRenderDirectory=renderDirectory;
    renderDirectory=function(){
      const out=baseRenderDirectory();
      if(!restoring&&state&&Array.isArray(state.registry)&&state.registry.length)cacheRegistry(state.registry,false);
      return out;
    };
  }

  async function timedFetch(url,options,timeoutMs=TIMEOUT_MS){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
    try{return await fetch(url,Object.assign({},options||{},{signal:controller.signal}))}
    finally{clearTimeout(timer)}
  }

  // All API calls after startup get a real timeout. The original inline startup request may already be in flight.
  if(typeof api==='function'){
    api=async function(data,post=false){
      const url=API+(post?'':'?'+new URLSearchParams(data));
      const opts=post?{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(data)}:{};
      const r=await timedFetch(url,opts,TIMEOUT_MS);
      if(!r.ok)throw new Error(`Request failed (${r.status})`);
      return r.json();
    };
  }

  function currentTownSignature(){return signature(townItems(state&&state.items))}
  function applyTownFeed(items,quiet){
    if(!validItems(items))return false;
    const clean=townItems(items),sig=signature(clean),currentSig=currentTownSignature();
    if(!clean.length&&currentSig)return false;
    if(sig===currentSig){
      if(clean.length)cacheFeed(clean,true);
      if(!quiet)setFeedStatus(`live · ${clean.filter(i=>typeof fresh==='function'?fresh(i):true).length} current`);
      return true;
    }
    if(state&&state.screen==='wildcats'){
      pendingTownItems=clean.slice();window.__llV4PendingTownItems=pendingTownItems;cacheFeed(clean,true);
      return true;
    }
    state.items=clean.slice();cacheFeed(clean,true);renderTownViews();
    if(!quiet)setFeedStatus(`live · ${clean.filter(i=>typeof fresh==='function'?fresh(i):true).length} current`);
    return true;
  }
  function applyPendingTownFeed(){
    const pending=pendingTownItems||window.__llV4PendingTownItems;
    if(!pending||!validItems(pending))return;
    state.items=pending.slice();pendingTownItems=null;window.__llV4PendingTownItems=null;renderTownViews();
  }
  window.__llV4ApplyPendingTownFeed=applyPendingTownFeed;

  async function refreshFeed(reason){
    if(refreshBusy||navigator.onLine===false)return false;
    refreshBusy=true;
    try{
      const url=API+'?'+new URLSearchParams({action:'feed',_v:String(Date.now())});
      const r=await timedFetch(url,{cache:'no-store'},TIMEOUT_MS);
      if(!r.ok)throw new Error(`Feed HTTP ${r.status}`);
      const d=await r.json();
      if(!d||!validItems(d.items))throw new Error('Invalid feed payload');
      if(!d.items.length&&currentTownSignature())throw new Error('Refusing empty feed over last-known-good data');
      applyTownFeed(d.items,false);clearTimeout(retryTimer);retryTimer=0;return true;
    }catch(e){
      const hasSaved=!!currentTownSignature()||!!(cachedFeed&&cachedFeed.items&&cachedFeed.items.length);
      setFeedStatus(`${navigator.onLine===false?'offline':'connection issue'}${hasSaved?` · ${ageText(cachedFeedTimestamp)}`:''}`);
      if(navigator.onLine!==false){clearTimeout(retryTimer);retryTimer=setTimeout(()=>refreshFeed('retry'),RETRY_MS)}
      return false;
    }finally{refreshBusy=false}
  }
  window.refreshLouisburgLocalFeed=refreshFeed;

  async function refreshRegistry(){
    if(registryRefreshBusy||navigator.onLine===false)return false;
    registryRefreshBusy=true;
    try{
      const names=['directory-1.json','directory-2.json','directory-3.json'];
      const parts=await Promise.all(names.map(async name=>{
        const r=await timedFetch(`${name}?v=${Date.now()}`,{cache:'no-store'},TIMEOUT_MS);
        if(!r.ok)throw new Error(`${name} HTTP ${r.status}`);
        return r.json();
      }));
      const items=parts.flatMap(p=>Array.isArray(p&&p.items)?p.items:[]);
      if(!validRegistry(items)||!items.length)throw new Error('Invalid directory payload');
      const current=state&&Array.isArray(state.registry)?state.registry:[];
      if(registrySignature(items)!==registrySignature(current)){
        state.registry=items;rebuildRegistryMap();cacheRegistry(items,true);
        if(state.screen==='directory'&&typeof renderDirectory==='function')renderDirectory();
      }else cacheRegistry(items,true);
      return true;
    }catch(e){return false}
    finally{registryRefreshBusy=false}
  }
  window.refreshLouisburgLocalDirectory=refreshRegistry;

  // If the old startup request fails after cached content is already on-screen, immediately restore the cache instead of showing a blank error card.
  const feedNode=document.querySelector('#feed');
  if(feedNode&&cachedFeed&&cachedFeed.items&&cachedFeed.items.length){
    const observer=new MutationObserver(()=>{
      if(/could not load the live feed/i.test(feedNode.textContent||'')){
        restoring=true;state.items=cachedFeed.items.slice();renderTownViews();restoring=false;
        setFeedStatus(navigator.onLine===false?`offline · ${ageText(cachedFeedTimestamp)}`:`connection issue · ${ageText(cachedFeedTimestamp)}`);
      }
    });
    observer.observe(feedNode,{childList:true,subtree:true,characterData:true});
  }

  function captureWildcatUi(out){
    const target=out||storageGet(sessionStorage,UI_KEY)||{};
    const selected=document.querySelector('#wildcatCalendar [data-wt-date].selected');
    const first=document.querySelector('#wildcatCalendar [data-wt-date]');
    const activeView=document.querySelector('[data-wt-view].active');
    const activeFilter=document.querySelector('[data-wt-filter].active');
    const town=document.querySelector('#wildcatTownToggle');
    if(selected)target.wildcatSelected=selected.dataset.wtDate||'';
    if(first)target.wildcatMonth=String(first.dataset.wtDate||'').slice(0,7);
    if(activeView)target.wildcatView=activeView.dataset.wtView||'';
    if(activeFilter)target.wildcatFilter=activeFilter.dataset.wtFilter||'';
    if(town)target.wildcatTown=town.getAttribute('aria-pressed')==='true';
    if(!out)storageSet(sessionStorage,UI_KEY,target);
  }
  function saveUiState(){
    if(!state)return;
    const out={screen:state.screen||'home',scrollY:Math.max(0,Math.round(window.scrollY||0)),ts:Date.now()};
    stateFields.forEach(k=>{if(Object.prototype.hasOwnProperty.call(state,k))out[k]=state[k]});
    const hs=document.querySelector('#homeSearch'),ds=document.querySelector('#directorySearch');
    if(hs)out.homeSearch=hs.value||'';if(ds)out.directorySearch=ds.value||'';
    captureWildcatUi(out);storageSet(sessionStorage,UI_KEY,out);
  }

  if(typeof showScreen==='function'){
    const baseShowScreen=showScreen;
    showScreen=function(name){
      if(name!=='wildcats')applyPendingTownFeed();
      const out=baseShowScreen(name);setTimeout(saveUiState,0);return out;
    };
  }

  function syncSelections(){
    if(!state)return;
    document.querySelectorAll('#quickNav [data-cat]').forEach(b=>b.classList.toggle('active',b.dataset.cat===state.cat));
    document.querySelectorAll('#sectionTabs [data-section]').forEach(b=>b.classList.toggle('active',b.dataset.section===state.section));
    document.querySelectorAll('#directoryChips [data-dir-cat]').forEach(b=>b.classList.toggle('active',b.dataset.dirCat===state.dirCat));
    document.querySelectorAll('#directoryQuick [data-dir-quick]').forEach(b=>b.classList.toggle('active',b.dataset.dirQuick===state.dirQuick));
    document.querySelectorAll('#eventQuick [data-event-filter]').forEach(b=>b.classList.toggle('active',b.dataset.eventFilter===state.eventFilter));
    document.querySelectorAll('[data-deal-cat]').forEach(b=>b.classList.toggle('active',b.dataset.dealCat===state.dealCat));
    document.querySelectorAll('[data-filter-source]').forEach(b=>b.classList.toggle('active',b.dataset.filterSource===state.source));
    document.querySelectorAll('[data-filter-recent]').forEach(b=>b.classList.toggle('active',!!state.recent));
    document.querySelectorAll('[data-filter-current]').forEach(b=>b.classList.toggle('active',!!state.currentOnly));
    const hs=document.querySelector('#homeSearch'),ds=document.querySelector('#directorySearch');
    if(hs&&typeof savedUi.homeSearch==='string')hs.value=savedUi.homeSearch;
    if(ds&&typeof savedUi.directorySearch==='string')ds.value=savedUi.directorySearch;
  }
  function cssEsc(v){return window.CSS&&typeof CSS.escape==='function'?CSS.escape(String(v)):String(v).replace(/["\\]/g,'\\$&')}
  function monthDelta(fromYm,toYm){
    if(!/^20\d{2}-\d{2}$/.test(fromYm||'')||!/^20\d{2}-\d{2}$/.test(toYm||''))return 0;
    const [fy,fm]=fromYm.split('-').map(Number),[ty,tm]=toYm.split('-').map(Number);return (ty-fy)*12+(tm-fm);
  }
  function restoreWildcatUi(){
    if(!document.querySelector('#wildcatsScreen'))return false;
    const view=savedUi.wildcatView&&document.querySelector(`[data-wt-view="${cssEsc(savedUi.wildcatView)}"]`);if(view&&!view.classList.contains('active'))view.click();
    const filter=savedUi.wildcatFilter&&document.querySelector(`[data-wt-filter="${cssEsc(savedUi.wildcatFilter)}"]`);if(filter&&!filter.classList.contains('active'))filter.click();
    const town=document.querySelector('#wildcatTownToggle');if(town&&typeof savedUi.wildcatTown==='boolean'&&((town.getAttribute('aria-pressed')==='true')!==savedUi.wildcatTown))town.click();
    const first=document.querySelector('#wildcatCalendar [data-wt-date]');
    if(first&&savedUi.wildcatMonth){
      const current=String(first.dataset.wtDate||'').slice(0,7),delta=monthDelta(current,savedUi.wildcatMonth),btn=delta<0?document.querySelector('#wildcatPrevMonth'):document.querySelector('#wildcatNextMonth');
      for(let n=0;n<Math.min(18,Math.abs(delta));n++)if(btn)btn.click();
    }
    if(savedUi.wildcatSelected){const d=document.querySelector(`#wildcatCalendar [data-wt-date="${cssEsc(savedUi.wildcatSelected)}"]`);if(d)d.click()}
    return true;
  }

  let restoreAttempts=0;
  function restoreUi(){
    if(initialRestoreDone)return;
    syncSelections();
    const wanted=savedUi.screen,screen=wanted&&document.querySelector(`#${cssEsc(wanted)}Screen`);
    if(wanted&&screen&&typeof showScreen==='function'){
      showScreen(wanted);if(wanted==='wildcats')restoreWildcatUi();
      initialRestoreDone=true;setTimeout(()=>window.scrollTo({top:Number(savedUi.scrollY||0),left:0,behavior:'auto'}),60);return;
    }
    if(wanted==='wildcats'&&restoreAttempts++<30){setTimeout(restoreUi,150);return}
    initialRestoreDone=true;if(savedUi.scrollY)setTimeout(()=>window.scrollTo({top:Number(savedUi.scrollY||0),left:0,behavior:'auto'}),60);
  }
  setTimeout(restoreUi,60);

  let scrollTimer=0;
  window.addEventListener('scroll',()=>{clearTimeout(scrollTimer);scrollTimer=setTimeout(saveUiState,180)},{passive:true});
  window.addEventListener('pagehide',saveUiState);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)saveUiState();else if(navigator.onLine!==false)refreshFeed('visible')});
  document.addEventListener('input',e=>{if(e.target&&/^(homeSearch|directorySearch)$/.test(e.target.id))setTimeout(saveUiState,0)},true);
  document.addEventListener('click',()=>setTimeout(saveUiState,0),true);

  window.addEventListener('offline',()=>setFeedStatus(currentTownSignature()?`offline · ${ageText(cachedFeedTimestamp)}`:'offline'));
  window.addEventListener('online',()=>{
    setFeedStatus(currentTownSignature()?`${ageText(cachedFeedTimestamp)} · updating…`:'reconnecting…');refreshFeed('online');refreshRegistry();
  });

  setTimeout(()=>{
    const status=String((document.querySelector('#feedStatus')||{}).textContent||'');
    if(/connecting|saved|connection issue|offline/i.test(status)&&navigator.onLine!==false)refreshFeed('startup-watchdog');
    if((!state.registry||!state.registry.length)&&navigator.onLine!==false)refreshRegistry();
  },TIMEOUT_MS+500);

  setInterval(()=>{if(!document.hidden&&navigator.onLine!==false){refreshFeed('periodic');refreshRegistry()}},PERIODIC_MS);
  window.__llV4Resilience={version:VERSION,refreshFeed,refreshRegistry,saveUiState,restoreUi};
})();
