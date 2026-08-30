function runLouisburgLocalCollector() { runCollector_(false); }
function forceScanLouisburgLocal() { runCollector_(true); }

function runCollector_(forceScan) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(LL_CONFIG.LOCK_WAIT_MS)) { logSkippedRun_('Collector skipped: another run holds the script lock.'); return; }
  try {
    const started=new Date(), runId=Utilities.getUuid(), ss=SpreadsheetApp.openById(LL_CONFIG.SPREADSHEET_ID);
    const endpointSheet=ss.getSheetByName(LL_CONFIG.SHEETS.ENDPOINTS), stateSheet=ss.getSheetByName(LL_CONFIG.SHEETS.STATE), logSheet=ss.getSheetByName(LL_CONFIG.SHEETS.LOG);
    if(!endpointSheet||!stateSheet||!logSheet) throw new Error('Collector sheets are missing.');
    const sherlockChecks=processSherlockRechecks_(ss), raw=endpointSheet.getDataRange().getDisplayValues(); if(raw.length<2)return;
    const headers=raw.shift(), ix=headerMap_(headers), state=loadState_(stateSheet), props=PropertiesService.getScriptProperties();
    const startCursor=forceScan?0:Math.max(0,Number(props.getProperty('LL_COLLECTOR_CURSOR')||0)), rows=raw;
    const allowed=forceScan?LL_CONFIG.FORCE_SCAN_ACCESS_METHODS:LL_CONFIG.ALLOWED_ACCESS_METHODS, maxEndpoints=forceScan?LL_CONFIG.FORCE_SCAN_MAX_ENDPOINTS:LL_CONFIG.MAX_ENDPOINTS_PER_RUN;
    let checked=0,changed=0,candidates=0,failures=0,considered=0,rejectedNoise=0,rejectedStale=0,rejectedWeak=0;
    let directChecked=0,surfaceChecked=0,surfaceReadable=0,surfaceBlocked=0,cursor=startCursor,visited=0;
    while(visited<rows.length&&considered<maxEndpoints){
      if(cursor>=rows.length)cursor=0; const row=rows[cursor];cursor++;visited++;
      const sourceUrl=cell_(row,ix,'Source URL'),active=cell_(row,ix,'Active').toLowerCase(),access=cell_(row,ix,'Access Method').toUpperCase(),org=cell_(row,ix,'Business / Organization'),priority=cell_(row,ix,'Feed Priority').toUpperCase()||'MEDIUM';
      if(!sourceUrl||!/^(yes|true|active)$/i.test(active)||allowed.indexOf(access)===-1)continue;
      const key=endpointKey_(org,sourceUrl),old=state[key]||{}; if(!forceScan&&!isDue_(old.nextCheck))continue;
      considered++;checked++;if(access==='SURFACE')surfaceChecked++;else directChecked++;
      try{
        const result=fetchPublicSource_(sourceUrl),normalized=normalizeText_(result.body),social=inspectSocialSurface_(sourceUrl,normalized,result.body);
        if(access==='SURFACE'){if(social.readable)surfaceReadable++;else surfaceBlocked++;}
        const activity=extractActivity_(normalized),activityFingerprint=digest_(activity.canonical||('no-activity|'+social.status)),didChange=!old.fingerprint||old.fingerprint!==activityFingerprint,now=new Date(); if(didChange)changed++;
        let candidateCount=0, gate=activityQualityGate_(activity,normalized,org,now);
        if(!gate.ok){if(gate.reason==='NOISE')rejectedNoise++;else if(gate.reason==='STALE')rejectedStale++;else rejectedWeak++;}
        if(didChange&&old.fingerprint&&gate.ok&&!verificationCandidateExists_(ss,org,sourceUrl,activityFingerprint)){
          appendVerificationCandidate_(ss,org,sourceUrl,activity,activityFingerprint,now);candidateCount=1;candidates++;
        }
        upsertState_(stateSheet,old.row,[key,org,sourceUrl,access,activityFingerprint,activity.contentDate||'',didChange?fmt_(now):(old.lastChange||''),fmt_(now),fmt_(now),fmt_(nextCheck_(now,priority)),0,didChange&&candidateCount?fmt_(addDays_(now,LL_CONFIG.SOURCE_BOOST_DAYS)):(old.boostUntil||''),result.status,normalized.length,social.status+'; '+gate.label,'Yes']);
      }catch(err){failures++;if(access==='SURFACE')surfaceBlocked++;const now=new Date(),failCount=Number(old.failures||0)+1;upsertState_(stateSheet,old.row,[key,org,sourceUrl,access,old.fingerprint||'',old.lastContentDate||'',old.lastChange||'',fmt_(now),old.lastSuccess||'',fmt_(failureNextCheck_(now,priority,failCount)),failCount,old.boostUntil||'','','',String(err).slice(0,500),'Yes']);}
    }
    if(!forceScan)props.setProperty('LL_COLLECTOR_CURSOR',String(cursor>=rows.length?0:cursor));
    logSheet.appendRow([runId,fmt_(started),fmt_(new Date()),rows.length,checked,changed,candidates,failures,'Collector V2.0: '+(forceScan?'FORCE SCAN; DIRECT+SURFACE':'scheduled; DIRECT only')+'; direct='+directChecked+'; surface='+surfaceChecked+'; surface-readable='+surfaceReadable+'; surface-blocked='+surfaceBlocked+'; filtered-noise='+rejectedNoise+'; filtered-stale='+rejectedStale+'; filtered-weak='+rejectedWeak+'; batch='+considered+'/'+maxEndpoints+'; Sherlock rechecks='+sherlockChecks+'; review gate mandatory.']);
  } finally { lock.releaseLock(); }
}

