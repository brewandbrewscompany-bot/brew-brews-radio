import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';

const DEFAULT_ENDPOINT='https://script.google.com/macros/s/AKfycbxw9gJBH50L_VZbgp6i_mHHnfPXAkraIqv63BA2XqWtb-XaaczXxdf89WveFkAOwV-azw/exec';
const BASE='https://www.frontierleagueks.org/public/genie/976/school/13';
const TZ='America/Chicago';
const MONTHS='January February March April May June July August September October November December'.split(' ');
const SPORT_RE=/\b(football|soccer|volleyball|cross country|golf|tennis|basketball|wrestling|baseball|softball|track(?:\s*&\s*field|\s+and\s+field)?|swimming|swim|bowling)\b/i;
const CONTEST_RE=/\b(game|match|meet|tournament|invitational|dual|triangular|quad|championship|playoff|playoffs|regional|state|sub-state|substate|scrimmage)\b/i;
const EXCLUDE_RE=/\b(practice|workout|workouts|camp|open gym|team dinner|dinner|awards? night|banquet|tryout|clinic|meeting|picture day|weights?|conditioning|first day of practice)\b/i;
const DATE_RE=new RegExp(`^(?:Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday),\\s+(${MONTHS.join('|')})\\s+(\\d{1,2}),\\s+(20\\d{2})$`,'i');
const TIME_ONLY_RE=/^(TBD|\d{1,2}:\d{2}\s*(?:am|pm)(?:\s*-\s*\d{1,2}:\d{2}\s*(?:am|pm))?|\d{1,2}\s*(?:am|pm))$/i;

function clean(v){return String(v||'').replace(/\u00a0/g,' ').replace(/\s+/g,' ').trim();}
function hash12(v){return createHash('sha256').update(String(v||'')).digest('hex').slice(0,12);}
function localYmd(d=new Date()){
  const p=new Intl.DateTimeFormat('en-US',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d),o={};
  p.forEach(x=>o[x.type]=x.value);return `${o.year}-${o.month}-${o.day}`;
}
function ymdFromHeading(line){const m=clean(line).match(DATE_RE);if(!m)return '';const month=MONTHS.findIndex(x=>x.toLowerCase()===m[1].toLowerCase())+1;return `${m[3]}-${String(month).padStart(2,'0')}-${String(Number(m[2])).padStart(2,'0')}`;}
function prettyDate(ymd){const [y,m,d]=ymd.split('-').map(Number);return new Intl.DateTimeFormat('en-US',{timeZone:TZ,month:'long',day:'numeric',year:'numeric'}).format(new Date(Date.UTC(y,m-1,d,18)));}
function addDaysYmd(ymd,days){const [y,m,d]=ymd.split('-').map(Number),x=new Date(Date.UTC(y,m-1,d+days,18));return `${x.getUTCFullYear()}-${String(x.getUTCMonth()+1).padStart(2,'0')}-${String(x.getUTCDate()).padStart(2,'0')}`;}
function compareYmd(a,b){return String(a).localeCompare(String(b));}
function inWindow(date,today,futureDays=35){return compareYmd(date,today)>=0&&compareYmd(date,addDaysYmd(today,futureDays))<=0;}
function isContest(title){const t=clean(title).replace(/\bBus Info\b/ig,'').replace(/\bmore\.\.\b/ig,'');return SPORT_RE.test(t)&&CONTEST_RE.test(t)&&!EXCLUDE_RE.test(t);}
function sportName(title){const m=clean(title).match(SPORT_RE);return m?m[1].replace(/\s+/g,' ').replace(/\b\w/g,c=>c.toUpperCase()):'Athletics';}
function cleanTitle(title){return clean(title).replace(/\bBus Info\b/ig,'').replace(/\bmore\.\.\b/ig,'').replace(/\s*\(\s*(?:Cancelled|Canceled)\s*\)\s*/ig,' (Cancelled)').trim();}
function cleanDetails(parts){return clean(parts.join(' ')).replace(/\* \* \*/g,' ').replace(/Leaves:\s*[^|]+/ig,' ').replace(/Dismissal:\s*[^|]+/ig,' ').replace(/Return:\s*[^|]+/ig,' ').replace(/\blocation(?:FS)?\b/ig,' ').replace(/\bBus Info\b/ig,' ').replace(/\s+/g,' ').trim();}
function parseOpponent(details){const m=String(details||'').match(/\bvs\.\s*(.+?)(?=\s+@\s+|$)/i);return m?clean(m[1]).replace(/\.\.$/,''):'';}
function parseLocation(details){const m=String(details||'').match(/\s@\s(.+)$/);return m?clean(m[1]).replace(/\blocation(?:FS)?\b/ig,'').trim():'';}
function timeStart(raw){const m=clean(raw).match(/^(TBD|\d{1,2}:\d{2}\s*(?:am|pm)|\d{1,2}\s*(?:am|pm))/i);return m?clean(m[1]):'';}
function rowFromInline(line){const cells=String(line||'').split(/\t+/).map(clean).filter(Boolean);if(cells.length>=2&&TIME_ONLY_RE.test(cells[0]))return {time:cells[0],title:cells[1],details:cells.slice(2)};const m=clean(line).match(/^(TBD|\d{1,2}:\d{2}\s*(?:am|pm)(?:\s*-\s*\d{1,2}:\d{2}\s*(?:am|pm))?|\d{1,2}\s*(?:am|pm))\s+(.+)$/i);return m?{time:m[1],title:m[2],details:[]}:null;}

