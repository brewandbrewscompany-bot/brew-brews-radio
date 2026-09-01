// Louisburg Local verification-audit identity bridge.
//
// Multiple distinct first-party activities can legitimately share one calendar
// or news index URL. Verification Queue rows therefore must not be considered
// the same activity merely because their source URL is identical. Prefer the
// activity fingerprint; use URL-only matching only when no fingerprint exists.

function socialVerificationActivityMatches_(row,payload,fingerprintNeedle){
  const needle=String(fingerprintNeedle||'').trim();
  const auditText=String(row&&row[9]||'');
  if(needle)return auditText.indexOf(needle)!==-1;
  return String(row&&row[4]||'').trim()===String(payload&&payload.postUrl||'').trim();
}

function socialEnsureManualVerificationIdentityAware_(sheet,payload,activityType,fingerprint,reason,now){
  const needle=String(fingerprint||'').slice(0,16),data=sheet.getLastRow()>1?sheet.getDataRange().getDisplayValues():[];
  for(let r=1;r<data.length;r++){
    if(!socialVerificationActivityMatches_(data[r],payload,needle))continue;
    if(String(data[r][6]||'').toUpperCase()==='OPEN - SOCIAL')sheet.getRange(r+1,4).setValue('Manual review exception: '+reason);
    return;
  }
  sheet.appendRow([payload.organization,'Social activity candidate',payload.text.slice(0,900),'Manual review exception: '+reason,payload.postUrl,'HIGH','OPEN - SOCIAL',Utilities.formatDate(now,LL_CONFIG.TZ,'yyyy-MM-dd'),'','Social fingerprint '+needle+'; platform='+payload.platform+'; activity='+activityType+'; media='+(payload.mediaUrl||'none')+'.']);
}

function socialUpsertVerificationAuditIdentityAware_(sheet,payload,activityType,fingerprint,status,itemId,reason,now){
  const needle=String(fingerprint||'').slice(0,16),date=Utilities.formatDate(now,LL_CONFIG.TZ,'yyyy-MM-dd');
  const resolution=status.indexOf('DUPLICATE')!==-1?'Automatic duplicate protection matched existing Hub Feed item '+itemId+'.':'Automatically verified and promoted to Hub Feed as '+itemId+'.';
  const audit='Automatic checks: '+reason+'; fingerprint='+needle+'; platform='+payload.platform+'; activity='+activityType+'.';
  const data=sheet.getLastRow()>1?sheet.getDataRange().getDisplayValues():[];
  for(let r=1;r<data.length;r++){
    if(!socialVerificationActivityMatches_(data[r],payload,needle))continue;
    sheet.getRange(r+1,7).setValue(status);
    sheet.getRange(r+1,8).setValue(date);
    sheet.getRange(r+1,9).setValue(resolution);
    sheet.getRange(r+1,10).setValue(audit);
    return;
  }
  sheet.appendRow([payload.organization,'Social activity automatic verification',payload.text.slice(0,900),'All automatic safeguards passed',payload.postUrl,'HIGH',status,date,resolution,audit]);
}

function runSocialVerificationAuditIdentityBridgeSelfTest(){
  const payload={postUrl:'https://example.com/events'};
  const sameUrlOtherFingerprint=['','','','','https://example.com/events','','','','','Social fingerprint aaaaaaaaaaaaaaaa;'];
  const sameActivity=['','','','','https://example.com/events','','','','','Automatic checks: ok; fingerprint=bbbbbbbbbbbbbbbb; platform=WEBSITE;'];
  const failures=[];
  if(socialVerificationActivityMatches_(sameUrlOtherFingerprint,payload,'bbbbbbbbbbbbbbbb'))failures.push('shared URL incorrectly matched a different fingerprint');
  if(!socialVerificationActivityMatches_(sameActivity,payload,'bbbbbbbbbbbbbbbb'))failures.push('same fingerprint did not match');
  if(!socialVerificationActivityMatches_(sameUrlOtherFingerprint,payload,''))failures.push('URL fallback failed when fingerprint is unavailable');
  if(failures.length)throw new Error('Verification audit identity bridge self-test failed: '+failures.join(' | '));
  Logger.log('Verification audit identity bridge self-test passed: 3/3');
}

// Install after SocialIntake.gs and the registration compatibility bridge.
socialEnsureManualVerification_=socialEnsureManualVerificationIdentityAware_;
socialUpsertVerificationAudit_=socialUpsertVerificationAuditIdentityAware_;
