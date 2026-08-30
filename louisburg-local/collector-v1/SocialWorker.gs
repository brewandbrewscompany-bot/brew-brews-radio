// Louisburg Local verified social-source worker.
//
// Purpose:
// - Reads verified rows from Social Worker Queue.
// - Uses supported Meta Graph API routes only.
// - Captures content-level post permalink, timestamp, text/caption and source media.
// - Writes normalized records into Social Post Intake.
// - Hands every new record to the existing verification gate; never auto-publishes.
//
// Security / source rule:
// LL_META_ACCESS_TOKEN and LL_META_IG_ACTOR_ID belong in Apps Script Script Properties.
// Never put tokens in this file, the spreadsheet, GitHub, logs, or the public frontend.
// Do NOT use Brew & Brews credentials, cookies, Page roles, tokens or Meta assets.
// Use a dedicated Louisburg Local Meta app/account and only permissions Meta officially grants.

function runLouisburgLocalSocialWorker() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(LL_CONFIG.LOCK_WAIT_MS || 5000)) return {ok:false, reason:'LOCKED'};

  try {
    const ss = SpreadsheetApp.openById(LL_CONFIG.SPREADSHEET_ID);
    const queueName = (LL_CONFIG.SHEETS && LL_CONFIG.SHEETS.SOCIAL_WORKERS) || 'Social Worker Queue';
    const intakeName = (LL_CONFIG.SHEETS && LL_CONFIG.SHEETS.SOCIAL_INTAKE) || 'Social Post Intake';
    const queue = ss.getSheetByName(queueName);
    const intake = ss.getSheetByName(intakeName);
    if (!queue || !intake) throw new Error('Social Worker Queue or Social Post Intake sheet missing.');
    if (queue.getLastRow() < 2) return {ok:true, scanned:0, fetched:0, added:0, duplicates:0, errors:0};

    const data = queue.getDataRange().getDisplayValues();
    const ix = headerMap_(data[0]);
    socialWorkerRequireHeaders_(ix, [
      'Queue ID','Business / Organization','Platform','Verified Profile URL','Source Status',
      'Priority','Scan Mode','Last Scan At','Last Result','Last Post URL','Last Post Date',
      'Last Post Text','Last Media URL','Activity Fingerprint','Next Scan','Publish Gate'
    ]);

    const props = PropertiesService.getScriptProperties();
    const meta = {
      token: String(props.getProperty('LL_META_ACCESS_TOKEN') || '').trim(),
      graphVersion: String(props.getProperty('LL_META_GRAPH_VERSION') || 'v24.0').trim(),
      igActorId: String(props.getProperty('LL_META_IG_ACTOR_ID') || '').trim()
    };

    const now = new Date();
    const maxWorkers = Number(LL_CONFIG.SOCIAL_WORKER_MAX_PER_RUN || 20);
    const lookbackDays = Number(LL_CONFIG.SOCIAL_LOOKBACK_DAYS || 45);
    let scanned = 0, fetched = 0, added = 0, duplicates = 0, errors = 0, unsupported = 0;

    for (let r = 1; r < data.length && scanned < maxWorkers; r++) {
      const row = data[r];
      const sourceStatus = cell_(row, ix, 'Source Status').toUpperCase();
      if (!/^VERIFIED/.test(sourceStatus)) continue;
      if (!socialWorkerDue_(row, ix, now)) continue;

      const queueId = cell_(row, ix, 'Queue ID');
      const org = cell_(row, ix, 'Business / Organization');
      const platform = cell_(row, ix, 'Platform').toUpperCase();
      const profileUrl = cell_(row, ix, 'Verified Profile URL');
      const scanMode = cell_(row, ix, 'Scan Mode').toUpperCase();
      if (!queueId || !org || !profileUrl || !scanMode) continue;

      scanned++;
      socialWorkerSet_(queue, r + 1, ix, 'Last Scan At', socialWorkerFmt_(now));

      try {
        let posts = [];
        if (scanMode === 'META_API_PUBLIC_PAGE' && platform === 'FACEBOOK') {
          socialWorkerRequireMetaToken_(meta);
          posts = socialWorkerFetchFacebookPagePosts_(profileUrl, meta);
        } else if (scanMode === 'META_IG_BUSINESS_DISCOVERY' && platform === 'INSTAGRAM') {
          socialWorkerRequireMetaToken_(meta);
          if (!meta.igActorId) throw new Error('META CONFIG REQUIRED: LL_META_IG_ACTOR_ID');
          posts = socialWorkerFetchInstagramBusinessPosts_(profileUrl, meta);
        } else {
          unsupported++;
          socialWorkerSet_(queue, r + 1, ix, 'Last Result', 'SKIPPED - unsupported scan mode '+scanMode+' for '+platform);
          continue;
        }

        fetched += posts.length;
        let workerAdded = 0, workerDupes = 0;
        for (let p = 0; p < posts.length; p++) {
          const post = posts[p];
          if (!socialWorkerWithinLookback_(post.postDate, now, lookbackDays)) continue;
          const payload = {
            organization: org,
            platform: platform,
            profileUrl: profileUrl,
            postUrl: post.postUrl,
            postId: post.postId,
            postDate: post.postDate,
            text: post.text,
            mediaUrl: post.mediaUrl,
            mediaType: post.mediaType,
            louisburgMatch: 'VERIFIED'
          };
          if (!payload.postUrl || !payload.text) continue;

          const fingerprint = socialFingerprint_(payload);
          if (socialFingerprintInSheet_(intake, fingerprint)) {
            duplicates++;
            workerDupes++;
            continue;
          }

          intake.appendRow([
            Utilities.getUuid(), queueId, org, platform, profileUrl, payload.postUrl,
            payload.postId, payload.postDate, socialWorkerFmt_(now), payload.text,
            payload.mediaUrl, payload.mediaType, '', payload.louisburgMatch, fingerprint,
            'PENDING', '', '', '', 'Captured by verified Social Worker Queue via '+scanMode+'; verification gate mandatory.'
          ]);
          added++;
          workerAdded++;
        }

        if (posts.length) {
          const latest = posts[0];
          const latestPayload = {
            organization: org,
            platform: platform,
            postUrl: latest.postUrl,
            postId: latest.postId,
            text: latest.text
          };
          socialWorkerSet_(queue, r + 1, ix, 'Last Post URL', latest.postUrl || '');
          socialWorkerSet_(queue, r + 1, ix, 'Last Post Date', latest.postDate || '');
          socialWorkerSet_(queue, r + 1, ix, 'Last Post Text', socialWorkerTruncate_(latest.text || '', 5000));
          socialWorkerSet_(queue, r + 1, ix, 'Last Media URL', latest.mediaUrl || '');
          socialWorkerSet_(queue, r + 1, ix, 'Activity Fingerprint', socialFingerprint_(latestPayload));
        }

        socialWorkerSet_(queue, r + 1, ix, 'Last Result',
          'OK - fetched '+posts.length+'; new intake '+workerAdded+'; duplicate '+workerDupes);
      } catch (err) {
        errors++;
        socialWorkerSet_(queue, r + 1, ix, 'Last Result', socialWorkerSafeError_(err));
      }
    }

    SpreadsheetApp.flush();
    let intakeSummary = null;
    if (added > 0 && typeof processSocialPostIntake === 'function') intakeSummary = processSocialPostIntake();
    return {ok:true, scanned:scanned, fetched:fetched, added:added, duplicates:duplicates, errors:errors, unsupported:unsupported, intake:intakeSummary};
  } finally {
    lock.releaseLock();
  }
}

