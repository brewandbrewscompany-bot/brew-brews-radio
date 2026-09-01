import {pathToFileURL} from 'node:url';
import {canonicalPostUrl,findFacebookDateLabel,isPostFresh,parseFacebookDateLabel} from './worker-v2.mjs';

const DEFAULT_ENDPOINT='https://script.google.com/macros/s/AKfycbxw9gJBH50L_VZbgp6i_mHHnfPXAkraIqv63BA2XqWtb-XaaczXxdf89WveFkAOwV-azw/exec';
const TZ='America/Chicago';
const MOBILE_UA='Mozilla/5.0 (Linux; Android 17; Pixel 10 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36';

export function parseExactRecoveryHints(notes){
  const text=String(notes||'');
  const altId=(text.match(/(?:^|\s)FACEBOOK_ALT_ID=(\d+)/i)||[])[1]||'';
  const raw=(text.match(/(?:^|\s)EXACT_POST_URL=(https?:\/\/\S+)/i)||[])[1]||'';
  const exactPostUrl=canonicalPostUrl(raw.replace(/[),.;]+$/,''));
  return {altId,exactPostUrl};
}

function ownerId(url){
  try{
    const u=new URL(String(url||''));
    const first=u.pathname.split('/').filter(Boolean)[0]||'';
    return /^\d+$/.test(first)?first:'';
  }catch{return '';}
}

function normalize(value){return String(value||'').replace(/\s+/g,' ').trim();}

async function postJson(endpoint,ingestKey,action,payload={}){
  const response=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action,ingestKey,...payload}),redirect:'follow'});
  const text=await response.text();let parsed;try{parsed=JSON.parse(text);}catch{throw new Error(`Non-JSON response for ${action}: ${text.slice(0,160)}`);}
  if(!response.ok||!parsed.ok)throw new Error(`${action} failed: ${parsed.error||response.status}`);return parsed;
}

async function settle(page){
  await page.waitForTimeout(1500);
  for(const label of [/Not Now/i,/Allow all cookies/i,/Only allow essential cookies/i,/Close/i]){
    const b=page.getByRole('button',{name:label}).first();if(await b.count())await b.click({timeout:900}).catch(()=>{});
  }
  await page.evaluate(()=>window.scrollBy(0,Math.max(500,window.innerHeight*.7))).catch(()=>{});await page.waitForTimeout(500);
}

async function explicitTimestamp(page,now){
  const values=await page.locator('time[datetime],abbr[data-utime]').evaluateAll(nodes=>nodes.flatMap(n=>[n.getAttribute('datetime'),n.getAttribute('data-utime')]).filter(Boolean)).catch(()=>[]);
  for(const value of values){
    let d=/^\d{9,13}$/.test(String(value))?new Date(Number(value)*(String(value).length===10?1000:1)):new Date(value);
    if(isPostFresh(d,now))return d;
  }
  return null;
}

function cleanBodyText(raw,organization,dateLabel){
  const lines=String(raw||'').split(/\r?\n/).map(normalize).filter(Boolean);
  const controls=/^(All reactions:|Like|Comment|Share|Write a comment|Most relevant|Send message|Follow|Log in|Sign Up|See more)$/i;
  const out=[];
  for(const line of lines){
    if(controls.test(line))continue;
    if(line===organization||line===dateLabel||line==='Shared with Public'||line==='·')continue;
    if(/^\d+\s*(?:comments?|shares?|reactions?)$/i.test(line))continue;
    out.push(line);
  }
  return normalize(out.join(' '));
}

async function extractMedia(scope){
  const videos=await scope.locator('video').evaluateAll(nodes=>nodes.map(v=>v.currentSrc||v.src||v.poster||'').filter(Boolean)).catch(()=>[]);
  if(videos.length)return {mediaUrl:videos[0],mediaType:'VIDEO'};
  const imgs=await scope.locator('img').evaluateAll(nodes=>nodes.map(i=>({src:i.currentSrc||i.src||'',w:i.naturalWidth||i.width||0,h:i.naturalHeight||i.height||0})).filter(i=>/fbcdn\.net/i.test(i.src)&&i.w>=220&&i.h>=160).sort((a,b)=>b.w*b.h-a.w*a.h)).catch(()=>[]);
  return imgs.length?{mediaUrl:imgs[0].src,mediaType:'IMAGE'}:{mediaUrl:'',mediaType:''};
}

