from pathlib import Path


def replace_function(text, name, new_code):
    marker = f'function {name}'
    start = text.find(marker)
    if start < 0:
        raise ValueError(f'Function not found: {name}')
    brace = text.find('{', start)
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
        if not in_d and not in_t and ch == "'": in_s = not in_s
        elif not in_s and not in_t and ch == '"': in_d = not in_d
        elif not in_s and not in_d and ch == '`': in_t = not in_t
        elif not (in_s or in_d or in_t):
            if ch == '{': depth += 1
            elif ch == '}':
                depth -= 1
                if depth == 0:
                    return text[:start] + new_code.rstrip() + text[i+1:]
        i += 1
    raise ValueError(f'Closing brace not found: {name}')

social_path=Path('louisburg-local/collector-v1/SocialIntake.gs')
social=social_path.read_text()

new_record=r'''function recordSocialIntakeWebhook_(body) {
  requireSocialIngestKey_(body);

  // Serialize the fingerprint check/write only. This prevents two collectors
  // from appending the same post simultaneously. Release before processing so
  // the processor can acquire its own ScriptLock without deadlocking.
  const ingestLock=LockService.getScriptLock();
  if(!ingestLock.tryLock(4000))throw new Error('Social intake is busy; retry delivery.');

  let result=null;
  let fingerprint='';
  try {
    const ss=SpreadsheetApp.openById(LL_CONFIG.SPREADSHEET_ID),sheet=ss.getSheetByName('Social Post Intake');
    if(!sheet)throw new Error('Social Post Intake sheet missing.');

    const platform=String(body.platform||'').trim().toUpperCase();
    const postUrl=String(body.postUrl||'').trim(),profileUrl=String(body.profileUrl||'').trim(),text=String(body.postText||body.text||'').trim();
    const org=String(body.organization||body.business||'').trim();
    if(!org||!postUrl||!text||!/^https?:\/\//i.test(postUrl))throw new Error('Missing social post fields.');

    const payload={organization:org,platform:platform,profileUrl:profileUrl,postUrl:postUrl,postId:String(body.postId||'').trim(),postDate:String(body.postDate||'').trim(),capturedAt:fmt_(new Date()),text:text,mediaUrl:String(body.mediaUrl||'').trim(),mediaType:String(body.mediaType||'').trim(),activityType:String(body.activityType||'').trim(),louisburgMatch:String(body.louisburgMatch||'').trim()};
    fingerprint=socialFingerprint_(payload);
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
        result={ok:true,duplicate:true,retried:true,fingerprint:fingerprint};
      }else{
        result={ok:true,duplicate:true,retried:false,fingerprint:fingerprint};
      }
    }else{
      sheet.appendRow([Utilities.getUuid(),String(body.queueId||''),org,platform,profileUrl,postUrl,payload.postId,payload.postDate,payload.capturedAt,text,payload.mediaUrl,payload.mediaType,payload.activityType,payload.louisburgMatch,fingerprint,'PENDING','','','','Webhook intake; immediate processing requested; scheduled processor remains the recovery watchdog.']);
      SpreadsheetApp.flush();
      result={ok:true,duplicate:false,retried:false,fingerprint:fingerprint};
    }
  } finally {
    ingestLock.releaseLock();
  }

  if(result&&!result.duplicate || result&&result.retried){
    const immediate=attemptImmediateSocialProcess_(fingerprint);
    result.immediateProcess=immediate.status;
    result.immediateSummary=immediate.summary||null;
  }else if(result){
    result.immediateProcess='DUPLICATE_SKIPPED';
  }
  return result;
}'''

social=replace_function(social,'recordSocialIntakeWebhook_(body)',new_record)
social_path.write_text(social)

web_path=Path('louisburg-local/collector-v1/WebApp.gs')
web=web_path.read_text()
old="""      const result = recordSocialIntakeWebhook_(body);\n      return jsonOutput_({ok:true,received:true,duplicate:!!result.duplicate,fingerprint:result.fingerprint||''});"""
new="""      const result = recordSocialIntakeWebhook_(body);\n      return jsonOutput_({ok:true,received:true,duplicate:!!result.duplicate,retried:!!result.retried,fingerprint:result.fingerprint||'',immediateProcess:result.immediateProcess||''});"""
if old not in web:
    if 'immediateProcess:result.immediateProcess' not in web:
        raise ValueError('Expected WebApp social_intake response block not found')
else:
    web=web.replace(old,new,1)
web_path.write_text(web)
print('finalized SocialIntake lock and WebApp intake observability')
