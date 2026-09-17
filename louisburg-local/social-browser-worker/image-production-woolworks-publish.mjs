import {createHash} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import {findFacebookDateLabel,isPostFresh,parseFacebookDateLabel} from './worker-v2.mjs';
import {parseExactRecoveryHints} from './exact-post-recovery.mjs';

const ENDPOINT='https://script.google.com/macros/s/AKfycbxw9gJBH50L_VZbgp6i_mHHnfPXAkraIqv63BA2XqWtb-XaaczXxdf89WveFkAOwV-azw/exec';
const POST_URL='https://www.facebook.com/woolworksetc/posts/always-lots-of-fun-classes-happening-at-woolworks-the-makers-nook-sign-up-today/1606951627790402/';
const PROFILE_URL='https://www.facebook.com/woolworksetc';
const ORG="WoolWorks - The Maker's Nook";
const MOBILE_UA='Mozilla/5.0 (Linux; Android 17; Pixel 10 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36';
const TZ='America/Chicago';
const DATES=['September 23','September 25'];
const LOCATION="WoolWorks - the Maker's Nook, 106 S Broadway, Louisburg, KS";
const CONTACT='913.238.6041; meg@woolworks-themakersnook.com';

const CLASSES=[
  {title:'1 ON 1 CLASSES - FOR KIDS AND SPECIAL REQUESTS',price:'Price determined based on request',details:'Choose your class from the a la carte menu; first come, first choice.'},
  {title:'2 AT A TIME TOE-UP SOCK KNITTING',price:'$50 plus kit fee of $18'},
  {title:'KNIT MITTENS',price:'$50 plus kit fee'},
  {title:'BEGINNER KNITTING',price:'$35 plus kit fee of $15'},
  {title:'BEGINNER CROCHET',price:'$35 plus kit fee of $15'},
  {title:'KNIT FIX -LEARN TO FIX MISTAKES',price:'$25 no kit fee'},
  {title:'MAGIC LOOP/CABLE KNITTING',price:'$35 plus kit fee'},
  {title:'KNIT RAGLAN SWEATERS',price:'$50 plus kit fee',details:'New'},
  {title:'NEXT STEPS KNITTING -LEARN TO PURL & READ CHARTS',price:'$35 plus kit fee of approx $25'},
  {title:'KNIT/CROCHET EARWARMERS',price:'$35 plus kit fee'},
  {title:'KNIT PUMPKINS',price:'$35 plus kit fee',details:'New'}
];

function hash12(value){return createHash('sha256').update(String(value||'')).digest('hex').slice(0,12);}

async function postJson(key,action,payload={}){
  const response=await fetch(ENDPOINT,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action,ingestKey:key,...payload}),redirect:'follow'});
  const text=await response.text();
  let parsed;try{parsed=JSON.parse(text);}catch{throw new Error('Non-JSON '+action+': '+text.slice(0,180));}
  if(!response.ok||!parsed.ok)throw new Error(action+' failed: '+(parsed.error||response.status));
  return parsed;
}