function activityQualityGate_(activity,text,org,now){
  if(!activity.signals.length||!activity.snippets.length)return {ok:false,reason:'WEAK',label:'FILTERED WEAK'};
  if(!isLouisburgRelevant_(text,org))return {ok:false,reason:'WEAK',label:'FILTERED NOT LOUISBURG'};
  const c=activity.canonical.toLowerCase();
  const boiler=LL_CONFIG.BOILERPLATE_TERMS.filter(function(x){return c.indexOf(x)>=0;}).length;
  if(boiler>=2||looksLikeCode_(c))return {ok:false,reason:'NOISE',label:'FILTERED CODE/BOILERPLATE'};
  const dateInfo=detectActivityDate_(c,now); activity.contentDate=dateInfo.iso||activity.contentDate;
  if(dateInfo.past)return {ok:false,reason:'STALE',label:'FILTERED PAST DATE'};
  let score=0;
  score+=Math.min(activity.signals.length,3)*2;
  if(dateInfo.found)score+=3;
  if(/today|tonight|tomorrow|this weekend|limited time|available now|sold out|cancel|postpon|reschedul|closing early|closed today|now hiring|grand opening|registration open|register now/.test(c))score+=3;
  if(/\b\d{1,2}:\d{2}\s*(am|pm)\b|\b\d{1,2}\s*(am|pm)\b/.test(c))score+=1;
  const evergreen=LL_CONFIG.EVERGREEN_TERMS.filter(function(x){return c.indexOf(x)>=0;}).length;
  if(evergreen>=2&&!dateInfo.found)score-=4;
  if(/testimonial|verified client|our services|learn more|click here|follow us/.test(c)&&!dateInfo.found)score-=2;
  activity.qualityScore=score;
  return score>=LL_CONFIG.MIN_ACTIVITY_SCORE?{ok:true,reason:'OK',label:'ACTIVITY SCORE '+score}:{ok:false,reason:'WEAK',label:'FILTERED WEAK SCORE '+score};
}

