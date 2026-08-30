function runLouisburgLocalCollector() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(LL_CONFIG.LOCK_WAIT_MS)) {
    logSkippedRun_('Collector skipped: another run holds the script lock.');
    return;
  }

  try {
    const started = new Date();
    const runId = Utilities.getUuid();
    const ss = SpreadsheetApp.openById(LL_CONFIG.SPREADSHEET_ID);
    const endpointSheet = ss.getSheetByName(LL_CONFIG.SHEETS.ENDPOINTS);
    const stateSheet = ss.getSheetByName(LL_CONFIG.SHEETS.STATE);
    const logSheet = ss.getSheetByName(LL_CONFIG.SHEETS.LOG);
    if (!endpointSheet || !stateSheet || !logSheet) throw new Error('Collector sheets are missing.');

    const sherlockChecks = processSherlockRechecks_(ss);
    const raw = endpointSheet.getDataRange().getDisplayValues();
    if (raw.length < 2) return;
    const headers = raw.shift();
    const ix = headerMap_(headers);
    const state = loadState_(stateSheet);
    const props = PropertiesService.getScriptProperties();
    const startCursor = Math.max(0, Number(props.getProperty('LL_COLLECTOR_CURSOR') || 0));
    const rows = raw;

    let checked = 0, changed = 0, candidates = 0, failures = 0, considered = 0;
    let cursor = startCursor;
    let visited = 0;

    while (visited < rows.length && considered < LL_CONFIG.MAX_ENDPOINTS_PER_RUN) {
      if (cursor >= rows.length) cursor = 0;
      const row = rows[cursor]; cursor++; visited++;
      const sourceUrl = cell_(row, ix, 'Source URL');
      const active = cell_(row, ix, 'Active').toLowerCase();
      const access = cell_(row, ix, 'Access Method').toUpperCase();
      const org = cell_(row, ix, 'Business / Organization');
      const priority = cell_(row, ix, 'Feed Priority').toUpperCase() || 'MEDIUM';
      if (!sourceUrl || !/^(yes|true|active)$/i.test(active)) continue;
      if (LL_CONFIG.ALLOWED_ACCESS_METHODS.indexOf(access) === -1) continue;

      const key = endpointKey_(org, sourceUrl);
      const old = state[key] || {};
      if (!isDue_(old.nextCheck)) continue;
      considered++; checked++;

      try {
        const result = fetchPublicSource_(sourceUrl);
        const normalized = normalizeText_(result.body);
        const activity = extractActivity_(normalized);
        const activityFingerprint = digest_(activity.canonical || 'no-activity');
        const didChange = !old.fingerprint || old.fingerprint !== activityFingerprint;
        const now = new Date();
        if (didChange) changed++;

        let candidateCount = 0;
        if (didChange && old.fingerprint && activity.signals.length && isLouisburgRelevant_(normalized, org)) {
          if (!verificationCandidateExists_(ss, org, sourceUrl, activityFingerprint)) {
            appendVerificationCandidate_(ss, org, sourceUrl, activity, activityFingerprint, now);
            candidateCount = 1; candidates++;
          }
        }

        upsertState_(stateSheet, old.row, [
          key, org, sourceUrl, access, activityFingerprint, activity.contentDate || '',
          didChange ? fmt_(now) : (old.lastChange || ''), fmt_(now), fmt_(now),
          fmt_(nextCheck_(now, priority)), 0,
          didChange && candidateCount ? fmt_(addDays_(now, LL_CONFIG.SOURCE_BOOST_DAYS)) : (old.boostUntil || ''),
          result.status, normalized.length, '', 'Yes'
        ]);
      } catch (err) {
        failures++;
        const now = new Date();
        const failCount = Number(old.failures || 0) + 1;
        upsertState_(stateSheet, old.row, [
          key, org, sourceUrl, access, old.fingerprint || '', old.lastContentDate || '', old.lastChange || '',
          fmt_(now), old.lastSuccess || '', fmt_(failureNextCheck_(now, priority, failCount)), failCount,
          old.boostUntil || '', '', '', String(err).slice(0, 500), 'Yes'
        ]);
      }
    }

    props.setProperty('LL_COLLECTOR_CURSOR', String(cursor >= rows.length ? 0 : cursor));
    logSheet.appendRow([runId, fmt_(started), fmt_(new Date()), rows.length, checked, changed, candidates, failures,
      'Collector V1.2: activity fingerprints; batch=' + considered + '/' + LL_CONFIG.MAX_ENDPOINTS_PER_RUN +
      '; Sherlock rechecks=' + sherlockChecks + '; DIRECT only; review gate mandatory.']);
  } finally { lock.releaseLock(); }
}

