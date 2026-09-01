// Louisburg Local 10-day future-activity bridge.
//
// Verified Facebook posts remain eligible for automatic promotion for up to
// 10 days when the post still points to a current/future event, deadline,
// promotion window, hiring close, closure/update date, or other dated activity.
// Undated routine promotions keep the existing 7-day automatic window.
//
// This preserves all existing verified Page identity/alias, Louisburg registry,
// ownership, shared-post, activity-type, stale-date and exact-event safeguards.

function socialAutoVerificationDecisionLookbackAware_(payload,activityType,now,sourceIndex,registryIndex,endpointIndex){
  const platform=String(payload.platform||'').toUpperCase();
  if(platform==='WEBSITE'||platform==='FIRST_PARTY'||platform==='DIRECT')return socialFirstPartyVerificationDecision_(payload,activityType,now,registryIndex,endpointIndex);
  if(platform!=='FACEBOOK')return {ok:false,reason:'platform is not a supported public social or first-party source'};

  const source=sourceIndex[String(payload.queueId||'')];
  if(!source)return {ok:false,reason:'source queue identity is not verified'};
  if(socialNormalizeOrg_(source.organization)!==socialNormalizeOrg_(payload.organization))return {ok:false,reason:'source organization does not match the intake organization'};

  const identities=(source.identityUrls&&source.identityUrls.length)?source.identityUrls:socialFacebookIdentityUrlsFromNotes_(source.profileUrl,source.notes||'');
  const profile=socialNormalizeUrl_(payload.profileUrl),post=socialNormalizeUrl_(payload.postUrl),postId=String(payload.postId||'');
  if(!profile||!socialFacebookIdentityKeyAllowed_(payload.profileUrl,identities))return {ok:false,reason:'captured profile does not match a verified Page identity'};

  const rawPost=String(payload.postUrl||'');
  const visibleCard=(/^VISIBLE-/i.test(postId)||/#ll-visible-/i.test(rawPost))&&post===profile;
  const publicFacebookContent=/^facebook\.com\//i.test(post);
  if(!visibleCard&&!publicFacebookContent)return {ok:false,reason:'captured content is not public Facebook evidence from the verified worker'};
  if(!visibleCard&&!socialFacebookIdentityKeyAllowed_(rawPost,identities))return {ok:false,reason:'Facebook post owner does not match a verified Page identity'};
  if(!/^(VERIFIED|CONFIRMED)$/.test(String(payload.louisburgMatch||'').toUpperCase()))return {ok:false,reason:'Louisburg match is not verified'};

  const registry=socialRegistryLookup_(registryIndex,payload.organization);
  if(!registry||!registry.louisburgVerified||!registry.hubEligible)return {ok:false,reason:'Master Registry does not verify this Louisburg business for Hub use'};
  if(registry.conflict)return {ok:false,reason:'Master Registry contains a conflict flag'};

  const postDate=new Date(String(payload.postDate||''));
  if(isNaN(postDate.getTime()))return {ok:false,reason:'post date is missing or ambiguous'};
  const ageDays=(now.getTime()-postDate.getTime())/86400000;
  if(ageDays<(-2/24)||ageDays>10)return {ok:false,reason:'post is outside the ten-day automatic lookback window'};

  const text=String(payload.text||'').replace(/\s+/g,' ').trim(),lower=text.toLowerCase();
  if(/\b(shared|reposted|re-posted)\b.{0,35}\b(post|from|by)\b|\boriginally posted by\b|\bshared from\b/.test(lower))return {ok:false,reason:'shared or reposted ownership is uncertain'};

  const allowed=['Deal / Special','New Product / Offering','Event / Activity','Business Update','Hiring','Operational Update'];
  if(allowed.indexOf(activityType)===-1)return {ok:false,reason:'activity type is not eligible for automatic promotion'};

  const dates=(typeof analyzeActivityDates_==='function')?analyzeActivityDates_(lower,now):{explicitPastOnly:false,pastOnly:false,hasCurrentOrFuture:false};
  if(dates.explicitPastOnly||dates.pastOnly)return {ok:false,reason:'post contains only stale dates'};
  const throughMonth=socialThroughMonthDate_(lower,now);
  const relevantDate=socialRelevantDate_(payload,activityType,now,dates)||throughMonth;
  const today=Utilities.formatDate(now,LL_CONFIG.TZ,'yyyy-MM-dd');

  // Days 8-10 are a deliberate lookback band, not an extension for generic
  // evergreen marketing. Require a still-current/future dated activity there.
  if(ageDays>7&&(!relevantDate||relevantDate<today))return {ok:false,reason:'8-10 day lookback requires a current or future dated activity'};

  if(activityType==='Event / Activity'&&!relevantDate)return {ok:false,reason:'event date is not exact enough for automatic publication'};
  if(/\b(today only|today|tonight)\b/.test(lower)&&relevantDate&&relevantDate<today)return {ok:false,reason:'same-day activity has already expired'};

  return {ok:true,sourceType:'SOCIAL',reason:ageDays>7?'verified public Facebook Page identity/alias with a still-current or future dated activity inside the 10-day lookback':'verified public Facebook Page identity/alias, verified Louisburg registry match, recent owned content, eligible activity and no conflict',registry:registry,relevantDate:relevantDate,timeParts:socialTimeParts_(text),visibleCard:visibleCard};
}

function runSocialFutureLookbackSelfTest(){
  const now=new Date('2026-09-01T12:00:00-05:00');
  const source={organization:'Test Louisburg Business',profileUrl:'https://www.facebook.com/testlouisburg',notes:'',identityUrls:['https://www.facebook.com/testlouisburg']};
  const sources={'SOC-TEST':source};
  const registry={};
  registry[socialNormalizeOrg_('Test Louisburg Business')]={organization:'Test Louisburg Business',address:'1 Main St, Louisburg, KS 66053',category:'Retail',louisburgVerified:true,hubEligible:true,conflict:false};
  const base={queueId:'SOC-TEST',organization:'Test Louisburg Business',platform:'FACEBOOK',profileUrl:'https://www.facebook.com/testlouisburg',postUrl:'https://www.facebook.com/testlouisburg/posts/pfbid123',postId:'pfbid123',text:'Louisburg KS. Fall open house September 8, 2026.',louisburgMatch:'VERIFIED'};
  const failures=[];

  let result=socialAutoVerificationDecisionLookbackAware_(Object.assign({},base,{postDate:'2026-08-23T12:00:00-05:00'}),'Event / Activity',now,sources,registry,{});
  if(!result.ok||result.relevantDate!=='2026-09-08')failures.push('9-day future event did not auto-verify');

  result=socialAutoVerificationDecisionLookbackAware_(Object.assign({},base,{postDate:'2026-08-21T12:00:00-05:00'}),'Event / Activity',now,sources,registry,{});
  if(result.ok)failures.push('11-day post incorrectly auto-verified');

  result=socialAutoVerificationDecisionLookbackAware_(Object.assign({},base,{postDate:'2026-08-23T12:00:00-05:00',text:'Louisburg KS. Fresh coffee available.'}),'Business Update',now,sources,registry,{});
  if(result.ok)failures.push('9-day undated generic promotion incorrectly auto-verified');

  result=socialAutoVerificationDecisionLookbackAware_(Object.assign({},base,{postDate:'2026-08-23T12:00:00-05:00',text:'Louisburg KS. Wednesday special: burger basket $9.99.'}),'Deal / Special',now,sources,registry,{});
  if(result.ok)failures.push('9-day stale weekday special incorrectly auto-verified');

  if(failures.length)throw new Error('Future lookback self-test failed: '+failures.join(' | '));
  Logger.log('Future lookback self-test passed: 4/4.');
}

socialAutoVerificationDecision_=socialAutoVerificationDecisionLookbackAware_;
