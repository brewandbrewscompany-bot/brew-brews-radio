function installLouisburgLocalCollectorTriggers() {
  removeLouisburgLocalCollectorTriggers();
  ScriptApp.newTrigger('runLouisburgLocalCollector').timeBased().everyHours(1).create();
  ScriptApp.newTrigger('processSocialPostIntake').timeBased().everyMinutes(5).create();
  ScriptApp.newTrigger('runLouisburgLocalMaintenance').timeBased().everyDays(1).atHour(3).create();
}

function removeLouisburgLocalCollectorTriggers() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    const fn = t.getHandlerFunction();
    if (fn === 'runLouisburgLocalCollector' || fn === 'processSocialPostIntake' || fn === 'runLouisburgLocalMaintenance') ScriptApp.deleteTrigger(t);
  });
}

function provisionLouisburgLocalSocialIntake() {
  const props=PropertiesService.getScriptProperties();
  let key=props.getProperty('LL_SOCIAL_INGEST_KEY');
  const created=!key;
  if(!key){
    key=(Utilities.getUuid()+Utilities.getUuid()).replace(/-/g,'');
    props.setProperty('LL_SOCIAL_INGEST_KEY',key);
  }
  installLouisburgLocalCollectorTriggers();
  Logger.log('Louisburg Local social intake provisioned: ingest-key='+(created?'created':'preserved')+'; social processor=every 5 minutes; collector=hourly; maintenance=daily.');
  return {ok:true,keyCreated:created,triggersInstalled:true};
}

function rotateLouisburgLocalSocialIngestKey() {
  const key=(Utilities.getUuid()+Utilities.getUuid()).replace(/-/g,'');
  PropertiesService.getScriptProperties().setProperty('LL_SOCIAL_INGEST_KEY',key);
  Logger.log('Louisburg Local social ingest key rotated. Existing senders must be updated before their next delivery.');
  return {ok:true,rotated:true};
}

function showLouisburgLocalSocialIngestKey() {
  const key=PropertiesService.getScriptProperties().getProperty('LL_SOCIAL_INGEST_KEY');
  if(!key)throw new Error('Social ingest key is not configured. Run provisionLouisburgLocalSocialIntake first.');
  Logger.log('LL_SOCIAL_INGEST_KEY='+key);
  return key;
}

function runLiveSocialIntakeEndpointSmokeTest() {
  const props=PropertiesService.getScriptProperties();
  const key=props.getProperty('LL_SOCIAL_INGEST_KEY');
  if(!key)throw new Error('Social ingest key is not configured. Run provisionLouisburgLocalSocialIntake first.');
  const url='https://script.google.com/macros/s/AKfycbxw9gJBH50L_VZbgp6i_mHHnfPXAkraIqv63BA2XqWtb-XaaczXxdf89WveFkAOwV-azw/exec';

  const ss=SpreadsheetApp.openById(LL_CONFIG.SPREADSHEET_ID);
  const intake=ss.getSheetByName('Social Post Intake');
  const verify=ss.getSheetByName(LL_CONFIG.SHEETS.VERIFY);
  if(!intake||!verify)throw new Error('Social intake or verification sheet missing.');

  const marker='LL_LIVE_SOCIAL_'+Utilities.getUuid().slice(0,8);
  const org='Louisburg Local Live Endpoint Test '+marker;
  const postUrl='https://example.com/'+marker+'/post';
  const payload={
    action:'social_intake',
    ingestKey:key,
    organization:org,
    platform:'LIVE-TEST',
    profileUrl:'https://example.com/'+marker+'/profile',
    postUrl:postUrl,
    postId:marker+'-post',
    postDate:new Date().toISOString(),
    postText:'Louisburg KS. Today only: live endpoint smoke test special until 8 PM.',
    louisburgMatch:'YES'
  };

  try {
    const response=UrlFetchApp.fetch(url,{method:'post',contentType:'application/json',payload:JSON.stringify(payload),muteHttpExceptions:true,followRedirects:true});
    const code=response.getResponseCode();
    const body=response.getContentText();
    let parsed={};
    try{parsed=JSON.parse(body);}catch(ignored){}
    if(code<200||code>=300||!parsed.ok||!parsed.received)throw new Error('Live endpoint rejected request: HTTP '+code+' '+body.slice(0,300));

    const summary=processSocialPostIntake();
    let queued=false;
    if(intake.getLastRow()>1){
      const data=intake.getDataRange().getDisplayValues(),ix=headerMap_(data[0]);
      for(let r=1;r<data.length;r++){
        if(String(data[r][ix['Business / Organization']]||'')===org&&String(data[r][ix['Post URL']]||'')===postUrl){
          queued=/^QUEUED FOR VERIFICATION/.test(String(data[r][ix['Worker Result']]||''));
          break;
        }
      }
    }
    if(!queued)throw new Error('Live endpoint accepted the post, but Social Intake did not queue it.');

    let verificationHits=0;
    if(verify.getLastRow()>1){
      const v=verify.getDataRange().getDisplayValues();
      for(let r=1;r<v.length;r++)if(String(v[r][0]||'')===org&&String(v[r][4]||'')===postUrl&&String(v[r][6]||'').toUpperCase()==='OPEN - SOCIAL')verificationHits++;
    }
    if(verificationHits!==1)throw new Error('Expected exactly one live Verification Queue candidate, found '+verificationHits);

    Logger.log('Live social intake endpoint smoke test passed: endpoint=accepted processor=queued verification=1; processor summary='+JSON.stringify(summary));
  } finally {
    cleanupLiveSocialEndpointTest_(intake,verify,org,marker);
  }
}

