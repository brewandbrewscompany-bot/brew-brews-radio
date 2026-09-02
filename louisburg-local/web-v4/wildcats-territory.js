// Louisburg Local V4 — Wildcat Territory.
// Isolated parent-facing school calendar/list view built from existing verified Hub Feed data.
(function(){
  const STYLE_ID='wildcat-territory-style';
  const TODAY=()=>lbToday();
  const wt={
    view:'calendar',
    town:false,
    filter:'ALL',
    month:TODAY().slice(0,7),
    selected:TODAY()
  };
  try{
    const savedView=localStorage.getItem('ll_wildcats_view');
    if(savedView==='calendar'||savedView==='list')wt.view=savedView;
    wt.town=localStorage.getItem('ll_wildcats_town_overlay')==='1';
  }catch(e){}

  function norm(v){return String(v||'').toLowerCase().replace(/\s+/g,' ').trim()}
  function ymd(i){return String(i&&i.date||'').slice(0,10)}
  function validYmd(v){return /^20\d{2}-\d{2}-\d{2}$/.test(String(v||''))}
  function isSchool(i){
    const org=norm(i&&i.organization),url=norm(i&&i.originalUrl),t=text(i||{});
    return /arbiterlive\.com/.test(url)||/usd 416|louisburg high school|louisburg middle school|broadmoor|rockville|circle grove/.test(org)||/\busd 416\b/.test(t);
  }
  function isAthletics(i){
    if(!isSchool(i))return false;
    const t=text(i),url=norm(i.originalUrl);
    return /arbiterlive\.com/.test(url)||tags(i).has('sports')||/football|soccer|volleyball|cross country|basketball|wrestling|baseball|softball|track|golf|tennis|swim|bowling|athletics|game|match|meet|tournament/.test(t);
  }
  function schoolLevel(i){
    const org=norm(i&&i.organization),url=norm(i&&i.originalUrl);
    if(/arbiterlive\.com/.test(url)||/high school/.test(org))return 'LHS';
    if(/middle school/.test(org))return 'LMS';
    if(/broadmoor|rockville|circle grove|elementary|preschool/.test(org))return 'ELEMENTARY';
    return 'DISTRICT';
  }
  function schoolEligible(i){
    if(!fresh(i)||!isSchool(i)||!validYmd(ymd(i))||ymd(i)<TODAY())return false;
    const ty=norm(i.activityType),t=text(i);
    return catMatch(i,'EVENTS')||isAthletics(i)||/operational update/.test(ty)||/no school|school closed|closure|cancel|postpon|reschedul|early dismissal|registration|open house|concert|performance|meeting/.test(t);
  }
  function townEligible(i){return fresh(i)&&!isSchool(i)&&validYmd(ymd(i))&&ymd(i)>=TODAY()&&catMatch(i,'EVENTS')}
  function filterSchool(i){
    if(wt.filter==='ALL')return true;
    if(wt.filter==='ATHLETICS')return isAthletics(i);
    return schoolLevel(i)===wt.filter;
  }
  function schoolItems(){return state.items.filter(schoolEligible).filter(filterSchool).slice().sort((a,b)=>eventSortKey(a)-eventSortKey(b)||String(a.organization||'').localeCompare(String(b.organization||'')))}
  function townItems(){return state.items.filter(townEligible).slice().sort((a,b)=>eventSortKey(a)-eventSortKey(b)||String(a.organization||'').localeCompare(String(b.organization||'')))}
  function itemsForDate(date){
    const school=schoolItems().filter(i=>ymd(i)===date),town=wt.town?townItems().filter(i=>ymd(i)===date):[];
    return {school,town};
  }
  function prettyMonth(ym){
    const m=String(ym||'').match(/^(\d{4})-(\d{2})$/);if(!m)return '';
    return new Date(Date.UTC(Number(m[1]),Number(m[2])-1,1,12)).toLocaleString('en-US',{month:'long',year:'numeric',timeZone:'UTC'});
  }
  function prettyDate(date){
    if(!validYmd(date))return date;
    const [y,m,d]=date.split('-').map(Number);
    return new Date(Date.UTC(y,m-1,d,12)).toLocaleString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric',timeZone:'UTC'});
  }
  function shiftMonth(delta){
    const [y,m]=wt.month.split('-').map(Number),d=new Date(Date.UTC(y,m-1+delta,1,12));
    wt.month=`${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}`;
    if(!wt.selected.startsWith(wt.month))wt.selected=`${wt.month}-01`;
    renderWildcats();
  }
  function timeKey(i){return norm(i&&i.time).replace(/\s+/g,'')}
  function overlapLabel(school,date){
    if(!wt.town)return '';
    const same=townItems().filter(t=>ymd(t)===date);if(!same.length)return '';
    const st=timeKey(school);if(st&&same.some(t=>timeKey(t)&&timeKey(t)===st))return 'Same-time town event';
    return 'Town event also this day';
  }
  function sourceLabel(i){
    const u=norm(i&&i.originalUrl);
    if(/arbiterlive\.com/.test(u))return 'Official ArbiterLive schedule';
    return sourceName(i)||'Verified school source';
  }
  function eventMini(i,kind){
    const overlap=kind==='school'?overlapLabel(i,ymd(i)):'';
    return `<button class="wtMini ${kind}" data-id="${esc(i.id)}"><span>${kind==='school'?'WILDCAT':'TOWN'}</span><b>${esc(i.headline||i.summary||'Event')}</b>${i.time?`<small>${esc(i.time)}</small>`:''}${overlap?`<em>${esc(overlap)}</em>`:''}</button>`;
  }
  function listCard(i,kind){
    const overlap=kind==='school'?overlapLabel(i,ymd(i)):'';
    const d=ymd(i).split('-'),mon=d[1]?new Date(2000,Number(d[1])-1,1).toLocaleString('en-US',{month:'short'}).toUpperCase():'UP';
    return `<article class="wtListCard ${kind}" data-id="${esc(i.id)}"><div class="wtDate"><span>${esc(mon)}</span><b>${esc(d[2]||'—')}</b></div><div class="wtListInfo"><div class="wtKind">${kind==='school'?(isAthletics(i)?'WILDCAT ATHLETICS':'SCHOOL'):'TOWN OVERLAY'}</div><h3>${esc(i.headline||'School event')}</h3><p>${esc(i.organization||'Louisburg USD 416')}<br>${esc([i.time,i.location].filter(Boolean).join(' · '))}</p>${overlap?`<div class="wtConflict">⚑ ${esc(overlap)}</div>`:''}<small>${esc(sourceLabel(i))}</small></div></article>`;
  }
  function renderDayPanel(){
    const box=document.querySelector('#wildcatDayPanel');if(!box)return;
    const {school,town}=itemsForDate(wt.selected),all=[...school.map(i=>[i,'school']),...town.map(i=>[i,'town'])];
    box.innerHTML=`<div class="wtDayHead"><div><b>${esc(prettyDate(wt.selected))}</b><small>${school.length} school · ${town.length} town overlay</small></div></div>${all.length?`<div class="wtDayItems">${all.map(([i,k])=>listCard(i,k)).join('')}</div>`:`<div class="wtEmpty">No ${wt.town?'school or town':'school'} events shown for this day.</div>`}`;
  }
  function renderCalendar(){
    const box=document.querySelector('#wildcatCalendar');if(!box)return;
    const [y,m]=wt.month.split('-').map(Number),first=new Date(Date.UTC(y,m-1,1,12)),days=new Date(Date.UTC(y,m,0,12)).getUTCDate(),offset=first.getUTCDay();
    let html='<div class="wtWeek"><span>SUN</span><span>MON</span><span>TUE</span><span>WED</span><span>THU</span><span>FRI</span><span>SAT</span></div><div class="wtGrid">';
    for(let i=0;i<offset;i++)html+='<div class="wtCell blank"></div>';
    for(let day=1;day<=days;day++){
      const date=`${wt.month}-${String(day).padStart(2,'0')}`,sets=itemsForDate(date),school=sets.school,town=sets.town,shown=[...school.map(i=>[i,'school']),...town.map(i=>[i,'town'])],sameDay=school.length&&town.length;
      const cls=['wtCell',date===TODAY()?'today':'',date===wt.selected?'selected':'',sameDay?'hasOverlap':''].filter(Boolean).join(' ');
      html+=`<button class="${cls}" data-wt-date="${date}"><div class="wtDayNum">${day}${sameDay?'<i title="Town activity also this day">!</i>':''}</div><div class="wtCellEvents">${shown.slice(0,3).map(([ev,k])=>`<span class="${k}" title="${esc(ev.headline||'')}">${k==='school'?'●':'○'} ${esc(String(ev.headline||'Event').replace(/^Louisburg Wildcats\s*/i,'').slice(0,24))}</span>`).join('')}${shown.length>3?`<small>+${shown.length-3} more</small>`:''}</div></button>`;
    }
    html+='</div>';
    box.innerHTML=html;
    renderDayPanel();
  }
  function renderList(){
    const box=document.querySelector('#wildcatList');if(!box)return;
    const school=schoolItems(),town=wt.town?townItems():[],all=[...school.map(i=>[i,'school']),...town.map(i=>[i,'town'])].sort((a,b)=>eventSortKey(a[0])-eventSortKey(b[0])||String(a[0].organization||'').localeCompare(String(b[0].organization||'')));
    box.innerHTML=all.length?all.map(([i,k])=>listCard(i,k)).join(''):`<div class="wtEmpty">No upcoming school events match this view.</div>`;
  }
  function syncControls(){
    const title=document.querySelector('#wildcatMonthTitle');if(title)title.textContent=prettyMonth(wt.month);
    document.querySelectorAll('[data-wt-view]').forEach(b=>b.classList.toggle('active',b.dataset.wtView===wt.view));
    document.querySelectorAll('[data-wt-filter]').forEach(b=>b.classList.toggle('active',b.dataset.wtFilter===wt.filter));
    const t=document.querySelector('#wildcatTownToggle');if(t){t.classList.toggle('active',wt.town);t.setAttribute('aria-pressed',String(wt.town));t.querySelector('b').textContent=wt.town?'ON':'OFF'}
    const cal=document.querySelector('#wildcatCalendarWrap'),list=document.querySelector('#wildcatList');if(cal)cal.hidden=wt.view!=='calendar';if(list)list.hidden=wt.view!=='list';
    const legend=document.querySelector('#wildcatTownLegend');if(legend)legend.hidden=!wt.town;
  }
  function renderWildcats(){
    syncControls();
    if(wt.view==='calendar')renderCalendar();else renderList();
    const meta=document.querySelector('#wildcatMeta');if(meta){const school=schoolItems(),town=wt.town?townItems():[];meta.textContent=`${school.length} upcoming school items${wt.town?` · ${town.length} town events overlaid`:''}`}
  }
  function showWildcats(){
    showScreen('wildcats');
    const events=document.querySelector('.navBtn[data-nav="events"]');if(events)events.classList.add('active');
    renderWildcats();
  }
  function installStyles(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement('style');style.id=STYLE_ID;style.textContent=`
      .wtHero{background:linear-gradient(145deg,#281036,#54247a);color:#fff;border-radius:21px;padding:16px;margin-bottom:11px;box-shadow:var(--shadow)}
      .wtHeroTop{display:flex;align-items:flex-start;gap:10px}.wtPaw{width:52px;height:52px;border-radius:16px;background:#ffffff16;border:1px solid #ffffff2f;display:grid;place-items:center;font-size:28px}.wtHero h1{font:800 28px Georgia,serif;margin:0 0 3px}.wtHero p{margin:0;font-size:11px;opacity:.82;line-height:1.45}.wtHero .wtBack{margin-left:auto;border:1px solid #ffffff35;background:#ffffff12;color:#fff;border-radius:12px;padding:9px 10px;font-size:10px;font-weight:900}
      .wtControls{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:10px 0}.wtSegment{display:flex;background:#eee5f2;border-radius:13px;padding:3px}.wtSegment button{border:0;background:transparent;color:var(--deep);border-radius:10px;padding:8px 11px;font-size:10px;font-weight:900}.wtSegment button.active{background:#fff;box-shadow:0 3px 9px rgba(45,20,60,.09)}
      .wtTownToggle{margin-left:auto;border:1px solid #d8c9df;background:#fff;color:var(--deep);border-radius:13px;padding:8px 10px;font-size:10px;font-weight:900}.wtTownToggle b{display:inline-block;min-width:29px;margin-left:5px;padding:3px 5px;border-radius:999px;background:#e7ddea}.wtTownToggle.active{border-color:#b68e48;background:#fff8e9}.wtTownToggle.active b{background:#ead5a9;color:#684912}
      .wtFilters{display:flex;gap:7px;overflow:auto;padding-bottom:10px;scrollbar-width:none}.wtFilters::-webkit-scrollbar{display:none}.wtFilter{border:1px solid var(--line);background:#fff;border-radius:999px;padding:8px 11px;font-size:10px;font-weight:900;white-space:nowrap}.wtFilter.active{background:var(--deep);color:#fff;border-color:var(--deep)}
      .wtInfo{display:flex;align-items:center;justify-content:space-between;gap:8px;color:var(--muted);font-size:10px;margin:2px 2px 10px}.wtLegend{display:flex;gap:8px;align-items:center}.wtLegend span:before{content:'●';color:var(--purple);margin-right:3px}.wtLegend span.town:before{content:'○';color:#a97520}.wtLegend span[hidden]{display:none}
      .wtMonthBar{display:grid;grid-template-columns:42px 1fr 42px;align-items:center;margin:4px 0 9px}.wtMonthBar button{height:38px;border:1px solid var(--line);background:#fff;border-radius:12px;color:var(--deep);font-weight:900}.wtMonthBar h2{text-align:center;margin:0;font:800 21px Georgia,serif;color:var(--deep)}
      .wtCalendar{background:#fff;border:1px solid var(--line);border-radius:18px;overflow:hidden;box-shadow:0 6px 18px rgba(46,23,62,.05)}.wtWeek{display:grid;grid-template-columns:repeat(7,1fr);background:#eee5f2;color:#5c4965}.wtWeek span{text-align:center;padding:8px 2px;font-size:8px;font-weight:900}.wtGrid{display:grid;grid-template-columns:repeat(7,1fr)}.wtCell{min-height:94px;border:0;border-right:1px solid #eee7ef;border-bottom:1px solid #eee7ef;background:#fff;text-align:left;padding:6px;overflow:hidden}.wtCell.blank{background:#faf7fb}.wtCell.today{box-shadow:inset 0 0 0 2px #8d64a9}.wtCell.selected{background:#f7f0fa}.wtCell.hasOverlap{background:#fffaf0}.wtDayNum{font-size:11px;font-weight:900;color:var(--deep);display:flex;justify-content:space-between}.wtDayNum i{font-style:normal;display:grid;place-items:center;width:16px;height:16px;border-radius:50%;background:#e5c992;color:#67470e;font-size:9px}.wtCellEvents{display:grid;gap:3px;margin-top:5px}.wtCellEvents span{display:block;border-radius:5px;padding:3px 4px;font-size:7px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.wtCellEvents span.school{background:#eee2f4;color:#4b216d}.wtCellEvents span.town{background:#fff0cd;color:#745115}.wtCellEvents small{font-size:7px;color:var(--muted)}
      .wtDayPanel{margin-top:10px}.wtDayHead{display:flex;justify-content:space-between;background:#f3ebf6;border:1px solid var(--line);border-radius:14px;padding:10px 12px}.wtDayHead b{display:block;color:var(--deep);font-size:12px}.wtDayHead small{display:block;color:var(--muted);font-size:9px;margin-top:2px}.wtDayItems,.wtList{display:grid;gap:9px;margin-top:9px}.wtListCard{display:grid;grid-template-columns:64px 1fr;background:#fff;border:1px solid var(--line);border-left:5px solid var(--purple);border-radius:16px;overflow:hidden;box-shadow:0 5px 14px rgba(46,23,62,.05);cursor:pointer}.wtListCard.town{border-left-color:#b8842e}.wtDate{display:grid;place-items:center;background:#f1e8f5;color:var(--deep);padding:8px}.wtListCard.town .wtDate{background:#fff2d8;color:#745115}.wtDate span{font-size:9px;font-weight:900}.wtDate b{font:800 23px Georgia,serif}.wtListInfo{padding:10px}.wtListInfo h3{font-size:14px;margin:2px 0 4px}.wtListInfo p{margin:0;color:var(--muted);font-size:10px;line-height:1.4}.wtListInfo>small{display:block;color:#6f5e76;font-size:8px;font-weight:800;margin-top:6px}.wtKind{font-size:8px;font-weight:900;color:var(--purple)}.wtListCard.town .wtKind{color:#8a5e18}.wtConflict{display:inline-block;margin-top:7px;background:#fff0cc;color:#765313;border-radius:999px;padding:5px 7px;font-size:8px;font-weight:900}.wtEmpty{background:#fff;border:1px dashed #cabed0;border-radius:16px;text-align:center;padding:23px 14px;color:var(--muted);font-size:11px}
      .wtMini{width:100%;display:grid;gap:2px;border:1px solid var(--line);border-left:4px solid var(--purple);background:#fff;border-radius:12px;padding:9px;text-align:left}.wtMini.town{border-left-color:#b8842e}.wtMini span{font-size:7px;font-weight:900;color:var(--purple)}.wtMini b{font-size:11px}.wtMini small{font-size:9px;color:var(--muted)}.wtMini em{font-size:8px;color:#765313;font-style:normal;font-weight:900}
      .wtJump{width:100%;margin-top:15px;border:1px solid #d8cedd;border-left:5px solid var(--purple);background:#fff;color:var(--deep);border-radius:16px;padding:14px 15px;display:flex;align-items:center;justify-content:space-between;gap:12px;text-align:left;box-shadow:0 5px 14px rgba(46,23,62,.05)}.wtJump span{display:grid;gap:3px}.wtJump b{font:800 16px Georgia,serif}.wtJump small{font-size:9px;color:var(--muted)}.wtJump strong{font-size:10px;color:var(--purple);white-space:nowrap}
      @media(max-width:620px){.wtCell{min-height:76px;padding:4px}.wtCellEvents span{font-size:0;height:8px;padding:0;border-radius:999px}.wtCellEvents span.school:after{content:''}.wtCellEvents small{font-size:6px}.wtWeek span{font-size:7px}.wtHero h1{font-size:25px}.wtTownToggle{margin-left:0}.wtControls{align-items:stretch}.wtCalendar{border-radius:15px}}
      @media(min-width:760px){#wildcatsScreen{max-width:980px;margin:auto}.wtCell{min-height:118px}.wtDayItems,.wtList{grid-template-columns:repeat(2,minmax(0,1fr))}}
    `;document.head.appendChild(style);
  }
  function installScreen(){
    if(document.querySelector('#wildcatsScreen'))return;
    const main=document.querySelector('main.main');if(!main)return;
    main.insertAdjacentHTML('beforeend',`<section class="screen" id="wildcatsScreen">
      <div class="wtHero"><div class="wtHeroTop"><div class="wtPaw">🐾</div><div><h1>Wildcat Territory</h1><p>Louisburg school events and athletics for parents. Town activity stays separate unless you turn the overlay on.</p></div><button class="wtBack" id="wildcatTownEvents">Town Events</button></div></div>
      <div class="wtControls"><div class="wtSegment"><button data-wt-view="calendar">Calendar</button><button data-wt-view="list">List</button></div><button class="wtTownToggle" id="wildcatTownToggle" aria-pressed="false">Show Town Events <b>OFF</b></button></div>
      <div class="wtFilters"><button class="wtFilter active" data-wt-filter="ALL">All School</button><button class="wtFilter" data-wt-filter="ATHLETICS">Athletics</button><button class="wtFilter" data-wt-filter="LHS">LHS</button><button class="wtFilter" data-wt-filter="LMS">LMS</button><button class="wtFilter" data-wt-filter="ELEMENTARY">Elementary</button><button class="wtFilter" data-wt-filter="DISTRICT">District</button></div>
      <div class="wtInfo"><span id="wildcatMeta">Loading school schedule…</span><div class="wtLegend"><span>School</span><span class="town" id="wildcatTownLegend" hidden>Town overlay</span></div></div>
      <div id="wildcatCalendarWrap"><div class="wtMonthBar"><button id="wildcatPrevMonth" aria-label="Previous month">‹</button><h2 id="wildcatMonthTitle"></h2><button id="wildcatNextMonth" aria-label="Next month">›</button></div><div class="wtCalendar" id="wildcatCalendar"></div><div class="wtDayPanel" id="wildcatDayPanel"></div></div>
      <div class="wtList" id="wildcatList" hidden></div>
    </section>`);
  }
  function separateTownEvents(){
    const eventList=document.querySelector('#eventList');
    if(eventList&&!document.querySelector('#wildcatJumpFromEvents')){
      const jump=document.createElement('button');
      jump.id='wildcatJumpFromEvents';jump.className='wtJump';
      jump.innerHTML='<span><b>🐾 Wildcat Tracker</b><small>School calendar, athletics and parent schedule</small></span><strong>Open →</strong>';
      jump.onclick=showWildcats;
      eventList.insertAdjacentElement('afterend',jump);
    }
    renderEvents=function(){
      let arr=state.items.filter(i=>fresh(i)&&!isSchool(i)&&catMatch(i,'EVENTS')&&eventFilterMatch(i,state.eventFilter));
      arr=arr.slice().sort((a,b)=>eventSortKey(a)-eventSortKey(b)||String(a.organization||'').localeCompare(String(b.organization||'')));
      $('#eventList').innerHTML=arr.length?arr.map(i=>{const d=String(i.date||'').split('-'),day=d[2]||'—',mon=d[1]?new Date(2000,Number(d[1])-1,1).toLocaleString('en-US',{month:'short'}).toUpperCase():'UP';return `<article class="eventCard" data-id="${esc(i.id)}"><div class="eventDate"><span>${esc(mon)}</span><b>${esc(day)}</b></div><div class="eventInfo"><h3>${esc(i.headline)}</h3><p><button class="orgBtn" data-profile="${esc(i.organization)}">${esc(i.organization)}</button><br>${esc([i.time,i.location].filter(Boolean).join(' · '))}</p></div></article>`}).join(''):`<div class="empty"><b>No town events match this filter.</b>School events are kept in Wildcat Territory.</div>`;
    };
  }
  function wire(){
    document.querySelectorAll('[data-wt-view]').forEach(b=>b.onclick=()=>{wt.view=b.dataset.wtView;try{localStorage.setItem('ll_wildcats_view',wt.view)}catch(e){}renderWildcats()});
    document.querySelectorAll('[data-wt-filter]').forEach(b=>b.onclick=()=>{wt.filter=b.dataset.wtFilter;renderWildcats()});
    const town=document.querySelector('#wildcatTownToggle');if(town)town.onclick=()=>{wt.town=!wt.town;try{localStorage.setItem('ll_wildcats_town_overlay',wt.town?'1':'0')}catch(e){}renderWildcats()};
    const prev=document.querySelector('#wildcatPrevMonth'),next=document.querySelector('#wildcatNextMonth');if(prev)prev.onclick=()=>shiftMonth(-1);if(next)next.onclick=()=>shiftMonth(1);
    const cal=document.querySelector('#wildcatCalendar');if(cal)cal.onclick=e=>{const d=e.target.closest('[data-wt-date]');if(!d)return;wt.selected=d.dataset.wtDate;renderCalendar()};
    const back=document.querySelector('#wildcatTownEvents');if(back)back.onclick=()=>showScreen('events');
    document.addEventListener('click',e=>{const card=e.target.closest('#wildcatsScreen [data-id]');if(card&&card.dataset.id)openDetail(findItem(card.dataset.id))});
  }
  installStyles();installScreen();separateTownEvents();wire();renderWildcats();
  window.showWildcatsTerritory=showWildcats;
})();
