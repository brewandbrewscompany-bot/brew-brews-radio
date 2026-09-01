import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';

const DEFAULT_ENDPOINT='https://script.google.com/macros/s/AKfycbxw9gJBH50L_VZbgp6i_mHHnfPXAkraIqv63BA2XqWtb-XaaczXxdf89WveFkAOwV-azw/exec';
const TZ='America/Chicago';
const WEEKDAYS=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MONTHS='January February March April May June July August September October November December'.split(' ');
const ACTION_RE=/\b(event|festival|live music|concert|special|deal|discount|coupon|promo(?:tion)?|sale|off\b|register|registration|enroll|class|workshop|camp|hiring|now hiring|job|opening|closed|closure|hours change|meeting|fundraiser|open house|new (?:product|drink|menu|offering)|now available)\b/i;
const EVENT_HEADING_RE=/(?:^|\b)(?:upcoming|community|public)\s+events?(?:\s+(?:calendar|schedule))?$|^events?(?:\s+(?:calendar|schedule))?$|^calendar$/i;

export function parseFallbackMetadata(notes){
  const text=String(notes||'');
  const entries=[...text.matchAll(/(?:^|\s)FIRST_PARTY_FALLBACK(?:_(\d+))?=(https?:\/\/\S+)/gi)]
    .map((match,index)=>({order:match[1]?Number(match[1]):0,index,url:String(match[2]||'').replace(/[),.;]+$/,'')}))
    .filter(item=>item.url)
    .sort((a,b)=>a.order-b.order||a.index-b.index);
  const urls=[...new Set(entries.map(item=>item.url))];
  const mode=(text.match(/(?:^|\s)FIRST_PARTY_MODE=([A-Z0-9_-]+)/i)||[])[1]||'';
  return {url:urls[0]||'',urls,mode:mode.toUpperCase()};
}

export function fallbackUrlCandidates(value){
  const raw=String(value||'').trim();
  if(!raw)return [];
  let primary;
  try{primary=new URL(raw);}catch{return [raw];}
  const out=[primary.toString()];
  const alternate=new URL(primary.toString());
  if(primary.hostname.startsWith('www.'))alternate.hostname=primary.hostname.slice(4);
  else alternate.hostname=`www.${primary.hostname}`;
  if(alternate.hostname!==primary.hostname)out.push(alternate.toString());
  return [...new Set(out)];
}

function localDateParts(now=new Date()){
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:TZ,weekday:'long',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
  const out={}; for(const p of parts)out[p.type]=p.value;
  return {weekday:out.weekday,date:`${out.year}-${out.month}-${out.day}`,year:Number(out.year)};
}

function localNoon(dateString){
  const [y,m,d]=dateString.split('-').map(Number);
  return new Date(Date.UTC(y,m-1,d,18,0,0));
}

function normalizeClockRange(value){
  return String(value||'').replace(/\b0(\d):(\d{2})\s*(AM|PM)\b/gi,'$1:$2 $3').replace(/\s*[–—]\s*/g,' - ').replace(/\s+-\s+/g,' - ').replace(/\s+/g,' ').trim();
}

function hash12(value){return createHash('sha256').update(String(value||'')).digest('hex').slice(0,12);}
function normalizeText(value){return String(value||'').replace(/\s+/g,' ').trim();}

export function extractWeekdaySpecial(raw,now=new Date()){
  const {weekday,date}=localDateParts(now);
  const lines=String(raw||'').split(/\r?\n/).map(v=>v.replace(/\s+/g,' ').trim()).filter(Boolean);
  let start=-1;
  for(let i=0;i<lines.length;i++){if(lines[i].toLowerCase()===weekday.toLowerCase()){start=i;break;}}
  if(start===-1)return null;
  let end=lines.length;
  for(let i=start+1;i<lines.length;i++){if(WEEKDAYS.some(day=>lines[i].toLowerCase()===day.toLowerCase())){end=i;break;}}
  const section=lines.slice(start+1,end).filter(line=>!/^specials?$/i.test(line));
  if(!section.length)return null;
  const timeIndex=section.findIndex(line=>/\b\d{1,2}:\d{2}\s*(?:AM|PM)\b.*\b\d{1,2}:\d{2}\s*(?:AM|PM)\b/i.test(line));
  const time=timeIndex>=0?normalizeClockRange(section[timeIndex]):'';
  const offerLines=section.filter((_,i)=>i!==timeIndex).filter(line=>!/^all specials$/i.test(line));
  let offer=offerLines.join(' ').replace(/^daily specials?!?\s*/i,'').replace(/^daily special:?\s*/i,'').trim();
  if(!offer||offer.length<12)return null;
  offer=offer.replace(/[.\s]+$/,'');
  return {date,postId:`${weekday.toUpperCase()}-SPECIAL-${date}`,postText:`${weekday} daily special: ${offer}.${time?` ${time}.`:''}`,activityType:'Deal / Special'};
}

