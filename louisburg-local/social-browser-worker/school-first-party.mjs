import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';

const DEFAULT_ENDPOINT='https://script.google.com/macros/s/AKfycbxw9gJBH50L_VZbgp6i_mHHnfPXAkraIqv63BA2XqWtb-XaaczXxdf89WveFkAOwV-azw/exec';
const TZ='America/Chicago';
const MONTHS='January February March April May June July August September October November December'.split(' ');
const SCHOOL_ACTION_RE=/\b(pto(?:\s+night)?|family night|community night|pep rally|open house|register|registration|enroll|enrollment|child find|sports physical|physical night|tryouts?|auditions?|fundraiser|food drive|blood drive|supply drive|volunteer|volunteers|meeting|concert|performance|games?|match|tournament|picture day|school(?:s)? closed|closed|closure|cancelled|canceled|postponed|rescheduled|delayed|schedule change|early dismissal|no school|sign up|signup|deadline|applications?|apply)\b/i;
const AGE_MARKER_RE=/^\d+\s+(?:minute|hour|day|week|month|year)s?\s+ago\b/i;

const SCHOOL_SOURCES=[
  {organization:'Rockville K-2 Elementary - USD 416',url:'https://www.usd416.org/o/rockville-elem/live-feed',kind:'LIVE_FEED'},
  {organization:'Broadmoor 3-5 Elementary - USD 416',url:'https://www.usd416.org/o/broadmoor-elem/live-feed/',kind:'LIVE_FEED'},
  {organization:'Louisburg High School - USD 416',url:'https://www.usd416.org/o/louisburg-high/live-feed',kind:'LIVE_FEED'},
  {organization:'Louisburg Middle School - USD 416',url:'https://www.usd416.org/o/louisburg-middle/live-feed',kind:'LIVE_FEED'},
  {organization:'Circle Grove Preschool - USD 416',url:'https://www.usd416.org/o/circle-grove-preschool/news',kind:'NEWS'},
  {organization:'Circle Grove Preschool - USD 416',url:'https://www.usd416.org/o/circle-grove-preschool/page/circle-grove-parent-information',kind:'ENROLLMENT'},
  {organization:'Louisburg High School - USD 416',url:'https://www.usd416.org/o/louisburg-high/news',kind:'NEWS'},
  {organization:'Louisburg Middle School - USD 416',url:'https://www.usd416.org/o/louisburg-middle/news',kind:'NEWS'},
  {organization:'Broadmoor 3-5 Elementary - USD 416',url:'https://www.usd416.org/o/broadmoor-elem/news',kind:'NEWS'},
  {organization:'Rockville K-2 Elementary - USD 416',url:'https://www.usd416.org/o/rockville-elem/news',kind:'NEWS'},
  {organization:'Louisburg USD 416',url:'https://www.usd416.org/live-feed',kind:'DISTRICT'}
];

function normalizeText(value){return String(value||'').replace(/\s+/g,' ').trim();}
function hash12(value){return createHash('sha256').update(String(value||'')).digest('hex').slice(0,12);}

function localDateParts(now=new Date()){
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
  const out={};for(const p of parts)out[p.type]=p.value;
  return {date:`${out.year}-${out.month}-${out.day}`,year:Number(out.year)};
}

function localNoon(dateString){
  const [y,m,d]=dateString.split('-').map(Number);
  return new Date(Date.UTC(y,m-1,d,18,0,0));
}

function relativeAgeAnchor(marker,now=new Date()){
  const m=String(marker||'').match(/^(\d+)\s+(minute|hour|day|week|month|year)s?\s+ago\b/i);
  if(!m)return null;
  const amount=Number(m[1]),unit=m[2].toLowerCase(),d=new Date(now);
  if(unit==='minute')d.setUTCMinutes(d.getUTCMinutes()-amount);
  else if(unit==='hour')d.setUTCHours(d.getUTCHours()-amount);
  else if(unit==='day')d.setUTCDate(d.getUTCDate()-amount);
  else if(unit==='week')d.setUTCDate(d.getUTCDate()-amount*7);
  else if(unit==='month')d.setUTCMonth(d.getUTCMonth()-amount);
  else if(unit==='year')d.setUTCFullYear(d.getUTCFullYear()-amount);
  return d;
}

function closestYearlessDate(month,day,anchor,defaultYear){
  const baseYear=anchor?localDateParts(anchor).year:defaultYear;
  const candidates=[baseYear-1,baseYear,baseYear+1].map(y=>new Date(Date.UTC(y,month,day,18)));
  if(anchor){
    candidates.sort((a,b)=>Math.abs(a-anchor)-Math.abs(b-anchor));
    return candidates[0];
  }
  let d=candidates[1];
  if(d<new Date(Date.now()-30*86400000))d=candidates[2];
  return d;
}