function extractActivity_(text) {
  const signals = extractSignals_(text);
  const snippets = [];
  const seen = {};
  signals.forEach(function(signal) {
    let from = 0, hits = 0;
    while (hits < 3) {
      const pos = text.indexOf(signal, from);
      if (pos < 0) break;
      const start = Math.max(0, pos - LL_CONFIG.ACTIVITY_SNIPPET_BEFORE);
      const end = Math.min(text.length, pos + signal.length + LL_CONFIG.ACTIVITY_SNIPPET_AFTER);
      const snippet = text.slice(start, end).replace(/\s+/g, ' ').trim();
      const compact = snippet.replace(/[^a-z0-9]+/g, ' ').trim();
      const key = digest_(compact).slice(0, 16);
      if (snippet.length >= 35 && !seen[key]) { seen[key] = true; snippets.push(snippet); }
      if (snippets.length >= LL_CONFIG.ACTIVITY_MAX_SNIPPETS) break;
      from = pos + signal.length; hits++;
    }
  });
  snippets.sort();
  const canonical = snippets.join('\n');
  return {signals: signals, snippets: snippets, canonical: canonical, contentDate: detectContentDate_(canonical)};
}

function detectContentDate_(text) {
  const iso = String(text || '').match(/\b(20\d{2})[-\/]([01]?\d)[-\/]([0-3]?\d)\b/);
  if (iso) return iso[1] + '-' + ('0'+iso[2]).slice(-2) + '-' + ('0'+iso[3]).slice(-2);
  return '';
}

function processSherlockRechecks_(ss) {
  const sheet = ss.getSheetByName(LL_CONFIG.SHEETS.SHERLOCK);
  if (!sheet || sheet.getLastRow() < 2) return 0;
  const data = sheet.getDataRange().getDisplayValues(); const headers = data.shift(); const ix = headerMap_(headers); let processed = 0;
  for (let r = 0; r < data.length && processed < LL_CONFIG.SHERLOCK_RECHECK_LIMIT_PER_RUN; r++) {
    const row = data[r], trigger = cell_(row, ix, 'Auto Recheck Triggered').toLowerCase(), status = cell_(row, ix, 'Moderation Status').toUpperCase(), sourceUrl = cell_(row, ix, 'Supporting URL');
    if (!/^(yes|true|pending)$/i.test(trigger) || status === 'REJECTED') continue;
    let resultText = 'No supporting URL supplied; source matching required.';
    if (sourceUrl && /^https?:\/\//i.test(sourceUrl)) {
      try { const fetched = fetchPublicSource_(sourceUrl), text = normalizeText_(fetched.body), activity = extractActivity_(text); resultText = 'HTTP ' + fetched.status + '; current activity signals: ' + (activity.signals.join(', ') || 'none detected'); }
      catch (err) { resultText = 'Recheck failed: ' + String(err).slice(0, 300); }
    }
    if (ix['Recheck Result'] != null) sheet.getRange(r + 2, ix['Recheck Result'] + 1).setValue(resultText);
    if (ix['Auto Recheck Triggered'] != null) sheet.getRange(r + 2, ix['Auto Recheck Triggered'] + 1).setValue('DONE');
    processed++;
  } return processed;
}

function fetchPublicSource_(url) {
  let lastErr;
  for (let attempt = 0; attempt <= LL_CONFIG.RETRY_COUNT; attempt++) {
    try {
      const response = UrlFetchApp.fetch(url,{muteHttpExceptions:true,followRedirects:true,headers:{'User-Agent':LL_CONFIG.USER_AGENT,'Accept':'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'}});
      const status=response.getResponseCode(); if(status===429||status>=500)throw new Error('Retryable HTTP '+status+' '+url); if(status<200||status>=400)throw new Error('HTTP '+status+' '+url);
      let body=response.getContentText(); if(body.length>LL_CONFIG.MAX_BODY_CHARS)body=body.slice(0,LL_CONFIG.MAX_BODY_CHARS); return {status:status,body:body};
    } catch(err){lastErr=err;if(attempt<LL_CONFIG.RETRY_COUNT)Utilities.sleep(LL_CONFIG.RETRY_BASE_MS*Math.pow(2,attempt));}
  } throw lastErr;
}

function normalizeText_(html){return String(html||'').replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&#39;/g,"'").replace(/&quot;/gi,'"').replace(/\s+/g,' ').trim().toLowerCase();}
function extractSignals_(text){return LL_CONFIG.KEYWORDS.filter(function(k){return text.indexOf(k)!==-1;}).slice(0,20);}
function isLouisburgRelevant_(text,org){const h=(text+' '+org).toLowerCase();return LL_CONFIG.LOUISBURG_TERMS.some(function(t){return h.indexOf(t)!==-1;});}

function appendVerificationCandidate_(ss,org,url,activity,activityFingerprint,now){
  const sheet=ss.getSheetByName(LL_CONFIG.SHEETS.VERIFY);if(!sheet)return;
  const preview=activity.snippets.slice(0,3).join(' | ').slice(0,900);
  sheet.appendRow([org,'Activity change candidate',preview||('Signals: '+activity.signals.join(', ')),'Verify exact new activity, date, Louisburg applicability and original destination before publication',url,'MEDIUM','OPEN - COLLECTOR',Utilities.formatDate(now,LL_CONFIG.TZ,'yyyy-MM-dd'),'', 'Activity fingerprint '+activityFingerprint.slice(0,16)+'; signals: '+activity.signals.join(', ')+'. Content-level source must beat business-level source; never substitute a homepage image for a social/post image.']);
}
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
