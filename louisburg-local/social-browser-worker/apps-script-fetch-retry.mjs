// Small transport-level retry shim for the Louisburg Local Apps Script webhook.
//
// Google occasionally returns a transient HTML interstitial (ppConfig) instead
// of the JSON response from the deployed web app. The collectors already dedupe
// social_intake writes and social_worker_scan is an idempotent status update, so
// retrying those transient responses is safer than dropping an otherwise valid
// source result. This module never retries ordinary website/Facebook fetches.

const originalFetch=globalThis.fetch.bind(globalThis);
const MAX_ATTEMPTS=3;
const RETRY_DELAYS_MS=[350,900];

function sleep(ms){return new Promise(resolve=>setTimeout(resolve,ms));}

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

globalThis.fetch=async function louisburgFetchWithAppsScriptRetry(input,init){
  if(!isAppsScriptWebhook(input)||!canRetryRequest(init))return originalFetch(input,init);
  let lastError=null;
  for(let attempt=0;attempt<MAX_ATTEMPTS;attempt++){
    try{
      const response=await originalFetch(input,init);
      const transient=await transientAppsScriptResponse(response);
      if(!transient||attempt===MAX_ATTEMPTS-1)return response;
    }catch(error){
      lastError=error;
      if(attempt===MAX_ATTEMPTS-1)throw error;
    }
    await sleep(RETRY_DELAYS_MS[Math.min(attempt,RETRY_DELAYS_MS.length-1)]);
  }
  if(lastError)throw lastError;
  return originalFetch(input,init);
};
