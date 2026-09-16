from pathlib import Path

target = Path('louisburg-local/collector-v1/SocialIntake.gs')
src = target.read_text()
if src.startswith('// REPLACEMENT BUILD 2026-09-16:'):
    print('SocialIntake.gs already hardened; no changes needed')
    raise SystemExit(0)

def replace_function(text, name, new_code):
    marker = f'function {name}'
    start = text.find(marker)
    if start < 0:
        raise ValueError(f'Function not found: {name}')
    brace = text.find('{', start)
    if brace < 0:
        raise ValueError(f'Opening brace not found: {name}')
    depth = 0
    in_s = in_d = in_t = False
    esc = False
    i = brace
    while i < len(text):
        ch = text[i]
        if esc:
            esc = False
            i += 1
            continue
        if (in_s or in_d or in_t) and ch == '\\':
            esc = True
            i += 1
            continue
        if not in_d and not in_t and ch == "'":
            in_s = not in_s
        elif not in_s and not in_t and ch == '"':
            in_d = not in_d
        elif not in_s and not in_d and ch == '`':
            in_t = not in_t
        elif not (in_s or in_d or in_t):
            if ch == '{':
                depth += 1
            elif ch == '}':
                depth -= 1
                if depth == 0:
                    end = i + 1
                    return text[:start] + new_code.rstrip() + text[end:]
        i += 1
    raise ValueError(f'Closing brace not found: {name}')

new_self_test = r'''function runSocialIntakeSelfTest() {
  const now = new Date(2026, 7, 30, 13, 30, 0);
  const cases = [
    {name:'fresh special', text:'Louisburg KS. Today only: burger basket special until 8 PM.', postDate:'2026-08-30T12:00:00-05:00', want:true, wantType:'Deal / Special'},
    {name:'fresh live music', text:'Louisburg KS. Live music tomorrow at 7 PM.', postDate:'2026-08-30T10:00:00-05:00', want:true, wantType:'Event / Activity'},
    {name:'fresh hiring', text:'Louisburg KS. We are now hiring part-time help. Apply today.', postDate:'2026-08-29T10:00:00-05:00', want:true, wantType:'Hiring'},
    {name:'fresh new product', text:'Louisburg KS. New fall drink available now.', postDate:'2026-08-30T09:00:00-05:00', want:true, wantType:'New Product / Offering'},
    {name:'fresh stock arrival', text:'Fresh apples have officially arrived at our Louisburg Country Store.', postDate:'2026-08-29T09:00:00-05:00', want:true, wantType:'New Product / Offering'},
    {name:'free coffee current offering', text:"Louisburg KS. Wednesday's coffee is ready! As always, the brewed coffee is FREE. Come by the roastery and grab a complimentary cup today.", postDate:'2026-08-30T09:00:00-05:00', want:true, wantType:'Deal / Special'},
    {name:'ready to pour offering', text:'Louisburg KS. Fresh brewed coffee is ready to pour today. Stop by and try a cup.', postDate:'2026-08-30T09:00:00-05:00', want:true, wantType:'New Product / Offering'},
    {name:'old generic post', text:'Louisburg KS. Check out our menu and services.', postDate:'2026-07-01T09:00:00-05:00', want:false},
    {name:'navigation boilerplate', text:'Louisburg KS. Home About Contact Follow us Privacy Policy.', postDate:'2026-08-30T09:00:00-05:00', want:false},
    {name:'not louisburg', text:'Join us tonight for live music in Overland Park.', postDate:'2026-08-30T09:00:00-05:00', want:false}
  ];
  const failures=[];
  cases.forEach(function(tc){
    const result=socialPostGate_({text:tc.text,postDate:tc.postDate,louisburgMatch:/louisburg/i.test(tc.text)?'YES':'NO'},now);
    if(result.ok!==tc.want)failures.push(tc.name+': expected '+tc.want+', got '+result.ok+' ('+result.reason+')');
    if(tc.want&&tc.wantType&&result.activityType!==tc.wantType)failures.push(tc.name+': expected type '+tc.wantType+', got '+result.activityType);
  });
  if(failures.length)throw new Error('Social Intake self-test failed: '+failures.join(' | '));
  Logger.log('Social Intake self-test passed: '+cases.length+'/'+cases.length);
}'''