function runLouisburgLocalSocialWorkerDiagnostics() {
  const props = PropertiesService.getScriptProperties();
  const ss = SpreadsheetApp.openById(LL_CONFIG.SPREADSHEET_ID);
  const queue = ss.getSheetByName((LL_CONFIG.SHEETS && LL_CONFIG.SHEETS.SOCIAL_WORKERS) || 'Social Worker Queue');
  let verified = 0, facebook = 0, instagram = 0;
  if (queue && queue.getLastRow() > 1) {
    const data = queue.getDataRange().getDisplayValues(), ix = headerMap_(data[0]);
    for (let r = 1; r < data.length; r++) {
      if (!/^VERIFIED/.test(cell_(data[r], ix, 'Source Status').toUpperCase())) continue;
      verified++;
      const p = cell_(data[r], ix, 'Platform').toUpperCase();
      if (p === 'FACEBOOK') facebook++;
      if (p === 'INSTAGRAM') instagram++;
    }
  }
  const result = {
    ok:true,
    queuePresent:!!queue,
    verifiedWorkers:verified,
    verifiedFacebook:facebook,
    verifiedInstagram:instagram,
    metaTokenConfigured:!!String(props.getProperty('LL_META_ACCESS_TOKEN') || '').trim(),
    instagramActorConfigured:!!String(props.getProperty('LL_META_IG_ACTOR_ID') || '').trim(),
    graphVersion:String(props.getProperty('LL_META_GRAPH_VERSION') || 'v24.0')
  };
  Logger.log(JSON.stringify(result));
  return result;
}