export function parseSchoolActivityDate(text,now=new Date(),ageMarker=''){
  const value=normalizeText(text);
  const {date:today,year}=localDateParts(now),ageAnchor=relativeAgeAnchor(ageMarker,now);
  if(/\btoday\b/i.test(value))return localNoon(today);
  if(/\btomorrow\b/i.test(value)){const d=localNoon(today);d.setUTCDate(d.getUTCDate()+1);return d;}
  let m=value.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
  if(m)return new Date(Date.UTC(Number(m[1]),Number(m[2])-1,Number(m[3]),18));
  m=value.match(/\b(\d{1,2})\/(\d{1,2})\/(20\d{2})\b/);
  if(m)return new Date(Date.UTC(Number(m[3]),Number(m[1])-1,Number(m[2]),18));
  m=value.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{2})\b/);
  if(m)return new Date(Date.UTC(2000+Number(m[3]),Number(m[1])-1,Number(m[2]),18));
  const monthPattern=MONTHS.map(x=>x.slice(0,3)+'(?:'+x.slice(3)+')?').join('|');
  m=value.match(new RegExp(`\\b(${monthPattern})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(20\\d{2}))?\\b`,'i'));
  if(m){
    const month=MONTHS.findIndex(x=>x.toLowerCase().startsWith(m[1].slice(0,3).toLowerCase()));
    if(m[3])return new Date(Date.UTC(Number(m[3]),month,Number(m[2]),18));
    if(ageAnchor)return closestYearlessDate(month,Number(m[2]),ageAnchor,year);
    let d=new Date(Date.UTC(year,month,Number(m[2]),18));
    if(d<new Date(now.getTime()-30*86400000))d=new Date(Date.UTC(year+1,month,Number(m[2]),18));
    return d;
  }
  return null;
}

function dateInWindow(date,now=new Date(),pastDays=2,futureDays=180){
  return date instanceof Date&&!Number.isNaN(date.getTime())&&date>=new Date(now.getTime()-pastDays*86400000)&&date<=new Date(now.getTime()+futureDays*86400000);
}

function inferActivityType(text){
  const t=String(text||'');
  if(/\b(school(?:s)? closed|closed|closure|cancelled|canceled|postponed|rescheduled|delayed|schedule change|early dismissal|no school)\b/i.test(t))return 'Operational Update';
  if(/\b(hiring|now hiring|job opening|position|careers?)\b/i.test(t))return 'Hiring';
  return 'Event / Activity';
}

function cleanSchoolLine(line){
  const value=normalizeText(line);
  if(!value)return '';
  if(/^image(?::|$)/i.test(value))return '';
  if(/^find us$/i.test(value)||/^schools$/i.test(value)||/^stay connected$/i.test(value))return '';
  if(/^copyright ©/i.test(value)||/^powered by apptegy/i.test(value))return '';
  return value;
}

function activitySegment(lines,index){
  let previous=-1,next=-1;
  for(let i=index-1;i>=0;i--){if(AGE_MARKER_RE.test(lines[i])){previous=i;break;}}
  for(let i=index+1;i<lines.length;i++){if(AGE_MARKER_RE.test(lines[i])){next=i;break;}}
  if(previous!==-1||next!==-1){
    const start=previous!==-1?previous+1:Math.max(0,index-2);
    const end=next!==-1?next:Math.min(lines.length,index+3);
    const text=normalizeText(lines.slice(start,end).filter(Boolean).join(' ')).slice(0,1400);
    const marker=next!==-1?lines[next]:(previous!==-1?lines[previous]:'');
    return {text,ageMarker:marker};
  }
  return {text:normalizeText(lines.slice(Math.max(0,index-2),Math.min(lines.length,index+3)).filter(Boolean).join(' ')).slice(0,1400),ageMarker:''};
}

export function extractSchoolActivities(raw,now=new Date()){
  const lines=String(raw||'').split(/\r?\n/).map(cleanSchoolLine).filter(v=>v.length>=3&&v.length<=600);
  const out=[],seen=new Set();
  for(let i=0;i<lines.length;i++){
    if(!SCHOOL_ACTION_RE.test(lines[i]))continue;
    const segment=activitySegment(lines,i),snippet=segment.text;
    const date=parseSchoolActivityDate(snippet,now,segment.ageMarker);
    if(!date||!dateInWindow(date,now))continue;
    if(!SCHOOL_ACTION_RE.test(snippet))continue;
    const dateKey=localDateParts(date).date;
    const normalized=snippet.toLowerCase().replace(/https?:\/\/\S+/g,' ').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
    const key=hash12(`${dateKey}|${normalized}`);
    if(seen.has(key))continue;
    seen.add(key);
    out.push({date:dateKey,postId:`SCHOOL-${dateKey.replace(/-/g,'')}-${key}`,postText:snippet,activityType:inferActivityType(snippet)});
    if(out.length>=6)break;
  }
  return out;
}

