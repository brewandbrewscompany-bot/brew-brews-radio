import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';

const DEFAULT_ENDPOINT='https://script.google.com/macros/s/AKfycbxw9gJBH50L_VZbgp6i_mHHnfPXAkraIqv63BA2XqWtb-XaaczXxdf89WveFkAOwV-azw/exec';
const MAX_POST_AGE_DAYS=14;
const TZ='America/Chicago';

export function canonicalPostUrl(href){
  try{
    const url=new URL(String(href||''));
    if(!/(^|\.)facebook\.com$/i.test(url.hostname)||!/\/posts\//i.test(url.pathname))return '';
    return 'https://www.facebook.com'+url.pathname.replace(/\/$/,'');
  }catch{return '';}
}

export function parseFacebookDateLabel(label,now=new Date()){
  const value=String(label||'').replace(/\s+/g,' ').trim();
  if(/^just now$/i.test(value))return new Date(now);
  let match=value.match(/^(\d+)\s*(m|min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days|w|wk|wks|week|weeks)$/i);
  if(match){
    const unit=match[2].toLowerCase();
    let ms=60000;
    if(/^h|^hr|^hour/.test(unit))ms=3600000;
    else if(/^d|^day/.test(unit))ms=86400000;
    else if(/^w|^wk|^week/.test(unit))ms=604800000;
    return new Date(now.getTime()-Number(match[1])*ms);
  }
  match=value.match(/^Yesterday(?: at (\d{1,2}):(\d{2})\s*([AP]M))?$/i);
  if(match){
    const result=new Date(now);
    result.setDate(result.getDate()-1);
    if(match[1]){
      let hours=Number(match[1])%12;
      if(match[3].toUpperCase()==='PM')hours+=12;
      result.setHours(hours,Number(match[2]),0,0);
    }else result.setHours(12,0,0,0);
    return result;
  }
  match=value.match(/^([A-Za-z]+)\s+(\d{1,2})(?:\s+at\s+(\d{1,2}):(\d{2})\s*([AP]M))?$/i);
  if(match){
    const months=['january','february','march','april','may','june','july','august','september','october','november','december'];
    const month=months.indexOf(match[1].toLowerCase());
    if(month!==-1){
      let hours=0,minutes=0;
      if(match[3]){
        hours=Number(match[3])%12;
        if(match[5].toUpperCase()==='PM')hours+=12;
        minutes=Number(match[4]);
      }
      let result=new Date(now.getFullYear(),month,Number(match[2]),hours,minutes,0,0);
      if(result.getTime()>now.getTime()+86400000)result=new Date(now.getFullYear()-1,month,Number(match[2]),hours,minutes,0,0);
      return result;
    }
  }
  const parsed=new Date(value);
  return Number.isNaN(parsed.getTime())?null:parsed;
}

export function isPostFresh(date,now=new Date(),maxDays=MAX_POST_AGE_DAYS){
  return date instanceof Date&&!Number.isNaN(date.getTime())&&now.getTime()-date.getTime()>=-3600000&&now.getTime()-date.getTime()<=maxDays*86400000;
}

function localDay(date){
  try{
    const parts=new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
    const get=type=>parts.find(p=>p.type===type)?.value||'';
    return `${get('year')}-${get('month')}-${get('day')}`;
  }catch{return date.toISOString().slice(0,10);}
}

export function findFacebookDateLabel(raw,now=new Date()){
  const lines=String(raw||'').split(/\r?\n/).map(v=>v.replace(/\s+/g,' ').trim()).filter(Boolean);
  const patterns=[
    /^just now$/i,
    /^\d+\s*(?:m|min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days|w|wk|wks|week|weeks)$/i,
    /^yesterday(?: at \d{1,2}:\d{2}\s*[ap]m)?$/i,
    /^(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:\s+at\s+\d{1,2}:\d{2}\s*[ap]m)?$/i
  ];
  for(const line of lines){
    if(!patterns.some(re=>re.test(line)))continue;
    const d=parseFacebookDateLabel(line,now);
    if(isPostFresh(d,now))return line;
  }
  return '';
}

export function cleanPostText(raw,author,dateLabel){
  const lines=String(raw||'').split(/\r?\n/).map(v=>v.replace(/\s+/g,' ').trim()).filter(Boolean);
  let start=lines.findIndex(line=>line===dateLabel);
  if(start===-1)start=lines.findIndex(line=>line===author);
  start=start===-1?0:start+1;
  const output=[];
  for(const line of lines.slice(start)){
    if(/^(All reactions:|Like|Comment|Share|Write a comment|Most relevant|Send message|Follow)$/i.test(line))break;
    if(/^(·|Shared with Public|\d+|\d+ (?:share|shares|comment|comments))$/i.test(line))continue;
    if(line===author||line===dateLabel)continue;
    output.push(line);
  }
  return output.join('\n').trim();
}

export function shouldScanWorker(worker,now=new Date(),force=false){
  if(force||String(worker.scanMode||'').toUpperCase()!=='BROWSER_PUBLIC_PREVIEW')return true;
  const parsed=new Date(String(worker.lastScanAtIso||worker.lastScanAt||''));
  if(Number.isNaN(parsed.getTime()))return true;
  const interval=/DAILY/i.test(String(worker.scanFrequency||''))?20*3600000:45*60000;
  return now.getTime()-parsed.getTime()>=interval;
}

export function publicFacebookPageCandidates(profileUrl){
  const raw=String(profileUrl||'').trim();
  if(!raw)return [];
  try{
    const url=new URL(raw);
    if(!/(^|\.)facebook\.com$/i.test(url.hostname))return [raw];
    const id=String(url.searchParams.get('id')||'').trim();
    const path=url.pathname.replace(/\/+$/,'')||'/';
    const pathId=/^\/(\d+)$/.exec(path)?.[1]||'';
    const candidates=[];
    const add=value=>{if(value&&!candidates.includes(value))candidates.push(value);};
    add(raw);
    if(id){
      add(`https://www.facebook.com/profile.php?id=${encodeURIComponent(id)}`);
      add(`https://www.facebook.com/profile.php?id=${encodeURIComponent(id)}&sk=posts`);
      add(`https://m.facebook.com/profile.php?id=${encodeURIComponent(id)}`);
      add(`https://m.facebook.com/profile.php?id=${encodeURIComponent(id)}&sk=posts`);
      return candidates;
    }
    const desktop=`https://www.facebook.com${path}`;
    const mobile=`https://m.facebook.com${path}`;
    add(desktop);
    add(`${desktop}/posts`);
    add(`${desktop}?sk=posts`);
    add(mobile);
    add(`${mobile}/posts`);
    add(`${mobile}?sk=posts`);
    if(pathId){
      add(`https://www.facebook.com/profile.php?id=${pathId}`);
      add(`https://www.facebook.com/profile.php?id=${pathId}&sk=posts`);
      add(`https://m.facebook.com/profile.php?id=${pathId}`);
      add(`https://m.facebook.com/profile.php?id=${pathId}&sk=posts`);
    }
    return candidates;
  }catch{return [raw];}
}

function identityKey(value){
  return String(value||'').toLowerCase().replace(/\b(llc|inc|company|co|kansas|ks)\b/g,' ').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
}

function identityMatches(author,organization){
  const a=identityKey(author),b=identityKey(organization);
  if(!a||!b)return true;
  return a===b||a.includes(b)||b.includes(a);
}

function hash12(value){return createHash('sha256').update(String(value||'')).digest('hex').slice(0,12);}
function priorityRank(priority){return {HIGH:3,MEDIUM:2,LOW:1}[String(priority||'').toUpperCase()]||0;}

async function postJson(endpoint,ingestKey,action,payload={}){
  const response=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action,ingestKey,...payload}),redirect:'follow'});
  const text=await response.text();
  let parsed;
  try{parsed=JSON.parse(text);}catch{throw new Error(`Non-JSON response for ${action}: ${text.slice(0,160)}`);}
  if(!response.ok||!parsed.ok)throw new Error(`${action} failed: ${parsed.error||response.status}`);
  return parsed;
}

