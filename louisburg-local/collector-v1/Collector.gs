function runLouisburgLocalCollector() {
  const started = new Date();
  const runId = Utilities.getUuid();
  const ss = SpreadsheetApp.openById(LL_CONFIG.SPREADSHEET_ID);
  const endpointSheet = ss.getSheetByName(LL_CONFIG.SHEETS.ENDPOINTS);
  const stateSheet = ss.getSheetByName(LL_CONFIG.SHEETS.STATE);
  const logSheet = ss.getSheetByName(LL_CONFIG.SHEETS.LOG);
  if (!endpointSheet || !stateSheet || !logSheet) throw new Error('Collector sheets are missing.');

  const rows = endpointSheet.getDataRange().getDisplayValues();
  if (rows.length < 2) return;
  const headers = rows.shift();
  const ix = headerMap_(headers);
  const state = loadState_(stateSheet);
  let checked = 0, changed = 0, candidates = 0, failures = 0;

  rows.forEach(row => {
    const sourceUrl = cell_(row, ix, 'Source URL');
    const active = cell_(row, ix, 'Active').toLowerCase();
    const access = cell_(row, ix, 'Access Method').toUpperCase();
    const org = cell_(row, ix, 'Business / Organization');
    const priority = cell_(row, ix, 'Feed Priority').toUpperCase() || 'MEDIUM';
    if (!sourceUrl || !/^yes|true|active$/i.test(active)) return;
    if (LL_CONFIG.ALLOWED_ACCESS_METHODS.indexOf(access) === -1) return;

    const key = endpointKey_(org, sourceUrl);
    const old = state[key] || {};
    if (!isDue_(old.nextCheck)) return;
    checked++;

    try {
      const result = fetchPublicSource_(sourceUrl);
      const normalized = normalizeText_(result.body);
      const fingerprint = digest_(normalized);
      const didChange = !old.fingerprint || old.fingerprint !== fingerprint;
      const now = new Date();
      if (didChange) changed++;

      let candidateCount = 0;
      if (didChange && old.fingerprint) {
        const signals = extractSignals_(normalized);
        if (signals.length && isLouisburgRelevant_(normalized, org)) {
          appendVerificationCandidate_(ss, org, sourceUrl, signals, now);
          candidateCount = 1;
          candidates++;
        }
      }

      upsertState_(stateSheet, old.row, [
        key, org, sourceUrl, access, fingerprint, '', didChange ? fmt_(now) : (old.lastChange || ''),
        fmt_(now), fmt_(now), fmt_(nextCheck_(now, priority)), 0,
        didChange && candidateCount ? fmt_(addDays_(now, 7)) : '', result.status,
        normalized.length, '', 'Yes'
      ]);
    } catch (err) {
      failures++;
      const now = new Date();
      const failCount = Number(old.failures || 0) + 1;
      upsertState_(stateSheet, old.row, [
        key, org, sourceUrl, access, old.fingerprint || '', old.lastContentDate || '', old.lastChange || '',
        fmt_(now), old.lastSuccess || '', fmt_(nextCheck_(now, priority)), failCount,
        old.boostUntil || '', '', '', String(err).slice(0, 500), 'Yes'
      ]);
    }
  });

  logSheet.appendRow([runId, fmt_(started), fmt_(new Date()), rows.length, checked, changed, candidates, failures,
    'Collector V1: DIRECT sources only; changed sources create review candidates, never automatic public cards.']);
}

function fetchPublicSource_(url) {
  const response = UrlFetchApp.fetch(url, {
    muteHttpExceptions: true,
    followRedirects: true,
    headers: {'User-Agent': LL_CONFIG.USER_AGENT, 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'}
  });
  const status = response.getResponseCode();
  if (status < 200 || status >= 400) throw new Error('HTTP ' + status + ' ' + url);
  let body = response.getContentText();
  if (body.length > LL_CONFIG.MAX_BODY_CHARS) body = body.slice(0, LL_CONFIG.MAX_BODY_CHARS);
  return {status, body};
}

function normalizeText_(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function extractSignals_(text) {
  return LL_CONFIG.KEYWORDS.filter(k => text.indexOf(k) !== -1).slice(0, 12);
}

function isLouisburgRelevant_(text, org) {
  const haystack = (text + ' ' + org).toLowerCase();
  return LL_CONFIG.LOUISBURG_TERMS.some(t => haystack.indexOf(t) !== -1);
}

function appendVerificationCandidate_(ss, org, url, signals, now) {
  const sheet = ss.getSheetByName(LL_CONFIG.SHEETS.VERIFY);
  if (!sheet) return;
  sheet.appendRow([
    org,
    'Collector change candidate',
    'Meaningful keywords detected after a source-content change: ' + signals.join(', '),
    'Human/detail extraction required before publication',
    url,
    'MEDIUM',
    'OPEN - COLLECTOR',
    Utilities.formatDate(now, LL_CONFIG.TZ, 'yyyy-MM-dd'),
    '',
    'Collector V1 detected a changed DIRECT source. Verify date, Louisburg applicability, exact offer/event details and destination before promoting to Hub Feed.'
  ]);
}

function loadState_(sheet) {
  const data = sheet.getDataRange().getDisplayValues();
  const out = {};
  for (let r = 1; r < data.length; r++) {
    if (!data[r][0]) continue;
    out[data[r][0]] = {
      row: r + 1, fingerprint: data[r][4], lastContentDate: data[r][5], lastChange: data[r][6],
      lastSuccess: data[r][8], nextCheck: data[r][9], failures: data[r][10], boostUntil: data[r][11]
    };
  }
  return out;
}

function upsertState_(sheet, rowNumber, values) {
  if (rowNumber) sheet.getRange(rowNumber, 1, 1, values.length).setValues([values]);
  else sheet.appendRow(values);
}

function headerMap_(headers) {
  const m = {}; headers.forEach((h, i) => m[String(h).trim()] = i); return m;
}
function cell_(row, ix, name) { return ix[name] == null ? '' : String(row[ix[name]] || '').trim(); }
function endpointKey_(org, url) { return digest_((org + '|' + url).toLowerCase()).slice(0, 24); }
function digest_(s) { const b = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8); return b.map(x => ('0' + ((x + 256) % 256).toString(16)).slice(-2)).join(''); }
function isDue_(v) { if (!v) return true; const d = new Date(v); return isNaN(d) || d <= new Date(); }
function nextCheck_(d, priority) { const h = priority === 'HIGH' ? LL_CONFIG.HIGH_INTERVAL_HOURS : priority === 'LOW' ? LL_CONFIG.LOW_INTERVAL_HOURS : LL_CONFIG.MEDIUM_INTERVAL_HOURS; return new Date(d.getTime() + h * 3600000); }
function addDays_(d, days) { return new Date(d.getTime() + days * 86400000); }
function fmt_(d) { return Utilities.formatDate(d, LL_CONFIG.TZ, 'yyyy-MM-dd HH:mm:ss'); }