async function exactPostEvidence(worker){
  const {chromium}=await import('playwright');
  const browser=await chromium.launch({headless:true});
  const context=await browser.newContext({locale:'en-US',timezoneId:TZ,viewport:{width:412,height:915},screen:{width:412,height:915},isMobile:true,hasTouch:true,deviceScaleFactor:2.625,userAgent:MOBILE_UA});
  const page=await context.newPage();
  try{
    await page.goto(POST_URL,{waitUntil:'domcontentloaded',timeout:30000});
    await page.waitForTimeout(1400);
    const now=new Date();
    const values=await page.locator('time[datetime],abbr[data-utime]').evaluateAll(nodes=>nodes.flatMap(n=>[n.getAttribute('datetime'),n.getAttribute('data-utime')]).filter(Boolean)).catch(()=>[]);
    let date=null;
    for(const value of values){
      const s=String(value);
      const d=/^\d{9,13}$/.test(s)?new Date(Number(s)*(s.length===10?1000:1)):new Date(s);
      if(isPostFresh(d,now)){date=d;break;}
    }
    if(!date){
      const raw=await page.locator('body').innerText({timeout:8000}).catch(()=>'');
      const label=findFacebookDateLabel(raw,now);
      date=parseFacebookDateLabel(label,now);
    }
    if(!isPostFresh(date,now)){
      const hint=parseExactRecoveryHints(worker?.notes||'');
      if(hint.date){
        const hinted=new Date(hint.date+'T12:00:00-05:00');
        if(isPostFresh(hinted,now)){date=hinted;console.log('WOOLWORKS_IMAGE_PUBLISH_DATE using verified EXACT_POST_DATE hint '+hint.date);}
      }
    }
    if(!isPostFresh(date,now))throw new Error('Could not verify a fresh public timestamp or configured exact-post date for the WoolWorks post.');
    let mediaUrl=String(await page.locator('meta[property="og:image"]').first().getAttribute('content').catch(()=>'')||'').trim();
    if(/^https?:\/\/[^\s]+fbcdn\.net\//i.test(mediaUrl)&&/([?&])ctp=p\d+x\d+/i.test(mediaUrl)){
      mediaUrl=mediaUrl.replace(/([?&])ctp=p\d+x\d+/i,(m,p)=>p+'ctp=p1200x1200');
    }
    return {postDate:date.toISOString(),mediaUrl};
  }finally{
    await page.close();await context.close();await browser.close();
  }
}

function classText(item){
  const parts=[
    item.title,
    'Available dates: '+DATES.join(', '),
    'Location: '+LOCATION,
    'Price: '+item.price,
    'Sign up: Contact Meg to enroll',
    'Contact: '+CONTACT
  ];
  if(item.details)parts.push('Details: '+item.details);
  return parts.join('. ');
}

async function run(){
  const key=String(process.env.LL_SOCIAL_INGEST_KEY||'').trim();
  if(!key)throw new Error('LL_SOCIAL_INGEST_KEY is required.');
  const manifest=await postJson(key,'social_worker_manifest');
  const worker=(manifest.workers||[]).find(w=>String(w.organization||'')===ORG&&String(w.profileUrl||'').replace(/\/+$/,'')===PROFILE_URL);
  if(!worker)throw new Error('Verified WoolWorks worker identity not found in live manifest.');
  const evidence=await exactPostEvidence(worker);
  const results=[];
  for(const item of CLASSES){
    const payload={
      queueId:worker.queueId,
      organization:ORG,
      platform:'FACEBOOK',
      profileUrl:PROFILE_URL,
      postUrl:POST_URL,
      postId:'1606951627790402-IMG-'+hash12(item.title),
      postDate:evidence.postDate,
      postText:classText(item),
      mediaUrl:evidence.mediaUrl,
      mediaType:evidence.mediaUrl?'IMAGE':'',
      activityType:'Event / Activity',
      louisburgMatch:'VERIFIED'
    };
    try{
      const intake=await postJson(key,'social_intake',payload);
      results.push({title:item.title,ok:true,duplicate:!!intake.duplicate,immediateProcess:intake.immediateProcess||'',immediateSummary:intake.immediateSummary||null,fingerprint:intake.fingerprint||''});
      console.log('WOOLWORKS_IMAGE_PUBLISH '+item.title+': ok duplicate='+!!intake.duplicate+' process='+(intake.immediateProcess||''));
    }catch(error){
      results.push({title:item.title,ok:false,error:String(error.message||error)});
      console.error('WOOLWORKS_IMAGE_PUBLISH '+item.title+': '+String(error.message||error));
    }
  }
  const summary={capturedAt:new Date().toISOString(),organization:ORG,postUrl:POST_URL,postDate:evidence.postDate,availableDates:DATES,total:results.length,submitted:results.filter(x=>x.ok&&!x.duplicate).length,duplicates:results.filter(x=>x.ok&&x.duplicate).length,errors:results.filter(x=>!x.ok).length,results};
  await writeFile('woolworks-image-publish-results.json',JSON.stringify(summary,null,2),'utf8');
  console.log('WOOLWORKS_IMAGE_PUBLISH_SUMMARY '+JSON.stringify({total:summary.total,submitted:summary.submitted,duplicates:summary.duplicates,errors:summary.errors}));
  if(summary.errors)throw new Error('One or more WoolWorks image activities failed to submit.');
}

run().catch(error=>{console.error(error);process.exitCode=1;});