export function extractWildcatEvents(raw,{today=localYmd(),futureDays=35}={}){
  const lines=String(raw||'').split(/\r?\n/).map(clean).filter(Boolean),out=[],seen=new Set();let currentDate='';
  for(let i=0;i<lines.length;i++){
    const heading=ymdFromHeading(lines[i]);if(heading){currentDate=heading;continue;}if(!currentDate||!inWindow(currentDate,today,futureDays))continue;
    let row=rowFromInline(lines[i]),consume=0;
    if(!row&&TIME_ONLY_RE.test(lines[i])){
      let j=i+1;while(j<lines.length&&/^(Time|Event|Details|-+|\* \* \*)$/i.test(lines[j]))j++;
      if(j<lines.length){row={time:lines[i],title:lines[j],details:[]};consume=j-i;}
    }
    if(!row||!isContest(row.title))continue;
    const detailParts=[...row.details];let j=i+Math.max(1,consume+1),steps=0;
    while(j<lines.length&&steps<10){if(ymdFromHeading(lines[j])||TIME_ONLY_RE.test(lines[j])||rowFromInline(lines[j]))break;detailParts.push(lines[j]);j++;steps++;}
    const title=cleanTitle(row.title),details=cleanDetails(detailParts),opponent=parseOpponent(details),location=parseLocation(details),cancelled=/\b(cancelled|canceled)\b/i.test(`${title} ${details}`),time=timeStart(row.time);
    const stable=`${currentDate}|${time}|${title.toLowerCase()}|${opponent.toLowerCase()}|${location.toLowerCase()}`;if(seen.has(stable))continue;seen.add(stable);
    out.push({date:currentDate,time,title,sport:sportName(title),opponent,location,cancelled,details,postId:`WILDCATS-${currentDate.replace(/-/g,'')}-${hash12(stable)}`});
  }
  return out.sort((a,b)=>a.date.localeCompare(b.date)||a.time.localeCompare(b.time)||a.title.localeCompare(b.title));
}

function buildPostText(event){
  const status=event.cancelled?'CANCELLED: ':'';let text=`${status}Louisburg Wildcats ${event.title} on ${prettyDate(event.date)}`;if(event.time)text+=` at ${event.time}`;text+='.';if(event.opponent)text+=` Opponent: ${event.opponent}.`;if(event.location)text+=` Location: ${event.location}.`;text+=' Official Frontier League Louisburg athletics schedule.';return text;
}

async function postJson(endpoint,ingestKey,payload){
  const response=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'social_intake',ingestKey,...payload}),redirect:'follow'});const text=await response.text();let parsed;try{parsed=JSON.parse(text);}catch{throw new Error(`Non-JSON intake response: ${text.slice(0,180)}`);}if(!response.ok||!parsed.ok)throw new Error(`intake failed: ${parsed.error||response.status}`);return parsed;
}

function weekUrls(today){return [0,7,14,21,28].map(offset=>`${BASE}/date/${addDaysYmd(today,offset)}/view/week/`);}

export async function run(){
  const endpoint=process.env.LL_SOCIAL_ENDPOINT||DEFAULT_ENDPOINT,ingestKey=process.env.LL_SOCIAL_INGEST_KEY||'';if(!ingestKey)throw new Error('LL_SOCIAL_INGEST_KEY is required.');
  const {chromium}=await import('playwright'),browser=await chromium.launch({headless:true}),context=await browser.newContext({locale:'en-US',timezoneId:TZ,viewport:{width:1365,height:1000}}),today=localYmd(),all=[];let readable=0,failures=0;
  try{
    for(const url of weekUrls(today)){
      const page=await context.newPage();try{await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});await page.waitForTimeout(1800);const body=await page.locator('body').innerText({timeout:10000});const events=extractWildcatEvents(body,{today,futureDays:35});readable++;all.push(...events.map(event=>({event,url})));console.log(`Wildcats schedule readable: ${url}; contests=${events.length}`);}catch(error){failures++;console.error(`Wildcats schedule error: ${url}; ${String(error.message||error).replace(/\s+/g,' ').slice(0,220)}`);}finally{await page.close();}
    }
  }finally{await context.close();await browser.close();}
  const unique=new Map();for(const x of all){const k=x.event.postId;if(!unique.has(k))unique.set(k,x);}const events=[...unique.values()].sort((a,b)=>a.event.date.localeCompare(b.event.date)||a.event.time.localeCompare(b.event.time)).slice(0,40);
  let delivered=0,duplicates=0;for(const {event,url} of events){const result=await postJson(endpoint,ingestKey,{queueId:'FIRSTPARTY-WILDCATS-SCHEDULE',organization:'Louisburg High School - USD 416',platform:'WEBSITE',profileUrl:`${BASE}/`,postUrl:url,postId:event.postId,postDate:new Date().toISOString(),postText:buildPostText(event),mediaUrl:'',mediaType:'',activityType:event.cancelled?'Operational Update':'Event / Activity',louisburgMatch:'VERIFIED'});delivered++;if(result.duplicate)duplicates++;console.log(`${event.date} ${event.time} ${event.title} -> ${result.duplicate?'duplicate':'submitted'}`);}
  console.log(`Wildcats schedule scan complete: readable=${readable}; extracted=${all.length}; unique=${events.length}; delivered=${delivered}; duplicates=${duplicates}; failures=${failures}`);if(!readable)throw new Error('No official Wildcats schedule page was readable.');
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)run().catch(error=>{console.error(error);process.exitCode=1;});
