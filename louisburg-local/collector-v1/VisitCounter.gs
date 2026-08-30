// Louisburg Local real visit counter.
// Counts at most one visit per browser session per Louisburg calendar day.
// Stores only a hashed visitor-day key; no IP address, account ID or raw browser session key.

function recordVisit_(body) {
  const sessionKey=String((body&&body.sessionKey)||'').trim();
  if(!sessionKey)throw new Error('Missing visit session key');

  const tz=(LL_CONFIG&&LL_CONFIG.TZ)||'America/Chicago';
  const now=new Date();
  const visitDate=Utilities.formatDate(now,tz,'yyyy-MM-dd');
  const visitorDayKey=digest_(['visit',visitDate,sessionKey].join('|')).slice(0,40);
  const ss=SpreadsheetApp.openById(LL_CONFIG.SPREADSHEET_ID);
  const sheet=ss.getSheetByName('Visits');
  if(!sheet)throw new Error('Visits sheet missing');

  const lock=LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const props=PropertiesService.getScriptProperties();
    let total=Number(props.getProperty('LL_PUBLIC_VISITS')||0);

    if(sheet.getLastRow()>1){
      const keys=sheet.getRange(2,4,sheet.getLastRow()-1,1).getDisplayValues();
      for(let r=0;r<keys.length;r++){
        if(String(keys[r][0]||'')===visitorDayKey){
          return {ok:true,duplicate:true,visitCount:total};
        }
      }
    }

    total++;
    sheet.appendRow([
      Utilities.getUuid(),
      visitDate,
      Utilities.formatDate(now,tz,'yyyy-MM-dd HH:mm:ss'),
      visitorDayKey,
      'Yes',
      'WEB',
      classifyVisitClient_(body&&body.clientClass),
      ''
    ]);
    props.setProperty('LL_PUBLIC_VISITS',String(total));
    return {ok:true,duplicate:false,visitCount:total};
  } finally {
    lock.releaseLock();
  }
}

function classifyVisitClient_(value){
  const v=String(value||'').toLowerCase();
  if(v==='mobile'||v==='tablet'||v==='desktop')return v.toUpperCase();
  return 'UNKNOWN';
}

function purgeOldVisitRows_(){
  const ss=SpreadsheetApp.openById(LL_CONFIG.SPREADSHEET_ID);
  const sheet=ss.getSheetByName('Visits');
  if(!sheet||sheet.getLastRow()<2)return {deleted:0};
  const tz=(LL_CONFIG&&LL_CONFIG.TZ)||'America/Chicago';
  const cutoff=new Date();
  cutoff.setDate(cutoff.getDate()-35);
  const cutoffDate=Utilities.formatDate(cutoff,tz,'yyyy-MM-dd');
  const data=sheet.getRange(2,1,sheet.getLastRow()-1,8).getDisplayValues();
  let deleted=0;
  for(let r=data.length-1;r>=0;r--){
    const d=String(data[r][1]||'');
    if(d&&d<cutoffDate){sheet.deleteRow(r+2);deleted++;}
  }
  return {deleted:deleted};
}

function rebuildVisitCountFromSheet(){
  const ss=SpreadsheetApp.openById(LL_CONFIG.SPREADSHEET_ID);
  const sheet=ss.getSheetByName('Visits');
  if(!sheet)throw new Error('Visits sheet missing');
  let total=0;
  if(sheet.getLastRow()>1){
    const vals=sheet.getRange(2,5,sheet.getLastRow()-1,1).getDisplayValues();
    vals.forEach(function(r){if(/^yes$/i.test(String(r[0]||'')))total++;});
  }
  PropertiesService.getScriptProperties().setProperty('LL_PUBLIC_VISITS',String(total));
  Logger.log('Visit count rebuilt from Visits sheet: '+total);
  return total;
}