new_process = r'''function processSocialPostIntake(targetFingerprint) {
  const lock=LockService.getScriptLock();
  const waitMs=targetFingerprint?2500:5000;
  if(!lock.tryLock(waitMs)){
    return {processed:0,queued:0,rejected:0,duplicates:0,promoted:0,hubDuplicates:0,manualReview:0,errors:0,deferred:true,reason:'LOCK_BUSY'};
  }
  try {
    return processSocialPostIntakeUnlocked_(String(targetFingerprint||'').trim());
  } finally {
    lock.releaseLock();
  }
}

function processSocialPostIntakeUnlocked_(targetFingerprint) {
  const ss=SpreadsheetApp.openById(LL_CONFIG.SPREADSHEET_ID);
  const sheet=ss.getSheetByName('Social Post Intake');
  const verify=ss.getSheetByName(LL_CONFIG.SHEETS.VERIFY);
  const feed=ss.getSheetByName(LL_CONFIG.SHEETS.FEED);
  if(!sheet||!verify||!feed)throw new Error('Social intake, verification or Hub Feed sheet missing.');
  if(sheet.getLastRow()<2)return {processed:0,queued:0,rejected:0,duplicates:0,promoted:0,hubDuplicates:0,manualReview:0,errors:0,deferred:false};

  const data=sheet.getDataRange().getDisplayValues(),headers=data[0],ix=headerMap_(headers),now=new Date();
  const sourceIndex=socialVerifiedWorkerIndex_(ss);
  const registryIndex=socialRegistryAutoIndex_(ss);
  const endpointIndex=socialFirstPartyEndpointIndex_(ss);
  const hubIndex=socialHubIndex_(feed);
  let processed=0,queued=0,rejected=0,duplicates=0,promoted=0,hubDuplicates=0,manualReview=0,errors=0;
  const seenThisRun={};

  for(let r=1;r<data.length;r++){
    const row=data[r];
    const rowFingerprint=cell_(row,ix,'Activity Fingerprint').trim();
    if(targetFingerprint&&rowFingerprint&&rowFingerprint!==targetFingerprint)continue;

    const worker=cell_(row,ix,'Worker Result').toUpperCase();
    if(/^(REJECTED|DUPLICATE|PROMOTED|DONE|AUTO-RESOLVED)/.test(worker))continue;
    const alreadyQueued=/^QUEUED FOR VERIFICATION/.test(worker);

    try {
      const payload={
        intakeId:cell_(row,ix,'Intake ID'),queueId:cell_(row,ix,'Queue ID'),organization:cell_(row,ix,'Business / Organization'),platform:cell_(row,ix,'Platform'),profileUrl:cell_(row,ix,'Profile URL'),postUrl:cell_(row,ix,'Post URL'),postId:cell_(row,ix,'Post ID'),postDate:cell_(row,ix,'Post Date / Time'),capturedAt:cell_(row,ix,'Captured At'),text:cell_(row,ix,'Post Text'),mediaUrl:cell_(row,ix,'Media URL'),mediaType:cell_(row,ix,'Media Type'),activityType:cell_(row,ix,'Activity Type'),louisburgMatch:cell_(row,ix,'Louisburg Match')
      };

      if(!payload.organization||!payload.postUrl||!payload.text){
        errors++;
        setSocialValue_(sheet,r+1,ix,'Worker Result','ERROR - RETRY PENDING');
        setSocialValue_(sheet,r+1,ix,'Verification Status','RETRY PENDING');
        setSocialValue_(sheet,r+1,ix,'Hub Eligibility','RETRY');
        setSocialValue_(sheet,r+1,ix,'Notes','Incomplete intake payload; waiting for a later collector/retry pass.');
        continue;
      }

      processed++;
      const gate=socialPostGate_(payload,now),fingerprint=socialFingerprint_(payload);
      setSocialValue_(sheet,r+1,ix,'Activity Fingerprint',fingerprint);
      if(targetFingerprint&&fingerprint!==targetFingerprint)continue;

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
      const auto=socialAutoVerificationDecision_(payload,activityType,now,sourceIndex,registryIndex,endpointIndex);
      if(auto.ok){
        const result=socialPromoteToHub_(feed,hubIndex,payload,activityType,fingerprint,auto,now);
        if(result.duplicate){
          hubDuplicates++;
          setSocialValue_(sheet,r+1,ix,'Worker Result','AUTO-RESOLVED - DUPLICATE HUB ITEM');
          setSocialValue_(sheet,r+1,ix,'Verification Status','AUTO-RESOLVED - DUPLICATE');
          setSocialValue_(sheet,r+1,ix,'Hub Eligibility','NO - DUPLICATE');
          setSocialValue_(sheet,r+1,ix,'Promoted Item ID',result.itemId||'');
          setSocialValue_(sheet,r+1,ix,'Notes','Automatic safeguards passed, but the public source or dedupe key already exists in Hub Feed.');
          socialUpsertVerificationAudit_(verify,payload,activityType,fingerprint,'AUTO-RESOLVED - DUPLICATE HUB ITEM',result.itemId||'',auto.reason,now);
        }else{
          promoted++;
          setSocialValue_(sheet,r+1,ix,'Worker Result','PROMOTED - AUTO-VERIFIED');
          setSocialValue_(sheet,r+1,ix,'Verification Status',auto.sourceType==='FIRST_PARTY'?'AUTO-VERIFIED - FIRST PARTY':'AUTO-VERIFIED - SOCIAL');
          setSocialValue_(sheet,r+1,ix,'Hub Eligibility','YES');
          setSocialValue_(sheet,r+1,ix,'Promoted Item ID',result.itemId);
          setSocialValue_(sheet,r+1,ix,'Notes',auto.sourceType==='FIRST_PARTY'?'Automatically verified from a verified Louisburg first-party source; normal exception safeguards passed.':'Automatically verified from a recent public post on a verified Louisburg Page; normal exception safeguards passed.');
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
    } catch(rowErr) {
      errors++;
      try {
        setSocialValue_(sheet,r+1,ix,'Worker Result','ERROR - RETRY PENDING');
        setSocialValue_(sheet,r+1,ix,'Verification Status','RETRY PENDING');
        setSocialValue_(sheet,r+1,ix,'Hub Eligibility','RETRY');
        setSocialValue_(sheet,r+1,ix,'Notes','Automatic processor error; retry will continue: '+String(rowErr).replace(/\s+/g,' ').slice(0,240));
      } catch(ignored) {}
      console.error('Social Intake row '+(r+1)+' failed and was isolated for retry: '+rowErr);
    }
  }

  return {processed:processed,queued:queued,rejected:rejected,duplicates:duplicates,promoted:promoted,hubDuplicates:hubDuplicates,manualReview:manualReview,errors:errors,deferred:false};
}'''

