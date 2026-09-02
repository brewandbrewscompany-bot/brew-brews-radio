import {pathToFileURL} from 'node:url';
import {writeFileSync} from 'node:fs';

const DEFAULT_ENDPOINT='https://script.google.com/macros/s/AKfycbxw9gJBH50L_VZbgp6i_mHHnfPXAkraIqv63BA2XqWtb-XaaczXxdf89WveFkAOwV-azw/exec';
const TZ='America/Chicago';
const SCHOOL_ID='13250';
const CALENDAR_URL=`https://www.arbiterlive.com/School/Calendar/${SCHOOL_ID}`;
const GAME_BASE='https://www.arbiterlive.com';
const EVENT_RESPONSE_RE=/\/School\/GetEventsByEntity\//i;
const SPORT_RE=/\b(football|soccer|volleyball|cross country|golf|tennis|basketball|wrestling|baseball|softball|track(?:\s*&\s*field|\s+and\s+field)?|swimming|swim|bowling)\b/i;
const SNAPSHOT_URL=new URL('../web-v4/wildcats-schedule.json',import.meta.url);

function clean(v){return String(v||'').replace(/\u00a0/g,' ').replace(/\s+/g,' ').trim();}
function norm(v){return clean(v).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();}
function localYmd(d=new Date()){
  const p=new Intl.DateTimeFormat('en-US',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d),o={};
  p.forEach(x=>o[x.type]=x.value);return `${o.year}-${o.month}-${o.day}`;
}
function addDaysYmd(ymd,days){const [y,m,d]=ymd.split('-').map(Number),x=new Date(Date.UTC(y,m-1,d+days,18));return `${x.getUTCFullYear()}-${String(x.getUTCMonth()+1).padStart(2,'0')}-${String(x.getUTCDate()).padStart(2,'0')}`;}
function inWindow(date,today,futureDays=35){return date>=today&&date<=addDaysYmd(today,futureDays);}
function prettyDate(ymd){const [y,m,d]=ymd.split('-').map(Number);return new Intl.DateTimeFormat('en-US',{timeZone:TZ,month:'long',day:'numeric',year:'numeric'}).format(new Date(Date.UTC(y,m-1,d,18)));}
function ymdFromArbiterStart(v){const m=String(v||'').match(/^(\d{1,2})\/(\d{1,2})\/(20\d{2})/);return m?`${m[3]}-${String(Number(m[1])).padStart(2,'0')}-${String(Number(m[2])).padStart(2,'0')}`:'';}
function decodeEntities(v){let s=String(v||'');for(let pass=0;pass<2;pass++)s=s.replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16))).replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&');return s;}
function gameIdFromHref(href){const m=String(href||'').match(/\/Teams\/Game\/(\d+)\/(\d+)\/(\d+)\/(\d+)/i);return m&&m[2]===SCHOOL_ID?m[1]:'';}
function normalizeClock(v){const m=clean(v).match(/^(\d{1,2}):(\d{2})\s*([ap])m?$/i);if(!m)return clean(v);return `${Number(m[1])}:${m[2]} ${m[3].toUpperCase()}M`;}
function parseTimePrefix(text){const m=clean(text).match(/^(\d{1,2}:\d{2}\s*[ap]m?)(?:\s*-\s*(\d{1,2}:\d{2}\s*[ap]m?))?\s+(.+)$/i);if(!m)return {time:'',endTime:'',rest:clean(text)};return {time:normalizeClock(m[1]),endTime:m[2]?normalizeClock(m[2]):'',rest:clean(m[3])};}
function sportName(label){const m=clean(label).match(SPORT_RE);return m?m[1].replace(/\s+/g,' ').replace(/\b\w/g,c=>c.toUpperCase()):'Athletics';}
function eventNoun(sport){return /cross country|track|golf|swim|bowling/i.test(sport)?'meet':'game';}
function stripGameWord(v){return clean(v).replace(/\s+(?:game|match|meet)$/i,'').trim();}

export function parseArbiterAnchorText(text){
  const t=parseTimePrefix(text);let desc=t.rest,cancelled=/\b(cancelled|canceled)\b/i.test(desc);desc=clean(desc.replace(/\b(cancelled|canceled)\b/ig,''));
  const rel=desc.match(/^(.*?)\s+(vs\.|at)\s+(.+)$/i);
  const teamLabel=stripGameWord(rel?rel[1]:desc),relation=rel?rel[2].toLowerCase():'',opponent=rel?clean(rel[3]):'';
  return {time:t.time,endTime:t.endTime,teamLabel,sport:sportName(teamLabel),homeAway:relation==='vs.'?'HOME':relation==='at'?'AWAY':'',opponent,cancelled};
}