function runLouisburgLocalSocialWorkerSelfTest() {
  const failures = [];
  if (socialWorkerFacebookRef_('https://www.facebook.com/450736031663124') !== '450736031663124') failures.push('numeric Facebook page');
  if (socialWorkerFacebookRef_('https://facebook.com/LouisburgKS/') !== 'LouisburgKS') failures.push('Facebook username');
  if (socialWorkerFacebookRef_('https://www.facebook.com/profile.php?id=123456') !== '123456') failures.push('Facebook profile.php id');
  if (socialWorkerInstagramUsername_('https://www.instagram.com/timbercreeklouisburg/') !== 'timbercreeklouisburg') failures.push('Instagram username');
  if (failures.length) throw new Error('Social Worker self-test failed: '+failures.join(' | '));
  Logger.log('Social Worker self-test passed: 4/4');
  return {ok:true, tests:4};
}

function socialWorkerFetchFacebookPagePosts_(profileUrl, meta) {
  const ref = socialWorkerFacebookRef_(profileUrl);
  if (!ref) throw new Error('Invalid Facebook Page URL: '+profileUrl);

  let pageId = ref;
  if (!/^\d+$/.test(pageId)) {
    const page = socialWorkerGraphGet_(ref, {fields:'id,name,link'}, meta);
    if (!page || !page.id) throw new Error('META PAGE RESOLUTION FAILED: '+ref);
    pageId = String(page.id);
  }

  // /posts targets posts created by the Page itself. Keep fields intentionally minimal
  // so the worker does not request private/profile data it does not need.
  const result = socialWorkerGraphGet_(pageId + '/posts', {
    fields:'id,message,story,created_time,permalink_url,full_picture',
    limit:'15'
  }, meta);
  const rows = (result && result.data) || [];
  return rows.map(function(item) {
    const text = String(item.message || item.story || '').replace(/\s+/g, ' ').trim();
    return {
      postId:String(item.id || ''),
      postUrl:String(item.permalink_url || ''),
      postDate:String(item.created_time || ''),
      text:text,
      mediaUrl:String(item.full_picture || ''),
      mediaType:item.full_picture ? 'IMAGE' : ''
    };
  }).filter(function(item) { return !!item.postUrl && !!item.text; });
}

function socialWorkerFetchInstagramBusinessPosts_(profileUrl, meta) {
  const username = socialWorkerInstagramUsername_(profileUrl);
  if (!username) throw new Error('Invalid Instagram profile URL: '+profileUrl);
  const fields = 'business_discovery.username(' + username + '){id,username,media.limit(15){id,caption,media_type,media_url,permalink,timestamp,thumbnail_url}}';
  const result = socialWorkerGraphGet_(meta.igActorId, {fields:fields}, meta);
  const discovery = result && result.business_discovery;
  const rows = discovery && discovery.media && discovery.media.data ? discovery.media.data : [];
  return rows.map(function(item) {
    const mediaType = String(item.media_type || '').toUpperCase();
    return {
      postId:String(item.id || ''),
      postUrl:String(item.permalink || ''),
      postDate:String(item.timestamp || ''),
      text:String(item.caption || '').replace(/\s+/g, ' ').trim(),
      mediaUrl:String(item.media_url || item.thumbnail_url || ''),
      mediaType:mediaType
    };
  }).filter(function(item) { return !!item.postUrl && !!item.text; });
}