async function getBodyText(page){
  return (await page.locator('body').innerText({timeout:10000}).catch(()=>'' )).replace(/\s+/g,' ').trim();
}

async function collectPostLinks(page){
  const hrefs=await page.locator('a[href*="/posts/"]').evaluateAll(links=>links.map(link=>link.href)).catch(()=>[]);
  return [...new Set(hrefs.map(canonicalPostUrl).filter(Boolean))];
}

async function extractMedia(scope){
  const videos=await scope.locator('video').evaluateAll(nodes=>nodes.map(video=>({src:video.currentSrc||video.src||video.poster||'',poster:video.poster||''})).filter(item=>item.src||item.poster)).catch(()=>[]);
  if(videos.length)return {mediaUrl:videos[0].src||videos[0].poster,mediaType:'VIDEO'};
  const images=await scope.locator('img').evaluateAll(nodes=>nodes.map(img=>({src:img.currentSrc||img.src||'',width:img.naturalWidth||img.width||0,height:img.naturalHeight||img.height||0})).filter(item=>/fbcdn\.net/i.test(item.src)&&item.width>=250&&item.height>=180).sort((a,b)=>b.width*b.height-a.width*a.height)).catch(()=>[]);
  return images.length?{mediaUrl:images[0].src,mediaType:'IMAGE'}:{mediaUrl:'',mediaType:''};
}