async function captureExact(context,worker,hints){
  const page=await context.newPage();const now=new Date();
  try{
    await page.goto(hints.exactPostUrl,{waitUntil:'domcontentloaded',timeout:30000});await settle(page);
    const canonical=canonicalPostUrl(page.url())||hints.exactPostUrl;
    if(!canonical)return {skip:'exact URL did not remain a public Facebook content URL'};
    const numericOwner=ownerId(canonical);
    if(hints.altId&&numericOwner&&numericOwner!==hints.altId)return {skip:`numeric Page owner mismatch (${numericOwner})`};
    const scope=page.locator('article,[role="article"],main,[role="main"]').first();
    const contentScope=await scope.count()?scope:page.locator('body');
    const raw=await contentScope.innerText({timeout:9000}).catch(()=>'' );
    if(normalize(raw).length<30)return {skip:'too little public post content'};
    let date=await explicitTimestamp(page,now);let dateLabel='';
    if(!date){
      dateLabel=findFacebookDateLabel(raw,now);
      if(!dateLabel){
        const labels=await page.locator('a').evaluateAll(nodes=>nodes.flatMap(n=>[n.innerText,n.getAttribute('aria-label'),n.getAttribute('title')]).filter(Boolean)).catch(()=>[]);
        for(const label of labels){const found=findFacebookDateLabel(label,now);if(found){dateLabel=found;break;}}
      }
      date=parseFacebookDateLabel(dateLabel,now);
    }
    if(!isPostFresh(date,now))return {skip:`stale or unknown public date (${dateLabel||'none'})`};
    const messages=[...new Set((await contentScope.locator('[data-ad-comet-preview="message"],[data-ad-preview="message"]').allTextContents().catch(()=>[])).map(normalize).filter(v=>v.length>10))];
    const postText=normalize(messages.join(' ')||cleanBodyText(raw,worker.organization,dateLabel));
    if(postText.length<20)return {skip:'too little public post text'};
    const media=await extractMedia(contentScope);
    return {organization:worker.organization,platform:'FACEBOOK',profileUrl:worker.profileUrl,postUrl:canonical,postId:canonical,postDate:date.toISOString(),postText:postText.slice(0,5000),mediaUrl:media.mediaUrl,mediaType:media.mediaType,activityType:'',louisburgMatch:'VERIFIED',queueId:worker.queueId,sourceMode:'EXACT_PUBLIC_POST_RECOVERY'};
  }catch(error){return {skip:`exact recovery open failed: ${String(error.message||error).replace(/\s+/g,' ').slice(0,140)}`};}
  finally{await page.close();}
}

export async function run(){
  const endpoint=process.env.LL_SOCIAL_ENDPOINT||DEFAULT_ENDPOINT;const ingestKey=process.env.LL_SOCIAL_INGEST_KEY||'';
  if(!ingestKey)throw new Error('LL_SOCIAL_INGEST_KEY is required.');
  const manifest=await postJson(endpoint,ingestKey,'social_worker_manifest');
  const targets=(manifest.workers||[]).map(worker=>({worker,hints:parseExactRecoveryHints(worker.notes)})).filter(x=>x.hints.exactPostUrl);
  if(!targets.length){console.log('Exact public post recovery: configured=0; delivered=0');return;}
  const {chromium}=await import('playwright');const browser=await chromium.launch({headless:true});
  const context=await browser.newContext({locale:'en-US',timezoneId:TZ,viewport:{width:412,height:915},screen:{width:412,height:915},isMobile:true,hasTouch:true,deviceScaleFactor:2.625,userAgent:MOBILE_UA});
  let delivered=0,duplicates=0;
  try{
    for(const {worker,hints} of targets){
      const post=await captureExact(context,worker,hints);
      if(post.skip){console.log(`${worker.organization}: EXACT POST RECOVERY SKIPPED - ${post.skip}`);continue;}
      const intake=await postJson(endpoint,ingestKey,'social_intake',post);delivered++;if(intake.duplicate)duplicates++;
      await postJson(endpoint,ingestKey,'social_worker_scan',{queueId:worker.queueId,result:'EXACT PUBLIC POST RECOVERY DELIVERED',lastPostUrl:post.postUrl,lastPostDate:post.postDate,lastPostText:post.postText,lastMediaUrl:post.mediaUrl||'',activityFingerprint:intake.fingerprint||''}).catch(()=>{});
      console.log(`${worker.organization}: EXACT PUBLIC POST RECOVERY DELIVERED; duplicate=${!!intake.duplicate}; url=${post.postUrl}`);
    }
  }finally{await context.close();await browser.close();}
  console.log(`Exact public post recovery complete: configured=${targets.length}; delivered=${delivered}; duplicates=${duplicates}`);
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)run().catch(error=>{console.error(error);process.exitCode=1;});