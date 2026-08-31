// Louisburg Local social activity intake bridge.
// Public social posts are normalized here before automatic high-confidence verification.
// Exceptions remain behind the existing Verification Queue review gate.
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
  const feed=ss.getSheetByName(LL_CONFIG.SHEETS.FEED);
  if(!sheet||!verify||!feed)throw new Error('Social intake, verification or Hub Feed sheet missing.');
  if(sheet.getLastRow()<2)return {processed:0,queued:0,rejected:0,duplicates:0,promoted:0,hubDuplicates:0,manualReview:0};
  const data=sheet.getDataRange().getDisplayValues(),headers=data[0],ix=headerMap_(headers),now=new Date();
  const sourceIndex=socialVerifiedWorkerIndex_(ss);
  const registryIndex=socialRegistryAutoIndex_(ss);
  const hubIndex=socialHubIndex_(feed);
  let processed=0,queued=0,rejected=0,duplicates=0,promoted=0,hubDuplicates=0,manualReview=0;
  const seenThisRun={};
  for(let r=1;r<data.length;r++){
    const row=data[r],worker=cell_(row,ix,'Worker Result').toUpperCase();
    if(/^(REJECTED|DUPLICATE|PROMOTED|DONE|AUTO-RESOLVED)/.test(worker))continue;
    const alreadyQueued=/^QUEUED FOR VERIFICATION/.test(worker);
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
    const auto=socialAutoVerificationDecision_(payload,activityType,now,sourceIndex,registryIndex);
    if(auto.ok){
      const result=socialPromoteToHub_(feed,hubIndex,payload,activityType,fingerprint,auto,now);
      if(result.duplicate){
        hubDuplicates++;
        setSocialValue_(sheet,r+1,ix,'Worker Result','AUTO-RESOLVED - DUPLICATE HUB ITEM');
        setSocialValue_(sheet,r+1,ix,'Verification Status','AUTO-RESOLVED - DUPLICATE');
        setSocialValue_(sheet,r+1,ix,'Hub Eligibility','NO - DUPLICATE');
        setSocialValue_(sheet,r+1,ix,'Promoted Item ID',result.itemId||'');
        setSocialValue_(sheet,r+1,ix,'Notes','Automatic safeguards passed, but the content-level source or dedupe key already exists in Hub Feed.');
        socialUpsertVerificationAudit_(verify,payload,activityType,fingerprint,'AUTO-RESOLVED - DUPLICATE HUB ITEM',result.itemId||'',auto.reason,now);
      }else{
        promoted++;
        setSocialValue_(sheet,r+1,ix,'Worker Result','PROMOTED - AUTO-VERIFIED');
        setSocialValue_(sheet,r+1,ix,'Verification Status','AUTO-VERIFIED - SOCIAL');
        setSocialValue_(sheet,r+1,ix,'Hub Eligibility','YES');
        setSocialValue_(sheet,r+1,ix,'Promoted Item ID',result.itemId);
        setSocialValue_(sheet,r+1,ix,'Notes','Automatically verified from the exact recent post on a verified Louisburg Page; normal exception safeguards passed.');
        socialUpsertVerificationAudit_(verify,payload,activityType,fingerprint,'AUTO-VERIFIED - PROMOTED',result.itemId,auto.reason,now);
      }
      continue;
    }
    setSocialValue_(sheet,r+1,ix,'Worker Result','QUEUED FOR VERIFICATION');
    setSocialValue_(sheet,r+1,ix,'Verification Status','OPEN - SOCIAL');
    setSocialValue_(sheet,r+1,ix,'Hub Eligibility','REVIEW');
    setSocialValue_(sheet,r+1,ix,'Notes','Manual review exception: '+auto.reason);
    socialEnsureManualVerification_(verify,payload,activityType,fingerprint,auto.reason,now);
    manualReview++;
    if(!alreadyQueued)queued++;
  }
  return {processed:processed,queued:queued,rejected:rejected,duplicates:duplicates,promoted:promoted,hubDuplicates:hubDuplicates,manualReview:manualReview};
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
  sheet.appendRow([Utilities.getUuid(),String(body.queueId||''),org,platform,profileUrl,postUrl,payload.postId,payload.postDate,payload.capturedAt,text,payload.mediaUrl,payload.mediaType,payload.activityType,payload.louisburgMatch,fingerprint,'PENDING','','','','Webhook intake; automatic verification eligible, exceptions stay in review.']);
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
  if(/closed today|closing early|closure|cancelled|canceled|postponed|rescheduled|delayed|sold out|hours? changed|change(?:d)? (?:our )?hours/.test(t))return 'Operational Update';
  if(/now hiring|hiring|apply today|job opening/.test(t))return 'Hiring';
  if(/daily special|special today|today only|\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+special|\bspecials?\b|\bdeal\b|discount|coupon|promotion|on sale|sale ends|buy one|get one|\bbogo\b/.test(t))return 'Deal / Special';
  if(/new product|new coffee|new drink|new menu|launch|release|available now|now available|freshly roasted|fresh inventory|\bare here\b|\b(?:has|have) (?:officially )?arrived\b|\bjust arrived\b|\bnow in stock\b/.test(t))return 'New Product / Offering';
  if(/live music|concert|festival|workshop|fundraiser|open house|\bevent\b|tickets|register now|registration open|sign up|signup|\bclass(?:es)?\b/.test(t))return 'Event / Activity';
  if(/now open|grand opening|online ordering|new hours|extended hours/.test(t))return 'Business Update';
  return '';
}

