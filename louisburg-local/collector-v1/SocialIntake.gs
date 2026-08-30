// Louisburg Local social activity intake bridge.
// Public social posts are normalized here before the mandatory Verification Queue review gate.
// No business credentials, cookies, or private-session data belong in this file.

function runSocialIntakeSelfTest() {
  const now = new Date(2026, 7, 30, 13, 30, 0);
  const cases = [
    {name:'fresh special', text:'Louisburg KS. Today only: burger basket special until 8 PM.', postDate:'2026-08-30T12:00:00-05:00', want:true},
    {name:'fresh live music', text:'Louisburg KS. Live music tomorrow at 7 PM.', postDate:'2026-08-30T10:00:00-05:00', want:true},
    {name:'fresh hiring', text:'Louisburg KS. We are now hiring part-time help. Apply today.', postDate:'2026-08-29T10:00:00-05:00', want:true},
    {name:'fresh new product', text:'Louisburg KS. New fall drink available now.', postDate:'2026-08-30T09:00:00-05:00', want:true},
    {name:'fresh stock arrival', text:'Fresh apples have officially arrived at our Louisburg Country Store.', postDate:'2026-08-29T09:00:00-05:00', want:true},
    {name:'old generic post', text:'Louisburg KS. Check out our menu and services.', postDate:'2026-07-01T09:00:00-05:00', want:false},
    {name:'navigation boilerplate', text:'Louisburg KS. Home About Contact Follow us Privacy Policy.', postDate:'2026-08-30T09:00:00-05:00', want:false},
    {name:'not louisburg', text:'Join us tonight for live music in Overland Park.', postDate:'2026-08-30T09:00:00-05:00', want:false}
  ];
  const failures=[];
  cases.forEach(function(tc){
    const result=socialPostGate_({text:tc.text,postDate:tc.postDate,louisburgMatch:/louisburg/i.test(tc.text)?'YES':'NO'},now);
    if(result.ok!==tc.want)failures.push(tc.name+': expected '+tc.want+', got '+result.ok+' ('+result.reason+')');
  });
  if(failures.length)throw new Error('Social Intake self-test failed: '+failures.join(' | '));
  Logger.log('Social Intake self-test passed: '+cases.length+'/'+cases.length);
}

function runSocialIntakePipelineTest() {
  const ss=SpreadsheetApp.openById(LL_CONFIG.SPREADSHEET_ID);
  const intake=ss.getSheetByName('Social Post Intake');
  const verify=ss.getSheetByName(LL_CONFIG.SHEETS.VERIFY);
  if(!intake||!verify)throw new Error('Social intake or verification sheet missing.');

  const marker='LL_PIPELINE_TEST_'+Utilities.getUuid().slice(0,8);
  const org='Louisburg Local Pipeline Test '+marker;
  const now=new Date();
  const fresh=now.toISOString();
  const stale=new Date(now.getTime()-30*86400000).toISOString();
  const start=intake.getLastRow()+1;
  const profile='https://example.com/'+marker+'/profile';
  const post='https://example.com/'+marker+'/post-1';
  const text='Louisburg KS. Today only: pipeline test burger basket special until 8 PM.';

  const rows=[
    [marker+'-1','',org,'TEST',profile,post,'same-post',fresh,fmt_(now),text,'','','','YES','','PENDING','','','','PIPELINE TEST '+marker],
    [marker+'-2','',org,'TEST',profile,'https://example.com/'+marker+'/stale','stale-post',stale,fmt_(now),'Louisburg KS. Check out our menu and services.','','','','YES','','PENDING','','','','PIPELINE TEST '+marker],
    [marker+'-3','',org,'TEST',profile,'https://example.com/'+marker+'/not-local','not-local',fresh,fmt_(now),'Join us tonight for live music in Overland Park.','','','','NO','','PENDING','','','','PIPELINE TEST '+marker],
    [marker+'-4','',org,'TEST',profile,post,'same-post',fresh,fmt_(now),text,'','','','YES','','PENDING','','','','PIPELINE TEST '+marker]
  ];

  let summary=null;
  try {
    intake.getRange(start,1,rows.length,20).setValues(rows);
    SpreadsheetApp.flush();
    summary=processSocialPostIntake();
    SpreadsheetApp.flush();

    const out=intake.getRange(start,1,rows.length,20).getDisplayValues();
    const failures=[];
    if(!/^QUEUED FOR VERIFICATION/.test(String(out[0][15]||'')))failures.push('fresh activity was not queued');
    if(String(out[1][15]||'')!=='REJECTED - STALE SOCIAL POST')failures.push('stale post was not rejected as stale');
    if(String(out[2][15]||'')!=='REJECTED - NOT LOUISBURG')failures.push('non-Louisburg post was not rejected');
    if(String(out[3][15]||'')!=='DUPLICATE')failures.push('same-run duplicate was not deduped');

    let verificationHits=0;
    if(verify.getLastRow()>1){
      const v=verify.getDataRange().getDisplayValues();
      for(let r=1;r<v.length;r++)if(String(v[r][0]||'')===org&&String(v[r][6]||'').toUpperCase()==='OPEN - SOCIAL')verificationHits++;
    }
    if(verificationHits!==1)failures.push('expected exactly 1 Verification Queue candidate, found '+verificationHits);
    if(summary.queued!==1||summary.rejected!==2||summary.duplicates!==1)failures.push('processor summary mismatch: '+JSON.stringify(summary));

    if(failures.length)throw new Error('Social Intake pipeline test failed: '+failures.join(' | '));
    Logger.log('Social Intake pipeline test passed: 4/4; queued=1 rejected=2 duplicate=1; verification=1');
  } finally {
    cleanupSocialPipelineTest_(intake,verify,marker,org);
  }
}