new_record = r'''function recordSocialIntakeWebhook_(body) {
  requireSocialIngestKey_(body);
  const ss=SpreadsheetApp.openById(LL_CONFIG.SPREADSHEET_ID),sheet=ss.getSheetByName('Social Post Intake');
  if(!sheet)throw new Error('Social Post Intake sheet missing.');

  const platform=String(body.platform||'').trim().toUpperCase();
  const postUrl=String(body.postUrl||'').trim(),profileUrl=String(body.profileUrl||'').trim(),text=String(body.postText||body.text||'').trim();
  const org=String(body.organization||body.business||'').trim();
  if(!org||!postUrl||!text||!/^https?:\/\//i.test(postUrl))throw new Error('Missing social post fields.');

  const payload={organization:org,platform:platform,profileUrl:profileUrl,postUrl:postUrl,postId:String(body.postId||'').trim(),postDate:String(body.postDate||'').trim(),capturedAt:fmt_(new Date()),text:text,mediaUrl:String(body.mediaUrl||'').trim(),mediaType:String(body.mediaType||'').trim(),activityType:String(body.activityType||'').trim(),louisburgMatch:String(body.louisburgMatch||'').trim()};
  const fingerprint=socialFingerprint_(payload);
  const existing=socialFindFingerprintRecord_(sheet,fingerprint);

  if(existing){
    const current=String(existing.workerResult||'').toUpperCase();
    const retryable=/^(PENDING|PENDING - RETRY|ERROR - RETRY PENDING|REJECTED - NO ACTIONABLE ACTIVITY)/.test(current);
    if(retryable){
      const ix=existing.ix,row=existing.row;
      if(payload.activityType)setSocialValue_(sheet,row,ix,'Activity Type',payload.activityType);
      if(payload.louisburgMatch)setSocialValue_(sheet,row,ix,'Louisburg Match',payload.louisburgMatch);
      if(payload.mediaUrl)setSocialValue_(sheet,row,ix,'Media URL',payload.mediaUrl);
      if(payload.mediaType)setSocialValue_(sheet,row,ix,'Media Type',payload.mediaType);
      if(payload.postDate)setSocialValue_(sheet,row,ix,'Post Date / Time',payload.postDate);
      setSocialValue_(sheet,row,ix,'Post Text',payload.text);
      setSocialValue_(sheet,row,ix,'Captured At',payload.capturedAt);
      setSocialValue_(sheet,row,ix,'Worker Result','PENDING - RETRY');
      setSocialValue_(sheet,row,ix,'Verification Status','');
      setSocialValue_(sheet,row,ix,'Hub Eligibility','');
      setSocialValue_(sheet,row,ix,'Notes','Rediscovered public activity; immediate retry requested.');
      SpreadsheetApp.flush();
      const immediate=attemptImmediateSocialProcess_(fingerprint);
      return {ok:true,duplicate:true,retried:true,fingerprint:fingerprint,immediateProcess:immediate.status,immediateSummary:immediate.summary||null};
    }

    return {ok:true,duplicate:true,retried:false,fingerprint:fingerprint,immediateProcess:'DUPLICATE_SKIPPED'};
  }

  sheet.appendRow([Utilities.getUuid(),String(body.queueId||''),org,platform,profileUrl,postUrl,payload.postId,payload.postDate,payload.capturedAt,text,payload.mediaUrl,payload.mediaType,payload.activityType,payload.louisburgMatch,fingerprint,'PENDING','','','','Webhook intake; immediate processing requested; scheduled processor remains the recovery watchdog.']);
  SpreadsheetApp.flush();

  const immediate=attemptImmediateSocialProcess_(fingerprint);
  return {ok:true,duplicate:false,retried:false,fingerprint:fingerprint,immediateProcess:immediate.status,immediateSummary:immediate.summary||null};
}

function attemptImmediateSocialProcess_(fingerprint){
  try {
    const summary=processSocialPostIntake(String(fingerprint||'').trim());
    if(summary&&summary.deferred)return {status:'DEFERRED_LOCK',summary:summary};
    return {status:'PROCESSED',summary:summary||{}};
  } catch(err) {
    console.error('Immediate Social Intake processing deferred to watchdog: '+err);
    return {status:'DEFERRED_ERROR',summary:{error:String(err).replace(/\s+/g,' ').slice(0,240)}};
  }
}

function socialFindFingerprintRecord_(sheet,fingerprint){
  if(!sheet||sheet.getLastRow()<2)return null;
  const data=sheet.getDataRange().getDisplayValues(),ix=headerMap_(data[0]);
  const fpCol=ix['Activity Fingerprint'],workerCol=ix['Worker Result'];
  if(fpCol==null)return null;
  for(let r=data.length-1;r>=1;r--){
    if(String(data[r][fpCol]||'').trim()!==fingerprint)continue;
    return {row:r+1,ix:ix,workerResult:workerCol==null?'':String(data[r][workerCol]||'')};
  }
  return null;
}'''