function socialWorkerGraphGet_(path, params, meta) {
  const version = String(meta.graphVersion || 'v24.0').replace(/^\/+|\/+$/g, '');
  const base = 'https://graph.facebook.com/' + encodeURIComponent(version) + '/' + path.replace(/^\/+/, '');
  const pairs = [];
  Object.keys(params || {}).forEach(function(k) {
    if (params[k] == null || params[k] === '') return;
    pairs.push(encodeURIComponent(k) + '=' + encodeURIComponent(String(params[k])));
  });
  pairs.push('access_token=' + encodeURIComponent(meta.token));
  const url = base + '?' + pairs.join('&');
  const response = UrlFetchApp.fetch(url, {method:'get', muteHttpExceptions:true, followRedirects:true});
  const code = response.getResponseCode();
  const body = response.getContentText();
  let parsed = {};
  try { parsed = JSON.parse(body); } catch (ignored) {}
  if (code < 200 || code >= 300 || parsed.error) {
    const e = parsed && parsed.error ? parsed.error : {};
    const msg = String(e.message || body || ('HTTP '+code)).replace(/access_token=[^&\s]+/ig, 'access_token=[REDACTED]');
    throw new Error('META HTTP '+code+(e.code != null ? ' code '+e.code : '')+': '+socialWorkerTruncate_(msg, 500));
  }
  return parsed;
}

function socialWorkerRequireMetaToken_(meta) {
  if (!meta.token) throw new Error('META CONFIG REQUIRED: LL_META_ACCESS_TOKEN');
}

function socialWorkerFacebookRef_(url) {
  const raw = String(url || '').trim();
  const idMatch = raw.match(/[?&]id=(\d+)/i);
  if (idMatch) return idMatch[1];
  const clean = raw.replace(/^https?:\/\/(?:www\.|m\.)?facebook\.com\//i, '').split(/[?#]/)[0].replace(/^\/+|\/+$/g, '');
  if (!clean) return '';
  const first = clean.split('/')[0];
  if (/^(pages|groups|events|watch|reel|share)$/i.test(first)) return '';
  return first;
}

function socialWorkerInstagramUsername_(url) {
  const clean = String(url || '').trim().replace(/^https?:\/\/(?:www\.)?instagram\.com\//i, '').split(/[?#]/)[0].replace(/^\/+|\/+$/g, '');
  if (!clean) return '';
  return clean.split('/')[0].replace(/^@/, '');
}

function socialWorkerWithinLookback_(value, now, days) {
  const d = new Date(String(value || ''));
  if (isNaN(d.getTime())) return true;
  return (now.getTime() - d.getTime()) <= days * 86400000;
}

function socialWorkerDue_(row, ix, now) {
  const lastText = cell_(row, ix, 'Last Scan At');
  const nextText = cell_(row, ix, 'Next Scan').toUpperCase();
  const priority = cell_(row, ix, 'Priority').toUpperCase();
  const last = socialWorkerDate_(lastText);
  if (!last) return true;

  const nextDate = socialWorkerDate_(cell_(row, ix, 'Next Scan'));
  if (nextDate && !/^(HOURLY|DAILY|WEEKLY)$/.test(nextText)) return now >= nextDate;

  let hours = priority === 'HIGH' ? 1 : (priority === 'MEDIUM' ? 24 : 168);
  if (nextText === 'HOURLY') hours = 1;
  if (nextText === 'DAILY') hours = 24;
  if (nextText === 'WEEKLY') hours = 168;
  return (now.getTime() - last.getTime()) >= hours * 3600000;
}

function socialWorkerDate_(value) {
  const s = String(value || '').trim();
  if (!s) return null;
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  const d2 = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6] || 0));
  return isNaN(d2.getTime()) ? null : d2;
}

function socialWorkerRequireHeaders_(ix, names) {
  const missing = names.filter(function(n) { return ix[n] == null; });
  if (missing.length) throw new Error('Social Worker Queue missing columns: '+missing.join(', '));
}

function socialWorkerSet_(sheet, rowNumber, ix, header, value) {
  if (ix[header] == null) return;
  sheet.getRange(rowNumber, ix[header] + 1).setValue(value);
}

function socialWorkerFmt_(d) {
  return Utilities.formatDate(d, LL_CONFIG.TZ || 'America/Chicago', 'yyyy-MM-dd HH:mm:ss');
}

function socialWorkerTruncate_(value, max) {
  const s = String(value == null ? '' : value);
  return s.length > max ? s.slice(0, max) : s;
}

function socialWorkerSafeError_(err) {
  let msg = String(err && err.message ? err.message : err || 'Unknown social worker error');
  msg = msg.replace(/access_token=[^&\s]+/ig, 'access_token=[REDACTED]');
  if (/META CONFIG REQUIRED/.test(msg)) return 'BLOCKED - '+msg;
  if (/META HTTP/.test(msg)) return 'META ERROR - '+socialWorkerTruncate_(msg, 700);
  return 'ERROR - '+socialWorkerTruncate_(msg, 700);
}