function cleanupSocialPipelineTest_(intake,verify,marker,org){
  if(verify&&verify.getLastRow()>1){
    const data=verify.getDataRange().getDisplayValues();
    for(let r=data.length-1;r>=1;r--){
      if(String(data[r][0]||'')===org||String(data[r][9]||'').indexOf(marker)!==-1)verify.deleteRow(r+1);
    }
  }
  if(intake&&intake.getLastRow()>1){
    const data=intake.getDataRange().getDisplayValues();
    for(let r=data.length-1;r>=1;r--){
      if(String(data[r][0]||'').indexOf(marker)===0||String(data[r][19]||'').indexOf(marker)!==-1)intake.deleteRow(r+1);
    }
  }
}

function processSocialPostIntake() {
  const ss=SpreadsheetApp.openById(LL_CONFIG.SPREADSHEET_ID);
  const sheet=ss.getSheetByName('Social Post Intake');
  const verify=ss.getSheetByName(LL_CONFIG.SHEETS.VERIFY);
  if(!sheet||!verify)throw new Error('Social intake or verification sheet missing.');
  if(sheet.getLastRow()<2)return {processed:0,queued:0,rejected:0,duplicates:0};
  const data=sheet.getDataRange().getDisplayValues(),headers=data[0],ix=headerMap_(headers),now=new Date();
  let processed=0,queued=0,rejected=0,duplicates=0;
  const seenThisRun={};
  for(let r=1;r<data.length;r++){
    const row=data[r],worker=cell_(row,ix,'Worker Result').toUpperCase();
    if(/^(QUEUED|REJECTED|DUPLICATE|PROMOTED|DONE)/.test(worker))continue;
    const payload={
      intakeId:cell_(row,ix,'Intake ID'),queueId:cell_(row,ix,'Queue ID'),organization:cell_(row,ix,'Business / Organization'),platform:cell_(row,ix,'Platform'),profileUrl:cell_(row,ix,'Profile URL'),postUrl:cell_(row,ix,'Post URL'),postId:cell_(row,ix,'Post ID'),postDate:cell_(row,ix,'Post Date / Time'),capturedAt:cell_(row,ix,'Captured At'),text:cell_(row,ix,'Post Text'),mediaUrl:cell_(row,ix,'Media URL'),mediaType:cell_(row,ix,'Media Type'),activityType:cell_(row,ix,'Activity Type'),louisburgMatch:cell_(row,ix,'Louisburg Match')
    };
    if(!payload.organization||!payload.postUrl||!payload.text)continue;
    processed++;
    const gate=socialPostGate_(payload,now),fingerprint=socialFingerprint_(payload);
    setSocialValue_(sheet,r+1,ix,'Activity Fingerprint',fingerprint);
    if(seenThisRun[fingerprint]||socialFingerprintExistsElsewhere_(data,ix,r,fingerprint)){
      duplicates++;
      seenThisRun[fingerprint]=true;
      setSocialValue_(sheet,r+1,ix,'Worker Result','DUPLICATE');
      setSocialValue_(sheet,r+1,ix,'Verification Status','DUPLICATE');
      setSocialValue_(sheet,r+1,ix,'Hub Eligibility','NO');
      continue;
    }
    seenThisRun[fingerprint]=true;
    if(!gate.ok){
      rejected++;
      setSocialValue_(sheet,r+1,ix,'Worker Result','REJECTED - '+gate.reason);
      setSocialValue_(sheet,r+1,ix,'Verification Status','REJECTED');
      setSocialValue_(sheet,r+1,ix,'Hub Eligibility','NO');
      setSocialValue_(sheet,r+1,ix,'Notes',gate.reason);
      continue;
    }
    const activityType=payload.activityType||gate.activityType;
    setSocialValue_(sheet,r+1,ix,'Activity Type',activityType);
    setSocialValue_(sheet,r+1,ix,'Worker Result','QUEUED FOR VERIFICATION');
    setSocialValue_(sheet,r+1,ix,'Verification Status','OPEN - SOCIAL');
    setSocialValue_(sheet,r+1,ix,'Hub Eligibility','REVIEW');
    if(!socialVerificationExists_(verify,payload.postUrl,fingerprint)){
      verify.appendRow([
        payload.organization,
        'Social activity candidate',
        payload.text.slice(0,900),
        'Verify exact activity, Louisburg applicability, timing and content-level original post before publication',
        payload.postUrl,
        'HIGH',
        'OPEN - SOCIAL',
        Utilities.formatDate(now,LL_CONFIG.TZ,'yyyy-MM-dd'),
        '',
        'Social fingerprint '+fingerprint.slice(0,16)+'; platform='+payload.platform+'; activity='+activityType+'; media='+(payload.mediaUrl||'none')+'. Content-level source must beat business-level source.'
      ]);
    }
    queued++;
  }
  return {processed:processed,queued:queued,rejected:rejected,duplicates:duplicates};
}

