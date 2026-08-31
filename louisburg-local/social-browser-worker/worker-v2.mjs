import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';

const DEFAULT_ENDPOINT='https://script.google.com/macros/s/AKfycbxw9gJBH50L_VZbgp6i_mHHnfPXAkraIqv63BA2XqWtb-XaaczXxdf89WveFkAOwV-azw/exec';
const TZ='America/Chicago';
const MAX_POST_AGE_DAYS=14;
const SYNTHETIC_MAX_AGE_DAYS=7;
const MOBILE_UA='Mozilla/5.0 (Linux; Android 17; Pixel 10 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36';

export function canonicalPostUrl(href){
  try{
    const url=new URL(String(href||''));
    if(!/(^|\.)facebook\.com$/i.test(url.hostname))return '';
    const path=url.pathname.replace(/\/$/,'');
    if(/\/posts\//i.test(path)||/\/(reel|videos)\//i.test(path))return 'https://www.facebook.com'+path;
    if(/\/(permalink|story|photo)\.php$/i.test(path)){
      const keep=new URLSearchParams();
      for(const key of ['story_fbid','fbid','id'])if(url.searchParams.get(key))keep.set(key,url.searchParams.get(key));
      return keep.toString()?`https://www.facebook.com${path}?${keep}`:'';
    }
    return '';
  }catch{return '';}
}

export function parseFacebookDateLabel(label,now=new Date()){
  const value=String(label||'').replace(/\s+/g,' ').trim();
  if(/^just now$/i.test(value))return new Date(now);
  let m=value.match(/^(\d+)\s*(m|min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days|w|wk|wks|week|weeks)$/i);
  if(m){
    const unit=m[2].toLowerCase();
    const ms=/^h|^hr|^hour/.test(unit)?3600000:/^d|^day/.test(unit)?86400000:/^w|^wk|^week/.test(unit)?604800000:60000;
    return new Date(now.getTime()-Number(m[1])*ms);
  }
  m=value.match(/^Yesterday(?: at (\d{1,2}):(\d{2})\s*([AP]M))?$/i);
  if(m){
    const d=new Date(now);d.setDate(d.getDate()-1);
    if(m[1]){let h=Number(m[1])%12;if(m[3].toUpperCase()==='PM')h+=12;d.setHours(h,Number(m[2]),0,0);}else d.setHours(12,0,0,0);
    return d;
  }
  m=value.match(/^([A-Za-z]+)\s+(\d{1,2})(?:\s+at\s+(\d{1,2}):(\d{2})\s*([AP]M))?$/i);
  if(m){
    const months=['january','february','march','april','may','june','july','august','september','october','november','december'];
    const month=months.indexOf(m[1].toLowerCase());
    if(month!==-1){let h=0,min=0;if(m[3]){h=Number(m[3])%12;if(m[5].toUpperCase()==='PM')h+=12;min=Number(m[4]);}let d=new Date(now.getFullYear(),month,Number(m[2]),h,min,0,0);if(d>new Date(now.getTime()+86400000))d=new Date(now.getFullYear()-1,month,Number(m[2]),h,min,0,0);return d;}
  }
  const parsed=new Date(value);return Number.isNaN(parsed.getTime())?null:parsed;
}

export function isPostFresh(date,now=new Date(),maxDays=MAX_POST_AGE_DAYS){
  return date instanceof Date&&!Number.isNaN(date.getTime())&&now-date>=-3600000&&now-date<=maxDays*86400000;
}

function localDay(date){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
  const get=t=>parts.find(p=>p.type===t)?.value||'';return `${get('year')}-${get('month')}-${get('day')}`;
}

export function findFacebookDateLabel(raw,now=new Date()){
  const lines=String(raw||'').split(/\r?\n/).map(v=>v.replace(/\s+/g,' ').trim()).filter(Boolean);
  const patterns=[/^just now$/i,/^\d+\s*(?:m|min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days|w|wk|wks|week|weeks)$/i,/^yesterday(?: at \d{1,2}:\d{2}\s*[ap]m)?$/i,/^(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:\s+at\s+\d{1,2}:\d{2}\s*[ap]m)?$/i];
  for(const line of lines){if(patterns.some(re=>re.test(line))&&isPostFresh(parseFacebookDateLabel(line,now),now))return line;}return '';
}

export function cleanPostText(raw,author,dateLabel){
  const lines=String(raw||'').split(/\r?\n/).map(v=>v.replace(/\s+/g,' ').trim()).filter(Boolean);
  let start=lines.findIndex(v=>v===dateLabel);if(start===-1)start=lines.findIndex(v=>v===author);start=start===-1?0:start+1;
  const out=[];for(const line of lines.slice(start)){if(/^(All reactions:|Like|Comment|Share|Write a comment|Most relevant|Send message|Follow|Log in|Sign Up)$/i.test(line))break;if(/^(·|Shared with Public|\d+|\d+ (?:share|shares|comment|comments))$/i.test(line))continue;if(line===author||line===dateLabel)continue;out.push(line);}return out.join('\n').trim();
}

export function shouldScanWorker(worker,now=new Date(),force=false){
  if(force||String(worker.scanMode||'').toUpperCase()!=='BROWSER_PUBLIC_PREVIEW')return true;
  const d=new Date(String(worker.lastScanAtIso||worker.lastScanAt||''));if(Number.isNaN(d.getTime()))return true;
  const interval=/DAILY/i.test(String(worker.scanFrequency||''))?20*3600000:45*60000;return now-d>=interval;
}

export function publicFacebookPageCandidates(profileUrl){
  const raw=String(profileUrl||'').trim();if(!raw)return [];
  try{
    const u=new URL(raw);if(!/(^|\.)facebook\.com$/i.test(u.hostname))return [raw];
    const id=String(u.searchParams.get('id')||'').trim();const path=u.pathname.replace(/\/+$/,'')||'/';const pathId=/^\/(\d+)$/.exec(path)?.[1]||'';
    const out=[];const add=v=>{if(v&&!out.includes(v))out.push(v);};
    const addId=v=>{add(`https://m.facebook.com/profile.php?id=${v}&sk=posts`);add(`https://www.facebook.com/profile.php?id=${v}&sk=posts`);add(`https://mbasic.facebook.com/profile.php?id=${v}&v=timeline`);};
    if(id){addId(encodeURIComponent(id));add(raw);return out;}
    for(const host of ['m.facebook.com','www.facebook.com','mbasic.facebook.com']){const base=`https://${host}${path}`;add(`${base}?sk=posts`);add(`${base}/posts`);add(base);}
    if(pathId)addId(pathId);add(raw);return out;
  }catch{return [raw];}
}

export function facebookOwnerKey(url){
  try{
    const u=new URL(String(url||''));
    if(!/(^|\.)facebook\.com$/i.test(u.hostname))return '';
    const id=String(u.searchParams.get('id')||'').trim();if(id)return `id:${id}`;
    const first=u.pathname.split('/').filter(Boolean)[0]||'';
    if(!first)return '';
    if(/^\d+$/.test(first))return `id:${first}`;
    if(/^(permalink\.php|story\.php|photo\.php|watch|reel|videos|profile\.php)$/i.test(first))return '';
    return `slug:${first.toLowerCase()}`;
  }catch{return '';}
}
export function facebookPostBelongsToProfile(postUrl,profileUrl){const a=facebookOwnerKey(postUrl),b=facebookOwnerKey(profileUrl);return !!a&&!!b&&a===b;}

function identityKey(v){return String(v||'').toLowerCase().replace(/\b(llc|inc|company|co|kansas|ks)\b/g,' ').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();}
function identityMatches(a,b){a=identityKey(a);b=identityKey(b);if(!a||!b)return true;return a===b||a.includes(b)||b.includes(a);}
function hash12(v){return createHash('sha256').update(String(v||'')).digest('hex').slice(0,12);}
function priorityRank(v){return {HIGH:3,MEDIUM:2,LOW:1}[String(v||'').toUpperCase()]||0;}

async function postJson(endpoint,ingestKey,action,payload={}){
  const r=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action,ingestKey,...payload}),redirect:'follow'});const text=await r.text();let parsed;try{parsed=JSON.parse(text);}catch{throw new Error(`Non-JSON response for ${action}: ${text.slice(0,160)}`);}if(!r.ok||!parsed.ok)throw new Error(`${action} failed: ${parsed.error||r.status}`);return parsed;
}

