import {pathToFileURL} from 'node:url';
import {canonicalPostUrl,findFacebookDateLabel,isPostFresh,parseFacebookDateLabel} from './worker-v2.mjs';

const DEFAULT_ENDPOINT='https://script.google.com/macros/s/AKfycbxw9gJBH50L_VZbgp6i_mHHnfPXAkraIqv63BA2XqWtb-XaaczXxdf89WveFkAOwV-azw/exec';
const TZ='America/Chicago';
const MOBILE_UA='Mozilla/5.0 (Linux; Android 17; Pixel 10 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36';

export function parseExactRecoveryHints(notes){
  const text=String(notes||'');
  const altId=(text.match(/(?:^|\s)FACEBOOK_ALT_ID=(\d+)/i)||[])[1]||'';
  const raw=(text.match(/(?:^|\s)EXACT_POST_URL=(https?:\/\/\S+)/i)||[])[1]||'';
  const date=(text.match(/(?:^|\s)EXACT_POST_DATE=(20\d{2}-\d{2}-\d{2})/i)||[])[1]||'';
  return {altId,exactPostUrl:canonicalPostUrl(raw.replace(/[),.;]+$/,'')),date};
}

function ownerId(url){try{const u=new URL(String(url||''));const first=u.pathname.split('/').filter(Boolean)[0]||'';return /^\d+$/.test(first)?first:'';}catch{return '';}}
function normalize(value){return String(value||'').replace(/\s+/g,' ').trim();}
function dateHintToDate(date){return /^20\d{2}-\d{2}-\d{2}$/.test(date)?new Date(`${date}T12:00:00-05:00`):null;}

export function publicExactCandidates(url){
  const canonical=canonicalPostUrl(url);if(!canonical)return [];
  const u=new URL(canonical);const path=u.pathname;const out=[];
  for(const host of ['www.facebook.com','m.facebook.com','mbasic.facebook.com']){const v=`https://${host}${path}`;if(!out.includes(v))out.push(v);}
  return out;
}

async function postJson(endpoint,ingestKey,action,payload={}){
  const response=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action,ingestKey,...payload}),redirect:'follow'});
  const text=await response.text();let parsed;try{parsed=JSON.parse(text);}catch{throw new Error(`Non-JSON response for ${action}: ${text.slice(0,160)}`);}
  if(!response.ok||!parsed.ok)throw new Error(`${action} failed: ${parsed.error||response.status}`);return parsed;
}

async function settle(page){
  await page.waitForTimeout(1200);
  for(const label of [/Not Now/i,/Allow all cookies/i,/Only allow essential cookies/i,/Close/i]){const b=page.getByRole('button',{name:label}).first();if(await b.count())await b.click({timeout:900}).catch(()=>{});}
  await page.evaluate(()=>window.scrollBy(0,Math.max(500,window.innerHeight*.7))).catch(()=>{});await page.waitForTimeout(400);
}

async function explicitTimestamp(page,now){
  const values=await page.locator('time[datetime],abbr[data-utime]').evaluateAll(nodes=>nodes.flatMap(n=>[n.getAttribute('datetime'),n.getAttribute('data-utime')]).filter(Boolean)).catch(()=>[]);
  for(const value of values){const s=String(value);const d=/^\d{9,13}$/.test(s)?new Date(Number(s)*(s.length===10?1000:1)):new Date(s);if(isPostFresh(d,now))return d;}return null;
}

function cleanBodyText(raw,organization,dateLabel){
  const controls=/^(All reactions:|Like|Comment|Share|Write a comment|Most relevant|Send message|Follow|Log in|Sign Up|See more)$/i;
  return normalize(String(raw||'').split(/\r?\n/).map(normalize).filter(Boolean).filter(line=>!controls.test(line)&&line!==organization&&line!==dateLabel&&line!=='Shared with Public'&&line!=='·'&&!/^\d+\s*(?:comments?|shares?|reactions?)$/i.test(line)).join(' '));
}

async function extractMedia(scope,page){
  const videos=await scope.locator('video').evaluateAll(nodes=>nodes.map(v=>v.currentSrc||v.src||v.poster||'').filter(Boolean)).catch(()=>[]);if(videos.length)return {mediaUrl:videos[0],mediaType:'VIDEO'};
  const imgs=await scope.locator('img').evaluateAll(nodes=>nodes.map(i=>({src:i.currentSrc||i.src||'',w:i.naturalWidth||i.width||0,h:i.naturalHeight||i.height||0})).filter(i=>/fbcdn\.net/i.test(i.src)&&i.w>=220&&i.h>=160).sort((a,b)=>b.w*b.h-a.w*a.h)).catch(()=>[]);if(imgs.length)return {mediaUrl:imgs[0].src,mediaType:'IMAGE'};
  const ogImage=await page.locator('meta[property="og:image"]').first().getAttribute('content').catch(()=>null);return ogImage?{mediaUrl:ogImage,mediaType:'IMAGE'}:{mediaUrl:'',mediaType:''};
}

