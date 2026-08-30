function runLouisburgLocalCollector() { runCollector_(false); }
function forceScanLouisburgLocal() { runCollector_(true); }

function runCollectorV21SelfTest() {
  const now = new Date(2026, 7, 30, 12, 0, 0);
  const cases = [
    {name:'testimonial cancel', text:'Louisburg KS. I got married here and everything was absolutely perfect. We cancelled the rest after our first meeting.', want:false},
    {name:'generic catering', text:'Louisburg KS. We cater any event including fund raisers, open houses, benefits, grand openings... the list is endless!', want:false},
    {name:'navigation tonight', text:'Louisburg KS. public calendar astronomical events general meetings earthsky tonight about us membership donate contact', want:false},
    {name:'stale market event', text:'Louisburg KS. live music friday october 31, 2023 1:00 pm. saturday october 15, 2022 10:00 am.', want:false},
    {name:'current live music', text:'Louisburg KS. Live music September 5, 2026 at 7:00 pm. Join us downtown.', want:true},
    {name:'new product current', text:'Louisburg KS. New coffee available now for a limited time.', want:true},
    {name:'closure today', text:'Louisburg KS. Closed today because of weather.', want:true},
    {name:'date driven event', text:'Louisburg KS. Dominoes September 2 at 1:00 pm in Fellowship Hall.', want:true}
  ];
  const failures = [];
  cases.forEach(function(tc) {
    const normalized = normalizeText_(tc.text);
    const activity = extractActivity_(normalized);
    const gate = activityQualityGate_(activity, normalized, 'Louisburg Test', now);
    if (gate.ok !== tc.want) failures.push(tc.name + ': expected ' + tc.want + ', got ' + gate.ok + ' (' + gate.label + ')');
  });
  if (failures.length) throw new Error('Collector V2.1 self-test failed: ' + failures.join(' | '));
  Logger.log('Collector V2.1 self-test passed: ' + cases.length + '/' + cases.length);
}

