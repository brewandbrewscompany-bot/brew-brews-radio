import {pathToFileURL} from 'node:url';
import {
  dataSjsBlocksFromHtml,
  relayDocumentsFromDataSjsBlocks,
} from './facebook-relay-recovery.mjs';
import {
  canonicalPostUrl,
  facebookOwnerKey,
  facebookPostBelongsToWorker,
  facebookWorkerIdentityUrls,
  publicFacebookPageCandidates,
  shouldScanWorker,
} from './worker-v2.mjs';

const DEFAULT_ENDPOINT='https://script.google.com/macros/s/AKfycbxw9gJBH50L_VZbgp6i_mHHnfPXAkraIqv63BA2XqWtb-XaaczXxdf89WveFkAOwV-azw/exec';
const TZ='America/Chicago';
const DESKTOP_UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
const LOOKBACK_DAYS=10;

// Deep, read-only recovery for signed-out public Facebook Relay data.
// This complements the normal timeline parser by walking alternate TimelineFeed
// response shapes that do not expose user.timeline_list_feed_units. It never
// logs in, uses account cookies/tokens, bypasses age gates, or guesses Page URLs.

function isObject(v){return !!v&&typeof v==='object'&&!Array.isArray(v);}
function normalize(v){return String(v||'').replace(/\s+/g,' ').trim();}
function priorityRank(v){return {HIGH:3,MEDIUM:2,LOW:1}[String(v||'').toUpperCase()]||0;}

function explicitNumericAliases(worker){
  const notes=String(worker?.notes||'');
  const ids=[];
  for(const re of [/(?:^|\s)FACEBOOK_ALT_ID=(\d+)/ig,/(?:^|\s)FACEBOOK_NUMERIC_ALIAS=(\d+)/ig]){
    let m;while((m=re.exec(notes)))if(!ids.includes(m[1]))ids.push(m[1]);
  }
  return ids;
}

function postBelongsToWorker(url,worker){
  if(facebookPostBelongsToWorker(url,worker))return true;
  const key=facebookOwnerKey(url);
  return explicitNumericAliases(worker).some(id=>key===`id:${id}`);
}

function profileUrlForVerifiedPost(postUrl,worker){
  try{
    const u=new URL(String(postUrl||''));
    if(!/(^|\.)facebook\.com$/i.test(u.hostname))return worker.profileUrl;
    const id=String(u.searchParams.get('id')||'').trim();
    if(id)return `https://www.facebook.com/${id}`;
    const first=u.pathname.split('/').filter(Boolean)[0]||'';
    if(first&&!/^(permalink\.php|story\.php|photo\.php|watch|reel|videos|profile\.php)$/i.test(first))return `https://www.facebook.com/${first}`;
  }catch{}
  return worker.profileUrl;
}

function findValueForKey(root,wanted,depth=0){
  if(depth>20||root==null)return undefined;
  if(isObject(root)){
    if(Object.prototype.hasOwnProperty.call(root,wanted))return root[wanted];
    for(const [key,value] of Object.entries(root)){
      if(/comments?|feedback|repl(?:y|ies)|likers?|reactors?/i.test(key))continue;
      const found=findValueForKey(value,wanted,depth+1);
      if(found!==undefined)return found;
    }
  }else if(Array.isArray(root)){
    for(const value of root){
      const found=findValueForKey(value,wanted,depth+1);
      if(found!==undefined)return found;
    }
  }
  return undefined;
}

function relayDate(value){
  if(value instanceof Date)return value;
  if(typeof value==='number'&&Number.isFinite(value))return new Date(value>1e12?value:value*1000);
  const raw=String(value||'').trim();
  if(/^\d{9,13}$/.test(raw)){
    const n=Number(raw);return new Date(n>1e12?n:n*1000);
  }
  const d=new Date(raw);return Number.isNaN(d.getTime())?null:d;
}

function storyCreationTime(story){return findValueForKey(story,'creation_time');}

