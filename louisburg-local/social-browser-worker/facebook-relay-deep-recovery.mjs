import {pathToFileURL} from 'node:url';
import {
  canonicalPostUrl,
  facebookOwnerKey,
  facebookPostBelongsToWorker,
  facebookWorkerIdentityUrls,
  isPostFresh,
  publicFacebookPageCandidates,
  shouldScanWorker,
} from './worker-v2.mjs';
import {dataSjsBlocksFromHtml,relayDocumentsFromDataSjsBlocks} from './facebook-relay-recovery.mjs';

const DEFAULT_ENDPOINT='https://script.google.com/macros/s/AKfycbxw9gJBH50L_VZbgp6i_mHHnfPXAkraIqv63BA2XqWtb-XaaczXxdf89WveFkAOwV-azw/exec';
const TZ='America/Chicago';
const DESKTOP_UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

// Second-pass signed-out Relay recovery. The normal Relay parser intentionally
// targets Facebook's known timeline_list_feed_units shape. Some public Pages
// expose TimelineFeedQuery data in a different nested wrapper. This pass walks
// only the already-public data-sjs Relay documents and looks for story-shaped
// objects without assuming one feed-container layout. It never logs in, uses an
// account cookie/token, bypasses an age gate, or replays a private GraphQL call.

function isObject(v){return !!v&&typeof v==='object'&&!Array.isArray(v);}
function normalize(v){return String(v||'').replace(/\s+/g,' ').trim();}
function priorityRank(v){return {HIGH:3,MEDIUM:2,LOW:1}[String(v||'').toUpperCase()]||0;}

function explicitNumericAliases(worker){
  const notes=String(worker?.notes||''),ids=[];
  for(const re of [/(?:^|\s)FACEBOOK_ALT_ID=(\d+)/ig,/(?:^|\s)FACEBOOK_NUMERIC_ALIAS=(\d+)/ig]){
    let m;while((m=re.exec(notes)))if(!ids.includes(m[1]))ids.push(m[1]);
  }
  return ids;
}

function belongsToWorker(url,worker){
  if(facebookPostBelongsToWorker(url,worker))return true;
  const key=facebookOwnerKey(url);
  return explicitNumericAliases(worker).some(id=>key===`id:${id}`);
}

function profileUrlForPost(postUrl,worker){
  try{
    const u=new URL(String(postUrl||''));
    const id=String(u.searchParams.get('id')||'').trim();
    if(id)return `https://www.facebook.com/${id}`;
    const first=u.pathname.split('/').filter(Boolean)[0]||'';
    if(first&&!/^(permalink\.php|story\.php|photo\.php|watch|reel|videos|profile\.php)$/i.test(first))return `https://www.facebook.com/${first}`;
  }catch{}
  return worker.profileUrl;
}

function relayDate(value){
  if(value instanceof Date)return value;
  if(typeof value==='number'&&Number.isFinite(value))return new Date(value>1e12?value:value*1000);
  const raw=String(value||'').trim();
  if(/^\d{9,13}$/.test(raw)){const n=Number(raw);return new Date(n>1e12?n:n*1000);}
  const d=new Date(raw);return Number.isNaN(d.getTime())?null:d;
}

function findValuesForKey(value,wanted,out=[],depth=0){
  if(depth>20||value==null)return out;
  if(isObject(value)){
    if(Object.prototype.hasOwnProperty.call(value,wanted))out.push(value[wanted]);
    for(const child of Object.values(value))findValuesForKey(child,wanted,out,depth+1);
  }else if(Array.isArray(value))for(const child of value)findValuesForKey(child,wanted,out,depth+1);
  return out;
}