function runCollector_(forceScan) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(LL_CONFIG.LOCK_WAIT_MS)) { logSkippedRun_('Collector skipped: another run holds the script lock.'); return; }
  try {
    const started = new Date(), runId = Utilities.getUuid(), ss = SpreadsheetApp.openById(LL_CONFIG.SPREADSHEET_ID);
    const endpointSheet = ss.getSheetByName(LL_CONFIG.SHEETS.ENDPOINTS), stateSheet = ss.getSheetByName(LL_CONFIG.SHEETS.STATE), logSheet = ss.getSheetByName(LL_CONFIG.SHEETS.LOG);
    if (!endpointSheet || !stateSheet || !logSheet) throw new Error('Collector sheets are missing.');
    const sherlockChecks = processSherlockRechecks_(ss), raw = endpointSheet.getDataRange().getDisplayValues();
    if (raw.length < 2) return;
    const headers = raw.shift(), ix = headerMap_(headers), state = loadState_(stateSheet), props = PropertiesService.getScriptProperties();
    const startCursor = forceScan ? 0 : Math.max(0, Number(props.getProperty('LL_COLLECTOR_CURSOR') || 0)), rows = raw;
    const allowed = forceScan ? LL_CONFIG.FORCE_SCAN_ACCESS_METHODS : LL_CONFIG.ALLOWED_ACCESS_METHODS;
    const maxEndpoints = forceScan ? LL_CONFIG.FORCE_SCAN_MAX_ENDPOINTS : LL_CONFIG.MAX_ENDPOINTS_PER_RUN;
    let checked=0, changed=0, candidates=0, failures=0, considered=0, rejectedNoise=0, rejectedStale=0, rejectedWeak=0, rejectedContext=0;
    let directChecked=0, surfaceChecked=0, surfaceReadable=0, surfaceBlocked=0, cursor=startCursor, visited=0;
    while (visited < rows.length && considered < maxEndpoints) {
      if (cursor >= rows.length) cursor = 0;
      const row = rows[cursor]; cursor++; visited++;
      const sourceUrl=cell_(row,ix,'Source URL'), active=cell_(row,ix,'Active').toLowerCase(), access=cell_(row,ix,'Access Method').toUpperCase(), org=cell_(row,ix,'Business / Organization'), priority=cell_(row,ix,'Feed Priority').toUpperCase()||'MEDIUM';
      if (!sourceUrl || !/^(yes|true|active)$/i.test(active) || allowed.indexOf(access) === -1) continue;
      const key=endpointKey_(org,sourceUrl), old=state[key]||{};
      if (!forceScan && !isDue_(old.nextCheck)) continue;
      considered++; checked++; if (access==='SURFACE') surfaceChecked++; else directChecked++;
      try {
        const result=fetchPublicSource_(sourceUrl), normalized=normalizeText_(result.body), social=inspectSocialSurface_(sourceUrl,normalized,result.body);
        if (access==='SURFACE') { if (social.readable) surfaceReadable++; else surfaceBlocked++; }
        const activity=extractActivity_(normalized), now=new Date(), gate=activityQualityGate_(activity,normalized,org,now);
        const activityFingerprint=digest_(activity.canonical || ('no-activity|'+social.status+'|'+gate.label));
        const didChange=!old.fingerprint || old.fingerprint!==activityFingerprint;
        if (didChange) changed++;
        if (!gate.ok) {
          if (gate.reason==='NOISE') rejectedNoise++;
          else if (gate.reason==='STALE') rejectedStale++;
          else if (gate.reason==='CONTEXT') rejectedContext++;
          else rejectedWeak++;
        }
        let candidateCount=0;
        if (didChange && old.fingerprint && gate.ok && !verificationCandidateExists_(ss,org,sourceUrl,activityFingerprint)) {
          appendVerificationCandidate_(ss,org,sourceUrl,activity,activityFingerprint,now); candidateCount=1; candidates++;
        }
        upsertState_(stateSheet,old.row,[key,org,sourceUrl,access,activityFingerprint,activity.contentDate||'',didChange?fmt_(now):(old.lastChange||''),fmt_(now),fmt_(now),fmt_(nextCheck_(now,priority)),0,didChange&&candidateCount?fmt_(addDays_(now,LL_CONFIG.SOURCE_BOOST_DAYS)):(old.boostUntil||''),result.status,normalized.length,social.status+'; '+gate.label,'Yes']);
      } catch (err) {
        failures++; if (access==='SURFACE') surfaceBlocked++;
        const now=new Date(), failCount=Number(old.failures||0)+1;
        upsertState_(stateSheet,old.row,[key,org,sourceUrl,access,old.fingerprint||'',old.lastContentDate||'',old.lastChange||'',fmt_(now),old.lastSuccess||'',fmt_(failureNextCheck_(now,priority,failCount)),failCount,old.boostUntil||'','','',String(err).slice(0,500),'Yes']);
      }
    }
    if (!forceScan) props.setProperty('LL_COLLECTOR_CURSOR',String(cursor>=rows.length?0:cursor));
    logSheet.appendRow([runId,fmt_(started),fmt_(new Date()),rows.length,checked,changed,candidates,failures,'Collector V2.1: '+(forceScan?'FORCE SCAN; DIRECT+SURFACE':'scheduled; DIRECT only')+'; direct='+directChecked+'; surface='+surfaceChecked+'; surface-readable='+surfaceReadable+'; surface-blocked='+surfaceBlocked+'; filtered-noise='+rejectedNoise+'; filtered-stale='+rejectedStale+'; filtered-context='+rejectedContext+'; filtered-weak='+rejectedWeak+'; batch='+considered+'/'+maxEndpoints+'; Sherlock rechecks='+sherlockChecks+'; review gate mandatory.']);
  } finally { lock.releaseLock(); }
}

