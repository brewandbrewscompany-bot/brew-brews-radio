function doGet(e) {
  const action = String((e && e.parameter && e.parameter.action) || 'feed').toLowerCase();
  if (action === 'feed') return jsonOutput_(buildPublicFeedPayload_());
  return jsonOutput_({ok:false,error:'Unknown action'});
}

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const action = String(body.action || '').toLowerCase();
    if (action === 'reaction') return jsonOutput_(recordReaction_(body));
    if (action === 'sherlock') return jsonOutput_(recordSherlockNote_(body));
    return jsonOutput_({ok:false,error:'Unknown action'});
  } catch (err) {
    return jsonOutput_({ok:false,error:String(err).slice(0,300)});
  }
}

function buildPublicFeedPayload_() {
  const ss = SpreadsheetApp.openById(LL_CONFIG.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(LL_CONFIG.SHEETS.FEED);
  if (!sheet || sheet.getLastRow() < 2) return {ok:true,items:[],visitCount:getVisitCount_()};

  const data = sheet.getDataRange().getDisplayValues();
  const headers = data.shift();
  const ix = headerMap_(headers);
  const items = [];
  const now = new Date();
  const today = Utilities.formatDate(now, LL_CONFIG.TZ || 'America/Chicago', 'yyyy-MM-dd');

  data.forEach(function(row) {
    const eligibility = cell_(row, ix, 'Public Eligibility').toUpperCase();
    if (['YES','LIMITED'].indexOf(eligibility) === -1) return;
    if (!isPublicFeedItemCurrent_(row, ix, now, today)) return;

    const sourceSet = cell_(row, ix, 'Source Set');
    items.push({
      id: cell_(row, ix, 'Item ID'),
      organization: cell_(row, ix, 'Business / Organization'),
      category: cell_(row, ix, 'Category'),
      headline: cell_(row, ix, 'Headline'),
      summary: cell_(row, ix, 'Summary'),
      section: cell_(row, ix, 'Current Section'),
      date: cell_(row, ix, 'Relevant / Event Date'),
      time: cell_(row, ix, 'Time / Window'),
      location: cell_(row, ix, 'Location'),
      originalUrl: cell_(row, ix, 'Original URL'),
      lifecycleState: cell_(row, ix, 'Lifecycle State'),
      activityType: cell_(row, ix, 'Business Activity Type'),
      sherlockStatus: cell_(row, ix, 'Sherlock Status'),
      likeCount: Number(cell_(row, ix, 'Like Count') || 0),
      heartCount: Number(cell_(row, ix, 'Heart Count') || 0),
      tags: deriveTags_(row, ix),
      sourceMediaUrl: extractSourceMediaUrl_(sourceSet),
      rankScore: Number(cell_(row, ix, 'Rank Score') || 0)
    });
  });

  items.sort(function(a,b) { return b.rankScore - a.rankScore; });
  const rotated = (typeof fairRotateFeed_ === 'function') ? fairRotateFeed_(items) : items;
  return {ok:true,items:rotated,visitCount:getVisitCount_(),generatedAt:fmt_(now)};
}

function isPublicFeedItemCurrent_(row, ix, now, today) {
  const section = cell_(row, ix, 'Current Section').toUpperCase();
  const lifecycle = cell_(row, ix, 'Lifecycle State').toUpperCase();
  const date = normalizeFeedDate_(cell_(row, ix, 'Relevant / Event Date'));
  const expireRaw = cell_(row, ix, 'Expire At');

  if ((section === 'TODAY' || lifecycle.indexOf('TODAY') !== -1) && date && date < today) return false;

  if (expireRaw) {
    const expires = new Date(expireRaw);
    if (!isNaN(expires.getTime()) && expires.getTime() <= now.getTime()) return false;
  }

  return true;
}

function normalizeFeedDate_(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  let m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return m[1] + '-' + m[2] + '-' + m[3];
  m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return m[3] + '-' + ('0'+m[1]).slice(-2) + '-' + ('0'+m[2]).slice(-2);
  return '';
}

function extractSourceMediaUrl_(sourceSet) {
  const raw = String(sourceSet || '').trim();
  if (!raw) return '';
  try {
    const parsed = JSON.parse(raw);
    const u = parsed.sourceMediaUrl || parsed.mediaUrl || parsed.imageUrl || '';
    return /^https?:\/\//i.test(String(u)) ? String(u) : '';
  } catch (ignored) {
    const match = raw.match(/https?:\/\/[^\s,;]+\.(?:jpg|jpeg|png|webp)(?:\?[^\s,;]*)?/i);
    return match ? match[0] : '';
  }
}

function deriveTags_(row, ix) {
  const text = [cell_(row, ix, 'Category'),cell_(row, ix, 'Business Activity Type'),cell_(row, ix, 'Headline'),cell_(row, ix, 'Summary')].join(' ').toLowerCase();
  const tags = [];
  if (/food|drink|coffee|restaurant|steak|menu/.test(text)) tags.push('food');
  if (/music|concert|band|live entertainment/.test(text)) tags.push('music');
  if (/deal|special|promotion|sale|discount/.test(text)) tags.push('promotions');
  if (/family|kid|child|youth/.test(text)) tags.push('family','kids');
  if (/sport|soccer|football|athletic|wildcat/.test(text)) tags.push('sports');
  if (/event|festival|ciderfest|market|registration|music|sport/.test(text)) tags.push('what-to-do');
  return tags.join(' ');
}

function recordReaction_(body) {
  const itemId = String(body.itemId || '').trim();
  const type = String(body.reactionType || '').toUpperCase();
  const sessionKey = String(body.sessionKey || '').trim();
  if (!itemId || ['LIKE','HEART'].indexOf(type) === -1 || !sessionKey) throw new Error('Invalid reaction');
  const ss = SpreadsheetApp.openById(LL_CONFIG.SPREADSHEET_ID);
  const reactions = ss.getSheetByName('Reactions');
  const feed = ss.getSheetByName(LL_CONFIG.SHEETS.FEED);
  if (!reactions || !feed) throw new Error('Reaction storage unavailable');
  const duplicateKey = digest_([itemId,type,sessionKey].join('|')).slice(0,32);
  if (reactions.getLastRow() > 1) {
    const vals = reactions.getDataRange().getDisplayValues();
    for (let r=1;r<vals.length;r++) if (String(vals[r][6]) === duplicateKey) return {ok:true,duplicate:true};
  }
  reactions.appendRow([Utilities.getUuid(),itemId,type,fmt_(new Date()),sessionKey,'Yes',duplicateKey,'WEB','','']);
  incrementFeedReactionCount_(feed,itemId,type);
  return {ok:true};
}

function incrementFeedReactionCount_(feedSheet,itemId,type) {
  if (!feedSheet || feedSheet.getLastRow() < 2) return;
  const data = feedSheet.getDataRange().getDisplayValues();
  const ix = headerMap_(data[0]);
  for (let r=1;r<data.length;r++) {
    if (String(data[r][ix['Item ID']] || '').trim() !== itemId) continue;
    const header = type === 'LIKE' ? 'Like Count' : 'Heart Count';
    const c = ix[header];
    if (c != null) feedSheet.getRange(r+1,c+1).setValue(Number(data[r][c] || 0)+1);
    break;
  }
}

function recordSherlockNote_(body) {
  const itemId = String(body.itemId || '').trim();
  const noteType = String(body.noteType || '').trim();
  const noteText = String(body.noteText || '').trim().slice(0,300);
  const supportingUrl = String(body.supportingUrl || '').trim();
  const submitterKey = String(body.submitterKey || '').trim();
  if (!itemId || !noteType || !noteText || !submitterKey) throw new Error('Missing Sherlock Note fields');
  const ss = SpreadsheetApp.openById(LL_CONFIG.SPREADSHEET_ID);
  const feed = ss.getSheetByName(LL_CONFIG.SHEETS.FEED);
  const sherlock = ss.getSheetByName(LL_CONFIG.SHEETS.SHERLOCK);
  if (!feed || !sherlock) throw new Error('Sherlock storage unavailable');
  const item = findFeedItem_(feed,itemId);
  if (!item) throw new Error('Item not found');
  sherlock.appendRow([Utilities.getUuid(),itemId,item.organization,noteType,noteText,fmt_(new Date()),submitterKey,/^https?:\/\//i.test(supportingUrl)?supportingUrl:'','', 'PENDING','','RELEVANT','PENDING',1,LL_CONFIG.SHERLOCK_TRUST_ANONYMOUS,'YES','','Community correction pending verification','','','','Web submission']);
  markFeedSherlockPending_(feed,itemId);
  return {ok:true,status:'PENDING'};
}

function findFeedItem_(sheet,itemId) {
  if (!sheet || sheet.getLastRow() < 2) return null;
  const data = sheet.getDataRange().getDisplayValues();
  const ix = headerMap_(data[0]);
  for (let r=1;r<data.length;r++) if (String(data[r][ix['Item ID']] || '').trim() === itemId) return {row:r+1,organization:String(data[r][ix['Business / Organization']] || '')};
  return null;
}

function markFeedSherlockPending_(sheet,itemId) {
  if (!sheet || sheet.getLastRow() < 2) return;
  const data = sheet.getDataRange().getDisplayValues();
  const ix = headerMap_(data[0]);
  for (let r=1;r<data.length;r++) {
    if (String(data[r][ix['Item ID']] || '').trim() !== itemId) continue;
    if (ix['Sherlock Status'] != null) sheet.getRange(r+1,ix['Sherlock Status']+1).setValue('Sherlock Note pending verification');
    if (ix['Sherlock Report Count'] != null) sheet.getRange(r+1,ix['Sherlock Report Count']+1).setValue(Number(data[r][ix['Sherlock Report Count']] || 0)+1);
    break;
  }
}

function getVisitCount_() {
  const props = PropertiesService.getScriptProperties();
  return Number(props.getProperty('LL_PUBLIC_VISITS') || 0);
}

function jsonOutput_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