function parseActivityDate(text,now=new Date()){
  const value=normalizeText(text);
  const {date:today,year}=localDateParts(now);
  if(/\btoday\b/i.test(value))return localNoon(today);
  if(/\btomorrow\b/i.test(value)){const d=localNoon(today);d.setUTCDate(d.getUTCDate()+1);return d;}
  let m=value.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
  if(m)return new Date(Date.UTC(Number(m[1]),Number(m[2])-1,Number(m[3]),18));
  m=value.match(/\b(\d{1,2})\/(\d{1,2})\/(20\d{2})\b/);
  if(m)return new Date(Date.UTC(Number(m[3]),Number(m[1])-1,Number(m[2]),18));
  const monthPattern=MONTHS.map(x=>x.slice(0,3)+'(?:'+x.slice(3)+')?').join('|');
  m=value.match(new RegExp(`\\b(${monthPattern})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(20\\d{2}))?\\b`,'i'));
  if(m){
    const month=MONTHS.findIndex(x=>x.toLowerCase().startsWith(m[1].slice(0,3).toLowerCase()));
    let y=Number(m[3]||year);
    let d=new Date(Date.UTC(y,month,Number(m[2]),18));
    if(!m[3]&&d<new Date(now.getTime()-30*86400000))d=new Date(Date.UTC(y+1,month,Number(m[2]),18));
    return d;
  }
  m=value.match(new RegExp(`\\bthrough\\s+(${monthPattern})\\.?\\s+(20\\d{2})\\b`,'i'));
  if(m){
    const month=MONTHS.findIndex(x=>x.toLowerCase().startsWith(m[1].slice(0,3).toLowerCase()));
    return new Date(Date.UTC(Number(m[2]),month+1,0,18));
  }
  return null;
}

function dateInWindow(date,now=new Date(),pastDays=2,futureDays=180){
  return date instanceof Date&&!Number.isNaN(date.getTime())&&date>=new Date(now.getTime()-pastDays*86400000)&&date<=new Date(now.getTime()+futureDays*86400000);
}

function inferActivityType(text){
  const t=String(text||'');
  if(/\b(hiring|now hiring|job|opening|position|careers?)\b/i.test(t))return 'Hiring';
  if(/\b(special|deal|discount|coupon|promo(?:tion)?|sale|% off|\$\d+.*off|half[- ]price)\b/i.test(t))return 'Deal / Special';
  if(/\b(closed|closure|hours change|weather closure)\b/i.test(t))return 'Operational Update';
  if(/\b(register|registration|enroll|class|workshop|camp)\b/i.test(t))return 'Event / Activity';
  if(/\b(new (?:product|drink|menu|offering)|now available)\b/i.test(t))return 'New Product / Offering';
  return 'Event / Activity';
}

function actionableSnippet(lines,index){
  const start=Math.max(0,index-2),end=Math.min(lines.length,index+3);
  return normalizeText(lines.slice(start,end).join(' ')).slice(0,1400);
}

function nearbyEventHeading_(lines,index,now){
  for(let i=index-1;i>=Math.max(0,index-5);i--){
    if(parseActivityDate(lines[i],now))break;
    if(EVENT_HEADING_RE.test(lines[i]))return true;
  }
  return false;
}

function datedLineSnippet_(lines,index,now){
  const line=lines[index],parts=[];
  const previous=lines[index-1]||'';
  const next=lines[index+1]||'';
  if(previous&&!EVENT_HEADING_RE.test(previous)&&!parseActivityDate(previous,now)&&!/^(contact|email|phone|learn more|details?)\b/i.test(previous))parts.push(previous);
  parts.push(line);
  if(next&&!EVENT_HEADING_RE.test(next)&&!parseActivityDate(next,now)&&ACTION_RE.test(next))parts.push(next);
  return normalizeText(parts.join(' ')).slice(0,1400);
}

