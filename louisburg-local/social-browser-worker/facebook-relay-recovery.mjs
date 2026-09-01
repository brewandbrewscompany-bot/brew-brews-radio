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

const DEFAULT_ENDPOINT='https://script.google.com/macros/s/AKfycbxw9gJBH50L_VZbgp6i_mHHnfPXAkraIqv63BA2XqWtb-XaaczXxdf89WveFkAOwV-azw/exec';
const TZ='America/Chicago';
const DESKTOP_UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

// Facebook's signed-out Comet page can carry the newest public Page story in
// inline Relay bootstrap data even when no usable post card is rendered in the
// DOM. This recovery layer reads only that public response; it does not log in,
// use cookies from a Facebook account, bypass an age gate, or replay private API
// credentials.

function isObject(v){return !!v&&typeof v==='object'&&!Array.isArray(v);}
function moduleName(v){return String(v||'').split('@')[0];}
function opFromPreloaderId(v){
  let s=String(v||'');
  if(s.startsWith('adp_'))s=s.slice(4);
  const i=s.indexOf('RelayPreloader');
  return i>0?s.slice(0,i):s;
}
function priorityRank(v){return {HIGH:3,MEDIUM:2,LOW:1}[String(v||'').toUpperCase()]||0;}

export function dataSjsBlocksFromHtml(html){
  const out=[];
  const source=String(html||'');
  const re=/<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
  while((m=re.exec(source))){
    const attrs=m[1]||'';
    if(!/\bdata-sjs(?:\s|=|>|$)/i.test(attrs))continue;
    if(!/\btype\s*=\s*["']application\/json["']/i.test(attrs))continue;
    const body=m[2]||'';
    const claimed=Number((attrs.match(/\bdata-content-len\s*=\s*["'](\d+)["']/i)||[])[1]||-1);
    if(claimed>=0&&claimed!==Buffer.byteLength(body,'utf8'))continue;
    out.push(body);
  }
  return out;
}

function collectRelayPayloads(v,out){
  if(Array.isArray(v)){
    if(v.length>=4&&typeof v[0]==='string'&&moduleName(v[0])==='RelayPrefetchedStreamCache'&&Array.isArray(v[3])){
      const args=v[3];
      const preloaderId=String(args[0]||'');
      const box=isObject(args[1])?args[1]:null;
      const bbox=isObject(box?.__bbox)?box.__bbox:null;
      const result=isObject(bbox?.result)?bbox.result:null;
      if(result){
        out.push({
          op:opFromPreloaderId(preloaderId),
          label:String(result.label||''),
          path:Array.isArray(result.path)?result.path:null,
          data:result.data,
          sequence:Number(bbox.sequence_number||0),
        });
      }
      return;
    }
    for(const child of v)collectRelayPayloads(child,out);
    return;
  }
  if(isObject(v))for(const child of Object.values(v))collectRelayPayloads(child,out);
}

function mergeInto(target,fragment){
  if(!isObject(target)||!isObject(fragment))return;
  for(const [key,value] of Object.entries(fragment)){
    if(isObject(value)&&isObject(target[key]))mergeInto(target[key],value);
    else target[key]=value;
  }
}

function walkPath(root,path){
  let cur=root;
  for(const step of path||[]){
    if(typeof step==='string'){
      if(!isObject(cur)&&!Array.isArray(cur))return null;
      cur=cur?.[step];
    }else if(typeof step==='number'){
      if(!Array.isArray(cur)||step<0||step>=cur.length)return null;
      cur=cur[step];
    }else return null;
    if(cur===undefined||cur===null)return null;
  }
  return isObject(cur)?cur:null;
}

export function relayDocumentsFromDataSjsBlocks(blockTexts){
  const payloads=[];
  for(const text of blockTexts||[]){
    let decoded;
    try{decoded=JSON.parse(String(text||''));}catch{continue;}
    collectRelayPayloads(decoded,payloads);
  }
  const grouped=new Map();
  for(const payload of payloads){
    if(!payload.op)continue;
    if(!grouped.has(payload.op))grouped.set(payload.op,[]);
    grouped.get(payload.op).push(payload);
  }
  const docs=new Map();
  for(const [op,group] of grouped){
    let root=null;
    const fragments=[];
    for(const p of group){
      if(!p.label&&p.path==null&&isObject(p.data)&&root==null)root=structuredClone(p.data);
      else fragments.push(p);
    }
    if(!root)continue;
    fragments.sort((a,b)=>a.sequence-b.sequence);
    for(const frag of fragments){
      if(!isObject(frag.data)||!Array.isArray(frag.path))continue;
      const node=walkPath(root,frag.path);
      if(node)mergeInto(node,frag.data);
    }
    docs.set(op,root);
  }
  return docs;
}

function dig(root,...path){
  let cur=root;
  for(const key of path){
    if(cur==null)return undefined;
    cur=cur[key];
  }
  return cur;
}

function findValueForKey(root,wanted,depth=0){
  if(depth>18||root==null)return undefined;
  if(isObject(root)){
    if(Object.prototype.hasOwnProperty.call(root,wanted))return root[wanted];
    for(const value of Object.values(root)){
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
    const n=Number(raw);
    return new Date(n>1e12?n:n*1000);
  }
  const d=new Date(raw);
  return Number.isNaN(d.getTime())?null:d;
}

function normalizedText(value){return String(value||'').replace(/\s+/g,' ').trim();}

function relayMessageText(story){
  const paths=[
    ['comet_sections','content','story','message','text'],
    ['comet_sections','content','story','comet_sections','message','story','message','text'],
    ['comet_sections','content','story','comet_sections','message_container','story','message','text'],
    ['message','text'],
    ['message'],
  ];
  for(const path of paths){
    const value=dig(story,...path);
    const text=normalizedText(typeof value==='string'?value:value?.text);
    if(text)return text;
  }
  return findMessageText(story,[],0);
}

function findMessageText(value,path,depth){
  if(depth>14||value==null)return '';
  const joined=path.join('.').toLowerCase();
  if(/(?:comments?|feedback|replies)/.test(joined))return '';
  if(isObject(value)){
    if(Object.prototype.hasOwnProperty.call(value,'message')){
      const msg=value.message;
      const text=normalizedText(typeof msg==='string'?msg:msg?.text);
      if(text)return text;
    }
    for(const [key,child] of Object.entries(value)){
      const found=findMessageText(child,[...path,key],depth+1);
      if(found)return found;
    }
  }else if(Array.isArray(value)){
    for(let i=0;i<value.length;i++){
      const found=findMessageText(value[i],[...path,String(i)],depth+1);
      if(found)return found;
    }
  }
  return '';
}

function firstNamedActor(list){
  if(!Array.isArray(list))return '';
  for(const actor of list){
    const name=normalizedText(actor?.name);
    if(name)return name;
  }
  return '';
}

function relayAuthor(story){
  const candidates=[
    dig(story,'actors'),
    dig(story,'comet_sections','context_layout','story','actors'),
    dig(story,'comet_sections','context_layout','story','comet_sections','actor_photo','story','actors'),
    dig(story,'comet_sections','content','story','actors'),
  ];
  for(const list of candidates){const name=firstNamedActor(list);if(name)return name;}
  const actors=findValueForKey(story,'actors');
  return firstNamedActor(actors);
}

function identityKey(v){return normalizedText(v).toLowerCase().replace(/\b(llc|inc|company|co|kansas|ks)\b/g,' ').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();}
function identityMatches(a,b){
  a=identityKey(a);b=identityKey(b);
  if(!a||!b)return true;
  return a===b||a.includes(b)||b.includes(a);
}

function explicitNumericAliases(worker){
  const notes=String(worker?.notes||'');
  const ids=[];
  for(const re of [/(?:^|\s)FACEBOOK_ALT_ID=(\d+)/ig,/(?:^|\s)FACEBOOK_NUMERIC_ALIAS=(\d+)/ig]){
    let m;while((m=re.exec(notes)))if(!ids.includes(m[1]))ids.push(m[1]);
  }
  return ids;
}

function relayPostBelongsToWorker(url,worker){
  if(facebookPostBelongsToWorker(url,worker))return true;
  const key=facebookOwnerKey(url);
  return explicitNumericAliases(worker).some(id=>key===`id:${id}`);
}

function collectCanonicalPostUrls(value,out,depth=0){
  if(depth>15||value==null)return;
  if(typeof value==='string'){
    const canonical=canonicalPostUrl(value.replace(/\\u002F/gi,'/').replace(/\\\//g,'/').replace(/&amp;/g,'&'));
    if(canonical&&!out.includes(canonical))out.push(canonical);
    return;
  }
  if(Array.isArray(value)){for(const child of value)collectCanonicalPostUrls(child,out,depth+1);return;}
  if(isObject(value))for(const child of Object.values(value))collectCanonicalPostUrls(child,out,depth+1);
}

function relayPostUrl(story,worker){
  const direct=[dig(story,'permalink_url'),dig(story,'url')];
  for(const raw of direct){
    const canonical=canonicalPostUrl(raw);
    if(canonical&&relayPostBelongsToWorker(canonical,worker))return canonical;
  }
  const urls=[];
  collectCanonicalPostUrls(story,urls);
  return urls.find(url=>relayPostBelongsToWorker(url,worker))||'';
}

function collectFbcdn(value,out,depth=0){
  if(depth>16||value==null)return;
  if(typeof value==='string'){
    const clean=value.replace(/\\u002F/gi,'/').replace(/\\\//g,'/').replace(/&amp;/g,'&');
    if(/https?:\/\/[^\s"']*fbcdn\.net\//i.test(clean)&&!out.includes(clean))out.push(clean);
    return;
  }
  if(Array.isArray(value)){for(const child of value)collectFbcdn(child,out,depth+1);return;}
  if(isObject(value))for(const child of Object.values(value))collectFbcdn(child,out,depth+1);
}

function relayMedia(story){
  const attachments=dig(story,'attachments')||dig(story,'comet_sections','content','story','attachments')||[];
  const urls=[];collectFbcdn(attachments,urls);
  if(!urls.length)return {mediaUrl:'',mediaType:''};
  const serialized=JSON.stringify(attachments);
  const mediaType=/Video|playable_url|video_inline|video_autoplay/i.test(serialized)?'VIDEO':'IMAGE';
  return {mediaUrl:urls[0],mediaType};
}

function storyPostId(story){
  return String(dig(story,'post_id')||dig(story,'legacy_story_hideable_id')||dig(story,'comet_sections','content','story','post_id')||'').trim();
}

function storyCreationTime(story){
  return dig(story,'creation_time')??dig(story,'comet_sections','content','story','creation_time')??findValueForKey(story,'creation_time');
}

function timelineUnitsFromDocument(doc){
  return dig(doc,'user','timeline_list_feed_units')||findValueForKey(doc,'timeline_list_feed_units');
}

function timelineStories(units){
  if(!units)return [];
  const list=Array.isArray(units.edges)?units.edges:Array.isArray(units.nodes)?units.nodes:[];
  return list.map(entry=>entry?.node||entry).filter(isObject);
}

export function relayPostsFromDataSjsBlocks(blockTexts,worker,now=new Date(),maxPosts=8){
  const docs=relayDocumentsFromDataSjsBlocks(blockTexts);
  const documentEntries=[...docs.entries()].sort(([a],[b])=>{
    const ar=a==='ProfileCometTimelineFeedQuery'?0:/TimelineFeedQuery/i.test(a)?1:2;
    const br=b==='ProfileCometTimelineFeedQuery'?0:/TimelineFeedQuery/i.test(b)?1:2;
    return ar-br;
  });
  const posts=[],seen=new Set();
  for(const [op,doc] of documentEntries){
    if(!/TimelineFeedQuery/i.test(op)&&!findValueForKey(doc,'timeline_list_feed_units'))continue;
    const units=timelineUnitsFromDocument(doc);
    for(const story of timelineStories(units)){
      const postId=storyPostId(story);
      const postUrl=relayPostUrl(story,worker);
      const postDate=relayDate(storyCreationTime(story));
      const postText=relayMessageText(story);
      const author=relayAuthor(story)||worker.organization;
      if(!postUrl||!isPostFresh(postDate,now)||postText.length<5||!identityMatches(author,worker.organization))continue;
      if(seen.has(postUrl))continue;seen.add(postUrl);
      const media=relayMedia(story);
      posts.push({
        organization:worker.organization,
        platform:'FACEBOOK',
        profileUrl:worker.profileUrl,
        postUrl,
        postId:postId||postUrl,
        postDate:postDate.toISOString(),
        postText:postText.slice(0,5000),
        mediaUrl:media.mediaUrl,
        mediaType:media.mediaType,
        activityType:'',
        louisburgMatch:'VERIFIED',
        queueId:worker.queueId,
        pageIdentity:author,
        publicDateLabel:'Relay creation_time',
        sourceMode:'PUBLIC_RELAY_DATA_SJS',
      });
    }
  }
  return posts.sort((a,b)=>new Date(b.postDate)-new Date(a.postDate)).slice(0,Math.max(1,maxPosts));
}

function relayPageCandidates(worker){
  const out=[];
  const add=value=>{if(value&&!out.includes(value))out.push(value);};
  const identities=[...facebookWorkerIdentityUrls(worker)];
  for(const id of explicitNumericAliases(worker))add(`https://www.facebook.com/${id}`);
  for(const identity of identities){
    for(const raw of publicFacebookPageCandidates(identity)){
      try{
        const u=new URL(raw);
        if(!/(^|\.)facebook\.com$/i.test(u.hostname))continue;
        u.hostname='www.facebook.com';
        add(u.toString());
      }catch{}
    }
  }
  // Keep this layer quick. The signed-out Relay store is normally on the first
  // www Page surface; two identities/candidates are enough before the existing
  // DOM and first-party fallbacks take over.
  return out.slice(0,4);
}

async function scanRelayWorker(context,worker,maxPosts){
  const page=await context.newPage();
  let maxBlocks=0;let operations=[];let lastSurface='';
  try{
    for(const candidate of relayPageCandidates(worker)){
      let response;
      try{response=await page.goto(candidate,{waitUntil:'domcontentloaded',timeout:30000});}catch{continue;}
      if(!response)continue;
      lastSurface=new URL(page.url()).hostname;
      let html='';
      try{html=await response.text();}catch{html=await page.content().catch(()=>'');}
      const blocks=dataSjsBlocksFromHtml(html);
      maxBlocks=Math.max(maxBlocks,blocks.length);
      const docs=relayDocumentsFromDataSjsBlocks(blocks);
      operations=[...new Set([...operations,...docs.keys()])];
      const posts=relayPostsFromDataSjsBlocks(blocks,worker,new Date(),maxPosts);
      if(posts.length)return {posts,result:`PUBLIC RELAY TIMELINE EXTRACTED; captured=${posts.length}; blocks=${blocks.length}; surface=${lastSurface}`};
    }
    const timeline=operations.filter(v=>/TimelineFeedQuery/i.test(v)).join(',')||'none';
    return {posts:[],result:`PUBLIC RELAY RECOVERY FOUND NO CURRENT POSTS; blocks=${maxBlocks}; timeline=${timeline}; surface=${lastSurface||'none'}`};
  }finally{await page.close();}
}

async function postJson(endpoint,ingestKey,action,payload={}){
  const r=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action,ingestKey,...payload}),redirect:'follow'});
  const text=await r.text();let parsed;
  try{parsed=JSON.parse(text);}catch{throw new Error(`Non-JSON response for ${action}: ${text.slice(0,160)}`);}
  if(!r.ok||!parsed.ok)throw new Error(`${action} failed: ${parsed.error||r.status}`);
  return parsed;
}

export async function run(){
  const endpoint=process.env.LL_SOCIAL_ENDPOINT||DEFAULT_ENDPOINT;
  const ingestKey=process.env.LL_SOCIAL_INGEST_KEY||'';
  if(!ingestKey)throw new Error('LL_SOCIAL_INGEST_KEY is required.');
  const maxWorkers=Math.max(1,Number(process.env.LL_MAX_WORKERS||25));
  const maxPosts=Math.max(1,Number(process.env.LL_MAX_POSTS_PER_PAGE||8));
  const force=/^(1|true|yes)$/i.test(process.env.LL_FORCE_SCAN||'');
  const manifest=await postJson(endpoint,ingestKey,'social_worker_manifest');
  const now=new Date();
  const workers=(manifest.workers||[]).filter(w=>shouldScanWorker(w,now,force)).sort((a,b)=>priorityRank(b.priority)-priorityRank(a.priority)||a.organization.localeCompare(b.organization)).slice(0,maxWorkers);
  const {chromium}=await import('playwright');
  const browser=await chromium.launch({headless:true});
  const context=await browser.newContext({locale:'en-US',timezoneId:TZ,viewport:{width:1365,height:900},userAgent:DESKTOP_UA});
  let delivered=0,duplicates=0,recoveredWorkers=0;
  try{
    for(const worker of workers){
      try{
        const scan=await scanRelayWorker(context,worker,maxPosts);
        if(!scan.posts.length){console.log(`${worker.organization}: ${scan.result}`);continue;}
        let last=null,lastFingerprint='';
        for(const post of scan.posts){
          const intake=await postJson(endpoint,ingestKey,'social_intake',post);
          delivered++;if(intake.duplicate)duplicates++;
          last=post;lastFingerprint=intake.fingerprint||lastFingerprint;
        }
        recoveredWorkers++;
        await postJson(endpoint,ingestKey,'social_worker_scan',{
          queueId:worker.queueId,
          result:`${scan.result}; delivered=${scan.posts.length}`,
          lastPostUrl:last?.postUrl||'',
          lastPostDate:last?.postDate||'',
          lastPostText:last?.postText||'',
          lastMediaUrl:last?.mediaUrl||'',
          activityFingerprint:lastFingerprint,
        });
        console.log(`${worker.organization}: ${scan.result}`);
      }catch(error){
        console.error(`${worker.organization}: RELAY RECOVERY ERROR: ${String(error.message||error).replace(/\s+/g,' ').slice(0,220)}`);
      }
    }
  }finally{await context.close();await browser.close();}
  console.log(`Louisburg Local public Relay recovery complete: workers=${workers.length}; recoveredWorkers=${recoveredWorkers}; delivered=${delivered}; duplicates=${duplicates}`);
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)run().catch(error=>{console.error(error);process.exitCode=1;});