function findMessageText(value,path=[],depth=0){
  if(depth>16||value==null)return '';
  const joined=path.join('.').toLowerCase();
  if(/comments?|feedback|repl(?:y|ies)/.test(joined))return '';
  if(isObject(value)){
    if(Object.prototype.hasOwnProperty.call(value,'message')){
      const msg=value.message;
      const text=normalize(typeof msg==='string'?msg:msg?.text);
      if(text)return text;
    }
    for(const [key,child] of Object.entries(value)){
      const found=findMessageText(child,[...path,key],depth+1);if(found)return found;
    }
  }else if(Array.isArray(value)){
    for(let i=0;i<value.length;i++){
      const found=findMessageText(value[i],[...path,String(i)],depth+1);if(found)return found;
    }
  }
  return '';
}

function firstNamedActor(list){
  if(!Array.isArray(list))return '';
  for(const actor of list){const name=normalize(actor?.name);if(name)return name;}
  return '';
}

function relayAuthor(story){return firstNamedActor(findValueForKey(story,'actors'));}
function identityKey(v){return normalize(v).toLowerCase().replace(/\b(llc|inc|company|co|kansas|ks|and)\b/g,' ').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();}
function identityMatches(a,b){a=identityKey(a);b=identityKey(b);if(!a||!b)return true;return a===b||a.includes(b)||b.includes(a);}

