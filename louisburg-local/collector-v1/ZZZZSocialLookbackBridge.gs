// Louisburg Local ten-day current/future social lookback bridge.
//
// Purpose:
// - Preserve the normal seven-day automatic Facebook rule for ordinary posts.
// - Extend automatic consideration to posts 8-10 days old only when the post
//   still points to a current/future dated activity, deadline, or promotion.
// - Keep every existing identity, locality, ownership, activity, stale-date and
//   conflict safeguard in the current social verification chain.
//
// This does not expand access to Facebook. It only changes how already-captured
// verified public posts are evaluated after discovery.

var socialAutoVerificationDecisionTenDayBase_=socialAutoVerificationDecision_;

function socialAutoVerificationDecisionTenDay_(payload,activityType,now,sourceIndex,registryIndex,endpointIndex){
  const platform=String(payload&&payload.platform||'').toUpperCase();
  if(platform!=='FACEBOOK')return socialAutoVerificationDecisionTenDayBase_(payload,activityType,now,sourceIndex,registryIndex,endpointIndex);

  const postDate=new Date(String(payload&&payload.postDate||''));
  if(isNaN(postDate.getTime()))return socialAutoVerificationDecisionTenDayBase_(payload,activityType,now,sourceIndex,registryIndex,endpointIndex);
  const ageDays=(now.getTime()-postDate.getTime())/86400000;

  // Existing path remains authoritative for fresh posts and for anything older
  // than the requested ten-day backscan.
  if(ageDays<=7||ageDays>10)return socialAutoVerificationDecisionTenDayBase_(payload,activityType,now,sourceIndex,registryIndex,endpointIndex);

  const text=String(payload&&payload.text||'').replace(/\s+/g,' ').trim(),lower=text.toLowerCase();
  const dates=(typeof analyzeActivityDates_==='function')?analyzeActivityDates_(lower,now):{hasCurrentOrFuture:false};
  const throughDate=(typeof socialThroughMonthDate_==='function')?socialThroughMonthDate_(lower,now):'';

  // The 8-10 day extension is not a generic freshness extension. It is only for
  // activity that is still live/future now. Old one-day specials, generic posts,
  // and evergreen marketing remain outside automatic publication.
  if(!dates.hasCurrentOrFuture&&!throughDate){
    return {ok:false,reason:'post is 8-10 days old without a current/future activity date'};
  }

  // Reuse the complete verified-source decision chain by evaluating freshness
  // against a three-day lookback offset. All other checks still execute in the
  // existing alias-aware verifier. Current/future dates were already confirmed
  // against the actual current time above.
  const lookbackNow=new Date(now.getTime()-3*86400000);
  const result=socialAutoVerificationDecisionTenDayBase_(payload,activityType,lookbackNow,sourceIndex,registryIndex,endpointIndex);
  if(!result||!result.ok)return result;
  result.reason='verified public Facebook Page identity/alias, verified Louisburg registry match, 10-day current/future lookback, eligible activity and no conflict';
  return result;
}

function runSocialTenDayLookbackSelfTest(){
  const now=new Date('2026-09-01T12:00:00-05:00');
  const freshFuture={platform:'FACEBOOK',postDate:'2026-08-23T12:00:00-05:00',text:'Save the date September 12 for our Louisburg event.'};
  const staleGeneric={platform:'FACEBOOK',postDate:'2026-08-23T12:00:00-05:00',text:'Thanks for a great week in Louisburg.'};
  const d1=(now-new Date(freshFuture.postDate))/86400000,d2=(now-new Date(staleGeneric.postDate))/86400000;
  if(d1<8||d1>10||d2<8||d2>10)throw new Error('Ten-day lookback self-test setup is invalid.');
  const futureDates=(typeof analyzeActivityDates_==='function')?analyzeActivityDates_(freshFuture.text.toLowerCase(),now):{hasCurrentOrFuture:false};
  const staleDates=(typeof analyzeActivityDates_==='function')?analyzeActivityDates_(staleGeneric.text.toLowerCase(),now):{hasCurrentOrFuture:false};
  if(!futureDates.hasCurrentOrFuture)throw new Error('Ten-day lookback self-test failed: future event date not recognized.');
  if(staleDates.hasCurrentOrFuture)throw new Error('Ten-day lookback self-test failed: generic stale post treated as future activity.');
  Logger.log('Ten-day social lookback self-test passed.');
}

// This file intentionally sorts after ZZSocialFacebookIdentityBridge.gs so it
// wraps the already alias-aware verifier instead of replacing those safeguards.
socialAutoVerificationDecision_=socialAutoVerificationDecisionTenDay_;