function collectUrls(value,out=[],depth=0){
  if(depth>18||value==null)return out;
  if(typeof value==='string'){
    const clean=value.replace(/\\u002F/gi,'/').replace(/\\\//g,'/').replace(/&amp;/g,'&');
    const direct=canonicalPostUrl(clean);
    if(direct&&!out.includes(direct))out.push(direct);
    const matches=clean.match(/https?:\/\/(?:[a-z0-9-]+\.)?facebook\.com\/[^\s"'<>]+/gi)||[];
    for(const raw of matches){const canonical=canonicalPostUrl(raw);if(canonical&&!out.includes(canonical))out.push(canonical);}
    return out;
  }
  if(Array.isArray(value)){for(const child of value)collectUrls(child,out,depth+1);return out;}
  if(isObject(value))for(const child of Object.values(value))collectUrls(child,out,depth+1);
  return out;
}

function messageText(value,depth=0,path=''){
  if(depth>16||value==null)return '';
  if(/comments?|feedback|replies/i.test(path))return '';
  if(isObject(value)){
    for(const key of ['message','text']){
      if(!Object.prototype.hasOwnProperty.call(value,key))continue;
      const raw=value[key],text=normalize(typeof raw==='string'?raw:raw?.text);
      if(text.length>=5)return text;
    }
    for(const [key,child] of Object.entries(value)){
      const found=messageText(child,depth+1,path+'.'+key);if(found)return found;
    }
  }else if(Array.isArray(value)){
    for(let i=0;i<value.length;i++){const found=messageText(value[i],depth+1,path+'.'+i);if(found)return found;}
  }
  return '';
}

function actorName(value){
  const actorLists=findValuesForKey(value,'actors');
  for(const list of actorLists){
    if(!Array.isArray(list))continue;
    for(const actor of list){const name=normalize(actor?.name);if(name)return name;}
  }
  return '';
}

function identityKey(v){return normalize(v).toLowerCase().replace(/\b(llc|inc|company|co|kansas|ks|and)\b/g,' ').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();}
function identityMatches(a,b){a=identityKey(a);b=identityKey(b);return !a||!b||a===b||a.includes(b)||b.includes(a);}

function mediaFrom(value){
  const urls=[];
  const walk=(v,depth=0)=>{
    if(depth>18||v==null)return;
    if(typeof v==='string'){
      const clean=v.replace(/\\u002F/gi,'/').replace(/\\\//g,'/').replace(/&amp;/g,'&');
      if(/https?:\/\/[^\s"']*fbcdn\.net\//i.test(clean)&&!urls.includes(clean))urls.push(clean);
      return;
    }
    if(Array.isArray(v)){for(const child of v)walk(child,depth+1);return;}
    if(isObject(v))for(const child of Object.values(v))walk(child,depth+1);
  };
  walk(value);
  if(!urls.length)return {mediaUrl:'',mediaType:''};
  return {mediaUrl:urls[0],mediaType:/Video|playable_url|video_inline|video_autoplay/i.test(JSON.stringify(value))?'VIDEO':'IMAGE'};
}

function looksStoryShaped(value){
  if(!isObject(value))return false;
  const keys=Object.keys(value);
  return keys.some(k=>/creation_time|post_id|legacy_story_hideable_id|permalink_url/i.test(k))&&keys.some(k=>/message|comet_sections|attachments|url|story/i.test(k));
}

function collectStoryObjects(value,out=[],seen=new Set(),depth=0){
  if(depth>20||value==null)return out;
  if(isObject(value)){
    if(looksStoryShaped(value)&&!seen.has(value)){seen.add(value);out.push(value);}
    for(const child of Object.values(value))collectStoryObjects(child,out,seen,depth+1);
  }else if(Array.isArray(value))for(const child of value)collectStoryObjects(child,out,seen,depth+1);
  return out;
}

function firstFreshDate(story,now){
  for(const raw of findValuesForKey(story,'creation_time')){const d=relayDate(raw);if(isPostFresh(d,now))return d;}
  for(const key of ['publish_time','publish_time_text','creation_timestamp']){
    for(const raw of findValuesForKey(story,key)){const d=relayDate(raw);if(isPostFresh(d,now))return d;}
  }
  return null;
}

export function deepRelayPostsFromDataSjsBlocks(blockTexts,worker,now=new Date(),maxPosts=8){
  const docs=relayDocumentsFromDataSjsBlocks(blockTexts),posts=[],seen=new Set();
  for(const [op,doc] of docs){
    if(!/TimelineFeedQuery/i.test(op))continue;
    for(const story of collectStoryObjects(doc)){
      const urls=collectUrls(story).filter(url=>belongsToWorker(url,worker));
      const postUrl=urls[0]||'';
      const postDate=firstFreshDate(story,now);
      const postText=messageText(story);
      const author=actorName(story)||worker.organization;
      if(!postUrl||!postDate||postText.length<5||!identityMatches(author,worker.organization))continue;
      if(seen.has(postUrl))continue;seen.add(postUrl);
      const media=mediaFrom(story);
      const postId=normalize(findValuesForKey(story,'post_id')[0]||findValuesForKey(story,'legacy_story_hideable_id')[0]||postUrl);
      posts.push({organization:worker.organization,platform:'FACEBOOK',profileUrl:profileUrlForPost(postUrl,worker),postUrl,postId,postDate:postDate.toISOString(),postText:postText.slice(0,5000),mediaUrl:media.mediaUrl,mediaType:media.mediaType,activityType:'',louisburgMatch:'VERIFIED',queueId:worker.queueId,pageIdentity:author,publicDateLabel:'Relay deep creation_time',sourceMode:'PUBLIC_RELAY_DEEP_DATA_SJS'});
    }
  }
  return posts.sort((a,b)=>new Date(b.postDate)-new Date(a.postDate)).slice(0,Math.max(1,maxPosts));
}

export function deepRelayDiagnostics(blockTexts,worker,now=new Date()){
  const docs=relayDocumentsFromDataSjsBlocks(blockTexts);
  let timelineDocs=0,storyObjects=0,ownedUrls=0,freshDates=0,texts=0;
  for(const [op,doc] of docs){
    if(!/TimelineFeedQuery/i.test(op))continue;timelineDocs++;
    const stories=collectStoryObjects(doc);storyObjects+=stories.length;
    for(const story of stories){if(collectUrls(story).some(url=>belongsToWorker(url,worker)))ownedUrls++;if(firstFreshDate(story,now))freshDates++;if(messageText(story).length>=5)texts++;}
  }
  return {timelineDocs,storyObjects,ownedUrls,freshDates,texts};
}

function pageCandidates(worker){
  const out=[],add=v=>{if(v&&!out.includes(v))out.push(v);};
  for(const id of explicitNumericAliases(worker))add(`https://www.facebook.com/${id}`);
  for(const identity of facebookWorkerIdentityUrls(worker)){
    for(const raw of publicFacebookPageCandidates(identity)){
      try{const u=new URL(raw);if(!/(^|\.)facebook\.com$/i.test(u.hostname))continue;u.hostname='www.facebook.com';add(u.toString());}catch{}
    }
  }
  return out.slice(0,4);
}

async function postJson(endpoint,ingestKey,action,payload={}){
  const response=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action,ingestKey,...payload}),redirect:'follow'});
  const text=await response.text();let parsed;try{parsed=JSON.parse(text);}catch{throw new Error(`Non-JSON response for ${action}: ${text.slice(0,160)}`);}
  if(!response.ok||!parsed.ok)throw new Error(`${action} failed: ${parsed.error||response.status}`);return parsed;
}

async function scanWorker(context,worker,maxPosts){
  const page=await context.newPage();let best={timelineDocs:0,storyObjects:0,ownedUrls:0,freshDates:0,texts:0},maxBlocks=0,lastSurface='';
  try{
    for(const candidate of pageCandidates(worker)){
      let response;try{response=await page.goto(candidate,{waitUntil:'domcontentloaded',timeout:30000});}catch{continue;}if(!response)continue;
      lastSurface=new URL(page.url()).hostname;
      let html='';try{html=await response.text();}catch{html=await page.content().catch(()=>'');}
      const blocks=dataSjsBlocksFromHtml(html);maxBlocks=Math.max(maxBlocks,blocks.length);
      const diag=deepRelayDiagnostics(blocks,worker,new Date());
      if(diag.storyObjects>best.storyObjects||diag.ownedUrls>best.ownedUrls)best=diag;
      const posts=deepRelayPostsFromDataSjsBlocks(blocks,worker,new Date(),maxPosts);
      if(posts.length)return {posts,result:`PUBLIC DEEP RELAY EXTRACTED; captured=${posts.length}; blocks=${blocks.length}; stories=${diag.storyObjects}; owned=${diag.ownedUrls}; surface=${lastSurface}`};
    }
    return {posts:[],result:`PUBLIC DEEP RELAY NO CURRENT POSTS; blocks=${maxBlocks}; timelineDocs=${best.timelineDocs}; stories=${best.storyObjects}; owned=${best.ownedUrls}; fresh=${best.freshDates}; text=${best.texts}; surface=${lastSurface||'none'}`};
  }finally{await page.close();}
}

export async function run(){
  const endpoint=process.env.LL_SOCIAL_ENDPOINT||DEFAULT_ENDPOINT,ingestKey=process.env.LL_SOCIAL_INGEST_KEY||'';if(!ingestKey)throw new Error('LL_SOCIAL_INGEST_KEY is required.');
  const maxWorkers=Math.max(1,Number(process.env.LL_MAX_WORKERS||25)),maxPosts=Math.max(1,Number(process.env.LL_MAX_POSTS_PER_PAGE||8)),force=/^(1|true|yes)$/i.test(process.env.LL_FORCE_SCAN||'');
  const manifest=await postJson(endpoint,ingestKey,'social_worker_manifest'),now=new Date();
  const workers=(manifest.workers||[]).filter(w=>shouldScanWorker(w,now,force)).sort((a,b)=>priorityRank(b.priority)-priorityRank(a.priority)||a.organization.localeCompare(b.organization)).slice(0,maxWorkers);
  const {chromium}=await import('playwright');const browser=await chromium.launch({headless:true});const context=await browser.newContext({locale:'en-US',timezoneId:TZ,viewport:{width:1365,height:900},userAgent:DESKTOP_UA});
  let delivered=0,duplicates=0,recoveredWorkers=0;
  try{
    for(const worker of workers){
      try{
        const scan=await scanWorker(context,worker,maxPosts);
        if(!scan.posts.length){console.log(`${worker.organization}: ${scan.result}`);continue;}
        let last=null,lastFingerprint='';
        for(const post of scan.posts){const intake=await postJson(endpoint,ingestKey,'social_intake',post);delivered++;if(intake.duplicate)duplicates++;last=post;lastFingerprint=intake.fingerprint||lastFingerprint;}
        recoveredWorkers++;
        await postJson(endpoint,ingestKey,'social_worker_scan',{queueId:worker.queueId,result:`${scan.result}; delivered=${scan.posts.length}`,lastPostUrl:last?.postUrl||'',lastPostDate:last?.postDate||'',lastPostText:last?.postText||'',lastMediaUrl:last?.mediaUrl||'',activityFingerprint:lastFingerprint});
        console.log(`${worker.organization}: ${scan.result}`);
      }catch(error){console.error(`${worker.organization}: DEEP RELAY ERROR: ${String(error.message||error).replace(/\s+/g,' ').slice(0,220)}`);}
    }
  }finally{await context.close();await browser.close();}
  console.log(`Louisburg Local deep Relay recovery complete: workers=${workers.length}; recoveredWorkers=${recoveredWorkers}; delivered=${delivered}; duplicates=${duplicates}`);
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)run().catch(error=>{console.error(error);process.exitCode=1;});
