// Louisburg Local registration activity compatibility bridge.
//
// Registration / Event is a current public activity type used by first-party
// calendar and program discovery. SocialIntake.gs historically allowed only
// Event / Activity, which incorrectly sent clean verified registrations to
// manual review. This bridge preserves all existing identity, freshness,
// Louisburg, date, conflict and dedupe safeguards while treating registration
// events as event-like for verification and promotion.

function socialRegistrationActivityAlias_(activityType){
  return String(activityType||'').trim()==='Registration / Event'?'Event / Activity':activityType;
}

var socialAutoVerificationRegistrationBase_=socialAutoVerificationDecision_;
function socialAutoVerificationRegistrationAware_(payload,activityType,now,sourceIndex,registryIndex,endpointIndex){
  return socialAutoVerificationRegistrationBase_(payload,socialRegistrationActivityAlias_(activityType),now,sourceIndex,registryIndex,endpointIndex);
}

var socialFirstPartyVerificationRegistrationBase_=socialFirstPartyVerificationDecision_;
function socialFirstPartyVerificationRegistrationAware_(payload,activityType,now,registryIndex,endpointIndex){
  return socialFirstPartyVerificationRegistrationBase_(payload,socialRegistrationActivityAlias_(activityType),now,registryIndex,endpointIndex);
}

var socialPromotionPlanRegistrationBase_=socialPromotionPlan_;
function socialPromotionPlanRegistrationAware_(payload,activityType,fingerprint,auto,now){
  const isRegistration=String(activityType||'').trim()==='Registration / Event';
  const plan=socialPromotionPlanRegistrationBase_(payload,isRegistration?'Event / Activity':activityType,fingerprint,auto,now);
  if(isRegistration&&plan&&plan.row){
    // Keep event-like lifecycle/date handling and dedupe behavior, but expose the
    // more useful public registration classification to Hub/frontend consumers.
    plan.row[2]='Registration';
    plan.row[30]='Registration / Event';
  }
  return plan;
}

function runSocialRegistrationActivityBridgeSelfTest(){
  const failures=[];
  if(socialRegistrationActivityAlias_('Registration / Event')!=='Event / Activity')failures.push('registration alias failed');
  if(socialRegistrationActivityAlias_('Deal / Special')!=='Deal / Special')failures.push('non-registration type changed');
  if(failures.length)throw new Error('Registration activity bridge self-test failed: '+failures.join(' | '));
  Logger.log('Registration activity bridge self-test passed: 2/2');
}

// Install after SocialIntake.gs and the earlier quality/lookback bridges.
socialAutoVerificationDecision_=socialAutoVerificationRegistrationAware_;
socialFirstPartyVerificationDecision_=socialFirstPartyVerificationRegistrationAware_;
socialPromotionPlan_=socialPromotionPlanRegistrationAware_;
