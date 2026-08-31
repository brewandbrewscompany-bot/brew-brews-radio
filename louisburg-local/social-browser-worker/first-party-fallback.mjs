import {pathToFileURL} from 'node:url';

const DEFAULT_ENDPOINT='https://script.google.com/macros/s/AKfycbxw9gJBH50L_VZbgp6i_mHHnfPXAkraIqv63BA2XqWtb-XaaczXxdf89WveFkAOwV-azw/exec';
const TZ='America/Chicago';
const WEEKDAYS=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

export function parseFallbackMetadata(notes){
  const text=String(notes||'');
  const url=(text.match(/(?:^|\s)FIRST_PARTY_FALLBACK=(https?:\/\/\S+)/i)||[])[1]||'';
  const mode=(text.match(/(?:^|\s)FIRST_PARTY_MODE=([A-Z0-9_-]+)/i)||[])[1]||'';
  return {url:url.replace(/[),.;]+$/,''),mode:mode.toUpperCase()};
}

function localDateParts(now=new Date()){
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:TZ,weekday:'long',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
  const out={};
  for(const p of parts)out[p.type]=p.value;
  return {weekday:out.weekday,date:`${out.year}-${out.month}-${out.day}`};
}

function normalizeClockRange(value){
  return String(value||'')
    .replace(/\b0(\d):(\d{2})\s*(AM|PM)\b/gi,'$1:$2 $3')
    .replace(/\s*[–—]\s*/g,' - ')
    .replace(/\s+-\s+/g,' - ')
    .replace(/\s+/g,' ')
    .trim();
}

export function extractWeekdaySpecial(raw,now=new Date()){
  const {weekday,date}=localDateParts(now);
  const lines=String(raw||'').split(/\r?\n/).map(v=>v.replace(/\s+/g,' ').trim()).filter(Boolean);
  let start=-1;
  for(let i=0;i<lines.length;i++){
    if(lines[i].toLowerCase()===weekday.toLowerCase()){start=i;break;}
  }
  if(start===-1)return null;
  let end=lines.length;
  for(let i=start+1;i<lines.length;i++){
    if(WEEKDAYS.some(day=>lines[i].toLowerCase()===day.toLowerCase())){end=i;break;}
  }
  const section=lines.slice(start+1,end).filter(line=>!/^specials?$/i.test(line));
  if(!section.length)return null;
  const timeIndex=section.findIndex(line=>/\b\d{1,2}:\d{2}\s*(?:AM|PM)\b.*\b\d{1,2}:\d{2}\s*(?:AM|PM)\b/i.test(line));
  const time=timeIndex>=0?normalizeClockRange(section[timeIndex]):'';
  const offerLines=section.filter((_,i)=>i!==timeIndex).filter(line=>!/^all specials$/i.test(line));
  let offer=offerLines.join(' ').replace(/^daily specials?!?\s*/i,'').replace(/^daily special:?\s*/i,'').trim();
  if(!offer||offer.length<12)return null;
  offer=offer.replace(/[.\s]+$/,'');
  const postText=`${weekday} daily special: ${offer}.${time?` ${time}.`:''}`;
  return {
    weekday,
    date,
    postId:`${weekday.toUpperCase()}-SPECIAL-${date}`,
    postText,
    activityType:'Deal / Special'
  };
}

export function extractFallbackActivity(raw,mode,now=new Date()){
  if(String(mode||'').toUpperCase()==='WEEKDAY_SPECIALS')return extractWeekdaySpecial(raw,now);
  return null;
}

async function postJson(endpoint,ingestKey,action,payload={}){
  const response=await fetch(endpoint,{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({action,ingestKey,...payload}),
    redirect:'follow'
  });
  const text=await response.text();
  let parsed;
  try{parsed=JSON.parse(text);}catch{throw new Error(`Non-JSON response for ${action}: ${text.slice(0,160)}`);}
  if(!response.ok||!parsed.ok)throw new Error(`${action} failed: ${parsed.error||response.status}`);
  return parsed;
}

async function scanFirstParty(page,url,mode,now){
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForTimeout(1800);
  const body=await page.locator('body').innerText({timeout:10000});
  return extractFallbackActivity(body,mode,now);
}

export async function run(){
  const endpoint=process.env.LL_SOCIAL_ENDPOINT||DEFAULT_ENDPOINT;
  const ingestKey=process.env.LL_SOCIAL_INGEST_KEY||'';
  if(!ingestKey)throw new Error('LL_SOCIAL_INGEST_KEY is required.');
  const manifest=await postJson(endpoint,ingestKey,'social_worker_manifest');
  const configured=(manifest.workers||[]).map(worker=>({worker,meta:parseFallbackMetadata(worker.notes)})).filter(item=>item.meta.url&&item.meta.mode);
  if(!configured.length){console.log('First-party fallback scan complete: configured=0; delivered=0; duplicates=0');return;}

  const {chromium}=await import('playwright');
  const browser=await chromium.launch({headless:true});
  const context=await browser.newContext({locale:'en-US',timezoneId:TZ,viewport:{width:1365,height:900}});
  let delivered=0,duplicates=0,failures=0;
  try{
    for(const {worker,meta} of configured){
      const page=await context.newPage();
      try{
        const now=new Date();
        const activity=await scanFirstParty(page,meta.url,meta.mode,now);
        if(!activity){
          console.log(`${worker.organization}: FIRST-PARTY FALLBACK READABLE; no current configured activity extracted`);
          continue;
        }
        const result=await postJson(endpoint,ingestKey,'social_intake',{
          queueId:worker.queueId,
          organization:worker.organization,
          platform:'WEBSITE',
          profileUrl:meta.url,
          postUrl:meta.url,
          postId:activity.postId,
          postDate:now.toISOString(),
          postText:activity.postText,
          mediaUrl:'',
          mediaType:'',
          activityType:activity.activityType,
          louisburgMatch:'VERIFIED'
        });
        delivered++;
        if(result.duplicate)duplicates++;
        console.log(`${worker.organization}: FIRST-PARTY FALLBACK DELIVERED; mode=${meta.mode}; duplicate=${!!result.duplicate}; source=${meta.url}`);
      }catch(error){
        failures++;
        console.error(`${worker.organization}: FIRST-PARTY FALLBACK ERROR: ${String(error.message||error).replace(/\s+/g,' ').slice(0,220)}`);
      }finally{
        await page.close();
      }
    }
  }finally{
    await context.close();
    await browser.close();
  }
  console.log(`First-party fallback scan complete: configured=${configured.length}; delivered=${delivered}; duplicates=${duplicates}; failures=${failures}`);
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  run().catch(error=>{console.error(error);process.exitCode=1;});
}
