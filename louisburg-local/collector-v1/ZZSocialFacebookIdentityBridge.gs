// Louisburg Local verified Facebook identity bridge.
//
// Purpose:
// - Treat a verified Facebook Page's configured numeric ID, vanity alias and
//   alternate verified ID as one public identity.
// - Re-evaluate an earlier owner-mismatch exception when a later verified
//   capture proves the same post belongs to one of those configured identities.
// - Keep unrelated Page owners, stale posts, uncertain locality and all other
//   normal safeguards behind the existing exception gate.
//
// This is public-source-only logic. It does not use Facebook credentials,
// cookies, private sessions, Meta tokens, or access-control workarounds.

function socialFacebookIdentityUrlsFromNotes_(profileUrl,notes){
  const out=[];
  const add=function(value){
    let v=String(value||'').trim().replace(/[;,]+$/,'');
    if(!v)return;
    if(/^\d+$/.test(v))v='https://www.facebook.com/'+v;
    if(!/^https?:\/\/(?:www\.|m\.|mbasic\.)?facebook\.com\//i.test(v))return;
    const norm=socialNormalizeUrl_(v);
    if(!out.some(function(existing){return socialNormalizeUrl_(existing)===norm;}))out.push(v);
  };
  add(profileUrl);
  const raw=String(notes||'');
  const re=/\b(FACEBOOK_VANITY_ALIAS|FACEBOOK_ALT_ID|FACEBOOK_NUMERIC_ALIAS)\s*=\s*([^\s]+)/ig;
  let m;
  while((m=re.exec(raw)))add(m[2]);
  return out;
}

function socialFacebookIdentityKeyAllowed_(url,identityUrls){
  const key=socialFacebookOwnerKey_(url);
  if(!key)return false;
  const ids=identityUrls||[];
  for(let i=0;i<ids.length;i++)if(socialFacebookOwnerKey_(ids[i])===key)return true;
  return false;
}

function socialVerifiedWorkerIndexAliasAware_(ss){
  const out={},sheet=ss.getSheetByName('Social Worker Queue');
  if(!sheet||sheet.getLastRow()<2)return out;
  const data=sheet.getDataRange().getDisplayValues(),ix=headerMap_(data[0]);
  for(let r=1;r<data.length;r++){
    const id=cell_(data[r],ix,'Queue ID'),platform=cell_(data[r],ix,'Platform').toUpperCase(),status=cell_(data[r],ix,'Source Status').toUpperCase(),gate=cell_(data[r],ix,'Publish Gate').toUpperCase();
    if(!id||platform!=='FACEBOOK'||status.indexOf('VERIFIED')!==0||!socialSourceGateAllowsPublicScan_(gate))continue;
    const profileUrl=cell_(data[r],ix,'Verified Profile URL'),notes=cell_(data[r],ix,'Notes');
    out[id]={
      organization:cell_(data[r],ix,'Business / Organization'),
      profileUrl:profileUrl,
      sourceStatus:status,
      publishGate:gate,
      notes:notes,
      identityUrls:socialFacebookIdentityUrlsFromNotes_(profileUrl,notes)
    };
  }
  return out;
}

function socialAutoVerificationDecisionAliasAware_(payload,activityType,now,sourceIndex,registryIndex,endpointIndex){
  const platform=String(payload.platform||'').toUpperCase();
  if(platform==='WEBSITE'||platform==='FIRST_PARTY'||platform==='DIRECT')return socialFirstPartyVerificationDecision_(payload,activityType,now,registryIndex,endpointIndex);
  if(platform!=='FACEBOOK')return {ok:false,reason:'platform is not a supported public social or first-party source'};
  const source=sourceIndex[String(payload.queueId||'')];
  if(!source)return {ok:false,reason:'source queue identity is not verified'};
  if(socialNormalizeOrg_(source.organization)!==socialNormalizeOrg_(payload.organization))return {ok:false,reason:'source organization does not match the intake organization'};

  const identities=(source.identityUrls&&source.identityUrls.length)?source.identityUrls:socialFacebookIdentityUrlsFromNotes_(source.profileUrl,source.notes||'');
  const profile=socialNormalizeUrl_(payload.profileUrl),post=socialNormalizeUrl_(payload.postUrl),postId=String(payload.postId||'');
  if(!profile||!socialFacebookIdentityKeyAllowed_(payload.profileUrl,identities))return {ok:false,reason:'captured profile does not match a verified Page identity'};

  const rawPost=String(payload.postUrl||'');
  const visibleCard=(/^VISIBLE-/i.test(postId)||/#ll-visible-/i.test(rawPost))&&post===profile;
  const publicFacebookContent=/^facebook\.com\//i.test(post);
  if(!visibleCard&&!publicFacebookContent)return {ok:false,reason:'captured content is not public Facebook evidence from the verified worker'};
  if(!visibleCard&&!socialFacebookIdentityKeyAllowed_(rawPost,identities))return {ok:false,reason:'Facebook post owner does not match a verified Page identity'};
  if(!/^(VERIFIED|CONFIRMED)$/.test(String(payload.louisburgMatch||'').toUpperCase()))return {ok:false,reason:'Louisburg match is not verified'};

  const registry=socialRegistryLookup_(registryIndex,payload.organization);
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
  if(dates.explicitPastOnly||dates.pastOnly)return {ok:false,reason:'post contains only stale dates'};
  const relevantDate=socialRelevantDate_(payload,activityType,now,dates)||socialThroughMonthDate_(lower,now);
  if(activityType==='Event / Activity'&&!relevantDate)return {ok:false,reason:'event date is not exact enough for automatic publication'};
  const today=Utilities.formatDate(now,LL_CONFIG.TZ,'yyyy-MM-dd');
  if(/\b(today only|today|tonight)\b/.test(lower)&&relevantDate&&relevantDate<today)return {ok:false,reason:'same-day activity has already expired'};
  return {ok:true,sourceType:'SOCIAL',reason:'verified public Facebook Page identity/alias, verified Louisburg registry match, recent owned content, eligible activity and no conflict',registry:registry,relevantDate:relevantDate,timeParts:socialTimeParts_(text),visibleCard:visibleCard};
}

function socialFingerprintRow_(sheet,fingerprint){
  if(!sheet||sheet.getLastRow()<2)return null;
  const data=sheet.getDataRange().getDisplayValues(),ix=headerMap_(data[0]),c=ix['Activity Fingerprint'];
  if(c==null)return null;
  for(let r=1;r<data.length;r++)if(String(data[r][c]||'').trim()===String(fingerprint||'').trim())return {row:r+1,data:data[r],ix:ix};
  return null;
}

function socialRequeueResolvedOwnerMismatch_(sheet,match,payload){
  if(!match)return false;
  const ix=match.ix,row=match.row,current=match.data;
  const worker=cell_(current,ix,'Worker Result').toUpperCase(),status=cell_(current,ix,'Verification Status').toUpperCase(),notes=cell_(current,ix,'Notes');
  if(!/^QUEUED FOR VERIFICATION/.test(worker)||status!=='OPEN - SOCIAL'||!/facebook post owner does not match/i.test(notes))return false;

  // Refresh public evidence with the later verified capture before reprocessing.
  setSocialValue_(sheet,row,ix,'Profile URL',payload.profileUrl);
  setSocialValue_(sheet,row,ix,'Post URL',payload.postUrl);
  setSocialValue_(sheet,row,ix,'Post ID',payload.postId);
  setSocialValue_(sheet,row,ix,'Post Date / Time',payload.postDate);
  setSocialValue_(sheet,row,ix,'Captured At',payload.capturedAt);
  setSocialValue_(sheet,row,ix,'Post Text',payload.text);
  setSocialValue_(sheet,row,ix,'Media URL',payload.mediaUrl);
  setSocialValue_(sheet,row,ix,'Media Type',payload.mediaType);
  if(payload.activityType)setSocialValue_(sheet,row,ix,'Activity Type',payload.activityType);
  setSocialValue_(sheet,row,ix,'Louisburg Match',payload.louisburgMatch);
  setSocialValue_(sheet,row,ix,'Worker Result','PENDING - VERIFIED IDENTITY RECHECK');
  setSocialValue_(sheet,row,ix,'Verification Status','');
  setSocialValue_(sheet,row,ix,'Hub Eligibility','');
  setSocialValue_(sheet,row,ix,'Notes','Requeued automatically after later public capture matched a configured verified Facebook Page identity.');
  return true;
}

function recordSocialIntakeWebhookAliasAware_(body){
  requireSocialIngestKey_(body);
  const ss=SpreadsheetApp.openById(LL_CONFIG.SPREADSHEET_ID),sheet=ss.getSheetByName('Social Post Intake');
  if(!sheet)throw new Error('Social Post Intake sheet missing.');
  const platform=String(body.platform||'').trim().toUpperCase();
  const postUrl=String(body.postUrl||'').trim(),profileUrl=String(body.profileUrl||'').trim(),text=String(body.postText||body.text||'').trim();
  const org=String(body.organization||body.business||'').trim();
  if(!org||!postUrl||!text||!/^https?:\/\//i.test(postUrl))throw new Error('Missing social post fields.');
  const payload={organization:org,platform:platform,profileUrl:profileUrl,postUrl:postUrl,postId:String(body.postId||'').trim(),postDate:String(body.postDate||'').trim(),capturedAt:fmt_(new Date()),text:text,mediaUrl:String(body.mediaUrl||'').trim(),mediaType:String(body.mediaType||'').trim(),activityType:String(body.activityType||'').trim(),louisburgMatch:String(body.louisburgMatch||'').trim()};
  const fingerprint=socialFingerprint_(payload),existing=socialFingerprintRow_(sheet,fingerprint);
  if(existing){
    const requeued=platform==='FACEBOOK'&&socialRequeueResolvedOwnerMismatch_(sheet,existing,payload);
    if(requeued){
      let processed=false;
      const lock=LockService.getScriptLock();
      if(lock.tryLock(3000)){
        try{processSocialPostIntake();processed=true;}finally{lock.releaseLock();}
      }
      return {ok:true,duplicate:true,requeued:true,processed:processed,fingerprint:fingerprint};
    }
    return {ok:true,duplicate:true,fingerprint:fingerprint};
  }
  sheet.appendRow([Utilities.getUuid(),String(body.queueId||''),org,platform,profileUrl,postUrl,payload.postId,payload.postDate,payload.capturedAt,text,payload.mediaUrl,payload.mediaType,payload.activityType,payload.louisburgMatch,fingerprint,'PENDING','','','','Webhook intake; verified Facebook sources auto-publish when normal safeguards pass.']);
  return {ok:true,duplicate:false,fingerprint:fingerprint};
}

function repairVerifiedFacebookOwnerMismatchIntake(){
  const ss=SpreadsheetApp.openById(LL_CONFIG.SPREADSHEET_ID),sheet=ss.getSheetByName('Social Post Intake');
  if(!sheet||sheet.getLastRow()<2)return {requeued:0,summary:null};
  const data=sheet.getDataRange().getDisplayValues(),ix=headerMap_(data[0]);
  let requeued=0;
  for(let r=1;r<data.length;r++){
    const worker=cell_(data[r],ix,'Worker Result').toUpperCase(),status=cell_(data[r],ix,'Verification Status').toUpperCase(),notes=cell_(data[r],ix,'Notes');
    if(!/^QUEUED FOR VERIFICATION/.test(worker)||status!=='OPEN - SOCIAL'||!/facebook post owner does not match/i.test(notes))continue;
    setSocialValue_(sheet,r+1,ix,'Worker Result','PENDING - VERIFIED IDENTITY RECHECK');
    setSocialValue_(sheet,r+1,ix,'Verification Status','');
    setSocialValue_(sheet,r+1,ix,'Hub Eligibility','');
    setSocialValue_(sheet,r+1,ix,'Notes','Requeued after verified Facebook identity/alias rules were upgraded.');
    requeued++;
  }
  const summary=requeued?processSocialPostIntake():null;
  return {requeued:requeued,summary:summary};
}

function runSocialFacebookIdentityBridgeSelfTest(){
  const source={profileUrl:'https://www.facebook.com/100063452718081',notes:'FACEBOOK_VANITY_ALIAS=https://www.facebook.com/BB.Coffee.Tea FACEBOOK_NUMERIC_ALIAS=100063452718081'};
  const ids=socialFacebookIdentityUrlsFromNotes_(source.profileUrl,source.notes);
  const failures=[];
  if(!socialFacebookIdentityKeyAllowed_('https://www.facebook.com/100063452718081/posts/pfbid123',ids))failures.push('numeric owner rejected');
  if(!socialFacebookIdentityKeyAllowed_('https://www.facebook.com/BB.Coffee.Tea/posts/pfbid123',ids))failures.push('verified vanity owner rejected');
  if(socialFacebookIdentityKeyAllowed_('https://www.facebook.com/unrelated.page/posts/pfbid123',ids))failures.push('unrelated owner accepted');
  if(failures.length)throw new Error('Facebook identity bridge self-test failed: '+failures.join(' | '));
  Logger.log('Facebook identity bridge self-test passed: numeric + vanity accepted; unrelated owner rejected.');
}

// Install the alias-aware implementations without changing the existing public
// function names used by WebApp.gs and processSocialPostIntake(). Top-level
// assignments run when the Apps Script execution context initializes.
socialVerifiedWorkerIndex_=socialVerifiedWorkerIndexAliasAware_;
socialAutoVerificationDecision_=socialAutoVerificationDecisionAliasAware_;
recordSocialIntakeWebhook_=recordSocialIntakeWebhookAliasAware_;