function socialFingerprint_(p){return digest_([String(p.organization||'').toLowerCase(),String(p.platform||'').toLowerCase(),String(p.postId||p.postUrl||'').toLowerCase(),String(p.text||'').replace(/\s+/g,' ').trim().toLowerCase()].join('|'));}
function socialFingerprintExistsElsewhere_(data,ix,currentIndex,fingerprint){const c=ix['Activity Fingerprint'];if(c==null)return false;for(let r=1;r<data.length;r++){if(r===currentIndex)continue;if(String(data[r][c]||'').trim()===fingerprint)return true;}return false;}
function socialFingerprintInSheet_(sheet,fingerprint){if(sheet.getLastRow()<2)return false;const data=sheet.getDataRange().getDisplayValues(),ix=headerMap_(data[0]),c=ix['Activity Fingerprint'];if(c==null)return false;for(let r=1;r<data.length;r++)if(String(data[r][c]||'').trim()===fingerprint)return true;return false;}
function socialVerificationExists_(sheet,url,fingerprint){if(!sheet||sheet.getLastRow()<2)return false;const data=sheet.getDataRange().getDisplayValues(),needle=String(fingerprint||'').slice(0,16);for(let r=1;r<data.length;r++){if(String(data[r][4]||'').trim()===url&&String(data[r][9]||'').indexOf(needle)!==-1)return true;}return false;}

function runSocialAutoPromotionSelfTest(){
  const now=new Date('2026-08-31T01:00:00-05:00');
  const payload={queueId:'SOC-TEST-FB',organization:'Test Louisburg Business',platform:'FACEBOOK',profileUrl:'https://www.facebook.com/testlouisburg',postUrl:'https://www.facebook.com/testlouisburg/posts/pfbid123',postId:'pfbid123',postDate:'2026-08-30T16:00:00-05:00',text:'Apples are here at the Louisburg store! Fresh inventory is now available.',mediaUrl:'https://example.com/post.jpg',mediaType:'IMAGE',louisburgMatch:'VERIFIED'};
  const sources={'SOC-TEST-FB':{organization:payload.organization,profileUrl:payload.profileUrl,sourceStatus:'VERIFIED',publishGate:'REVIEW REQUIRED'}};
  const registry={};
  registry[socialNormalizeOrg_(payload.organization)]={organization:payload.organization,address:'1 Main St, Louisburg, KS 66053',category:'Retail',louisburgVerified:true,hubEligible:true,conflict:false};
  const failures=[];
  if(!socialAutoVerificationDecision_(payload,'New Product / Offering',now,sources,registry).ok)failures.push('clean verified offering did not qualify');
  if(socialAutoVerificationDecision_(Object.assign({},payload,{queueId:'UNKNOWN'}),'New Product / Offering',now,sources,registry).ok)failures.push('unverified source qualified');
  if(socialAutoVerificationDecision_(Object.assign({},payload,{text:'We shared another Page post about fresh inventory in Louisburg.'}),'New Product / Offering',now,sources,registry).ok)failures.push('shared/reposted content qualified');
  if(socialAutoVerificationDecision_(Object.assign({},payload,{postDate:'2026-08-01T16:00:00-05:00'}),'New Product / Offering',now,sources,registry).ok)failures.push('stale post qualified');
  if(socialAutoVerificationDecision_(Object.assign({},payload,{text:'Live music is coming soon in Louisburg.'}),'Event / Activity',now,sources,registry).ok)failures.push('undated event qualified');
  if(failures.length)throw new Error('Social auto-promotion self-test failed: '+failures.join(' | '));
  Logger.log('Social auto-promotion self-test passed: 5/5');
}