function activityQualityGate_(activity,text,org,now) {
  if (!activity.snippets.length) { activity.canonical=''; activity.signals=[]; return {ok:false,reason:'WEAK',label:'FILTERED NO ACTIVITY'}; }
  if (!isLouisburgRelevant_(text,org)) { activity.canonical=''; return {ok:false,reason:'WEAK',label:'FILTERED NOT LOUISBURG'}; }
  const kept=[]; let sawNoise=false, sawContext=false;
  activity.snippets.forEach(function(snippet){ const v=snippetContextGate_(snippet); if(v.ok)kept.push(snippet); else if(v.reason==='NOISE')sawNoise=true; else sawContext=true; });
  activity.snippets=uniqueStrings_(kept); activity.canonical=activity.snippets.join('\n'); activity.signals=extractSignals_(activity.canonical);
  if(activity.dateDriven&&activity.snippets.length)activity.signals.push('dated activity'); activity.signals=uniqueStrings_(activity.signals);
  if(!activity.snippets.length)return sawNoise?{ok:false,reason:'NOISE',label:'FILTERED CODE/BOILERPLATE'}:{ok:false,reason:'CONTEXT',label:'FILTERED CONTEXT/NOT ACTIVITY'};
  const c=activity.canonical.toLowerCase(); if(looksLikeCode_(c))return {ok:false,reason:'NOISE',label:'FILTERED CODE/BOILERPLATE'};
  const dates=analyzeActivityDates_(c,now); activity.contentDate=dates.bestIso||'';
  if(dates.pastOnly)return {ok:false,reason:'STALE',label:'FILTERED PAST DATE(S)'};
  const hasCurrent=/\b(today|tonight|tomorrow|this weekend|weekend only|limited time|available now|sold out|closing early|closed today|now hiring|registration open|register now|sale ends|starts today|ends today)\b/.test(c);
  const hasFreshProduct=/\b(new product|new coffee|new drink|new menu|launch|release|freshly roasted)\b/.test(c);
  const hasOperational=/\b(cancelled|canceled|postponed|delayed|rescheduled|closure|closed today|closing early|moved to|sold out)\b/.test(c);
  const hasGeneric=/\b(live music|concert|workshop|grand opening|fundraiser|festival|tickets|sign up|signup|promotion|discount|coupon|now open|on sale|deal)\b/.test(c);
  const hasTime=/\b\d{1,2}:\d{2}\s*(am|pm)\b|\b\d{1,2}\s*(am|pm)\b/.test(c);
  if(LL_CONFIG.REQUIRE_DATE_FOR_GENERIC_ACTIVITY&&hasGeneric&&!dates.hasCurrentOrFuture&&!hasCurrent&&!hasFreshProduct&&!hasOperational)return {ok:false,reason:'CONTEXT',label:'FILTERED GENERIC/UNDATED'};
  if(activity.dateDriven&&!activity.signals.filter(function(s){return s!=='dated activity';}).length&&!hasTime&&!dates.hasCurrentOrFuture)return {ok:false,reason:'WEAK',label:'FILTERED DATE WITHOUT ACTIVITY'};
  let score=0; const strong=activity.signals.filter(function(s){return s!=='dated activity';});
  score+=Math.min(strong.length,3)*2; if(dates.hasCurrentOrFuture)score+=4; if(hasTime)score+=2; if(hasCurrent)score+=4; if(hasFreshProduct)score+=3; if(hasOperational)score+=3; if(activity.dateDriven)score+=2;
  const evergreen=LL_CONFIG.EVERGREEN_TERMS.filter(function(x){return c.indexOf(x)>=0;}).length; if(evergreen>=2&&!dates.hasCurrentOrFuture&&!hasCurrent&&!hasFreshProduct)score-=4;
  activity.qualityScore=score;
  return score>=LL_CONFIG.MIN_ACTIVITY_SCORE?{ok:true,reason:'OK',label:'ACTIVITY SCORE '+score}:{ok:false,reason:'WEAK',label:'FILTERED WEAK SCORE '+score};
}