function cleanupLiveSocialEndpointTest_(intake,verify,org,marker){
  if(verify&&verify.getLastRow()>1){
    const data=verify.getDataRange().getDisplayValues();
    for(let r=data.length-1;r>=1;r--){
      if(String(data[r][0]||'')===org||String(data[r][4]||'').indexOf(marker)!==-1)verify.deleteRow(r+1);
    }
  }
  if(intake&&intake.getLastRow()>1){
    const data=intake.getDataRange().getDisplayValues(),ix=headerMap_(data[0]);
    const orgCol=ix['Business / Organization'],urlCol=ix['Post URL'];
    for(let r=data.length-1;r>=1;r--){
      if(String(data[r][orgCol]||'')===org||String(data[r][urlCol]||'').indexOf(marker)!==-1)intake.deleteRow(r+1);
    }
  }
}

function seedLouisburgLocalCollector() {
  // First pass establishes fingerprints. Existing source content is baseline,
  // not treated as a newly discovered item merely because state was empty.
  PropertiesService.getScriptProperties().deleteProperty('LL_COLLECTOR_CURSOR');
  runLouisburgLocalCollector();
}

function runLouisburgLocalMaintenance() {
  const ss = SpreadsheetApp.openById(LL_CONFIG.SPREADSHEET_ID);
  purgeOldSherlockAndReactionKeys_(ss);
}

function purgeOldSherlockAndReactionKeys_(ss) {
  // Retention is conservative. We clear pseudonymous submitter/session keys,
  // not the factual correction or aggregate reaction counts.
  const now = new Date();
  const sherlock = ss.getSheetByName(LL_CONFIG.SHEETS.SHERLOCK);
  if (sherlock && sherlock.getLastRow() > 1) {
    const data = sherlock.getDataRange().getDisplayValues();
    const ix = headerMap_(data[0]);
    for (let r = 1; r < data.length; r++) {
      const submitted = new Date(data[r][ix['Submitted At']]);
      const moderation = String(data[r][ix['Moderation Status']] || '').toUpperCase();
      const days = moderation === 'REJECTED' ? LL_CONFIG.RETENTION_DAYS_REJECTED_SHERLOCK : LL_CONFIG.RETENTION_DAYS_VALID_SHERLOCK;
      if (!isNaN(submitted) && now - submitted > days * 86400000 && ix['Submitter Key'] != null) {
        sherlock.getRange(r + 1, ix['Submitter Key'] + 1).clearContent();
      }
    }
  }

  const reactions = ss.getSheetByName('Reactions');
  if (reactions && reactions.getLastRow() > 1) {
    const data = reactions.getDataRange().getDisplayValues();
    const ix = headerMap_(data[0]);
    for (let r = 1; r < data.length; r++) {
      const submitted = new Date(data[r][ix['Submitted At']]);
      if (!isNaN(submitted) && now - submitted > LL_CONFIG.RETENTION_DAYS_REACTION_KEYS * 86400000) {
        if (ix['Session / User Key'] != null) reactions.getRange(r + 1, ix['Session / User Key'] + 1).clearContent();
        if (ix['Duplicate Check Key'] != null) reactions.getRange(r + 1, ix['Duplicate Check Key'] + 1).clearContent();
      }
    }
  }
}