export function extractDatedTextActivities(raw,now=new Date()){
  const {weekday,date:today}=localDateParts(now);
  const lines=String(raw||'').split(/\r?\n/).map(normalizeText).filter(v=>v.length>=3&&v.length<=500);
  const out=[],seen=new Set();
  for(let i=0;i<lines.length;i++){
    const line=lines[i];
    const lineDate=parseActivityDate(line,now);
    const sectionContext=lineDate&&nearbyEventHeading_(lines,i,now);
    const directLineActivity=ACTION_RE.test(line)||/\b(fish fry|blood drive|music bingo|bbq contest|barbecue contest|tractor pull)\b/i.test(line);
    let snippet='',date=null;

    if(lineDate&&(directLineActivity||sectionContext)){
      date=lineDate;
      snippet=datedLineSnippet_(lines,i,now);
    }else{
      const hiringLine=/\b(current openings?|open positions?)\b/i.test(line);
      if(!directLineActivity&&!hiringLine)continue;
      if(EVENT_HEADING_RE.test(line))continue;
      const nextDate=parseActivityDate(lines[i+1]||'',now);
      if(nextDate&&nearbyEventHeading_(lines,i,now))continue;
      snippet=actionableSnippet(lines,i);
      date=parseActivityDate(snippet,now);
    }

    if(!snippet)continue;
    if(!date&&new RegExp(`\\b${weekday}\\b`,'i').test(snippet)&&/\b(special|deal|discount|off|half[- ]price|\$\d)/i.test(snippet))date=localNoon(today);
    const hiring=/\b(hiring|now hiring|current openings?|open positions?|careers?)\b/i.test(snippet);
    if(!date&&!hiring)continue;
    if(date&&!dateInWindow(date,now))continue;
    if(!ACTION_RE.test(snippet)&&!hiring&&!sectionContext&&!/\b(fish fry|blood drive|music bingo|bbq contest|barbecue contest|tractor pull)\b/i.test(snippet))continue;
    const dateKey=date?localDateParts(date).date:today;
    const key=hash12(`${dateKey}|${snippet.toLowerCase()}`);
    if(seen.has(key))continue;seen.add(key);
    out.push({date:dateKey,postId:`FP-${dateKey.replace(/-/g,'')}-${key}`,postText:snippet,activityType:inferActivityType(snippet)});
    if(out.length>=5)break;
  }
  return out;
}

function flattenJsonLd(value,out=[]){
  if(Array.isArray(value)){for(const item of value)flattenJsonLd(item,out);return out;}
  if(value&&typeof value==='object'){
    out.push(value);
    if(Array.isArray(value['@graph']))for(const item of value['@graph'])flattenJsonLd(item,out);
  }
  return out;
}

export function extractJsonLdActivities(jsonTexts,now=new Date()){
  const out=[],seen=new Set();
  for(const raw of jsonTexts||[]){
    let parsed; try{parsed=JSON.parse(raw);}catch{continue;}
    for(const item of flattenJsonLd(parsed)){
      const types=[].concat(item['@type']||[]).map(v=>String(v).toLowerCase());
      let activityType='',dateValue='';
      if(types.includes('event')){activityType='Event / Activity';dateValue=item.startDate||item.endDate||'';}
      else if(types.includes('jobposting')){activityType='Hiring';dateValue=item.validThrough||item.datePosted||'';}
      else if(types.includes('offer')){activityType='Deal / Special';dateValue=item.priceValidUntil||item.validThrough||'';}
      else continue;
      const date=dateValue?new Date(dateValue):null;
      if(date&&Number.isNaN(date.getTime()))continue;
      if(date&&!dateInWindow(date,now,7,240))continue;
      if(!date&&activityType!=='Hiring')continue;
      const name=normalizeText(item.name||item.title||'');
      const description=normalizeText(item.description||'').slice(0,900);
      const text=normalizeText([name,description,dateValue?`Date: ${dateValue}`:''].filter(Boolean).join('. '));
      if(text.length<12)continue;
      const dateKey=date?localDateParts(date).date:localDateParts(now).date;
      const key=hash12(`${activityType}|${dateKey}|${text.toLowerCase()}`);if(seen.has(key))continue;seen.add(key);
      out.push({date:dateKey,postId:`FP-${dateKey.replace(/-/g,'')}-${key}`,postText:text,activityType});
      if(out.length>=5)return out;
    }
  }
  return out;
}

export function extractFallbackActivities(raw,mode,now=new Date(),jsonTexts=[]){
  const normalized=String(mode||'').toUpperCase();
  if(normalized==='WEEKDAY_SPECIALS'){const one=extractWeekdaySpecial(raw,now);return one?[one]:[];}
  if(!['AUTO_CURRENT','EVENTS_CURRENT','HIRING_CURRENT','PROMO_CURRENT'].includes(normalized))return [];
  const combined=[...extractJsonLdActivities(jsonTexts,now),...extractDatedTextActivities(raw,now)];
  const seen=new Set(),unique=[];
  for(const item of combined){
    if(normalized==='EVENTS_CURRENT'&&!/Event|Operational|Registration/i.test(item.activityType))continue;
    if(normalized==='HIRING_CURRENT'&&item.activityType!=='Hiring')continue;
    if(normalized==='PROMO_CURRENT'&&!/Deal|New Product/i.test(item.activityType))continue;
    const key=normalizeText(item.postText).toLowerCase();if(seen.has(key))continue;seen.add(key);unique.push(item);
    if(unique.length>=5)break;
  }
  return unique;
}