function snippetContextGate_(snippet) {
  const s=String(snippet||'').toLowerCase(); if(!s||s.length<35)return {ok:false,reason:'CONTEXT'}; if(looksLikeCode_(s))return {ok:false,reason:'NOISE'};
  if(LL_CONFIG.BOILERPLATE_TERMS.filter(function(x){return s.indexOf(x)>=0;}).length>=2)return {ok:false,reason:'NOISE'};
  if(LL_CONFIG.TESTIMONIAL_TERMS.filter(function(x){return s.indexOf(x)>=0;}).length>=1)return {ok:false,reason:'CONTEXT'};
  if(/we cater any event.*fund.?rais|fund.?raisers?,?\s+open houses?,?\s+benefits?,?\s+grand openings?/i.test(s))return {ok:false,reason:'CONTEXT'};
  if(/weddings?, birthdays?, fundraisers?.*(event planning|floral design|rentals?)/i.test(s))return {ok:false,reason:'CONTEXT'};
  if(/sign up for updates|be the first to know|marketing and promotional materials/i.test(s))return {ok:false,reason:'CONTEXT'};
  if(/earthsky tonight|public calendar astronomical events|general meetings hoasp resources/i.test(s))return {ok:false,reason:'CONTEXT'};
  const nav=LL_CONFIG.NAVIGATION_TERMS.filter(function(x){return s.indexOf(x)>=0;}).length, date=containsDateLike_(s), time=/\b\d{1,2}:\d{2}\s*(am|pm)\b|\b\d{1,2}\s*(am|pm)\b/.test(s), current=/\b(today|tonight|tomorrow|this weekend|limited time|available now|closed today|now hiring|registration open|register now)\b/.test(s);
  if(nav>=1&&!date&&!time&&!current)return {ok:false,reason:'CONTEXT'};
  const evergreen=LL_CONFIG.EVERGREEN_TERMS.filter(function(x){return s.indexOf(x)>=0;}).length;
  if(evergreen>=2&&!date&&!time&&!current&&!/\b(new product|new coffee|new drink|new menu|launch|release|freshly roasted)\b/.test(s))return {ok:false,reason:'CONTEXT'};
  return {ok:true,reason:'OK'};
}