function runVisitCounterSelfTest(){
  const props=PropertiesService.getScriptProperties();
  const previous=props.getProperty('LL_PUBLIC_VISITS');
  const ss=SpreadsheetApp.openById(LL_CONFIG.SPREADSHEET_ID);
  const sheet=ss.getSheetByName('Visits');
  if(!sheet)throw new Error('Visits sheet missing');

  const marker='LL_VISIT_TEST_'+Utilities.getUuid().slice(0,8);
  const beforeRows=sheet.getLastRow();
  const failures=[];
  try{
    const start=41;
    props.setProperty('LL_PUBLIC_VISITS',String(start));

    let missingBlocked=false;
    try{recordVisit_({sessionKey:''});}catch(e){missingBlocked=/missing visit session key/i.test(String(e));}
    if(!missingBlocked)failures.push('missing session key not blocked');

    const first=recordVisit_({sessionKey:marker+'-A',clientClass:'desktop'});
    if(!first.ok||first.duplicate||first.visitCount!==42)failures.push('first visit did not increment once');

    const duplicate=recordVisit_({sessionKey:marker+'-A',clientClass:'desktop'});
    if(!duplicate.ok||!duplicate.duplicate||duplicate.visitCount!==42)failures.push('duplicate visit was not suppressed');

    const second=recordVisit_({sessionKey:marker+'-B',clientClass:'mobile'});
    if(!second.ok||second.duplicate||second.visitCount!==43)failures.push('second visitor did not increment');

    const stored=Number(props.getProperty('LL_PUBLIC_VISITS')||0);
    if(stored!==43)failures.push('stored total mismatch');

    if(failures.length)throw new Error('Visit counter self-test failed: '+failures.join(' | '));
    Logger.log('Visit counter self-test passed: 5/5; first=counted duplicate=suppressed second=counted total=43');
  } finally {
    // Remove controlled rows by the marker-derived day keys, without touching real visits.
    if(sheet.getLastRow()>beforeRows){
      const data=sheet.getRange(2,1,sheet.getLastRow()-1,8).getDisplayValues();
      const today=Utilities.formatDate(new Date(),(LL_CONFIG&&LL_CONFIG.TZ)||'America/Chicago','yyyy-MM-dd');
      const keyA=digest_(['visit',today,marker+'-A'].join('|')).slice(0,40);
      const keyB=digest_(['visit',today,marker+'-B'].join('|')).slice(0,40);
      for(let r=data.length-1;r>=0;r--){
        if(data[r][3]===keyA||data[r][3]===keyB)sheet.deleteRow(r+2);
      }
    }
    if(previous==null)props.deleteProperty('LL_PUBLIC_VISITS'); else props.setProperty('LL_PUBLIC_VISITS',previous);
  }
}

function runLiveVisitEndpointSmokeTest(){
  const url='https://script.google.com/macros/s/AKfycbxw9gJBH50L_VZbgp6i_mHHnfPXAkraIqv63BA2XqWtb-XaaczXxdf89WveFkAOwV-azw/exec';
  const props=PropertiesService.getScriptProperties();
  const before=Number(props.getProperty('LL_PUBLIC_VISITS')||0);
  const sessionKey='LL_LIVE_VISIT_'+Utilities.getUuid();
  const response=UrlFetchApp.fetch(url,{
    method:'post',
    contentType:'application/json',
    payload:JSON.stringify({action:'visit',sessionKey:sessionKey,clientClass:'desktop'}),
    muteHttpExceptions:true,
    followRedirects:true
  });
  const code=response.getResponseCode();
  const body=response.getContentText();
  let parsed={};
  try{parsed=JSON.parse(body);}catch(ignored){}
  if(code<200||code>=300||!parsed.ok)throw new Error('Live visit endpoint rejected request: HTTP '+code+' '+body.slice(0,300));
  if(parsed.visitCount!==before+1)throw new Error('Live visit endpoint returned unexpected count: before='+before+' after='+parsed.visitCount);

  const duplicateResponse=UrlFetchApp.fetch(url,{
    method:'post',
    contentType:'application/json',
    payload:JSON.stringify({action:'visit',sessionKey:sessionKey,clientClass:'desktop'}),
    muteHttpExceptions:true,
    followRedirects:true
  });
  const duplicate=JSON.parse(duplicateResponse.getContentText()||'{}');
  if(!duplicate.ok||!duplicate.duplicate||duplicate.visitCount!==parsed.visitCount)throw new Error('Live visit duplicate suppression failed');
  Logger.log('Live visit endpoint smoke test passed: first=counted duplicate=suppressed visitCount='+parsed.visitCount);
}
