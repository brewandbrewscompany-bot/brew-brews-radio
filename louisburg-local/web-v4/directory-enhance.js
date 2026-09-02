// Louisburg Local V4 directory/profile enhancement.
// Read-only static snapshot generated from the verified Master Registry.
(function(){
  state.registry=[];
  state.registryMap=new Map();
  state.currentOnly=false;
  state.dirQuick='ALL';

  function norm(v){return String(v||'').toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim()}
  function currentPosts(org){const n=norm(org);return state.items.filter(i=>fresh(i)&&norm(i.organization)===n)}
  function latestPost(org){return currentPosts(org).sort((a,b)=>Number(b.rankScore||0)-Number(a.rankScore||0))[0]||null}
  function registrySearchText(r){return norm([r.organization,r.category,r.address].join(' '))}
  function registryMatchesQuery(r,q){
    const qn=norm(q);if(!qn)return true;
    const hay=registrySearchText(r);if(hay.includes(qn))return true;
    const stop=new Set(['the','and','co','llc','inc','company','corp','corporation']);
    const wanted=qn.split(' ').filter(x=>x&&!stop.has(x));
    if(!wanted.length)return true;
    const have=hay.split(' ');
    return wanted.every(w=>have.some(h=>h===w||h.startsWith(w)||w.startsWith(h)));
  }
  function hasRegistrySource(r,source){if(!source)return true;if(source==='Facebook')return !!r.facebook;if(source==='Instagram')return !!r.instagram;if(source==='Website')return !!r.website;return true}

  function installUiCorrections(){
    const old=document.querySelector('#homeScreen .searchbar [data-open-filter]');
    if(old){
      const icon=document.createElement('span');
      icon.className='homeSearchStatic';
      icon.setAttribute('aria-hidden','true');
      icon.textContent='🔍';
      old.replaceWith(icon);
    }
    const homeDefault=document.querySelector('#quickNav [data-cat="ALL"]');
    if(homeDefault)homeDefault.classList.remove('active');
    if(!document.getElementById('v4-ui-corrections-style')){
      const style=document.createElement('style');
      style.id='v4-ui-corrections-style';
      style.textContent='.homeSearchStatic{flex:0 0 52px;height:48px;display:grid;place-items:center;font-size:25px;line-height:1;pointer-events:none;user-select:none}.profileLink.directions{background:#e7edf5;color:var(--deep)}';
      document.head.appendChild(style);
    }
  }

  function directionsUrl(address){
    const raw=String(address||'').trim();if(!raw)return '';
    const q=encodeURIComponent(raw),ua=String(navigator.userAgent||'');
    if(/Android/i.test(ua))return `geo:0,0?q=${q}`;
    if(/iPhone|iPad|iPod/i.test(ua))return `https://maps.apple.com/?daddr=${q}`;
    return `https://www.google.com/maps/dir/?api=1&destination=${q}`;
  }

  installUiCorrections();

  function categoryGroup(r){
    const c=String(r.category||'').toLowerCase();
    if(/dining|restaurant|coffee|roast|café|cafe|grocery|catering|food|barbecue|pizza/.test(c))return 'Food & Drink';
    if(/beauty|salon|barber|nail|grooming/.test(c))return 'Beauty';
    if(/health|medical|dental|dentistry|pharmacy|chiropr|optometr|wellness|counsel/.test(c))return 'Health';
    if(/automotive|auto |towing|collision|vehicle/.test(c))return 'Automotive';
    if(/real estate|apartments|housing|storage/.test(c))return 'Real Estate & Housing';
    if(/hvac|heating|cooling|plumbing|electrical|construction|contractor|pest|lawn|landscap|waste|welding|fabrication|stone/.test(c))return 'Home & Trade Services';
    if(/retail|boutique|antiques|hardware|discount|farm & home|yarn|crafts|tools/.test(c))return 'Shopping';
    if(/bank|financial|insurance|tax|accounting|title|business services|consulting/.test(c))return 'Financial & Professional';
    if(/school|preschool|childcare|learning center/.test(c))return 'Schools & Childcare';
    if(/church/.test(c))return 'Churches';
    if(/fitness|martial arts|dance|recreation|sports/.test(c))return 'Fitness & Recreation';
    if(/event venue|photography|arts|artist|travel/.test(c))return 'Events & Creative';
    if(/community|nonprofit|government|library|civic|veterans|observatory|attraction/.test(c))return 'Community';
    return 'Services';
  }

  function quickGroupMatch(r,q){
    if(q==='ALL')return true;
    const g=categoryGroup(r),t=norm([r.category,r.organization].join(' '));
    if(q==='FOOD')return g==='Food & Drink';
    if(q==='SHOPPING')return g==='Shopping';
    if(q==='FAMILY')return ['Schools & Childcare','Fitness & Recreation'].includes(g)||/family|kid|child|preschool|school|dance|recreation|library/.test(t);
    if(q==='BEAUTY')return g==='Beauty';
    if(q==='HEALTH')return g==='Health';
    if(q==='HOME')return ['Home & Trade Services','Real Estate & Housing'].includes(g);
    if(q==='FITNESS')return g==='Fitness & Recreation';
    if(q==='COMMUNITY')return ['Community','Churches'].includes(g);
    return true;
  }

  const directoryGroups=['ALL','Food & Drink','Shopping','Beauty','Health','Automotive','Home & Trade Services','Financial & Professional','Real Estate & Housing','Fitness & Recreation','Events & Creative','Community','Schools & Childcare','Churches','Services'];
  $('#directoryChips').innerHTML=directoryGroups.map(c=>`<button class="chip ${c==='ALL'?'active':''}" data-dir-cat="${esc(c)}">${esc(c==='ALL'?'All':c)}</button>`).join('');

  const quickDefs=[
    ['ALL','▦','All','Everything'],['FOOD','☕','Food','Dining + coffee'],['SHOPPING','◇','Shopping','Retail + local finds'],['FAMILY','♙','Family','Kids + schools'],['BEAUTY','✦','Beauty','Hair + nails'],['HEALTH','+','Health','Medical + wellness'],['HOME','⌂','Home','Trades + property'],['FITNESS','◉','Fitness','Sports + recreation'],['COMMUNITY','♥','Community','Groups + civic']
  ];
  const dirChips=$('#directoryChips');
  const quick=document.createElement('div');quick.id='directoryQuick';quick.className='eventQuick';
  quick.innerHTML=quickDefs.map(([k,icon,label,sub])=>`<button class="eventQuickCard ${k==='ALL'?'active':''}" data-dir-quick="${k}"><b>${icon}</b><span>${label}</span><small>${sub}</small></button>`).join('');
  dirChips.parentNode.insertBefore(quick,dirChips);

  directoryData=function(){
    if(state.registry.length)return state.registry.slice();
    const map=new Map();state.items.filter(fresh).forEach(i=>{const k=String(i.organization||'').trim();if(!k)return;const old=map.get(k);if(!old||Number(i.rankScore||0)>Number(old.rankScore||0))map.set(k,i)});return [...map.values()]
  };

  dirCategory=function(i){
    if(i&&Object.prototype.hasOwnProperty.call(i,'website'))return categoryGroup(i);
    const t=text(i),tg=tags(i);if(tg.has('food')||tg.has('food-drink'))return 'Food & Drink';if(/health|vision|dental|pharmacy|chiropr/.test(t))return 'Health';if(/beauty|salon|nail|barber/.test(t))return 'Beauty';if(/auto|ford|o'reilly|car/.test(t))return 'Automotive';if(/school|usd 416/.test(t))return 'Schools & Childcare';if(/church/.test(t))return 'Churches';if(tg.has('community'))return 'Community';return 'Services'
  };

  renderDirectory=function(){
    let arr=directoryData();
    if(state.registry.length){
      arr=arr.filter(r=>quickGroupMatch(r,state.dirQuick))
        .filter(r=>state.dirCat==='ALL'||categoryGroup(r)===state.dirCat)
        .filter(r=>registryMatchesQuery(r,state.dirQ));
      if(state.source)arr=arr.filter(r=>hasRegistrySource(r,state.source));
      if(state.currentOnly)arr=arr.filter(r=>currentPosts(r.organization).length>0);
      if(state.recent)arr=arr.filter(r=>currentPosts(r.organization).some(i=>String(i.discoveryDate||'').slice(0,10)===lbToday()));
      arr.sort((a,b)=>String(a.organization||'').localeCompare(String(b.organization||'')));
      $('#directoryCount').textContent=`${arr.length} verified local listings`;
      $('#directoryList').innerHTML=arr.length?arr.map(r=>{
        const post=latestPost(r.organization),count=currentPosts(r.organization).length;
        const sourceTags=[r.website?'Website':'',r.facebook?'Facebook':'',r.instagram?'Instagram':''].filter(Boolean);
        const designations=Array.isArray(r.designationLabels)?r.designationLabels:[];
        return `<button class="directoryCard" data-profile="${esc(r.organization)}"><div class="avatar">${post&&post.sourceMediaUrl?`<img src="${esc(post.sourceMediaUrl)}" alt="" onerror="this.parentNode.textContent='${esc(initials(r.organization))}'">`:esc(initials(r.organization))}</div><div><h3>${esc(r.organization)}</h3><p>${esc(r.category||categoryGroup(r))}<br>${esc(r.address||'Louisburg, KS')}</p><div class="tinyTags">${count?`<span class="tinyTag">● ${count} current</span>`:''}${sourceTags.slice(0,2).map(x=>`<span class="tinyTag">${esc(x)}</span>`).join('')}${designations.slice(0,1).map(x=>`<span class="tinyTag">${esc(x)}</span>`).join('')}</div></div><span class="chev">›</span></button>`
      }).join(''):`<div class="empty"><b>No directory matches.</b>Try clearing a filter.</div>`;
      return;
    }
    $('#directoryCount').textContent='Loading verified directory…';
  };

  function findRegistry(org){
    const key=norm(org);if(state.registryMap.has(key))return state.registryMap.get(key);
    const core=key.split(' ').filter(x=>!['the','and','co','llc','inc','company'].includes(x));
    let best=null,bestScore=0;
    state.registry.forEach(r=>{const rt=norm(r.organization).split(' ');const hit=core.filter(x=>rt.includes(x)).length;const score=core.length?hit/core.length:0;if(score>bestScore&&score>=.75){best=r;bestScore=score}});
    return best;
  }

  function registryProfileLinks(r,posts){
    const out=[];const seen=new Set();
    function add(name,url){if(!url||!/^https?:\/\//i.test(url)||seen.has(url))return;seen.add(url);out.push([name,url])}
    if(r){add('Website',r.website);add('Facebook',r.facebook);add('Instagram',r.instagram);if(r.calendar&&r.calendar!==r.website)add('Events / Calendar',r.calendar)}
    posts.forEach(p=>add(sourceName(p)||'Latest source',p.originalUrl));
    return out;
  }

  function registryBlurb(r,posts){
    if(!r){const i=posts[0];return i?profileBlurb(i,posts):''}
    let s=`${r.organization} is a verified Louisburg ${String(r.category||'local organization').toLowerCase()}`;
    if(r.address)s+=` located at ${r.address}`;
    s+='.';
    const labels=Array.isArray(r.designationLabels)?r.designationLabels.filter(Boolean):[];
    if(labels.length)s+=` ${labels.join(' · ')}.`;
    if(posts.length)s+=` ${posts.length} current public update${posts.length===1?' is':'s are'} available in Louisburg Local.`;
    else s+=' There are no current feed updates right now, but the verified profile links are available below.';
    return s;
  }

  openProfile=function(org){
    const r=findRegistry(org),posts=currentPosts(org).slice().sort((a,b)=>Number(b.rankScore||0)-Number(a.rankScore||0)),i=posts[0]||null;
    if(!r&&!i)return;
    const name=r?r.organization:org,category=r?r.category:(i.category||dirCategory(i)),mapAddress=r&&r.address?r.address:(i&&i.location?i.location:''),address=mapAddress||'Louisburg, KS',directions=mapAddress?directionsUrl(mapAddress):'',links=registryProfileLinks(r,posts),photo=posts.find(x=>x.sourceMediaUrl&&/^https?:\/\//i.test(x.sourceMediaUrl));
    $('#profileContent').innerHTML=`<div class="profileTop"><div class="profileLogo">${photo?`<img src="${esc(photo.sourceMediaUrl)}" alt="" onerror="this.parentNode.textContent='${esc(initials(name))}'">`:esc(initials(name))}</div><div class="profileIdentity"><h2>${esc(name)}</h2><p>${esc(category)}<br>${esc(address)}</p><span class="verifiedLine">✓ Verified Louisburg listing</span></div></div><div class="profileBlurb">${esc(registryBlurb(r,posts))}</div>${links.length||directions?`<div class="profileLinks">${links.slice(0,6).map(([n,u])=>`<a class="profileLink ${profileLinkClass(n)}" target="_blank" rel="noopener noreferrer" href="${esc(u)}"><span>${profileLinkIcon(n)}</span>${esc(n)}</a>`).join('')}${directions?`<a class="profileLink directions" href="${esc(directions)}"><span>↗</span>Directions</a>`:''}</div>`:`<div class="meta" style="margin-bottom:14px">No verified public web or social link is currently on file.</div>`}<div class="profileSection"><div class="profileSectionHead"><h3>Current activity</h3><small>${posts.length} update${posts.length===1?'':'s'}</small></div><div class="feed">${posts.length?posts.map(card).join(''):'<div class="empty"><b>No current posts right now.</b>This listing remains available in the directory.</div>'}</div></div>`;
    openOverlay('#profileOverlay')
  };

  quick.onclick=e=>{
    const b=e.target.closest('[data-dir-quick]');if(!b)return;
    state.dirQuick=b.dataset.dirQuick;state.dirCat='ALL';
    $$('#directoryQuick .eventQuickCard').forEach(x=>x.classList.toggle('active',x===b));
    $$('#directoryChips .chip').forEach(x=>x.classList.toggle('active',x.dataset.dirCat==='ALL'));
    renderDirectory();
  };
  $('#directoryChips').onclick=e=>{
    const b=e.target.closest('[data-dir-cat]');if(!b)return;
    state.dirCat=b.dataset.dirCat;state.dirQuick='ALL';
    $$('#directoryChips .chip').forEach(x=>x.classList.toggle('active',x===b));
    $$('#directoryQuick .eventQuickCard').forEach(x=>x.classList.toggle('active',x.dataset.dirQuick==='ALL'));
    renderDirectory();
  };
  $$('[data-filter-current]').forEach(b=>b.onclick=()=>{state.currentOnly=!state.currentOnly;b.classList.toggle('active',state.currentOnly)});

  async function loadRegistryDirectory(){
    try{
      const parts=await Promise.all(['directory-1.json','directory-2.json','directory-3.json'].map(u=>fetch(u,{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('Directory data failed');return r.json()})));
      state.registry=parts.flatMap(p=>Array.isArray(p.items)?p.items:[]);
      state.registryMap=new Map(state.registry.map(r=>[norm(r.organization),r]));
      if(state.screen==='directory')renderDirectory();
    }catch(e){
      console.warn('V4 registry directory unavailable; using active-feed fallback.',e);
    }
  }
  loadRegistryDirectory();
})();

// Load the isolated Wildcat Territory parent calendar without changing the existing V4 feed/directory pipeline.
(function(){
  const s=document.createElement('script');
  s.src='wildcats-data.js';
  s.async=false;
  document.body.appendChild(s);
})();