function collectCanonicalPostUrls(value,out,depth=0){
  if(depth>18||value==null)return;
  if(typeof value==='string'){
    const clean=value.replace(/\\u002F/gi,'/').replace(/\\\//g,'/').replace(/&amp;/g,'&');
    const canonical=canonicalPostUrl(clean);
    if(canonical&&!out.includes(canonical))out.push(canonical);
    return;
  }
  if(Array.isArray(value)){for(const child of value)collectCanonicalPostUrls(child,out,depth+1);return;}
  if(isObject(value)){
    for(const [key,child] of Object.entries(value)){
      if(/comments?|feedback|repl(?:y|ies)/i.test(key))continue;
      collectCanonicalPostUrls(child,out,depth+1);
    }
  }
}

function relayPostUrl(story,worker){
  const urls=[];collectCanonicalPostUrls(story,urls);
  return urls.find(url=>postBelongsToWorker(url,worker))||'';
}

function collectFbcdn(value,out,depth=0){
  if(depth>18||value==null)return;
  if(typeof value==='string'){
    const clean=value.replace(/\\u002F/gi,'/').replace(/\\\//g,'/').replace(/&amp;/g,'&');
    if(/https?:\/\/[^\s"']*fbcdn\.net\//i.test(clean)&&!out.includes(clean))out.push(clean);
    return;
  }
  if(Array.isArray(value)){for(const child of value)collectFbcdn(child,out,depth+1);return;}
  if(isObject(value))for(const child of Object.values(value))collectFbcdn(child,out,depth+1);
}

function relayMedia(story){
  const urls=[];collectFbcdn(story,urls);
  if(!urls.length)return {mediaUrl:'',mediaType:''};
  const serialized=JSON.stringify(story);
  return {mediaUrl:urls[0],mediaType:/Video|playable_url|video_inline|video_autoplay/i.test(serialized)?'VIDEO':'IMAGE'};
}

function storyPostId(story){return String(findValueForKey(story,'post_id')||findValueForKey(story,'legacy_story_hideable_id')||'').trim();}

function storyish(value){
  if(!isObject(value))return false;
  return Object.prototype.hasOwnProperty.call(value,'creation_time')||
    Object.prototype.hasOwnProperty.call(value,'post_id')||
    Object.prototype.hasOwnProperty.call(value,'legacy_story_hideable_id')||
    Object.prototype.hasOwnProperty.call(value,'permalink_url')||
    Object.prototype.hasOwnProperty.call(value,'comet_sections')||
    Object.prototype.hasOwnProperty.call(value,'message');
}

function collectStoryCandidates(value,out,path=[],depth=0){
  if(depth>18||value==null||out.length>=1200)return;
  const joined=path.join('.').toLowerCase();
  if(/comments?|feedback|repl(?:y|ies)|likers?|reactors?/.test(joined))return;
  if(isObject(value)){
    if(storyish(value))out.push(value);
    for(const [key,child] of Object.entries(value))collectStoryCandidates(child,out,[...path,key],depth+1);
  }else if(Array.isArray(value)){
    for(let i=0;i<value.length;i++)collectStoryCandidates(value[i],out,[...path,String(i)],depth+1);
  }
}

function withinLookback(date,now){
  if(!(date instanceof Date)||Number.isNaN(date.getTime()))return false;
  const age=(now.getTime()-date.getTime())/86400000;
  return age>=(-1/24)&&age<=LOOKBACK_DAYS;
}

function requiresLouisburgText(worker){return /require louisburg[- ]specific|louisburg-specific text|location-specific activity/i.test(String(worker?.notes||''));}

export function deepRelayPostsFromDocuments(docs,worker,now=new Date(),maxPosts=8){
  const posts=[],seen=new Set();
  for(const [op,doc] of docs.entries()){
    if(!/TimelineFeedQuery/i.test(op))continue;
    const candidates=[];collectStoryCandidates(doc,candidates);
    for(const story of candidates){
      const postUrl=relayPostUrl(story,worker);if(!postUrl||seen.has(postUrl))continue;
      const postDate=relayDate(storyCreationTime(story));if(!withinLookback(postDate,now))continue;
      const postText=findMessageText(story);if(postText.length<5)continue;
      const author=relayAuthor(story)||worker.organization;if(!identityMatches(author,worker.organization))continue;
      if(requiresLouisburgText(worker)&&!/\blouisburg\b|\b66053\b/i.test(postText))continue;
      seen.add(postUrl);
      const media=relayMedia(story);
      posts.push({organization:worker.organization,platform:'FACEBOOK',profileUrl:profileUrlForVerifiedPost(postUrl,worker),postUrl,postId:storyPostId(story)||postUrl,postDate:postDate.toISOString(),postText:postText.slice(0,5000),mediaUrl:media.mediaUrl,mediaType:media.mediaType,activityType:'',louisburgMatch:'VERIFIED',queueId:worker.queueId,pageIdentity:author,publicDateLabel:'Relay creation_time',sourceMode:'PUBLIC_RELAY_DEEP_10_DAY_LOOKBACK'});
    }
  }
  return posts.sort((a,b)=>new Date(b.postDate)-new Date(a.postDate)).slice(0,Math.max(1,maxPosts));
}

export function deepRelayPostsFromDataSjsBlocks(blocks,worker,now=new Date(),maxPosts=8){return deepRelayPostsFromDocuments(relayDocumentsFromDataSjsBlocks(blocks),worker,now,maxPosts);}

function relayPageCandidates(worker){
  const out=[];const add=value=>{if(value&&!out.includes(value))out.push(value);};
  const identities=[...facebookWorkerIdentityUrls(worker)];
  for(const id of explicitNumericAliases(worker))identities.push(`https://www.facebook.com/${id}`);
  for(const identity of identities){
    for(const raw of publicFacebookPageCandidates(identity)){
      try{const u=new URL(raw);if(!/(^|\.)facebook\.com$/i.test(u.hostname))continue;u.hostname='www.facebook.com';add(u.toString());}catch{}
    }
  }
  return out.slice(0,4);
}

async function scanWorker(context,worker,maxPosts){
  const page=await context.newPage();let maxBlocks=0,ops=[],lastSurface='';
  try{
    for(const candidate of relayPageCandidates(worker)){
      let response;try{response=await page.goto(candidate,{waitUntil:'domcontentloaded',timeout:30000});}catch{continue;}
      if(!response)continue;
      lastSurface=new URL(page.url()).hostname;
      let html='';try{html=await response.text();}catch{html=await page.content().catch(()=>'');}
      const blocks=dataSjsBlocksFromHtml(html);maxBlocks=Math.max(maxBlocks,blocks.length);
      const docs=relayDocumentsFromDataSjsBlocks(blocks);ops=[...new Set([...ops,...docs.keys()])];
      const posts=deepRelayPostsFromDocuments(docs,worker,new Date(),maxPosts);
      if(posts.length)return {posts,result:`PUBLIC RELAY DEEP 10-DAY LOOKBACK EXTRACTED; captured=${posts.length}; blocks=${blocks.length}; surface=${lastSurface}`};
    }
    return {posts:[],result:`PUBLIC RELAY DEEP LOOKBACK FOUND NO VERIFIED POSTS; blocks=${maxBlocks}; timeline=${ops.filter(v=>/TimelineFeedQuery/i.test(v)).join(',')||'none'}; surface=${lastSurface||'none'}`};
  }finally{await page.close();}
}

async function postJson(endpoint,ingestKey,action,payload={}){
  const r=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action,ingestKey,...payload}),redirect:'follow'});
  const text=await r.text();let parsed;try{parsed=JSON.parse(text);}catch{throw new Error(`Non-JSON response for ${action}: ${text.slice(0,160)}`);}
  if(!r.ok||!parsed.ok)throw new Error(`${action} failed: ${parsed.error||r.status}`);return parsed;
}