function looksLikeCode_(s){
  const codeHits=(s.match(/pointer-events|font-size|background-color|artifactid|metasiteid|data-v-|window\.|function\s|\{\"|\\\//g)||[]).length;
  const punctuation=(s.match(/[{};<>]/g)||[]).length;
  return codeHits>=2||punctuation>Math.max(20,s.length*0.025);
}

function detectActivityDate_(text,now){
  const s=String(text||''), currentYear=Number(Utilities.formatDate(now,LL_CONFIG.TZ,'yyyy'));
  let m=s.match(/\b(20\d{2})[-\/]([01]?\d)[-\/]([0-3]?\d)\b/);
  let d=null;
  if(m)d=new Date(Number(m[1]),Number(m[2])-1,Number(m[3]));
  if(!d){m=s.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(20\d{2}))?\b/i);if(m){const months={january:0,jan:0,february:1,feb:1,march:2,mar:2,april:3,apr:3,may:4,june:5,jun:5,july:6,jul:6,august:7,aug:7,september:8,sep:8,sept:8,october:9,oct:9,november:10,nov:10,december:11,dec:11};d=new Date(Number(m[3]||currentYear),months[m[1].toLowerCase()],Number(m[2]));}}
  if(!d)return {found:false,past:false,iso:''};
  const today=new Date(now.getFullYear(),now.getMonth(),now.getDate()),ageDays=(today-d)/86400000;
  return {found:true,past:ageDays>LL_CONFIG.MAX_PAST_DAYS,iso:Utilities.formatDate(d,LL_CONFIG.TZ,'yyyy-MM-dd')};
}

function inspectSocialSurface_(url,text,html){const u=String(url||'').toLowerCase(),fb=/facebook\.com|fb\.com/.test(u),ig=/instagram\.com/.test(u);if(!fb&&!ig)return{readable:true,status:'DIRECT READABLE'};const h=String(text||'').toLowerCase(),raw=String(html||'').toLowerCase(),wall=/log in|login|create new account|sign up|accounts\/login|checkpoint/.test(h+' '+raw),post=/posted|photos|reel|followers|likes|comments|instagram|facebook/.test(h),meaningful=h.length>500&&post&&!wall;if(meaningful)return{readable:true,status:(fb?'FACEBOOK':'INSTAGRAM')+' SURFACE READABLE'};if(wall)return{readable:false,status:(fb?'FACEBOOK':'INSTAGRAM')+' LOGIN/INTERSTITIAL'};return{readable:false,status:(fb?'FACEBOOK':'INSTAGRAM')+' SURFACE LIMITED'};}
function extractActivity_(text){const signals=extractSignals_(text),snippets=[],seen={};signals.forEach(function(signal){let from=0,hits=0;while(hits<3){const pos=text.indexOf(signal,from);if(pos<0)break;const start=Math.max(0,pos-LL_CONFIG.ACTIVITY_SNIPPET_BEFORE),end=Math.min(text.length,pos+signal.length+LL_CONFIG.ACTIVITY_SNIPPET_AFTER),snippet=text.slice(start,end).replace(/\s+/g,' ').trim(),compact=snippet.replace(/[^a-z0-9]+/g,' ').trim(),key=digest_(compact).slice(0,16);if(snippet.length>=35&&!seen[key]){seen[key]=true;snippets.push(snippet);}if(snippets.length>=LL_CONFIG.ACTIVITY_MAX_SNIPPETS)break;from=pos+signal.length;hits++;}});snippets.sort();const canonical=snippets.join('\n');return{signals:signals,snippets:snippets,canonical:canonical,contentDate:detectContentDate_(canonical),qualityScore:0};}
function detectContentDate_(text){const iso=String(text||'').match(/\b(20\d{2})[-\/]([01]?\d)[-\/]([0-3]?\d)\b/);return iso?iso[1]+'-'+('0'+iso[2]).slice(-2)+'-'+('0'+iso[3]).slice(-2):'';}
function processSherlockRechecks_(ss){const sheet=ss.getSheetByName(LL_CONFIG.SHEETS.SHERLOCK);if(!sheet||sheet.getLastRow()<2)return 0;const data=sheet.getDataRange().getDisplayValues(),headers=data.shift(),ix=headerMap_(headers);let processed=0;for(let r=0;r<data.length&&processed<LL_CONFIG.SHERLOCK_RECHECK_LIMIT_PER_RUN;r++){const row=data[r],trigger=cell_(row,ix,'Auto Recheck Triggered').toLowerCase(),status=cell_(row,ix,'Moderation Status').toUpperCase(),sourceUrl=cell_(row,ix,'Supporting URL');if(!/^(yes|true|pending)$/i.test(trigger)||status==='REJECTED')continue;let resultText='No supporting URL supplied; source matching required.';if(sourceUrl&&/^https?:\/\//i.test(sourceUrl)){try{const fetched=fetchPublicSource_(sourceUrl),text=normalizeText_(fetched.body),activity=extractActivity_(text);resultText='HTTP '+fetched.status+'; current activity signals: '+(activity.signals.join(', ')||'none detected');}catch(err){resultText='Recheck failed: '+String(err).slice(0,300);}}if(ix['Recheck Result']!=null)sheet.getRange(r+2,ix['Recheck Result']+1).setValue(resultText);if(ix['Auto Recheck Triggered']!=null)sheet.getRange(r+2,ix['Auto Recheck Triggered']+1).setValue('DONE');processed++;}return processed;}
function fetchPublicSource_(url){let lastErr;for(let attempt=0;attempt<=LL_CONFIG.RETRY_COUNT;attempt++){try{const response=UrlFetchApp.fetch(url,{muteHttpExceptions:true,followRedirects:true,headers:{'User-Agent':LL_CONFIG.USER_AGENT,'Accept':'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'}}),status=response.getResponseCode();if(status===429||status>=500)throw new Error('Retryable HTTP '+status+' '+url);if(status<200||status>=400)throw new Error('HTTP '+status+' '+url);let body=response.getContentText();if(body.length>LL_CONFIG.MAX_BODY_CHARS)body=body.slice(0,LL_CONFIG.MAX_BODY_CHARS);return{status:status,body:body};}catch(err){lastErr=err;if(attempt<LL_CONFIG.RETRY_COUNT)Utilities.sleep(LL_CONFIG.RETRY_BASE_MS*Math.pow(2,attempt));}}throw lastErr;}
function normalizeText_(html){return String(html||'').replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<!--([\s\S]*?)-->/g,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&#39;/g,"'").replace(/&quot;/gi,'"').replace(/\s+/g,' ').trim().toLowerCase();}
function extractSignals_(text){return LL_CONFIG.KEYWORDS.filter(function(k){return text.indexOf(k)!==-1;}).slice(0,20);}
function isLouisburgRelevant_(text,org){const h=(text+' '+org).toLowerCase();return LL_CONFIG.LOUISBURG_TERMS.some(function(t){return h.indexOf(t)!==-1;});}
function appendVerificationCandidate_(ss,org,url,activity,activityFingerprint,now){const sheet=ss.getSheetByName(LL_CONFIG.SHEETS.VERIFY);if(!sheet)return;const preview=activity.snippets.slice(0,3).join(' | ').slice(0,900);sheet.appendRow([org,'Activity change candidate',preview||('Signals: '+activity.signals.join(', ')),'Verify exact new activity, date, Louisburg applicability and original destination before publication',url,'MEDIUM','OPEN - COLLECTOR',Utilities.formatDate(now,LL_CONFIG.TZ,'yyyy-MM-dd'),'','Activity fingerprint '+activityFingerprint.slice(0,16)+'; quality='+activity.qualityScore+'; signals: '+activity.signals.join(', ')+'. Content-level source must beat business-level source.']);}
function verificationCandidateExists_(ss,org,url,fingerprint){const sheet=ss.getSheetByName(LL_CONFIG.SHEETS.VERIFY);if(!sheet||sheet.getLastRow()<2)return false;const data=sheet.getDataRange().getDisplayValues(),needle=String(fingerprint||'').slice(0,16);for(let i=1;i<data.length;i++){if(String(data[i][0]).trim()===org&&String(data[i][4]).indexOf(url)!==-1&&/^OPEN/.test(String(data[i][6]).toUpperCase())&&(!needle||String(data[i][9]).indexOf(needle)!==-1))return true;}return false;}
function loadState_(sheet){const data=sheet.getDataRange().getDisplayValues(),out={};for(let r=1;r<data.length;r++){if(!data[r][0])continue;out[data[r][0]]={row:r+1,fingerprint:data[r][4],lastContentDate:data[r][5],lastChange:data[r][6],lastSuccess:data[r][8],nextCheck:data[r][9],failures:data[r][10],boostUntil:data[r][11]};}return out;}
function upsertState_(sheet,rowNumber,values){if(rowNumber)sheet.getRange(rowNumber,1,1,values.length).setValues([values]);else sheet.appendRow(values);}
function logSkippedRun_(message){try{const ss=SpreadsheetApp.openById(LL_CONFIG.SPREADSHEET_ID),sheet=ss.getSheetByName(LL_CONFIG.SHEETS.LOG);if(sheet)sheet.appendRow([Utilities.getUuid(),fmt_(new Date()),fmt_(new Date()),'',0,0,0,0,message]);}catch(ignored){}}
function headerMap_(headers){const m={};headers.forEach(function(h,i){m[String(h).trim()]=i;});return m;}
function cell_(row,ix,name){return ix[name]==null?'':String(row[ix[name]]||'').trim();}
function endpointKey_(org,url){return digest_((org+'|'+url).toLowerCase()).slice(0,24);}
function digest_(s){const b=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,s,Utilities.Charset.UTF_8);return b.map(function(x){return('0'+((x+256)%256).toString(16)).slice(-2);}).join('');}
function isDue_(v){if(!v)return true;const d=new Date(v);return isNaN(d)||d<=new Date();}
function nextCheck_(d,priority){const h=priority==='HIGH'?LL_CONFIG.HIGH_INTERVAL_HOURS:priority==='LOW'?LL_CONFIG.LOW_INTERVAL_HOURS:LL_CONFIG.MEDIUM_INTERVAL_HOURS;return new Date(d.getTime()+h*3600000);}
function failureNextCheck_(d,priority,failures){const normal=nextCheck_(d,priority),backoffHours=Math.min(Math.pow(2,Math.min(failures,5)),24);return new Date(Math.min(normal.getTime(),d.getTime()+backoffHours*3600000));}
function addDays_(d,days){return new Date(d.getTime()+days*86400000);}
function fmt_(d){return Utilities.formatDate(d,LL_CONFIG.TZ,'yyyy-MM-dd HH:mm:ss');}
