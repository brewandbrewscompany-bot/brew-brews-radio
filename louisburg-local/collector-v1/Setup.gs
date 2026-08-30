function installLouisburgLocalCollectorTriggers() {
  removeLouisburgLocalCollectorTriggers();
  ScriptApp.newTrigger('runLouisburgLocalCollector').timeBased().everyHours(1).create();
}

function removeLouisburgLocalCollectorTriggers() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'runLouisburgLocalCollector') ScriptApp.deleteTrigger(t);
  });
}

function seedLouisburgLocalCollector() {
  // First run establishes fingerprints. It deliberately does not create
  // review candidates until a source changes on a later run.
  runLouisburgLocalCollector();
}