new_classify = r'''function classifySocialActivity_(t) {
  t=String(t||'').toLowerCase();
  if(/closed today|closing early|closure|cancelled|canceled|postponed|rescheduled|delayed|sold out|hours? changed|change(?:d)? (?:our )?hours/.test(t))return 'Operational Update';
  if(/now hiring|\bhiring\b|apply today|job opening|applications? (?:close|closing|due)/.test(t))return 'Hiring';
  if(/daily special|special today|today only|\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+special|\bspecials?\b|\bdeal\b|discount|coupon|promo(?:tion)? code|\b\d{1,3}\s*%\s*off\b|\bsave\s+\d{1,3}\s*%\b|promotion|on sale|sale ends|buy one|get one|\bbogo\b|\bgiveaway\b|\bfree\b.{0,45}\b(?:coffee|drink|cup|sample|tasting|beverage)\b|\bcomplimentary\b.{0,45}\b(?:coffee|drink|cup|sample|tasting|beverage)\b|\b(?:coffee|drink|cup|sample|tasting|beverage)\b.{0,45}\bfree\b/.test(t))return 'Deal / Special';
  if(/new product|new coffee|new drink|new menu|launch|release|available now|now available|available today|serving today|freshly roasted|fresh inventory|fresh brewed|freshly brewed|coffee is ready|ready to pour|ready today|ready now|\bare here\b|\b(?:has|have) (?:officially )?arrived\b|\bjust arrived\b|\bback in stock\b|\bnow in stock\b/.test(t))return 'New Product / Offering';
  if(/live music|concert|festival|workshop|fundraiser|open house|\bevent\b|tickets|register now|registration open|open enrollment|sign up|signup|\bclass(?:es)?\b/.test(t))return 'Event / Activity';
  if(/now open|grand opening|open today|we(?:'|’)re open|online ordering|new hours|extended hours/.test(t))return 'Business Update';
  return '';
}'''