function extractActivity_(text) {
  const source=String(text||''), signals=extractSignals_(source), snippets=[], seen={}; let dateDriven=false;
  function addAt_(pos,len,fromDate){const start=Math.max(0,pos-LL_CONFIG.ACTIVITY_SNIPPET_BEFORE),end=Math.min(source.length,pos+len+LL_CONFIG.ACTIVITY_SNIPPET_AFTER),snippet=source.slice(start,end).replace(/\s+/g,' ').trim(),compact=snippet.replace(/[^a-z0-9]+/g,' ').trim();if(snippet.length<35||!compact)return;const key=digest_(compact).slice(0,16);if(!seen[key]&&snippets.length<LL_CONFIG.ACTIVITY_MAX_SNIPPETS){seen[key]=true;snippets.push(snippet);if(fromDate)dateDriven=true;}}
  signals.forEach(function(signal){let from=0,hits=0;while(hits<3&&snippets.length<LL_CONFIG.ACTIVITY_MAX_SNIPPETS){const pos=source.indexOf(signal,from);if(pos<0)break;addAt_(pos,signal.length,false);from=pos+signal.length;hits++;}});
  const dateRe=/\b20\d{2}[-\/][01]?\d[-\/][0-3]?\d\b|\b(?:january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\.?\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+20\d{2})?\b/gi;let m,dateHits=0;
  while((m=dateRe.exec(source))&&dateHits<12&&snippets.length<LL_CONFIG.ACTIVITY_MAX_SNIPPETS){const probe=source.slice(Math.max(0,m.index-90),Math.min(source.length,m.index+m[0].length+140));if(looksDateActivityLike_(probe))addAt_(m.index,m[0].length,true);dateHits++;}
  snippets.sort();return {signals:uniqueStrings_(signals),snippets:snippets,canonical:snippets.join('\n'),contentDate:'',qualityScore:0,dateDriven:dateDriven};
}
function looksDateActivityLike_(s){const t=String(s||'').toLowerCase();return /\b\d{1,2}:\d{2}\s*(am|pm)\b|\b\d{1,2}\s*(am|pm)\b/.test(t)||/\b(event|meeting|class|workshop|concert|music|game|market|festival|sale|special|register|registration|closed|closure|opening|open house|dominoes|storytime|tour|practice|tryout|fundraiser)\b/.test(t);}
function analyzeActivityDates_(text,now){const s=String(text||''),dates=[],currentYear=Number(Utilities.formatDate(now,LL_CONFIG.TZ,'yyyy'));let m;const iso=/\b(20\d{2})[-\/]([01]?\d)[-\/]([0-3]?\d)\b/g;while((m=iso.exec(s)))add_(Number(m[1]),Number(m[2])-1,Number(m[3]));const mon=/\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(20\d{2}))?\b/gi,months={january:0,jan:0,february:1,feb:1,march:2,mar:2,april:3,apr:3,may:4,june:5,jun:5,july:6,jul:6,august:7,aug:7,september:8,sep:8,sept:8,october:9,oct:9,november:10,nov:10,december:11,dec:11};while((m=mon.exec(s)))add_(Number(m[3]||currentYear),months[m[1].toLowerCase()],Number(m[2]));function add_(y,mo,d){const x=new Date(y,mo,d,12,0,0);if(!isNaN(x.getTime()))dates.push(x);}if(!dates.length)return {found:false,hasCurrentOrFuture:false,pastOnly:false,bestIso:''};const today=new Date(now.getFullYear(),now.getMonth(),now.getDate(),12,0,0);let future=false,past=false,best=null,bestMs=Infinity;dates.forEach(function(x){const delta=x.getTime()-today.getTime();if(delta>=0){future=true;if(delta<bestMs){bestMs=delta;best=x;}}else{past=true;if(!best&&Math.abs(delta)<bestMs){bestMs=Math.abs(delta);best=x;}}});return {found:true,hasCurrentOrFuture:future,pastOnly:past&&!future,bestIso:best?Utilities.formatDate(best,LL_CONFIG.TZ,'yyyy-MM-dd'):''};}
function containsDateLike_(s){return /\b20\d{2}[-\/][01]?\d[-\/][0-3]?\d\b|\b(?:january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\.?\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+20\d{2})?\b/i.test(String(s||''));}
function looksLikeCode_(s){const t=String(s||'').toLowerCase(),hits=(t.match(/pointer-events|font-size|background-color|artifactid|metasiteid|siteassetstestmoduleversion|wixdevelopersanalytics|window\.|function\s|requesturl|xsrftoken|appdefid|instanceid/g)||[]).length,p=(t.match(/[{};<>]/g)||[]).length,long=(t.match(/\b[a-z0-9_-]{80,}\b/g)||[]).length;return hits>=2||long>=2||p>Math.max(20,t.length*.025);}
function inspectSocialSurface_(url,text,html){const u=String(url||'').toLowerCase(),fb=/facebook\.com|fb\.com/.test(u),ig=/instagram\.com/.test(u);if(!fb&&!ig)return {readable:true,status:'DIRECT READABLE'};const h=String(text||'').toLowerCase(),raw=String(html||'').toLowerCase(),wall=/log in|login|create new account|sign up|accounts\/login|checkpoint/.test(h+' '+raw),post=/posted|photos|reel|followers|likes|comments|instagram|facebook/.test(h),meaningful=h.length>500&&post&&!wall;if(meaningful)return {readable:true,status:(fb?'FACEBOOK':'INSTAGRAM')+' SURFACE READABLE'};if(wall)return {readable:false,status:(fb?'FACEBOOK':'INSTAGRAM')+' LOGIN/INTERSTITIAL'};return {readable:false,status:(fb?'FACEBOOK':'INSTAGRAM')+' SURFACE LIMITED'};}
function processSherlockRechecks_(ss){const sheet=ss.getSheetByName(LL_CONFIG.SHEETS.SHERLOCK);if(!sheet||sheet.getLastRow()<2)return 0;const data=sheet.getDataRange().getDisplayValues(),headers=data.shift(),ix=headerMap_(headers);let processed=0;for(let r=0;r<data.length&&processed<LL_CONFIG.SHERLOCK_RECHECK_LIMIT_PER_RUN;r++){const row=data[r],trigger=cell_(row,ix,'Auto Recheck Triggered').toLowerCase(),status=cell_(row,ix,'Moderation Status').toUpperCase(),sourceUrl=cell_(row,ix,'Supporting URL');if(!/^(yes|true|pending)$/i.test(trigger)||status==='REJECTED')continue;let resultText='No supporting URL supplied; source matching required.';if(sourceUrl&&/^https?:\/\//i.test(sourceUrl)){try{const fetched=fetchPublicSource_(sourceUrl),text=normalizeText_(fetched.body),activity=extractActivity_(text),gate=activityQualityGate_(activity,text,'',new Date());resultText='HTTP '+fetched.status+'; '+gate.label+'; current signals: '+(activity.signals.join(', ')||'none detected');}catch(err){resultText='Recheck failed: '+String(err).slice(0,300);}}if(ix['Recheck Result']!=null)sheet.getRange(r+2,ix['Recheck Result']+1).setValue(resultText);if(ix['Auto Recheck Triggered']!=null)sheet.getRange(r+2,ix['Auto Recheck Triggered']+1).setValue('DONE');processed++;}return processed;}
function fetchPublicSource_(url){let lastErr;for(let attempt=0;attempt<=LL_CONFIG.RETRY_COUNT;attempt++){try{const response=UrlFetchApp.fetch(url,{muteHttpExceptions:true,followRedirects:true,headers:{'User-Agent':LL_CONFIG.USER_AGENT,'Accept':'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'}}),status=response.getResponseCode();if(status===429||status>=500)throw new Error('Retryable HTTP '+status+' '+url);if(status<200||status>=400)throw new Error('HTTP '+status+' '+url);let body=response.getContentText();if(body.length>LL_CONFIG.MAX_BODY_CHARS)body=body.slice(0,LL_CONFIG.MAX_BODY_CHARS);return {status:status,body:body};}catch(err){lastErr=err;if(attempt<LL_CONFIG.RETRY_COUNT)Utilities.sleep(LL_CONFIG.RETRY_BASE_MS*Math.pow(2,attempt));}}throw lastErr;}
function normalizeText_(html){return String(html||'').replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<!--([\s\S]*?)-->/g,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&#39;/g,"'").replace(/&quot;/gi,'"').replace(/&#x27;/gi,"'").replace(/&#x2f;/gi,'/').replace(/\s+/g,' ').trim().toLowerCase();}
function extractSignals_(text){const t=String(text||'');return LL_CONFIG.KEYWORDS.filter(function(k){return t.indexOf(k)!==-1;}).slice(0,20);}
function isLouisburgRelevant_(text,org){const h=(String(text||'')+' '+String(org||'')).toLowerCase();return LL_CONFIG.LOUISBURG_TERMS.some(function(t){return h.indexOf(t)!==-1;});}
function appendVerificationCandidate_(ss,org,url,activity,fingerprint,now){const sheet=ss.getSheetByName(LL_CONFIG.SHEETS.VERIFY);if(!sheet)return;const preview=activity.snippets.slice(0,3).join(' | ').slice(0,900);sheet.appendRow([org,'Activity change candidate',preview||('Signals: '+activity.signals.join(', ')),'Verify exact new activity, date, Louisburg applicability and original destination before publication',url,'MEDIUM','OPEN - COLLECTOR',Utilities.formatDate(now,LL_CONFIG.TZ,'yyyy-MM-dd'),'','Activity fingerprint '+fingerprint.slice(0,16)+'; quality='+activity.qualityScore+'; signals: '+activity.signals.join(', ')+'. V2.1 contextual filter passed. Content-level source must beat business-level source.']);}
function verificationCandidateExists_(ss,org,url,fingerprint){const sheet=ss.getSheetByName(LL_CONFIG.SHEETS.VERIFY);if(!sheet||sheet.getLastRow()<2)return false;const data=sheet.getDataRange().getDisplayValues(),needle=String(fingerprint||'').slice(0,16);for(let i=1;i<data.length;i++){if(String(data[i][0]).trim()===org&&String(data[i][4]).indexOf(url)!==-1&&/^OPEN/.test(String(data[i][6]).toUpperCase())&&(!needle||String(data[i][9]).indexOf(needle)!==-1))return true;}return false;}
function loadState_(sheet){const data=sheet.getDataRange().getDisplayValues(),out={};for(let r=1;r<data.length;r++){if(!data[r][0])continue;out[data[r][0]]={row:r+1,fingerprint:data[r][4],lastContentDate:data[r][5],lastChange:data[r][6],lastSuccess:data[r][8],nextCheck:data[r][9],failures:data[r][10],boostUntil:data[r][11]};}return out;}
function upsertState_(sheet,row,values){if(row)sheet.getRange(row,1,1,values.length).setValues([values]);else sheet.appendRow(values);}
function logSkippedRun_(message){try{const ss=SpreadsheetApp.openById(LL_CONFIG.SPREADSHEET_ID),sheet=ss.getSheetByName(LL_CONFIG.SHEETS.LOG);if(sheet)sheet.appendRow([Utilities.getUuid(),fmt_(new Date()),fmt_(new Date()),'',0,0,0,0,message]);}catch(ignored){}}
function headerMap_(headers){const m={};headers.forEach(function(h,i){m[String(h).trim()]=i;});return m;}
function cell_(row,ix,name){return ix[name]==null?'':String(row[ix[name]]||'').trim();}
function endpointKey_(org,url){return digest_((org+'|'+url).toLowerCase()).slice(0,24);}
function digest_(s){const b=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,s,Utilities.Charset.UTF_8);return b.map(function(x){return ('0'+((x+256)%256).toString(16)).slice(-2);}).join('');}
function uniqueStrings_(arr){const seen={};return (arr||[]).filter(function(v){const k=String(v||'').trim();if(!k||seen[k])return false;seen[k]=true;return true;});}
function isDue_(v){if(!v)return true;const d=new Date(v);return isNaN(d)||d<=new Date();}
function nextCheck_(d,p){const h=p==='HIGH'?LL_CONFIG.HIGH_INTERVAL_HOURS:p==='LOW'?LL_CONFIG.LOW_INTERVAL_HOURS:LL_CONFIG.MEDIUM_INTERVAL_HOURS;return new Date(d.getTime()+h*3600000);}
function failureNextCheck_(d,p,f){const normal=nextCheck_(d,p),backoff=Math.min(Math.pow(2,Math.min(f,5)),24);return new Date(Math.min(normal.getTime(),d.getTime()+backoff*3600000));}
function addDays_(d,days){return new Date(d.getTime()+days*86400000);}
function fmt_(d){return Utilities.formatDate(d,LL_CONFIG.TZ,'yyyy-MM-dd HH:mm:ss');}