function similarityTokens(text){
  const stop=new Set('the a an and or to of in on at for from with is are was were be been this that our your you we it usd 416 louisburg school schools elementary middle high district k 2 3 5'.split(' '));
  return new Set(String(text||'').toLowerCase().replace(/https?:\/\/\S+/g,' ').replace(/[^a-z0-9]+/g,' ').split(/\s+/).filter(t=>t.length>2&&!stop.has(t)));
}

function jaccard(a,b){
  if(!a.size||!b.size)return 0;
  let common=0;for(const v of a)if(b.has(v))common++;
  return common/(a.size+b.size-common);
}

export function dedupeSchoolCandidates(candidates){
  const kept=[];
  for(const candidate of candidates||[]){
    const tokens=similarityTokens(candidate.activity.postText);
    const duplicate=kept.some(existing=>existing.activity.date===candidate.activity.date&&existing.activity.activityType===candidate.activity.activityType&&jaccard(tokens,similarityTokens(existing.activity.postText))>=0.64);
    if(!duplicate)kept.push(candidate);
  }
  return kept;
}

async function postJson(endpoint,ingestKey,action,payload={}){
  const response=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action,ingestKey,...payload}),redirect:'follow'});
  const text=await response.text();let parsed;try{parsed=JSON.parse(text);}catch{throw new Error(`Non-JSON response for ${action}: ${text.slice(0,160)}`);}
  if(!response.ok||!parsed.ok)throw new Error(`${action} failed: ${parsed.error||response.status}`);
  return parsed;
}

async function scanSource(page,source,now){
  let navigationError=null;
  try{await page.goto(source.url,{waitUntil:'domcontentloaded',timeout:25000});}catch(error){navigationError=error;}
  await page.waitForTimeout(navigationError?900:1800);
  const body=await page.locator('body').innerText({timeout:10000}).catch(()=> '');
  if(!normalizeText(body)){
    if(navigationError)throw navigationError;
    return [];
  }
  return extractSchoolActivities(body,now);
}

export async function run(){
  const endpoint=process.env.LL_SOCIAL_ENDPOINT||DEFAULT_ENDPOINT;
  const ingestKey=process.env.LL_SOCIAL_INGEST_KEY||'';
  if(!ingestKey)throw new Error('LL_SOCIAL_INGEST_KEY is required.');
  const {chromium}=await import('playwright');
  const browser=await chromium.launch({headless:true});
  const context=await browser.newContext({locale:'en-US',timezoneId:TZ,viewport:{width:1365,height:900}});
  const candidates=[];
  let readable=0,failures=0;
  try{
    for(const source of SCHOOL_SOURCES){
      const page=await context.newPage();
      try{
        const now=new Date();
        const activities=await scanSource(page,source,now);
        readable++;
        for(const activity of activities)candidates.push({source,activity,capturedAt:now});
        console.log(`${source.organization}: SCHOOL SOURCE READABLE; kind=${source.kind}; activities=${activities.length}; source=${source.url}`);
      }catch(error){
        failures++;
        console.error(`${source.organization}: SCHOOL SOURCE ERROR: ${String(error.message||error).replace(/\s+/g,' ').slice(0,220)}`);
      }finally{await page.close();}
    }
  }finally{await context.close();await browser.close();}

  const deliver=dedupeSchoolCandidates(candidates);
  let delivered=0,duplicates=0;
  for(const {source,activity,capturedAt} of deliver){
    const result=await postJson(endpoint,ingestKey,'social_intake',{
      queueId:`FIRSTPARTY-SCHOOL-${hash12(source.url)}`,
      organization:source.organization,
      platform:'WEBSITE',
      profileUrl:source.url,
      postUrl:source.url,
      postId:activity.postId,
      postDate:capturedAt.toISOString(),
      postText:activity.postText,
      mediaUrl:'',
      mediaType:'',
      activityType:activity.activityType,
      louisburgMatch:'VERIFIED'
    });
    delivered++;
    if(result.duplicate)duplicates++;
  }
  console.log(`USD 416 rendered source scan complete: configured=${SCHOOL_SOURCES.length}; readable=${readable}; extracted=${candidates.length}; after-cross-source-dedupe=${deliver.length}; delivered=${delivered}; duplicates=${duplicates}; failures=${failures}`);
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)run().catch(error=>{console.error(error);process.exitCode=1;});