function fallbackTextForGame(decodedTitle,gameId){
  const re=new RegExp(`<a[^>]+href=['\"]([^'\"]*\\/Teams\\/Game\\/${gameId}\\/[^'\"]+)['\"][^>]*>([\\s\\S]*?)<\\/a>`,'i'),m=decodedTitle.match(re);if(!m)return '';
  return clean(decodeEntities(m[2]).replace(/<br\s*\/?\s*>/gi,' ').replace(/<[^>]+>/g,' '));
}

export function parseArbiterEventsResponse(outer,anchors=[],{today=localYmd(),futureDays=35}={}){
  const payload=typeof outer==='string'?JSON.parse(outer):outer||{};
  const summaries=typeof payload.EventsFilteredSummaryString==='string'?JSON.parse(payload.EventsFilteredSummaryString||'[]'):Array.isArray(payload.EventsFilteredSummaryString)?payload.EventsFilteredSummaryString:[];
  const anchorMap=new Map();
  for(const a of anchors){const id=gameIdFromHref(a.href);if(id&&!anchorMap.has(id))anchorMap.set(id,clean(a.text));}
  const raw=[];
  for(const summary of summaries){
    const date=ymdFromArbiterStart(summary.start);if(!date||!inWindow(date,today,futureDays))continue;
    const decoded=decodeEntities(summary.title||'');
    const ids=[...decoded.matchAll(new RegExp(`/Teams/Game/(\\d+)/${SCHOOL_ID}/\\d+/\\d+`,'gi'))].map(m=>m[1]);
    for(const gameId of [...new Set(ids)]){
      const hrefMatch=decoded.match(new RegExp(`(/Teams/Game/${gameId}/${SCHOOL_ID}/\\d+/\\d+)`,'i'));if(!hrefMatch)continue;
      const path=hrefMatch[1],sourceText=anchorMap.get(gameId)||fallbackTextForGame(decoded,gameId),parsed=parseArbiterAnchorText(sourceText);
      if(!parsed.teamLabel||!SPORT_RE.test(parsed.teamLabel))continue;
      raw.push({...parsed,date,gameId,postId:`WILDCATS-${gameId}`,postUrl:`${GAME_BASE}${path}`});
    }
  }
  const deduped=new Map();
  for(const event of raw){
    const key=[event.date,event.time,norm(event.teamLabel),norm(event.opponent),event.homeAway].join('|');const old=deduped.get(key);
    if(!old||old.cancelled&&!event.cancelled)deduped.set(key,event);
  }
  return [...deduped.values()].sort((a,b)=>a.date.localeCompare(b.date)||a.time.localeCompare(b.time)||a.teamLabel.localeCompare(b.teamLabel));
}

function buildPostText(event){
  const noun=eventNoun(event.sport),status=event.cancelled?'CANCELLED: ':'';let text=`${status}Louisburg Wildcats ${event.teamLabel} ${noun}`;
  if(event.opponent)text+=event.homeAway==='HOME'?` vs. ${event.opponent}`:event.homeAway==='AWAY'?` at ${event.opponent}`:` with ${event.opponent}`;
  text+=` on ${prettyDate(event.date)}`;if(event.time)text+=` at ${event.time}`;text+='.';
  if(event.homeAway==='HOME')text+=' Home event in Louisburg, KS.';else if(event.homeAway==='AWAY'&&event.opponent)text+=` Away event at ${event.opponent}.`;
  text+=' Official ArbiterLive Louisburg High School athletics schedule.';return text;
}

function snapshotHeadline(event){
  const noun=eventNoun(event.sport),status=event.cancelled?'CANCELLED — ':'';let s=`${status}${event.teamLabel} ${noun}`;
  if(event.opponent)s+=event.homeAway==='HOME'?` vs. ${event.opponent}`:event.homeAway==='AWAY'?` at ${event.opponent}`:` — ${event.opponent}`;
  return clean(s);
}