function socialAutoVerificationDecision_(payload,activityType,now,sourceIndex,registryIndex){
  const platform=String(payload.platform||'').toUpperCase();
  if(platform!=='FACEBOOK')return {ok:false,reason:'platform is not the logged-out Facebook Page worker'};
  const source=sourceIndex[String(payload.queueId||'')];
  if(!source)return {ok:false,reason:'source queue identity is not verified'};
  if(socialNormalizeOrg_(source.organization)!==socialNormalizeOrg_(payload.organization))return {ok:false,reason:'source organization does not match the intake organization'};
  const profile=socialNormalizeUrl_(payload.profileUrl),verifiedProfile=socialNormalizeUrl_(source.profileUrl),post=socialNormalizeUrl_(payload.postUrl);
  if(!profile||profile!==verifiedProfile)return {ok:false,reason:'captured profile does not match the verified Page URL'};
  if(!post||post.indexOf(profile+'/posts/')!==0)return {ok:false,reason:'exact content-level post URL is not owned by the verified Page path'};
  if(!/^(VERIFIED|CONFIRMED)$/.test(String(payload.louisburgMatch||'').toUpperCase()))return {ok:false,reason:'Louisburg match is not verified'};
  const registry=registryIndex[socialNormalizeOrg_(payload.organization)];
  if(!registry||!registry.louisburgVerified||!registry.hubEligible)return {ok:false,reason:'Master Registry does not verify this Louisburg business for Hub use'};
  if(registry.conflict)return {ok:false,reason:'Master Registry contains a conflict flag'};
  const postDate=new Date(String(payload.postDate||''));
  if(isNaN(postDate.getTime()))return {ok:false,reason:'post date is missing or ambiguous'};
  const ageDays=(now.getTime()-postDate.getTime())/86400000;
  if(ageDays<(-2/24)||ageDays>7)return {ok:false,reason:'post is outside the seven-day automatic verification window'};
  const text=String(payload.text||'').replace(/\s+/g,' ').trim(),lower=text.toLowerCase();
  if(/\b(shared|reposted|re-posted)\b.{0,35}\b(post|from|by)\b|\boriginally posted by\b|\bshared from\b/.test(lower))return {ok:false,reason:'shared or reposted ownership is uncertain'};
  const allowed=['Deal / Special','New Product / Offering','Event / Activity','Business Update','Hiring','Operational Update'];
  if(allowed.indexOf(activityType)===-1)return {ok:false,reason:'activity type is not eligible for automatic promotion'};
  const dates=(typeof analyzeActivityDates_==='function')?analyzeActivityDates_(lower,now):{explicitPastOnly:false,pastOnly:false};
  if(dates.explicitPastOnly)return {ok:false,reason:'post contains only stale explicit dates'};
  const relevantDate=socialRelevantDate_(payload,activityType,now,dates);
  if(activityType==='Event / Activity'&&!relevantDate)return {ok:false,reason:'event date is not exact enough for automatic publication'};
  const today=Utilities.formatDate(now,LL_CONFIG.TZ,'yyyy-MM-dd');
  if(/\b(today only|today|tonight)\b/.test(lower)&&relevantDate&&relevantDate<today)return {ok:false,reason:'same-day activity has already expired'};
  return {ok:true,reason:'verified Page, verified Louisburg registry match, recent exact post, eligible activity and no conflict',registry:registry,relevantDate:relevantDate,timeParts:socialTimeParts_(text)};
}