export async function run(){
  const endpoint=process.env.LL_SOCIAL_ENDPOINT||DEFAULT_ENDPOINT,ingestKey=process.env.LL_SOCIAL_INGEST_KEY||'';if(!ingestKey)throw new Error('LL_SOCIAL_INGEST_KEY is required.');
  const maxWorkers=Math.max(1,Number(process.env.LL_MAX_WORKERS||25)),maxPosts=Math.max(1,Number(process.env.LL_MAX_POSTS_PER_PAGE||8)),force=/^(1|true|yes)$/i.test(process.env.LL_FORCE_SCAN||'');
  const manifest=await postJson(endpoint,ingestKey,'social_worker_manifest'),now=new Date();
  const workers=(manifest.workers||[]).filter(w=>shouldScanWorker(w,now,force)).sort((a,b)=>priorityRank(b.priority)-priorityRank(a.priority)||a.organization.localeCompare(b.organization)).slice(0,maxWorkers);
  const {chromium}=await import('playwright');const browser=await chromium.launch({headless:true});const context=await browser.newContext({locale:'en-US',timezoneId:TZ,viewport:{width:1365,height:900},userAgent:DESKTOP_UA});
  let recoveredWorkers=0,delivered=0,duplicates=0;
  try{
    for(const worker of workers){
      try{
        const scan=await scanWorker(context,worker,maxPosts);
        if(!scan.posts.length){console.log(`${worker.organization}: ${scan.result}`);continue;}
        let last=null,lastFingerprint='';
        for(const post of scan.posts){const intake=await postJson(endpoint,ingestKey,'social_intake',post);delivered++;if(intake.duplicate)duplicates++;last=post;lastFingerprint=intake.fingerprint||lastFingerprint;}
        recoveredWorkers++;
        await postJson(endpoint,ingestKey,'social_worker_scan',{queueId:worker.queueId,result:`${scan.result}; delivered=${scan.posts.length}`,lastPostUrl:last?.postUrl||'',lastPostDate:last?.postDate||'',lastPostText:last?.postText||'',lastMediaUrl:last?.mediaUrl||'',activityFingerprint:lastFingerprint}).catch(()=>{});
        console.log(`${worker.organization}: ${scan.result}`);
      }catch(error){console.error(`${worker.organization}: RELAY DEEP LOOKBACK ERROR: ${String(error.message||error).replace(/\s+/g,' ').slice(0,220)}`);}
    }
  }finally{await context.close();await browser.close();}
  console.log(`Louisburg Local deep Relay 10-day lookback complete: workers=${workers.length}; recoveredWorkers=${recoveredWorkers}; delivered=${delivered}; duplicates=${duplicates}`);
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)run().catch(error=>{console.error(error);process.exitCode=1;});