async function findPostScope(page){
  for(const selector of ['[role="dialog"] article','main article','article','[role="article"]','[role="dialog"]','main']){
    const candidate=page.locator(selector).first();
    if(await candidate.count())return candidate;
  }
  return page.locator('body');
}

async function extractPost(browserContext,postUrl,worker,now){
  const page=await browserContext.newPage();
  try{
    await page.goto(postUrl,{waitUntil:'domcontentloaded',timeout:45000});
    await page.waitForTimeout(2500);
    const finalUrl=page.url();
    if(/\/login\//i.test(finalUrl))return {skip:'LOGIN REQUIRED'};
    const article=await findPostScope(page);
    let timestampLink=article.locator('a[href*="/posts/"]').first();
    if(!await timestampLink.count())timestampLink=page.locator('a[href*="/posts/"]').first();
    if(!await timestampLink.count())return {skip:'PUBLIC POST PERMALINK DID NOT RENDER'};
    const dateLabel=(await timestampLink.innerText({timeout:8000}).catch(()=>'' )).replace(/\s+/g,' ').trim();
    const parsedDate=parseFacebookDateLabel(dateLabel,now);
    if(!isPostFresh(parsedDate,now))return {skip:`STALE OR UNKNOWN DATE (${dateLabel||'none'})`};
    const author=(await article.locator('h2 a, h3 a, strong a').first().innerText({timeout:5000}).catch(()=>worker.organization)).trim()||worker.organization;
    if(!identityMatches(author,worker.organization))return {skip:`POST AUTHOR DOES NOT MATCH VERIFIED PAGE (${author})`};
    const messageNodes=article.locator('[data-ad-comet-preview="message"], [data-ad-preview="message"]');
    const messages=[...new Set((await messageNodes.allTextContents().catch(()=>[])).map(v=>v.replace(/\s+/g,' ').trim()).filter(v=>v.length>10))];
    const raw=await article.innerText({timeout:10000});
    const postText=(messages.join('\n')||cleanPostText(raw,author,dateLabel)).trim();
    if(postText.length<20)return {skip:'TOO LITTLE PUBLIC POST TEXT'};
    const canonical=canonicalPostUrl(finalUrl)||postUrl;
    const postId=canonical.split('/posts/')[1]||canonical;
    const media=await extractMedia(article);
    return {organization:worker.organization,platform:'FACEBOOK',profileUrl:worker.profileUrl,postUrl:canonical,postId,postDate:parsedDate.toISOString(),postText:postText.slice(0,5000),mediaUrl:media.mediaUrl,mediaType:media.mediaType,activityType:'',louisburgMatch:'VERIFIED',queueId:worker.queueId,pageIdentity:author,publicDateLabel:dateLabel,sourceMode:'PUBLIC_POST_PERMALINK'};
  }finally{await page.close();}
}

async function extractVisiblePagePosts(page,worker,now,maxPosts){
  const scopes=page.locator('article, [role="article"]');
  const count=Math.min(await scopes.count().catch(()=>0),20);
  const posts=[],seen=new Set();
  for(let i=0;i<count&&posts.length<maxPosts;i++){
    const scope=scopes.nth(i);
    const raw=await scope.innerText({timeout:5000}).catch(()=>'' );
    if(raw.length<30)continue;
    let exact='';
    const hrefs=await scope.locator('a[href*="/posts/"]').evaluateAll(links=>links.map(link=>link.href)).catch(()=>[]);
    for(const href of hrefs){exact=canonicalPostUrl(href);if(exact)break;}
    let dateLabel='';
    if(exact){
      const link=scope.locator('a[href*="/posts/"]').first();
      dateLabel=(await link.innerText({timeout:3000}).catch(()=>'' )).replace(/\s+/g,' ').trim();
    }
    if(!dateLabel||!parseFacebookDateLabel(dateLabel,now))dateLabel=findFacebookDateLabel(raw,now);
    const parsedDate=parseFacebookDateLabel(dateLabel,now);
    if(!isPostFresh(parsedDate,now))continue;
    const author=(await scope.locator('h2 a, h3 a, strong a').first().innerText({timeout:2500}).catch(()=>worker.organization)).trim()||worker.organization;
    if(!identityMatches(author,worker.organization))continue;
    const messageNodes=scope.locator('[data-ad-comet-preview="message"], [data-ad-preview="message"]');
    const messages=[...new Set((await messageNodes.allTextContents().catch(()=>[])).map(v=>v.replace(/\s+/g,' ').trim()).filter(v=>v.length>10))];
    const postText=(messages.join('\n')||cleanPostText(raw,author,dateLabel)).trim();
    if(postText.length<20)continue;
    const key=hash12(`${worker.organization}|${dateLabel}|${postText}`);
    if(seen.has(key))continue;
    seen.add(key);
    const media=await extractMedia(scope);
    if(exact){
      posts.push({organization:worker.organization,platform:'FACEBOOK',profileUrl:worker.profileUrl,postUrl:exact,postId:exact.split('/posts/')[1]||exact,postDate:parsedDate.toISOString(),postText:postText.slice(0,5000),mediaUrl:media.mediaUrl,mediaType:media.mediaType,activityType:'',louisburgMatch:'VERIFIED',queueId:worker.queueId,pageIdentity:author,publicDateLabel:dateLabel,sourceMode:'PUBLIC_POST_PERMALINK'});
      continue;
    }
    if(localDay(parsedDate)!==localDay(now))continue;
    const postId=`VISIBLE-${localDay(parsedDate).replace(/-/g,'')}-${key}`;
    const base=String(worker.profileUrl||'').replace(/#.*$/,'');
    posts.push({organization:worker.organization,platform:'FACEBOOK',profileUrl:worker.profileUrl,postUrl:`${base}#ll-visible-${key}`,postId,postDate:parsedDate.toISOString(),postText:postText.slice(0,5000),mediaUrl:media.mediaUrl,mediaType:media.mediaType,activityType:'',louisburgMatch:'VERIFIED',queueId:worker.queueId,pageIdentity:author,publicDateLabel:dateLabel,sourceMode:'PUBLIC_PAGE_VISIBLE_NO_PERMALINK'});
  }
  return posts;
}

async function scanWorker(browserContext,worker,settings){
  const page=await browserContext.newPage();
  const now=new Date();
  const candidates=publicFacebookPageCandidates(worker.profileUrl);
  let sawLogin=false,sawAgeGate=false,sawReadable=false,pageIdentity='',links=[],surface='',visiblePosts=[];
  try{
    for(const candidate of candidates){
      try{
        await page.goto(candidate,{waitUntil:'domcontentloaded',timeout:45000});
        await page.waitForTimeout(2500);
      }catch{continue;}
      const finalUrl=page.url(),bodyText=await getBodyText(page);
      const identity=(await page.locator('h1').first().innerText({timeout:4000}).catch(()=>'' )).trim();
      if(identity&&!pageIdentity)pageIdentity=identity;
      if(/Log in to view this 18\+ content/i.test(bodyText)){sawAgeGate=true;continue;}

      const found=(await collectPostLinks(page)).slice(0,settings.maxPostsPerPage);
      if(found.length){links=found;surface=candidate;if(identity)pageIdentity=identity;break;}

      const visible=await extractVisiblePagePosts(page,worker,now,settings.maxPostsPerPage);
      if(visible.length){visiblePosts=visible;surface=candidate;if(identity)pageIdentity=identity;break;}

      if(/\/login\//i.test(finalUrl)||/^Log into Facebook/i.test(bodyText)){sawLogin=true;continue;}
      if(bodyText.length>80)sawReadable=true;
    }

    if(links.length){
      const posts=[];
      for(const postUrl of links){
        const captured=await extractPost(browserContext,postUrl,worker,now);
        if(!captured.skip)posts.push(captured);
      }
      let surfaceLabel='';try{surfaceLabel=new URL(surface).hostname;}catch{}
      return {result:`PUBLIC PREVIEW READABLE; permalinks=${links.length}; recent posts=${posts.length}${surfaceLabel?'; surface='+surfaceLabel:''}${pageIdentity?'; identity='+pageIdentity:''}`,posts};
    }

    if(visiblePosts.length){
      const exactCount=visiblePosts.filter(p=>!/\bVISIBLE-/.test(p.postId)).length;
      const noLinkCount=visiblePosts.length-exactCount;
      return {result:`PUBLIC PAGE POST CARDS VISIBLE; captured=${visiblePosts.length}; exact-permalink=${exactCount}; no-permalink=${noLinkCount}${pageIdentity?'; identity='+pageIdentity:''}`,posts:visiblePosts};
    }

    if(sawReadable)return {result:`PUBLIC PAGE READABLE AFTER FALLBACKS; NO USABLE CURRENT POST CARDS EXPOSED${pageIdentity?'; identity='+pageIdentity:''}`,posts:[]};
    if(sawAgeGate)return {result:'AGE-GATED - PUBLIC POSTS NOT EXPOSED AFTER PUBLIC FALLBACKS',posts:[]};
    if(sawLogin)return {result:'LOGIN ONLY - NO VISIBLE CURRENT POST CARDS AFTER PUBLIC FALLBACKS',posts:[]};
    return {result:'PUBLIC FACEBOOK PAGE UNAVAILABLE AFTER PUBLIC FALLBACKS',posts:[]};
  }finally{await page.close();}
}

export async function run(){
  const endpoint=process.env.LL_SOCIAL_ENDPOINT||DEFAULT_ENDPOINT;
  const ingestKey=process.env.LL_SOCIAL_INGEST_KEY||'';
  if(!ingestKey)throw new Error('LL_SOCIAL_INGEST_KEY is required.');
  const maxWorkers=Math.max(1,Number(process.env.LL_MAX_WORKERS||25));
  const maxPostsPerPage=Math.max(1,Number(process.env.LL_MAX_POSTS_PER_PAGE||2));
  const forceScan=/^(1|true|yes)$/i.test(process.env.LL_FORCE_SCAN||'');
  const manifest=await postJson(endpoint,ingestKey,'social_worker_manifest');
  const now=new Date();
  const workers=(manifest.workers||[]).filter(worker=>shouldScanWorker(worker,now,forceScan)).sort((a,b)=>priorityRank(b.priority)-priorityRank(a.priority)||a.organization.localeCompare(b.organization)).slice(0,maxWorkers);
  const {chromium}=await import('playwright');
  const browser=await chromium.launch({headless:true});
  const context=await browser.newContext({locale:'en-US',timezoneId:TZ,viewport:{width:1365,height:900}});
  let capturedCount=0,duplicateCount=0;
  try{
    for(const worker of workers){
      try{
        const scan=await scanWorker(context,worker,{maxPostsPerPage});
        let lastPost=null,lastFingerprint='';
        for(const post of scan.posts){
          const intake=await postJson(endpoint,ingestKey,'social_intake',post);
          capturedCount++;
          if(intake.duplicate)duplicateCount++;
          lastPost=post;
          lastFingerprint=intake.fingerprint||lastFingerprint;
        }
        await postJson(endpoint,ingestKey,'social_worker_scan',{queueId:worker.queueId,result:scan.result+(scan.posts.length?`; delivered=${scan.posts.length}`:''),lastPostUrl:lastPost?.postUrl||'',lastPostDate:lastPost?.postDate||'',lastPostText:lastPost?.postText||'',lastMediaUrl:lastPost?.mediaUrl||'',activityFingerprint:lastFingerprint});
        console.log(`${worker.organization}: ${scan.result}`);
      }catch(error){
        const result=`BROWSER WORKER ERROR: ${String(error.message||error).replace(/\s+/g,' ').slice(0,220)}`;
        await postJson(endpoint,ingestKey,'social_worker_scan',{queueId:worker.queueId,result}).catch(()=>{});
        console.error(`${worker.organization}: ${result}`);
      }
      await new Promise(resolve=>setTimeout(resolve,1200));
    }
  }finally{
    await context.close();
    await browser.close();
  }
  console.log(`Louisburg Local social scan complete: workers=${workers.length}; delivered=${capturedCount}; duplicates=${duplicateCount}`);
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  run().catch(error=>{console.error(error);process.exitCode=1;});
}