async function settlePage(page){
  await page.waitForTimeout(1800);
  for(const label of [/Not Now/i,/Allow all cookies/i,/Only allow essential cookies/i,/Close/i]){const b=page.getByRole('button',{name:label}).first();if(await b.count())await b.click({timeout:1200}).catch(()=>{});}
  for(let i=0;i<2;i++){await page.evaluate(()=>window.scrollBy(0,Math.max(700,window.innerHeight*.9))).catch(()=>{});await page.waitForTimeout(900);}
  await page.evaluate(()=>window.scrollTo(0,0)).catch(()=>{});await page.waitForTimeout(500);
}

async function getBodyText(page){return (await page.locator('body').innerText({timeout:8000}).catch(()=>'' )).replace(/\s+/g,' ').trim();}
async function collectPostLinks(page){const hrefs=await page.locator('a[href]').evaluateAll(nodes=>nodes.map(n=>n.href)).catch(()=>[]);return [...new Set(hrefs.map(canonicalPostUrl).filter(Boolean))];}
async function extractMedia(scope){const videos=await scope.locator('video').evaluateAll(nodes=>nodes.map(v=>v.currentSrc||v.src||v.poster||'').filter(Boolean)).catch(()=>[]);if(videos.length)return {mediaUrl:videos[0],mediaType:'VIDEO'};const imgs=await scope.locator('img').evaluateAll(nodes=>nodes.map(i=>({src:i.currentSrc||i.src||'',w:i.naturalWidth||i.width||0,h:i.naturalHeight||i.height||0})).filter(i=>/fbcdn\.net/i.test(i.src)&&i.w>=220&&i.h>=160).sort((a,b)=>b.w*b.h-a.w*a.h)).catch(()=>[]);return imgs.length?{mediaUrl:imgs[0].src,mediaType:'IMAGE'}:{mediaUrl:'',mediaType:''};}