function socialVerifiedWorkerIndex_(ss){
  const out={},sheet=ss.getSheetByName('Social Worker Queue');
  if(!sheet||sheet.getLastRow()<2)return out;
  const data=sheet.getDataRange().getDisplayValues(),ix=headerMap_(data[0]);
  for(let r=1;r<data.length;r++){
    const id=cell_(data[r],ix,'Queue ID'),platform=cell_(data[r],ix,'Platform').toUpperCase(),status=cell_(data[r],ix,'Source Status').toUpperCase(),gate=cell_(data[r],ix,'Publish Gate').toUpperCase();
    if(!id||platform!=='FACEBOOK'||status.indexOf('VERIFIED')!==0||gate!=='REVIEW REQUIRED')continue;
    out[id]={organization:cell_(data[r],ix,'Business / Organization'),profileUrl:cell_(data[r],ix,'Verified Profile URL'),sourceStatus:status,publishGate:gate};
  }
  return out;
}

function socialRegistryAutoIndex_(ss){
  const out={},sheet=ss.getSheetByName('Master Registry');
  if(!sheet||sheet.getLastRow()<2)return out;
  const data=sheet.getDataRange().getDisplayValues(),ix=headerMap_(data[0]);
  for(let r=1;r<data.length;r++){
    const org=cell_(data[r],ix,'Business / Organization');
    if(!org)continue;
    out[socialNormalizeOrg_(org)]={
      organization:org,
      address:cell_(data[r],ix,'Louisburg Address'),
      category:cell_(data[r],ix,'Category'),
      louisburgVerified:/^(YES|VERIFIED)$/i.test(cell_(data[r],ix,'Louisburg Verified')),
      hubEligible:/^(YES|VERIFIED)$/i.test(cell_(data[r],ix,'Hub Eligible')),
      conflict:/^(YES|TRUE|CONFLICT)$/i.test(cell_(data[r],ix,'Conflict Flag'))
    };
  }
  return out;
}

function socialHubIndex_(sheet){
  const out={byUrl:{},byDedupe:{}};
  if(!sheet||sheet.getLastRow()<2)return out;
  const data=sheet.getDataRange().getDisplayValues(),ix=headerMap_(data[0]);
  for(let r=1;r<data.length;r++){
    const id=cell_(data[r],ix,'Item ID'),url=socialNormalizeUrl_(cell_(data[r],ix,'Original URL')),key=cell_(data[r],ix,'Dedupe Key');
    if(url)out.byUrl[url]=id;
    if(key)out.byDedupe[key]=id;
  }
  return out;
}

function socialPromoteToHub_(sheet,index,payload,activityType,fingerprint,auto,now){
  const plan=socialPromotionPlan_(payload,activityType,fingerprint,auto,now);
  const normalizedUrl=socialNormalizeUrl_(payload.postUrl);
  const existing=index.byUrl[normalizedUrl]||index.byDedupe[plan.dedupeKey]||'';
  if(existing)return {duplicate:true,itemId:existing};
  const target=sheet.getLastRow()+1;
  if(target>2)sheet.getRange(target-1,1,1,plan.row.length).copyTo(sheet.getRange(target,1,1,plan.row.length),SpreadsheetApp.CopyPasteType.PASTE_FORMAT,false);
  sheet.getRange(target,1,1,plan.row.length).setValues([plan.row]);
  index.byUrl[normalizedUrl]=plan.itemId;
  index.byDedupe[plan.dedupeKey]=plan.itemId;
  return {duplicate:false,itemId:plan.itemId};
}

