from pathlib import Path

p = Path('louisburg-local/web-v5/index.html')
s = p.read_text()

s = s.replace(
    '@media(min-width:900px){.drawer{width:360px}}',
    '@media(min-width:900px){.drawer{width:360px}}.edgeButton{display:none!important}.swipeHint{display:none!important}'
)
s = s.replace(
    '<div class="autoApplyHint"><b>Auto-applies</b>Choose filters, then swipe this panel right.</div>',
    '<div class="autoApplyHint"><b>Auto-applies</b>Close this panel when you are finished.</div>'
)

refresh = r'''
function installRefresh(x){
  if(!x.getElementById('v5-refresh-css')){
    const s=x.createElement('style');
    s.id='v5-refresh-css';
    s.textContent=`
      body{background:#f7f3eb!important}
      .app{max-width:1380px!important}.topin{max-width:1380px!important}.main{max-width:1380px!important;margin:0 auto!important}
      #menuBtn,#focusSearch{display:none!important}.quick,.snapshot,#sectionTabs,.searchbar,.homeSearchStatic{display:none!important}#directoryQuick{display:none!important}
      #v5PrimaryNav{display:none;align-items:center;gap:5px;margin-left:auto}
      #v5PrimaryNav button{border:0;background:transparent;color:#eee5f4;border-radius:10px;padding:9px 11px;font-size:12px;font-weight:800;white-space:nowrap}
      #v5PrimaryNav button:hover,#v5PrimaryNav button.active{background:#ffffff18;color:#fff}
      #v5TopFilter,#v5TopSearch{flex:0 0 40px!important;width:40px!important;height:40px!important;border-radius:12px!important;border:1px solid #ffffff32!important;background:#ffffff12!important;color:#fff!important;font-size:17px!important;display:grid!important;place-items:center!important;padding:0!important}
      #v5QuickStrip{display:flex;gap:7px;overflow:auto;padding:1px 1px 11px;scrollbar-width:none}#v5QuickStrip::-webkit-scrollbar{display:none}
      #v5QuickStrip button{border:1px solid #d9cedd;background:#fff;color:#321447;border-radius:999px;padding:9px 13px;font-size:11px;font-weight:800;white-space:nowrap}
      #v5QuickStrip button.active{background:#321447;color:#fff;border-color:#321447;box-shadow:0 6px 14px rgba(50,20,71,.15)}
      .feed{align-items:stretch!important}.feedCard{height:100%;display:flex;flex-direction:column;border-radius:18px!important;box-shadow:0 8px 22px rgba(48,22,65,.08)!important}.feedCard .actions{margin-top:auto}
      .headline{font-size:20px!important;line-height:1.14!important}.cardBody{padding:14px 15px 11px!important}.summary{font-size:13px!important;-webkit-line-clamp:4!important}.media{aspect-ratio:16/9!important;max-height:none!important}
      .bar{margin:2px 2px 12px!important;align-items:center!important}.bar h2{font-size:25px!important}.directoryHeader,.subHeader{margin-bottom:13px!important}.directoryHeader h1,.subHeader h1{font-size:30px!important}
      .directoryCard{min-height:92px!important;border-radius:16px!important;padding:11px!important;box-shadow:0 5px 15px rgba(46,23,62,.045)!important}.directoryCard h3{font-size:15px!important}.chips{padding-bottom:12px!important}
      .eventQuick{gap:7px!important;padding-bottom:12px!important}.eventQuickCard{min-width:auto!important;border-radius:999px!important;padding:9px 13px!important;display:flex!important;align-items:center!important;gap:6px!important}.eventQuickCard b,.eventQuickCard small{display:none!important}.eventQuickCard span{font-size:11px!important;margin:0!important}
      .eventCard,.dealCard{height:100%;border-radius:16px!important;box-shadow:0 8px 22px rgba(48,22,65,.07)!important}.eventInfo h3,.dealInfo h3{font-size:16px!important;line-height:1.25!important}
      #historyTeaser{min-height:118px!important;height:118px!important;max-height:118px!important;margin:0 0 13px!important;border-radius:18px!important}#historyTeaser .historyTeaserBody{height:118px!important;max-width:72%!important;padding:15px 18px!important;justify-content:center!important}#historyTeaser .historyTeaserBody b{font-size:20px!important;margin:5px 0!important}#historyTeaser .historyTeaserBody small{display:none!important}#historyTeaser .historyTeaserCta{font-size:8px!important;margin-top:4px!important}
      #v5SearchPanel{top:calc(7px + env(safe-area-inset-top))!important;left:9px!important;right:9px!important;max-width:620px!important;margin-left:auto!important}.resultsMeta{margin:7px 2px 11px!important}
      @media(min-width:900px){.topin{padding:11px 26px!important;gap:8px!important}.brand{flex:0 0 auto!important;min-width:210px!important}.brand b{font-size:21px!important}.brand small{font-size:9px!important}#v5PrimaryNav{display:flex!important}.main{padding:22px 30px 38px!important}.bottom{display:none!important}.feed{grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:18px!important}.directoryList{grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:13px!important}.eventList,.dealList{grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:13px!important}.moreGrid{grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:12px!important}#historyTeaser{height:132px!important;min-height:132px!important;max-height:132px!important}#historyTeaser .historyTeaserBody{height:132px!important;max-width:62%!important;padding:18px 22px!important}#historyTeaser .historyTeaserBody b{font-size:24px!important}#historyTeaser .historyTeaserBody small{display:block!important;font-size:10px!important;line-height:1.35!important}}
      @media(max-width:899px){.topin{padding:calc(7px + env(safe-area-inset-top)) 10px 7px!important;gap:7px!important}.brand b{font-size:18px!important}.brand small{font-size:8px!important;margin-top:2px!important}.main{padding:10px 11px calc(82px + env(safe-area-inset-bottom))!important}.feed{grid-template-columns:1fr!important;gap:11px!important}.directoryList,.eventList,.dealList{grid-template-columns:1fr!important}.directoryHeader h1,.subHeader h1{font-size:25px!important}.bar h2{font-size:23px!important}}
    `;
    x.head.appendChild(s)
  }
  const top=x.querySelector('.topin');
  if(top&&!x.getElementById('v5PrimaryNav')){
    const nav=x.createElement('nav');nav.id='v5PrimaryNav';nav.setAttribute('aria-label','Primary navigation');
    nav.innerHTML='<button data-v5-nav="home">Home</button><button data-v5-nav="directory">Directory</button><button data-v5-nav="events">Events</button><button data-v5-nav="deals">Deals</button><button data-v5-nav="more">Explore</button><button data-v5-history>History</button>';
    const brand=top.querySelector('.brand');if(brand)brand.insertAdjacentElement('afterend',nav);else top.prepend(nav);
    nav.addEventListener('click',e=>{const b=e.target.closest('[data-v5-nav]');if(b){showScreen(b.dataset.v5Nav);setTimeout(()=>syncRefreshNav(x),20);return}if(e.target.closest('[data-v5-history]'))location.href='../web-v4/history.html'})
  }
  if(top&&!x.getElementById('v5TopFilter')){
    const b=x.createElement('button');b.id='v5TopFilter';b.type='button';b.textContent='☷';b.setAttribute('aria-label','Filter posts');const search=x.getElementById('v5TopSearch');if(search)top.insertBefore(b,search);else top.appendChild(b);b.onclick=()=>openDrawer('right')
  }
  const home=x.getElementById('homeScreen'),bar=home&&home.querySelector('.bar');
  if(home&&bar&&!x.getElementById('v5QuickStrip')){
    const q=x.createElement('div');q.id='v5QuickStrip';q.innerHTML='<button class="active" data-v5-quick="ALL">All</button><button data-v5-quick="TODAY">Today</button><button data-v5-quick="DEALS">Deals</button><button data-v5-quick="EVENTS">Events</button><button data-v5-quick="FOOD">Food & drink</button><button data-v5-quick="FAMILY">Family</button><button data-v5-quick="SPORTS">Sports</button><button data-v5-quick="HIRING">Hiring</button>';bar.parentNode.insertBefore(q,bar);
    q.onclick=e=>{const b=e.target.closest('[data-v5-quick]');if(!b)return;chosenCat='ALL';chosenTime='ALL';chosenSource='';document.querySelectorAll('#categoryChoices .choice').forEach(c=>c.classList.toggle('active',c.dataset.filterCat==='ALL'));document.querySelectorAll('#timeChoices .choice').forEach(c=>c.classList.toggle('active',c.dataset.filterTime==='ALL'));document.querySelectorAll('#sourceChoices .choice').forEach(c=>c.classList.toggle('active',c.dataset.filterSource===''));resetBaseFeed();const k=b.dataset.v5Quick;if(k==='TODAY'){const t=x.querySelector('#sectionTabs [data-section="TODAY"]');if(t)t.click()}else if(k!=='ALL'){const c=x.querySelector(`#quickNav [data-cat="${k}"]`);if(c)c.click()}q.querySelectorAll('button').forEach(z=>z.classList.toggle('active',z===b));setTimeout(applyDomFilters,20)}
  }
  const h=x.querySelector('#homeScreen .bar h2');if(h)h.textContent='Happening in Louisburg';const dhead=x.querySelector('#directoryScreen .directoryHeader h1');if(dhead)dhead.textContent='Louisburg Directory';syncRefreshNav(x)
}
function syncRefreshNav(x){const active=x.querySelector('.screen.active'),name=active?String(active.id||'').replace('Screen',''):'';x.querySelectorAll('#v5PrimaryNav [data-v5-nav]').forEach(b=>b.classList.toggle('active',b.dataset.v5Nav===name))}
'''

marker = 'function inject(){'
if 'function installRefresh(x)' not in s:
    if marker not in s:
        raise SystemExit('inject marker missing')
    s = s.replace(marker, refresh + '\n' + marker, 1)

old = 'installSearch(x);installObserver();attachMain(x);setTimeout(applyDomFilters,0)'
new = 'installSearch(x);installObserver();installRefresh(x);setTimeout(applyDomFilters,0)'
if old not in s:
    raise SystemExit('inject call marker missing')
s = s.replace(old, new, 1)

p.write_text(s)