export function extractFallbackActivity(raw,mode,now=new Date(),jsonTexts=[]){
  return extractFallbackActivities(raw,mode,now,jsonTexts)[0]||null;
}

async function postJson(endpoint,ingestKey,action,payload={}){
  const response=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action,ingestKey,...payload}),redirect:'follow'});
  const text=await response.text();let parsed;try{parsed=JSON.parse(text);}catch{throw new Error(`Non-JSON response for ${action}: ${text.slice(0,160)}`);}
  if(!response.ok||!parsed.ok)throw new Error(`${action} failed: ${parsed.error||response.status}`);return parsed;
}

async function scanFirstParty(page,url,mode,now){
  await page.route('**/*',route=>{
    const type=route.request().resourceType();
    if(['image','media','font'].includes(type))return route.abort();
    return route.continue();
  }).catch(()=>{});
  let lastError=null;
  for(const candidate of fallbackUrlCandidates(url)){
    let navigationError=null;
    try{
      await page.goto(candidate,{waitUntil:'domcontentloaded',timeout:18000});
    }catch(error){
      navigationError=error;
      lastError=error;
    }
    await page.waitForTimeout(navigationError?800:1200);
    const body=await page.locator('body').innerText({timeout:8000}).catch(()=> '');
    const jsonTexts=await page.locator('script[type="application/ld+json"]').allTextContents().catch(()=>[]);
    if(normalizeText(body))return extractFallbackActivities(body,mode,now,jsonTexts);
  }
  if(lastError)throw lastError;
  return [];
}

export async function run(){
  const endpoint=process.env.LL_SOCIAL_ENDPOINT||DEFAULT_ENDPOINT;const ingestKey=process.env.LL_SOCIAL_INGEST_KEY||'';
  if(!ingestKey)throw new Error('LL_SOCIAL_INGEST_KEY is required.');
  const manifest=await postJson(endpoint,ingestKey,'social_worker_manifest');
  const configured=(manifest.workers||[]).map(worker=>({worker,meta:parseFallbackMetadata(worker.notes)})).filter(item=>item.meta.urls.length&&item.meta.mode);
  if(!configured.length){console.log('First-party fallback scan complete: configured=0; delivered=0; duplicates=0');return;}
  const {chromium}=await import('playwright');const browser=await chromium.launch({headless:true});const context=await browser.newContext({locale:'en-US',timezoneId:TZ,viewport:{width:1365,height:900}});
  let delivered=0,duplicates=0,failures=0;
  try{
    for(const {worker,meta} of configured){
      const now=new Date();
      const gathered=[],seen=new Set();
      let readableSources=0,sourceErrors=0;
      for(const sourceUrl of meta.urls){
        const page=await context.newPage();
        try{
          const activities=await scanFirstParty(page,sourceUrl,meta.mode,now);readableSources++;
          for(const activity of activities){
            const key=`${activity.date}|${activity.activityType}|${normalizeText(activity.postText).toLowerCase()}`;
            if(seen.has(key))continue;seen.add(key);gathered.push({activity,sourceUrl});
          }
        }catch(error){
          sourceErrors++;
          console.error(`${worker.organization}: FIRST-PARTY FALLBACK SOURCE ERROR; source=${sourceUrl}; ${String(error.message||error).replace(/\s+/g,' ').slice(0,180)}`);
        }finally{await page.close();}
      }
      if(!readableSources&&sourceErrors){failures++;continue;}
      if(!gathered.length){console.log(`${worker.organization}: FIRST-PARTY FALLBACK READABLE; no current configured activity extracted; mode=${meta.mode}; sources=${meta.urls.length}`);continue;}
      for(const {activity,sourceUrl} of gathered){
        const result=await postJson(endpoint,ingestKey,'social_intake',{queueId:worker.queueId,organization:worker.organization,platform:'WEBSITE',profileUrl:sourceUrl,postUrl:sourceUrl,postId:activity.postId,postDate:now.toISOString(),postText:activity.postText,mediaUrl:'',mediaType:'',activityType:activity.activityType,louisburgMatch:'VERIFIED'});
        delivered++;if(result.duplicate)duplicates++;
      }
      console.log(`${worker.organization}: FIRST-PARTY FALLBACK DELIVERED; mode=${meta.mode}; activities=${gathered.length}; sources=${meta.urls.length}`);
    }
  }finally{await context.close();await browser.close();}
  const sourceCount=configured.reduce((sum,item)=>sum+item.meta.urls.length,0);
  console.log(`First-party fallback scan complete: configured=${configured.length}; sources=${sourceCount}; delivered=${delivered}; duplicates=${duplicates}; failures=${failures}`);
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)run().catch(error=>{console.error(error);process.exitCode=1;});