async function extractVisiblePagePosts(page,worker,now,maxPosts){
  const scopes=page.locator('article,[role="article"],[data-pagelet*="FeedUnit"],div[data-ft]');const count=Math.min(await scopes.count().catch(()=>0),30);const posts=[],seen=new Set();
  for(let i=0;i<count&&posts.length<maxPosts;i++){
    const scope=scopes.nth(i);const raw=await scope.innerText({timeout:4000}).catch(()=>'' );if(raw.length<30)continue;
    const hrefs=await scope.locator('a[href]').evaluateAll(nodes=>nodes.map(n=>n.href)).catch(()=>[]);let exact='';for(const href of hrefs){exact=canonicalPostUrl(href);if(exact)break;}if(exact&&!facebookPostBelongsToProfile(exact,worker.profileUrl))continue;
    let dateLabel=findFacebookDateLabel(raw,now);if(!dateLabel){const attrs=await scope.locator('a').evaluateAll(nodes=>nodes.flatMap(n=>[n.getAttribute('aria-label'),n.getAttribute('title')]).filter(Boolean)).catch(()=>[]);for(const a of attrs){const candidate=findFacebookDateLabel(a,now)||String(a).trim();if(isPostFresh(parseFacebookDateLabel(candidate,now),now)){dateLabel=candidate;break;}}}
    const parsedDate=parseFacebookDateLabel(dateLabel,now);if(!isPostFresh(parsedDate,now))continue;
    const author=(await scope.locator('h2 a,h3 a,strong a').first().innerText({timeout:1800}).catch(()=>worker.organization)).trim()||worker.organization;if(!identityMatches(author,worker.organization))continue;
    const messages=[...new Set((await scope.locator('[data-ad-comet-preview="message"],[data-ad-preview="message"]').allTextContents().catch(()=>[])).map(v=>v.replace(/\s+/g,' ').trim()).filter(v=>v.length>10))];const postText=(messages.join('\n')||cleanPostText(raw,author,dateLabel)).trim();if(postText.length<20)continue;
    const key=hash12(`${worker.organization}|${localDay(parsedDate)}|${postText}`);if(seen.has(key))continue;seen.add(key);const media=await extractMedia(scope);
    let postUrl=exact,postId=exact?exact:'',sourceMode='PUBLIC_POST_PERMALINK';
    if(!exact){if(now-parsedDate>SYNTHETIC_MAX_AGE_DAYS*86400000)continue;const base=String(worker.profileUrl||'').replace(/#.*$/,'');postId=`VISIBLE-${localDay(parsedDate).replace(/-/g,'')}-${key}`;postUrl=`${base}#ll-visible-${key}`;sourceMode='PUBLIC_PAGE_VISIBLE_NO_PERMALINK';}
    posts.push({organization:worker.organization,platform:'FACEBOOK',profileUrl:worker.profileUrl,postUrl,postId,postDate:parsedDate.toISOString(),postText:postText.slice(0,5000),mediaUrl:media.mediaUrl,mediaType:media.mediaType,activityType:'',louisburgMatch:'VERIFIED',queueId:worker.queueId,pageIdentity:author,publicDateLabel:dateLabel,sourceMode});
  }
  return posts;
}

async function scanWorker(context,worker,settings){
  const page=await context.newPage();const now=new Date();let sawLogin=false,sawAgeGate=false,sawReadable=false,pageIdentity='';
  try{
    for(const candidate of publicFacebookPageCandidates(worker.profileUrl)){
      try{await page.goto(candidate,{waitUntil:'domcontentloaded',timeout:30000});await settlePage(page);}catch{continue;}
      const finalUrl=page.url();const body=await getBodyText(page);const identity=(await page.locator('h1').first().innerText({timeout:2500}).catch(()=>'' )).trim();if(identity&&!pageIdentity)pageIdentity=identity;
      if(/Log in to view this 18\+ content/i.test(body)){sawAgeGate=true;continue;}
      const visible=await extractVisiblePagePosts(page,worker,now,settings.maxPostsPerPage);if(visible.length)return {result:`PUBLIC PAGE POST CARDS VISIBLE; captured=${visible.length}; surface=${new URL(candidate).hostname}${pageIdentity?'; identity='+pageIdentity:''}`,posts:visible};
      const links=(await collectPostLinks(page)).slice(0,settings.maxPostsPerPage);if(links.length)return {result:`PUBLIC CONTENT LINKS VISIBLE; links=${links.length}; surface=${new URL(candidate).hostname}${pageIdentity?'; identity='+pageIdentity:''}`,posts:[]};
      if(/\/login\//i.test(finalUrl)||/^Log into Facebook/i.test(body)){sawLogin=true;continue;}if(body.length>80)sawReadable=true;
    }
    if(sawReadable)return {result:`PUBLIC PAGE READABLE AFTER MOBILE/DESKTOP FALLBACKS; NO USABLE CURRENT POST CARDS${pageIdentity?'; identity='+pageIdentity:''}`,posts:[]};
    if(sawAgeGate)return {result:'AGE-GATED - PUBLIC POSTS NOT EXPOSED AFTER MOBILE/DESKTOP FALLBACKS',posts:[]};
    if(sawLogin)return {result:'LOGIN ONLY - NO VISIBLE CURRENT POST CARDS AFTER MOBILE/DESKTOP FALLBACKS',posts:[]};
    return {result:'PUBLIC FACEBOOK PAGE UNAVAILABLE AFTER MOBILE/DESKTOP FALLBACKS',posts:[]};
  }finally{await page.close();}
}

export async function run(){
  const endpoint=process.env.LL_SOCIAL_ENDPOINT||DEFAULT_ENDPOINT;const ingestKey=process.env.LL_SOCIAL_INGEST_KEY||'';if(!ingestKey)throw new Error('LL_SOCIAL_INGEST_KEY is required.');
  const maxWorkers=Math.max(1,Number(process.env.LL_MAX_WORKERS||25));const maxPostsPerPage=Math.max(1,Number(process.env.LL_MAX_POSTS_PER_PAGE||8));const force=/^(1|true|yes)$/i.test(process.env.LL_FORCE_SCAN||'');
  const manifest=await postJson(endpoint,ingestKey,'social_worker_manifest');const now=new Date();const workers=(manifest.workers||[]).filter(w=>shouldScanWorker(w,now,force)).sort((a,b)=>priorityRank(b.priority)-priorityRank(a.priority)||a.organization.localeCompare(b.organization)).slice(0,maxWorkers);
  const {chromium}=await import('playwright');const browser=await chromium.launch({headless:true});const context=await browser.newContext({locale:'en-US',timezoneId:TZ,viewport:{width:412,height:915},screen:{width:412,height:915},isMobile:true,hasTouch:true,deviceScaleFactor:2.625,userAgent:MOBILE_UA});
  let captured=0,duplicates=0;
  try{for(const worker of workers){try{const scan=await scanWorker(context,worker,{maxPostsPerPage});let last=null,lastFingerprint='';for(const post of scan.posts){const intake=await postJson(endpoint,ingestKey,'social_intake',post);captured++;if(intake.duplicate)duplicates++;last=post;lastFingerprint=intake.fingerprint||lastFingerprint;}await postJson(endpoint,ingestKey,'social_worker_scan',{queueId:worker.queueId,result:scan.result+(scan.posts.length?`; delivered=${scan.posts.length}`:''),lastPostUrl:last?.postUrl||'',lastPostDate:last?.postDate||'',lastPostText:last?.postText||'',lastMediaUrl:last?.mediaUrl||'',activityFingerprint:lastFingerprint});console.log(`${worker.organization}: ${scan.result}`);}catch(error){const result=`BROWSER WORKER ERROR: ${String(error.message||error).replace(/\s+/g,' ').slice(0,220)}`;await postJson(endpoint,ingestKey,'social_worker_scan',{queueId:worker.queueId,result}).catch(()=>{});console.error(`${worker.organization}: ${result}`);}await new Promise(r=>setTimeout(r,800));}}
  finally{await context.close();await browser.close();}
  console.log(`Louisburg Local social scan complete: workers=${workers.length}; delivered=${captured}; duplicates=${duplicates}`);
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)run().catch(error=>{console.error(error);process.exitCode=1;});