function recordSocialIntakeWebhook_(body) {
  requireSocialIngestKey_(body);
  const ss=SpreadsheetApp.openById(LL_CONFIG.SPREADSHEET_ID),sheet=ss.getSheetByName('Social Post Intake');
  if(!sheet)throw new Error('Social Post Intake sheet missing.');
  const platform=String(body.platform||'').trim().toUpperCase();
  const postUrl=String(body.postUrl||'').trim(),profileUrl=String(body.profileUrl||'').trim(),text=String(body.postText||body.text||'').trim();
  const org=String(body.organization||body.business||'').trim();
  if(!org||!postUrl||!text||!/^https?:\/\//i.test(postUrl))throw new Error('Missing social post fields.');
  const payload={organization:org,platform:platform,profileUrl:profileUrl,postUrl:postUrl,postId:String(body.postId||'').trim(),postDate:String(body.postDate||'').trim(),capturedAt:fmt_(new Date()),text:text,mediaUrl:String(body.mediaUrl||'').trim(),mediaType:String(body.mediaType||'').trim(),activityType:String(body.activityType||'').trim(),louisburgMatch:String(body.louisburgMatch||'').trim()};
  const fingerprint=socialFingerprint_(payload);
  if(socialFingerprintInSheet_(sheet,fingerprint))return {ok:true,duplicate:true,fingerprint:fingerprint};
  sheet.appendRow([Utilities.getUuid(),String(body.queueId||''),org,platform,profileUrl,postUrl,payload.postId,payload.postDate,payload.capturedAt,text,payload.mediaUrl,payload.mediaType,payload.activityType,payload.louisburgMatch,fingerprint,'PENDING','','','','Webhook intake; review gate mandatory.']);
  return {ok:true,duplicate:false,fingerprint:fingerprint};
}

function getSocialWorkerManifest_(body) {
  requireSocialIngestKey_(body);
  const ss=SpreadsheetApp.openById(LL_CONFIG.SPREADSHEET_ID);
  const sheet=ss.getSheetByName('Social Worker Queue');
  if(!sheet)throw new Error('Social Worker Queue sheet missing.');
  if(sheet.getLastRow()<2)return {ok:true,workers:[],generatedAt:fmt_(new Date())};
  const data=sheet.getDataRange().getDisplayValues(),ix=headerMap_(data[0]),workers=[];
  for(let r=1;r<data.length;r++){
    const platform=cell_(data[r],ix,'Platform').toUpperCase();
    const sourceStatus=cell_(data[r],ix,'Source Status').toUpperCase();
    const publishGate=cell_(data[r],ix,'Publish Gate').toUpperCase();
    const profileUrl=cell_(data[r],ix,'Verified Profile URL');
    if(platform!=='FACEBOOK'||sourceStatus.indexOf('VERIFIED')!==0||!/^https:\/\/(?:www\.)?facebook\.com\//i.test(profileUrl))continue;
    if(publishGate&&publishGate!=='REVIEW REQUIRED')continue;
    workers.push({
      queueId:cell_(data[r],ix,'Queue ID'),
      organization:cell_(data[r],ix,'Business / Organization'),
      platform:'FACEBOOK',
      profileUrl:profileUrl,
      priority:cell_(data[r],ix,'Priority')||'MEDIUM',
      scanFrequency:cell_(data[r],ix,'Next Scan')||'DAILY',
      scanMode:cell_(data[r],ix,'Scan Mode'),
      lastScanAt:cell_(data[r],ix,'Last Scan At'),
      lastScanAtIso:socialDisplayDateIso_(cell_(data[r],ix,'Last Scan At')),
      notes:cell_(data[r],ix,'Notes')
    });
  }
  workers.sort(function(a,b){return socialPriorityRank_(b.priority)-socialPriorityRank_(a.priority)||a.organization.localeCompare(b.organization);});
  return {ok:true,workers:workers,generatedAt:fmt_(new Date())};
}

function recordSocialWorkerScan_(body) {
  requireSocialIngestKey_(body);
  const queueId=String(body.queueId||'').trim();
  if(!queueId)throw new Error('Missing social worker queue ID.');
  const ss=SpreadsheetApp.openById(LL_CONFIG.SPREADSHEET_ID);
  const sheet=ss.getSheetByName('Social Worker Queue');
  if(!sheet||sheet.getLastRow()<2)throw new Error('Social Worker Queue unavailable.');
  const data=sheet.getDataRange().getDisplayValues(),ix=headerMap_(data[0]);
  for(let r=1;r<data.length;r++){
    if(cell_(data[r],ix,'Queue ID')!==queueId)continue;
    if(cell_(data[r],ix,'Platform').toUpperCase()!=='FACEBOOK'||cell_(data[r],ix,'Source Status').toUpperCase().indexOf('VERIFIED')!==0)throw new Error('Worker is not an approved Facebook source.');
    setSocialValue_(sheet,r+1,ix,'Scan Mode','BROWSER_PUBLIC_PREVIEW');
    setSocialValue_(sheet,r+1,ix,'Last Scan At',fmt_(new Date()));
    setSocialValue_(sheet,r+1,ix,'Last Result',String(body.result||'SCAN COMPLETE').replace(/\s+/g,' ').trim().slice(0,300));
    if(body.lastPostUrl)setSocialValue_(sheet,r+1,ix,'Last Post URL',String(body.lastPostUrl).slice(0,500));
    if(body.lastPostDate)setSocialValue_(sheet,r+1,ix,'Last Post Date',String(body.lastPostDate).slice(0,80));
    if(body.lastPostText)setSocialValue_(sheet,r+1,ix,'Last Post Text',String(body.lastPostText).replace(/\s+/g,' ').trim().slice(0,500));
    if(body.lastMediaUrl)setSocialValue_(sheet,r+1,ix,'Last Media URL',String(body.lastMediaUrl).slice(0,1000));
    if(body.activityFingerprint)setSocialValue_(sheet,r+1,ix,'Activity Fingerprint',String(body.activityFingerprint).slice(0,128));
    return {ok:true,queueId:queueId,recorded:true};
  }
  throw new Error('Social worker queue item not found.');
}

function requireSocialIngestKey_(body) {
  const expected=PropertiesService.getScriptProperties().getProperty('LL_SOCIAL_INGEST_KEY');
  if(!expected)throw new Error('Social intake key not configured.');
  if(String((body&&body.ingestKey)||'')!==expected)throw new Error('Unauthorized social intake.');
}

function socialPriorityRank_(priority){return {HIGH:3,MEDIUM:2,LOW:1}[String(priority||'').toUpperCase()]||0;}
function socialDisplayDateIso_(value){try{return Utilities.parseDate(String(value||''),LL_CONFIG.TZ||'America/Chicago','yyyy-MM-dd HH:mm:ss').toISOString();}catch(ignored){return '';}}

function socialPostGate_(payload,now) {
  const text=String(payload.text||'').replace(/\s+/g,' ').trim(),lower=text.toLowerCase();
  const match=String(payload.louisburgMatch||'').toUpperCase();
  const explicitLouisburg=/\blouisburg\b|\b66053\b/.test(lower);
  if(!explicitLouisburg&&!/^(YES|TRUE|VERIFIED|CONFIRMED|LOUISBURG|HIGH)$/.test(match))return {ok:false,reason:'NOT LOUISBURG'};
  if(text.length<20)return {ok:false,reason:'TOO LITTLE CONTENT'};
  if(looksLikeCode_(lower))return {ok:false,reason:'CODE/BOILERPLATE'};
  if(/privacy policy|all rights reserved|follow us\s*$|home about contact|menu welcome/.test(lower)&&!/today|tonight|tomorrow|special|sale|event|music|hiring|new |closed|open house|register/.test(lower))return {ok:false,reason:'NAVIGATION/BOILERPLATE'};
  const d=new Date(String(payload.postDate||''));
  const ageDays=isNaN(d.getTime())?null:(now.getTime()-d.getTime())/86400000;
  const dates=(typeof analyzeActivityDates_==='function')?analyzeActivityDates_(lower,now):{hasCurrentOrFuture:false};
  if(ageDays!=null&&ageDays>14&&!dates.hasCurrentOrFuture)return {ok:false,reason:'STALE SOCIAL POST'};
  const type=classifySocialActivity_(lower);
  if(!type)return {ok:false,reason:'NO ACTIONABLE ACTIVITY'};
  return {ok:true,reason:'OK',activityType:type};
}

function classifySocialActivity_(t) {
  if(/closed today|closing early|closure|cancelled|canceled|postponed|rescheduled|delayed/.test(t))return 'Operational Update';
  if(/now hiring|hiring|apply today|job opening/.test(t))return 'Hiring';
  if(/daily special|special today|today only|deal|discount|coupon|promotion|on sale|sale ends/.test(t))return 'Deal / Special';
  if(/new product|new coffee|new drink|new menu|launch|release|available now|now available|freshly roasted|\bare here\b|\b(?:has|have) (?:officially )?arrived\b|\bnow in stock\b/.test(t))return 'New Product / Offering';
  if(/live music|concert|festival|workshop|fundraiser|open house|event|tickets|register now|registration open|sign up|signup/.test(t))return 'Event / Activity';
  if(/now open|grand opening|online ordering|new hours|hours changed/.test(t))return 'Business Update';
  return '';
}

function socialFingerprint_(p){return digest_([String(p.organization||'').toLowerCase(),String(p.platform||'').toLowerCase(),String(p.postId||p.postUrl||'').toLowerCase(),String(p.text||'').replace(/\s+/g,' ').trim().toLowerCase()].join('|'));}
function socialFingerprintExistsElsewhere_(data,ix,currentIndex,fingerprint){const c=ix['Activity Fingerprint'];if(c==null)return false;for(let r=1;r<data.length;r++){if(r===currentIndex)continue;if(String(data[r][c]||'').trim()===fingerprint)return true;}return false;}
function socialFingerprintInSheet_(sheet,fingerprint){if(sheet.getLastRow()<2)return false;const data=sheet.getDataRange().getDisplayValues(),ix=headerMap_(data[0]),c=ix['Activity Fingerprint'];if(c==null)return false;for(let r=1;r<data.length;r++)if(String(data[r][c]||'').trim()===fingerprint)return true;return false;}
function socialVerificationExists_(sheet,url,fingerprint){if(!sheet||sheet.getLastRow()<2)return false;const data=sheet.getDataRange().getDisplayValues(),needle=String(fingerprint||'').slice(0,16);for(let r=1;r<data.length;r++){if(String(data[r][4]||'').trim()===url&&String(data[r][9]||'').indexOf(needle)!==-1)return true;}return false;}
function setSocialValue_(sheet,row,ix,header,value){const c=ix[header];if(c!=null)sheet.getRange(row,c+1).setValue(value);}
