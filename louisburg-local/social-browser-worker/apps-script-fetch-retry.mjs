// Transport-level reliability shim for the Louisburg Local Apps Script webhook.
//
// Responsibilities:
// 1. Retry transient Apps Script HTML/interstitial and 5xx/429 responses.
// 2. Add an explicit activityType to social_intake payloads when the collector
//    did not already provide one. This prevents a valid current business post
//    from being lost because one backend classifier misses its wording.
// 3. Treat a social_intake response as successful only when the deployed web
//    app explicitly confirms received=true.
//
// The backend remains authoritative for Louisburg identity, ownership, age,
// dedupe, conflicts and public eligibility. This shim only supplies a strong
// first-pass activity classification and reliable transport.

const originalFetch=globalThis.fetch.bind(globalThis);
const MAX_ATTEMPTS=3;
const RETRY_DELAYS_MS=[350,900];

function sleep(ms){return new Promise(resolve=>setTimeout(resolve,ms));}
function normalizeText(value){return String(value||'').replace(/\s+/g,' ').trim().toLowerCase();}

export function classifyLouisburgActivityType(value){
  const t=normalizeText(value);
  if(!t)return '';

  if(/closed today|closing early|\bclosure\b|cancelled|canceled|postponed|rescheduled|delayed|sold out|hours? changed|change(?:d)? (?:our )?hours|phone (?:line|lines) (?:is|are) (?:currently )?(?:down|out)|temporarily closed/.test(t))return 'Operational Update';
  if(/now hiring|\bhiring\b|apply today|job opening|employment|applications? (?:close|closing|due)|join our team/.test(t))return 'Hiring';
  if(/daily special|special today|today only|\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+special|\bspecials?\b|\bdeal\b|discount|coupon|promo(?:tion)? code|\b\d{1,3}\s*%\s*off\b|\bsave\s+\d{1,3}\s*%\b|promotion|on sale|sale ends|buy one|get one|\bbogo\b|\bfree\b|complimentary|giveaway/.test(t))return 'Deal / Special';
  if(/live music|concert|festival|workshop|fundraiser|open house|\bevent\b|tickets|register now|registration open|open enrollment|sign up|signup|\bclass(?:es)?\b|game this|game today|meeting today|meeting tonight/.test(t))return 'Event / Activity';
  if(/now open|grand opening|online ordering|new hours|extended hours|new location|moving to|we moved|reopening/.test(t))return 'Business Update';
  if(/new product|new coffee|new drink|new menu|launch|release|available now|now available|freshly roasted|fresh inventory|\bare here\b|\b(?:has|have) (?:officially )?arrived\b|\bjust arrived\b|\bnow in stock\b|restock|restocked|ready to pour|ready to serve|ready to go/.test(t))return 'New Product / Offering';

  // Routine current commercial invitations are valid local activity even when
  // they are not discounts or brand-new products. Require both a current-time
  // signal and an action/invitation signal to avoid promoting generic branding.
  const current=/\b(today|tonight|tomorrow|this morning|this afternoon|this evening|this weekend|this week|now|ready|available|in stock|fresh(?:ly)? brewed|fresh(?:ly)? roasted|serving|pouring)\b/.test(t);
  const invitation=/\b(stop by|come by|swing by|come see us|grab|try|pick up|shop|visit|order|reserve|call us|join us|we(?:'|’)d love to see you)\b/.test(t);
  if(current&&invitation)return 'New Product / Offering';

  // A slightly narrower fallback for posts that omit an explicit time word but
  // clearly advertise something presently available at the business.
  const offerVerb=/\b(stop by|come by|swing by|grab|try|pick up|available now|ready to (?:go|pour|serve)|we(?:'|’)ve got)\b/.test(t);
  const offerObject=/\b(coffee|drink|food|meal|product|inventory|bags?|donuts?|snacks?|service|appointments?|tickets?|merch|merchandise)\b/.test(t);
  if(offerVerb&&offerObject)return 'New Product / Offering';

  return '';
}

function isAppsScriptWebhook(input){
  try{
    const raw=typeof input==='string'||input instanceof URL?String(input):String(input?.url||'');
    const u=new URL(raw);
    return /(^|\.)script\.google\.com$/i.test(u.hostname)&&/\/macros\/s\//i.test(u.pathname);
  }catch{return false;}
}

function canRetryRequest(init){
  const method=String(init?.method||'GET').toUpperCase();
  return method==='POST'||method==='GET';
}

function parseJsonBody(init){
  if(typeof init?.body!=='string')return null;
  try{return JSON.parse(init.body);}catch{return null;}
}

function prepareAppsScriptInit(init){
  const body=parseJsonBody(init);
  if(!body||String(body.action||'').toLowerCase()!=='social_intake'||String(body.activityType||'').trim())return init;
  const activityType=classifyLouisburgActivityType(body.postText||body.text||'');
  if(!activityType)return init;
  return {...init,body:JSON.stringify({...body,activityType,deliveryClassifier:'shared-worker-v2'})};
}

async function transientAppsScriptResponse(response){
  if(!response)return true;
  if(response.status===408||response.status===425||response.status===429||response.status>=500)return true;
  const type=String(response.headers?.get?.('content-type')||'').toLowerCase();
  if(type.includes('application/json'))return false;
  // Clone so the caller can still consume the original response if this is the
  // final attempt. Only inspect a small prefix; ppConfig is present near the top.
  const prefix=(await response.clone().text().catch(()=>'' )).slice(0,1200);
  return /<!doctype html|<html\b|ppConfig|productName:\s*['"]26981ed0d57bbad37e728ff58134270c/i.test(prefix);
}

async function socialIntakeAcknowledged(response,action){
  if(action!=='social_intake')return true;
  try{
    const data=JSON.parse(await response.clone().text());
    // Deterministic backend rejections are left to the caller. Only an
    // otherwise-successful response that failed to confirm receipt is retried.
    if(data?.ok!==true)return true;
    return data.received===true;
  }catch{return false;}
}

globalThis.fetch=async function louisburgFetchWithAppsScriptRetry(input,init){
  if(!isAppsScriptWebhook(input)||!canRetryRequest(init))return originalFetch(input,init);
  const prepared=prepareAppsScriptInit(init);
  const action=String(parseJsonBody(prepared)?.action||'').toLowerCase();
  let lastError=null;
  for(let attempt=0;attempt<MAX_ATTEMPTS;attempt++){
    try{
      const response=await originalFetch(input,prepared);
      const transient=await transientAppsScriptResponse(response);
      const acknowledged=transient?false:await socialIntakeAcknowledged(response,action);
      if((!transient&&acknowledged)||attempt===MAX_ATTEMPTS-1)return response;
    }catch(error){
      lastError=error;
      if(attempt===MAX_ATTEMPTS-1)throw error;
    }
    await sleep(RETRY_DELAYS_MS[Math.min(attempt,RETRY_DELAYS_MS.length-1)]);
  }
  if(lastError)throw lastError;
  return originalFetch(input,prepared);
};
