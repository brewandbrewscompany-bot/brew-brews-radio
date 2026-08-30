function installLouisburgLocalCollectorTriggers() {
  removeLouisburgLocalCollectorTriggers();
  ScriptApp.newTrigger('runLouisburgLocalCollector').timeBased().everyHours(1).create();
  ScriptApp.newTrigger('runLouisburgLocalMaintenance').timeBased().everyDays(1).atHour(3).create();
}

function removeLouisburgLocalCollectorTriggers() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    const fn = t.getHandlerFunction();
    if (fn === 'runLouisburgLocalCollector' || fn === 'runLouisburgLocalMaintenance') ScriptApp.deleteTrigger(t);
  });
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
