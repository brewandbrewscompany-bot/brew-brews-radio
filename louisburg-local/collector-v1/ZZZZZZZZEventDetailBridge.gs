// Louisburg Local first-party event detail bridge.
//
// Two production issues surfaced while expanding verified first-party calendars:
// 1) shared-meridiem ranges such as "4:30-5:30 PM" were reduced to the
//    second time because the base parser required AM/PM on every token;
// 2) off-site events inherited the organization's Registry address even when
//    the first-party activity text explicitly named a known Louisburg venue.
//
// This bridge keeps the existing date, identity, source, dedupe and lifecycle
// safeguards. It only improves time parsing and a small verified venue map.

function socialTimeTo24_(hour,minute,meridiem){
  let h=Number(hour),m=Number(minute||0);
  if(!isFinite(h)||h<1||h>12||!isFinite(m)||m<0||m>59)return '';
  h=h%12;
  if(/^p/i.test(String(meridiem||'')))h+=12;
  return ('0'+h).slice(-2)+':'+('0'+m).slice(-2);
}

function socialToggleMeridiem_(value){return /^p/i.test(String(value||''))?'AM':'PM';}

function socialRangeTimeParts_(text){
  const value=String(text||'').replace(/[–—]/g,'-');
  const re=/\b(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?\s*(?:-|\bto\b)\s*(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)\b/ig;
  const ranges=[];
  let match;
  while((match=re.exec(value))&&ranges.length<4){
    const endMeridiem=match[6];
    let startMeridiem=match[3]||endMeridiem;
    let start=socialTimeTo24_(match[1],match[2],startMeridiem);
    const end=socialTimeTo24_(match[4],match[5],endMeridiem);
    // In a shared-meridiem range such as 11:00-1:00 PM, inheriting PM for
    // both sides would place the start after the end. Flip only the implicit
    // start meridiem in that case.
    if(!match[3]&&start&&end&&start>end){
      startMeridiem=socialToggleMeridiem_(endMeridiem);
      start=socialTimeTo24_(match[1],match[2],startMeridiem);
    }
    if(!start||!end)continue;
    ranges.push({start:start,end:end,window:start+'-'+end});
  }
  if(!ranges.length)return null;
  return {start:ranges[0].start,end:ranges[ranges.length-1].end,window:ranges.map(function(r){return r.window;}).join(' / ')};
}

var socialTimePartsEventDetailBase_=socialTimeParts_;
function socialTimePartsEventDetailAware_(text){
  return socialRangeTimeParts_(text)||socialTimePartsEventDetailBase_(text);
}

function socialExplicitLouisburgVenue_(text){
  const value=String(text||'');
  if(/\bfox community hall\b/i.test(value))return 'Fox Community Hall, 201 S Broadway St, Louisburg, KS 66053';
  if(/\blouisburg senior center\b/i.test(value))return 'Louisburg Senior Center, 504 S Metcalf Rd, Louisburg, KS 66053';
  if(/\bwildcat activit(?:y|ies) center\b/i.test(value))return 'Wildcat Activities Center, 7 S Peoria St, Louisburg, KS 66053';
  if(/\bcity hall\b/i.test(value))return 'City Hall, 215 S Broadway St, Louisburg, KS 66053';
  if(/\bat louisburg library district #?1\b/i.test(value))return 'Louisburg Library District #1, 206 S Broadway St, Louisburg, KS 66053';
  return '';
}

var socialPromotionPlanEventDetailBase_=socialPromotionPlan_;
function socialPromotionPlanEventDetailAware_(payload,activityType,fingerprint,auto,now){
  const plan=socialPromotionPlanEventDetailBase_(payload,activityType,fingerprint,auto,now);
  if(plan&&plan.row&&auto&&auto.sourceType==='FIRST_PARTY'){
    const venue=socialExplicitLouisburgVenue_(payload&&payload.text);
    if(venue)plan.row[8]=venue;
  }
  return plan;
}

function runSocialEventDetailBridgeSelfTest(){
  const failures=[];
  const shared=socialRangeTimeParts_('Panel Pack is 4:30-5:30 PM.');
  if(!shared||shared.window!=='16:30-17:30')failures.push('shared PM range failed');
  const evening=socialRangeTimeParts_('Felt Wreath is 6:00-8:00 PM.');
  if(!evening||evening.window!=='18:00-20:00')failures.push('evening shared-meridiem range failed');
  const split=socialRangeTimeParts_('Two sessions: 2:00-3:30 PM and 6:00-7:30 PM.');
  if(!split||split.window!=='14:00-15:30 / 18:00-19:30'||split.start!=='14:00'||split.end!=='19:30')failures.push('multiple ranges failed');
  const noon=socialRangeTimeParts_('Open 11:00-1:00 PM.');
  if(!noon||noon.window!=='11:00-13:00')failures.push('cross-noon implicit meridiem failed');
  if(socialExplicitLouisburgVenue_('Join us at Fox Community Hall.')!=='Fox Community Hall, 201 S Broadway St, Louisburg, KS 66053')failures.push('Fox venue failed');
  if(socialExplicitLouisburgVenue_('WILDCAT ACTIVITY CENTER')!=='Wildcat Activities Center, 7 S Peoria St, Louisburg, KS 66053')failures.push('Wildcat venue failed');
  if(failures.length)throw new Error('Event detail bridge self-test failed: '+failures.join(' | '));
  Logger.log('Event detail bridge self-test passed: 6/6');
}

// Install after the registration/audit compatibility bridges.
socialTimeParts_=socialTimePartsEventDetailAware_;
socialPromotionPlan_=socialPromotionPlanEventDetailAware_;