async function captureFromPage(page,worker,hints,now){
  const canonical=canonicalPostUrl(page.url())||hints.exactPostUrl;if(!canonical)return {skip:'exact URL did not remain a public Facebook content URL'};
  const numericOwner=ownerId(canonical);if(hints.altId&&numericOwner&&numericOwner!==hints.altId)return {skip:`numeric Page owner mismatch (${numericOwner})`};
  const scope=page.locator('article,[role="article"],main,[role="main"]').first();const contentScope=await scope.count()?scope:page.locator('body');
  const raw=await contentScope.innerText({timeout:7000}).catch(()=>'' );
  const ogDescription=normalize(await page.locator('meta[property="og:description"]').first().getAttribute('content').catch(()=>''));
  const ogTitle=normalize(await page.locator('meta[property="og:title"]').first().getAttribute('content').catch(()=>''));
  if(normalize(raw).length<30&&ogDescription.length<20)return {skip:'too little public post content'};
  let date=await explicitTimestamp(page,now),dateLabel='';
  if(!date){dateLabel=findFacebookDateLabel(raw,now);if(!dateLabel){const labels=await page.locator('a').evaluateAll(nodes=>nodes.flatMap(n=>[n.innerText,n.getAttribute('aria-label'),n.getAttribute('title')]).filter(Boolean)).catch(()=>[]);for(const label of labels){const found=findFacebookDateLabel(label,now);if(found){dateLabel=found;break;}}}date=parseFacebookDateLabel(dateLabel,now);}
  if(!isPostFresh(date,now)&&hints.date)date=dateHintToDate(hints.date);
  if(!isPostFresh(date,now))return {skip:`stale or unknown public date (${dateLabel||'none'})`};
  const messages=[...new Set((await contentScope.locator('[data-ad-comet-preview="message"],[data-ad-preview="message"]').allTextContents().catch(()=>[])).map(normalize).filter(v=>v.length>10))];
  let postText=normalize(messages.join(' ')||ogDescription||cleanBodyText(raw,worker.organization,dateLabel));
  if(postText.length<20&&ogTitle.length>=20)postText=ogTitle;
  if(postText.length<20)return {skip:'too little public post text'};
  const media=await extractMedia(contentScope,page);
  return {organization:worker.organization,platform:'FACEBOOK',profileUrl:worker.profileUrl,postUrl:hints.exactPostUrl,postId:hints.exactPostUrl,postDate:date.toISOString(),postText:postText.slice(0,5000),mediaUrl:media.mediaUrl,mediaType:media.mediaType,activityType:'',louisburgMatch:'VERIFIED',queueId:worker.queueId,sourceMode:'EXACT_PUBLIC_POST_RECOVERY'};
}

async function captureExact(context,worker,hints){
  const now=new Date(),reasons=[];
  for(const candidate of publicExactCandidates(hints.exactPostUrl)){
    const page=await context.newPage();
    try{await page.goto(candidate,{waitUntil:'domcontentloaded',timeout:25000});await settle(page);const result=await captureFromPage(page,worker,hints,now);if(!result.skip)return result;reasons.push(`${new URL(candidate).hostname}: ${result.skip}`);}catch(error){reasons.push(`${new URL(candidate).hostname}: ${String(error.message||error).replace(/\s+/g,' ').slice(0,100)}`);}finally{await page.close();}
  }
  return {skip:reasons.join(' | ').slice(0,420)||'all exact public surfaces failed'};
}

export async function run(){
  const endpoint=process.env.LL_SOCIAL_ENDPOINT||DEFAULT_ENDPOINT,ingestKey=process.env.LL_SOCIAL_INGEST_KEY||'';if(!ingestKey)throw new Error('LL_SOCIAL_INGEST_KEY is required.');
  const manifest=await postJson(endpoint,ingestKey,'social_worker_manifest');
  const targets=(manifest.workers||[]).map(worker=>({worker,hints:parseExactRecoveryHints(worker.notes)})).filter(x=>x.hints.exactPostUrl);
  if(!targets.length){console.log('Exact public post recovery: configured=0; delivered=0');return;}
  const {chromium}=await import('playwright');const browser=await chromium.launch({headless:true});const context=await browser.newContext({locale:'en-US',timezoneId:TZ,viewport:{width:412,height:915},screen:{width:412,height:915},isMobile:true,hasTouch:true,deviceScaleFactor:2.625,userAgent:MOBILE_UA});
  let delivered=0,duplicates=0;
  try{for(const {worker,hints} of targets){const post=await captureExact(context,worker,hints);if(post.skip){await postJson(endpoint,ingestKey,'social_worker_scan',{queueId:worker.queueId,result:`EXACT POST RECOVERY SKIPPED: ${post.skip}`}).catch(()=>{});console.log(`${worker.organization}: EXACT POST RECOVERY SKIPPED - ${post.skip}`);continue;}const intake=await postJson(endpoint,ingestKey,'social_intake',post);delivered++;if(intake.duplicate)duplicates++;await postJson(endpoint,ingestKey,'social_worker_scan',{queueId:worker.queueId,result:'EXACT PUBLIC POST RECOVERY DELIVERED',lastPostUrl:post.postUrl,lastPostDate:post.postDate,lastPostText:post.postText,lastMediaUrl:post.mediaUrl||'',activityFingerprint:intake.fingerprint||''}).catch(()=>{});console.log(`${worker.organization}: EXACT PUBLIC POST RECOVERY DELIVERED; duplicate=${!!intake.duplicate}; url=${post.postUrl}`);}}
  finally{await context.close();await browser.close();}
  console.log(`Exact public post recovery complete: configured=${targets.length}; delivered=${delivered}; duplicates=${duplicates}`);
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)run().catch(error=>{console.error(error);process.exitCode=1;});