function writeScheduleSnapshot(events,loaded){
  const items=events.map(event=>({
    id:event.postId,
    organization:'Louisburg High School - USD 416',
    category:'Event',
    headline:snapshotHeadline(event),
    summary:buildPostText(event),
    section:'COMING UP',
    date:event.date,
    time:event.time,
    endTime:event.endTime||'',
    location:event.homeAway==='HOME'?'Louisburg, KS':event.opponent||'',
    originalUrl:event.postUrl,
    lifecycleState:event.cancelled?'CANCELLED':'COMING UP',
    activityType:event.cancelled?'Operational Update':'Event / Activity',
    tags:'sports what-to-do',
    source:'ArbiterLive',
    schoolId:SCHOOL_ID,
    sport:event.sport,
    teamLabel:event.teamLabel,
    homeAway:event.homeAway,
    opponent:event.opponent,
    cancelled:!!event.cancelled
  }));
  const snapshot={ok:true,source:'ArbiterLive',school:'Louisburg High School',schoolId:SCHOOL_ID,calendarUrl:CALENDAR_URL,generatedAt:new Date().toISOString(),rangeStart:loaded.rangeStart||'',rangeEnd:loaded.rangeEnd||'',items};
  writeFileSync(SNAPSHOT_URL,JSON.stringify(snapshot,null,2)+'\n','utf8');
  console.log(`Wildcats public schedule snapshot written: ${items.length} items -> ${SNAPSHOT_URL.pathname}`);
}

async function postJson(endpoint,ingestKey,payload){
  const response=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'social_intake',ingestKey,...payload}),redirect:'follow'});const text=await response.text();let parsed;try{parsed=JSON.parse(text);}catch{throw new Error(`Non-JSON intake response: ${text.slice(0,180)}`);}if(!response.ok||!parsed.ok)throw new Error(`intake failed: ${parsed.error||response.status}`);return parsed;
}

async function loadOfficialSchedule(context,{today,futureDays}){
  const page=await context.newPage();
  try{
    const responsePromise=page.waitForResponse(r=>EVENT_RESPONSE_RE.test(r.url())&&r.request().method()==='POST',{timeout:20000});
    await page.goto(CALENDAR_URL,{waitUntil:'domcontentloaded',timeout:30000});
    const response=await responsePromise,outer=await response.json();
    await page.waitForTimeout(1800);
    const anchors=await page.locator('a[href*="/Teams/Game/"]').evaluateAll(as=>as.map(a=>({href:a.getAttribute('href')||a.href||'',text:(a.innerText||a.textContent||'').replace(/\s+/g,' ').trim()})).filter(x=>x.href));
    const events=parseArbiterEventsResponse(outer,anchors,{today,futureDays});
    return {events,rangeStart:outer.DataDateStart||'',rangeEnd:outer.DataDateEnd||'',anchorCount:anchors.length};
  }finally{await page.close();}
}

export async function run(){
  const endpoint=process.env.LL_SOCIAL_ENDPOINT||DEFAULT_ENDPOINT,ingestKey=process.env.LL_SOCIAL_INGEST_KEY||'';if(!ingestKey)throw new Error('LL_SOCIAL_INGEST_KEY is required.');
  const {chromium}=await import('playwright'),browser=await chromium.launch({headless:true}),context=await browser.newContext({locale:'en-US',timezoneId:TZ,viewport:{width:1440,height:1100}}),today=localYmd();
  let loaded;try{loaded=await loadOfficialSchedule(context,{today,futureDays:35});}finally{await context.close();await browser.close();}
  const events=loaded.events.slice(0,80);console.log(`Official Arbiter Wildcats calendar: range=${loaded.rangeStart}..${loaded.rangeEnd}; gameLinks=${loaded.anchorCount}; currentFuture=${events.length}`);
  if(!events.length)throw new Error('Official Arbiter Wildcats calendar was readable but no current/future athletic events were extracted.');
  writeScheduleSnapshot(events,loaded);
  let delivered=0,duplicates=0;
  for(const event of events){
    const result=await postJson(endpoint,ingestKey,{queueId:'FIRSTPARTY-WILDCATS-ARBITER',organization:'Louisburg High School - USD 416',platform:'WEBSITE',profileUrl:CALENDAR_URL,postUrl:event.postUrl,postId:event.postId,postDate:new Date().toISOString(),postText:buildPostText(event),mediaUrl:'',mediaType:'',activityType:event.cancelled?'Operational Update':'Event / Activity',louisburgMatch:'VERIFIED'});
    delivered++;if(result.duplicate)duplicates++;console.log(`${event.date} ${event.time} ${event.teamLabel}${event.opponent?` ${event.homeAway==='HOME'?'vs.':'at'} ${event.opponent}`:''}${event.cancelled?' [CANCELLED]':''} -> ${result.duplicate?'duplicate':'submitted'}`);
  }
  console.log(`Wildcats Arbiter scan complete: extracted=${events.length}; delivered=${delivered}; duplicates=${duplicates}`);
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)run().catch(error=>{console.error(error);process.exitCode=1;});