function socialPromotionPlan_(payload,activityType,fingerprint,auto,now){
  const discovery=socialPostLocalDate_(payload.postDate),relevant=auto.relevantDate||'',times=auto.timeParts||{window:'',start:'',end:''};
  const eventStart=relevant&&times.start?relevant+' '+times.start:'';
  const eventEnd=relevant&&times.end?relevant+' '+times.end:'';
  let explicitExpire='';
  if(activityType==='Deal / Special'&&!relevant)explicitExpire=socialEndOfAddedDay_(discovery,5);
  if(activityType==='Hiring'||activityType==='Business Update')explicitExpire=socialEndOfAddedDay_(discovery,14);
  if(activityType==='Operational Update')explicitExpire=relevant?relevant+' 23:59':socialEndOfAddedDay_(discovery,3);
  const item={currentSection:'NOW',relevantDate:relevant,eventStart:eventStart,eventEnd:eventEnd,activityType:activityType,discoveryDate:discovery,expireAt:explicitExpire};
  const life=(typeof lifecycleDecision_==='function')?lifecycleDecision_(item,now):{section:relevant?'COMING UP':'NOW',state:'NOW',expireAt:explicitExpire,freshnessBoost:20,proximityBoost:0};
  const base=socialImportanceBase_(activityType),sourceConfidence=15,fairnessPenalty=0;
  const rank=base+Number(life.freshnessBoost||0)+Number(life.proximityBoost||0)+sourceConfidence-fairnessPenalty;
  const itemId='SOC-'+String(fingerprint||'').slice(0,16).toUpperCase();
  const dedupeKey='social|'+String(fingerprint||'').toLowerCase();
  const sourceSet={sourceType:'FACEBOOK_PUBLIC_POST',profileUrl:payload.profileUrl,sourcePostUrl:payload.postUrl};
  if(/^https?:\/\//i.test(String(payload.mediaUrl||'')))sourceSet.sourceMediaUrl=payload.mediaUrl;
  const category=activityType==='Event / Activity'?'Event':activityType;
  const row=[
    itemId,payload.organization,category,socialHeadline_(payload.text,activityType,payload.organization),socialPublicSummary_(payload.text),life.section||'NOW',relevant,times.window||'',auto.registry.address||'',payload.postUrl,'BROWSER PUBLIC / VERIFIED','HIGH','HIGH',fmt_(now),life.expireAt||explicitExpire||'',
    'Automatically verified from the exact recent public post on the verified Louisburg Page. No login, account, token or Page role used.',discovery,eventStart,eventEnd,life.state||'NOW',base,Number(life.freshnessBoost||0),Number(life.proximityBoost||0),sourceConfidence,fairnessPenalty,rank,dedupeKey,JSON.stringify(sourceSet),'YES','AUTO-VERIFIED - SOCIAL',activityType,'',0,'',0,0
  ];
  return {itemId:itemId,dedupeKey:dedupeKey,row:row};
}

function socialEnsureManualVerification_(sheet,payload,activityType,fingerprint,reason,now){
  const needle=String(fingerprint||'').slice(0,16),data=sheet.getLastRow()>1?sheet.getDataRange().getDisplayValues():[];
  for(let r=1;r<data.length;r++){
    if(String(data[r][4]||'').trim()!==payload.postUrl&&String(data[r][9]||'').indexOf(needle)===-1)continue;
    if(String(data[r][6]||'').toUpperCase()==='OPEN - SOCIAL')sheet.getRange(r+1,4).setValue('Manual review exception: '+reason);
    return;
  }
  sheet.appendRow([payload.organization,'Social activity candidate',payload.text.slice(0,900),'Manual review exception: '+reason,payload.postUrl,'HIGH','OPEN - SOCIAL',Utilities.formatDate(now,LL_CONFIG.TZ,'yyyy-MM-dd'),'','Social fingerprint '+needle+'; platform='+payload.platform+'; activity='+activityType+'; media='+(payload.mediaUrl||'none')+'. Content-level source must beat business-level source.']);
}

function socialUpsertVerificationAudit_(sheet,payload,activityType,fingerprint,status,itemId,reason,now){
  const needle=String(fingerprint||'').slice(0,16),date=Utilities.formatDate(now,LL_CONFIG.TZ,'yyyy-MM-dd');
  const resolution=status.indexOf('DUPLICATE')!==-1?'Automatic duplicate protection matched existing Hub Feed item '+itemId+'.':'Automatically verified and promoted to Hub Feed as '+itemId+'.';
  const audit='Automatic checks: '+reason+'; fingerprint='+needle+'; platform='+payload.platform+'; activity='+activityType+'.';
  const data=sheet.getLastRow()>1?sheet.getDataRange().getDisplayValues():[];
  for(let r=1;r<data.length;r++){
    if(String(data[r][4]||'').trim()!==payload.postUrl&&String(data[r][9]||'').indexOf(needle)===-1)continue;
    sheet.getRange(r+1,7).setValue(status);
    sheet.getRange(r+1,8).setValue(date);
    sheet.getRange(r+1,9).setValue(resolution);
    sheet.getRange(r+1,10).setValue(audit);
    return;
  }
  sheet.appendRow([payload.organization,'Social activity automatic verification',payload.text.slice(0,900),'All automatic safeguards passed',payload.postUrl,'HIGH',status,date,resolution,audit]);
}

function socialRelevantDate_(payload,activityType,now,dates){
  const text=String(payload.text||'').toLowerCase(),postDate=socialPostLocalDate_(payload.postDate);
  if(/\b(today only|today|tonight)\b/.test(text))return postDate;
  if(/\btomorrow\b/.test(text))return socialAddDaysIso_(postDate,1);
  if(dates&&dates.hasCurrentOrFuture&&dates.bestIso)return dates.bestIso;
  return '';
}

function socialTimeParts_(text){
  const times=[],re=/\b(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)\b/ig;
  let m;
  while((m=re.exec(String(text||'')))&&times.length<2){
    let hour=Number(m[1])%12;
    if(/^p/i.test(m[3]))hour+=12;
    const value=('0'+hour).slice(-2)+':'+('0'+Number(m[2]||0)).slice(-2);
    if(times.indexOf(value)===-1)times.push(value);
  }
  return {start:times[0]||'',end:times[1]||'',window:times.length>1?times[0]+'-'+times[1]:(times[0]||'')};
}

function socialHeadline_(text,activityType,organization){
  const clean=socialPublicSummary_(text),m=clean.match(/^(.{12,110}?[.!?])(?:\s|$)/);
  if(m)return m[1].trim();
  if(clean.length>=12&&clean.length<=110)return clean;
  const words=clean.split(/\s+/),out=[];
  for(let i=0;i<words.length;i++){if((out.join(' ')+' '+words[i]).trim().length>100)break;out.push(words[i]);}
  if(out.join(' ').length>=12)return out.join(' ').replace(/[,:;\-]+$/,'');
  const labels={'Deal / Special':'Current special from ','New Product / Offering':'New offering from ','Event / Activity':'New activity from ','Business Update':'New update from ','Hiring':'Now hiring at ','Operational Update':'Current update from '};
  return (labels[activityType]||'Update from ')+organization;
}

function socialPublicSummary_(text){
  let clean=String(text||'').replace(/(?:\s*#[A-Za-z0-9_]+)+\s*$/,'').replace(/\s+/g,' ').trim();
  if(clean.length>700)clean=clean.slice(0,697).replace(/\s+\S*$/,'')+'...';
  return clean;
}

function socialImportanceBase_(activityType){return {'Operational Update':70,'Deal / Special':60,'New Product / Offering':50,'Event / Activity':50,'Hiring':45,'Business Update':40}[activityType]||40;}
function socialNormalizeOrg_(value){return String(value||'').toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');}
function socialNormalizeUrl_(value){return String(value||'').trim().toLowerCase().replace(/^https?:\/\/(?:www\.)?/,'').replace(/[?#].*$/,'').replace(/\/+$/,'');}
function socialPostLocalDate_(value){const d=new Date(String(value||''));return isNaN(d.getTime())?'':Utilities.formatDate(d,LL_CONFIG.TZ,'yyyy-MM-dd');}
function socialAddDaysIso_(iso,days){try{const d=Utilities.parseDate(String(iso||''),LL_CONFIG.TZ,'yyyy-MM-dd');d.setTime(d.getTime()+Number(days||0)*86400000);return Utilities.formatDate(d,LL_CONFIG.TZ,'yyyy-MM-dd');}catch(ignored){return '';}}
function socialEndOfAddedDay_(iso,days){const d=socialAddDaysIso_(iso,days);return d?d+' 23:59':'';}
function setSocialValue_(sheet,row,ix,header,value){const c=ix[header];if(c!=null)sheet.getRange(row,c+1).setValue(value);}