new_fp_exists = r'''function socialFingerprintExistsElsewhere_(data,ix,currentIndex,fingerprint){
  const c=ix['Activity Fingerprint'],w=ix['Worker Result'];
  if(c==null)return false;
  for(let r=1;r<data.length;r++){
    if(r===currentIndex)continue;
    if(String(data[r][c]||'').trim()!==fingerprint)continue;
    const state=w==null?'':String(data[r][w]||'').toUpperCase().trim();
    if(/^(REJECTED - NO ACTIONABLE ACTIVITY|ERROR - RETRY PENDING|PENDING - RETRY)$/.test(state))continue;
    return true;
  }
  return false;
}'''

src = replace_function(src, 'runSocialIntakeSelfTest()', new_self_test)
src = replace_function(src, 'processSocialPostIntake()', new_process)
src = replace_function(src, 'recordSocialIntakeWebhook_(body)', new_record)
src = replace_function(src, 'classifySocialActivity_(t)', new_classify)
src = replace_function(src, 'socialFingerprintExistsElsewhere_(data,ix,currentIndex,fingerprint)', new_fp_exists)

header = "// REPLACEMENT BUILD 2026-09-16: immediate intake processing, row isolation, retry repair, expanded current-offer classification.\n"
if not src.startswith('// REPLACEMENT BUILD'):
    src = header + src

target.write_text(src)
print('wrote', len(src.splitlines()), 'lines')
