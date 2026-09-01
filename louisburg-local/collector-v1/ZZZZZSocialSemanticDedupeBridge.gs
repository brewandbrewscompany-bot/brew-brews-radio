// Louisburg Local semantic first-party dedupe bridge.
//
// A calendar/event page legitimately shares one URL across many events, so URL
// dedupe is intentionally disabled for first-party activity. This bridge closes
// the other side of that rule: if a newly extracted first-party item describes
// the same organization, same relevant date, and same distinctive activity as
// an existing public Hub card, reuse the canonical card instead of publishing a
// second wording of the same event.
//
// It is intentionally conservative. Generic overlap such as "live music" alone
// is not enough; at least one distinctive shared token and strong token overlap
// are required. Different events on the same calendar/date remain separate.

function socialSemanticDedupeTokens_(text,organization){
  let normalized=String(text||'').toLowerCase()
    .replace(/https?:\/\/\S+/g,' ')
    .replace(/\b[\w.+-]+@[\w.-]+\.\w+\b/g,' ')
    .replace(/\b20\d{2}\b/g,' ')
    .replace(/\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/g,' ')
    .replace(/\b\d{1,2}(?:st|nd|rd|th)?\b/g,' ')
    .replace(/[^a-z0-9]+/g,' ')
    .replace(/\s+/g,' ')
    .trim();
  const stop={
    the:1,a:1,an:1,and:1,or:1,of:1,to:1,for:1,at:1,in:1,on:1,from:1,with:1,our:1,your:1,you:1,we:1,us:1,is:1,are:1,be:1,as:1,by:1,
    this:1,that:1,these:1,those:1,have:1,has:1,had:1,will:1,can:1,if:1,please:1,more:1,information:1,interested:1,next:1,
    january:1,february:1,march:1,april:1,may:1,june:1,july:1,august:1,september:1,october:1,november:1,december:1,
    jan:1,feb:1,mar:1,apr:1,jun:1,jul:1,aug:1,sep:1,sept:1,oct:1,nov:1,dec:1,
    sunday:1,monday:1,tuesday:1,wednesday:1,thursday:1,friday:1,saturday:1,
    today:1,tonight:1,tomorrow:1,current:1,official:1,first:1,party:1,website:1,page:1,lists:1,listed:1,listing:1,
    contact:1,email:1,phone:1,info:1,com:1,www:1,org:1,ks:1,kansas:1,louisburg:1
  };
  String(organization||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').split(/\s+/).forEach(function(token){if(token)stop[token]=1;});
  const out=[],seen={};
  normalized.split(/\s+/).forEach(function(token){
    if(!token||token.length<3||stop[token]||seen[token])return;
    seen[token]=1;out.push(token);
  });
  return out;
}

function socialSemanticDistinctive_(token){
  return !{event:1,events:1,activity:1,activities:1,community:1,public:1,live:1,music:1,special:1,specials:1,deal:1,deals:1,open:1,opening:1,register:1,registration:1,festival:1,meeting:1,program:1,programs:1}[token];
}

function socialSemanticSameActivity_(candidateTokens,existingTokens){
  if(!candidateTokens.length||!existingTokens.length)return false;
  const existing={};existingTokens.forEach(function(t){existing[t]=1;});
  const shared=candidateTokens.filter(function(t){return existing[t];});
  if(shared.length<2)return false;
  if(!shared.some(socialSemanticDistinctive_))return false;
  const denominator=Math.min(candidateTokens.length,existingTokens.length);
  return denominator>0&&(shared.length/denominator)>=0.5;
}

function socialBuildSemanticHubIndex_(sheet){
  const out={};
  if(!sheet||sheet.getLastRow()<2)return out;
  const data=sheet.getDataRange().getDisplayValues(),ix=headerMap_(data[0]);
  for(let r=1;r<data.length;r++){
    const eligibility=cell_(data[r],ix,'Public Eligibility').toUpperCase();
    if(['YES','LIMITED'].indexOf(eligibility)===-1)continue;
    const org=cell_(data[r],ix,'Business / Organization'),date=cell_(data[r],ix,'Relevant / Event Date'),id=cell_(data[r],ix,'Item ID');
    if(!org||!date||!id)continue;
    const key=socialNormalizeOrg_(org)+'|'+date;
    if(!out[key])out[key]=[];
    const text=[cell_(data[r],ix,'Headline'),cell_(data[r],ix,'Summary')].join(' ');
    out[key].push({itemId:id,tokens:socialSemanticDedupeTokens_(text,org)});
  }
  return out;
}

function socialSemanticExistingHubItem_(sheet,index,payload,auto){
  if(!auto||auto.sourceType!=='FIRST_PARTY'||!auto.relevantDate)return '';
  if(!index.__semanticByOrgDate)index.__semanticByOrgDate=socialBuildSemanticHubIndex_(sheet);
  const key=socialNormalizeOrg_(payload.organization)+'|'+String(auto.relevantDate),list=index.__semanticByOrgDate[key]||[];
  const candidate=socialSemanticDedupeTokens_(payload.text,payload.organization);
  for(let i=0;i<list.length;i++)if(socialSemanticSameActivity_(candidate,list[i].tokens))return list[i].itemId;
  return '';
}

function socialSemanticRememberHubItem_(index,payload,auto,itemId){
  if(!auto||auto.sourceType!=='FIRST_PARTY'||!auto.relevantDate||!itemId)return;
  if(!index.__semanticByOrgDate)index.__semanticByOrgDate={};
  const key=socialNormalizeOrg_(payload.organization)+'|'+String(auto.relevantDate);
  if(!index.__semanticByOrgDate[key])index.__semanticByOrgDate[key]=[];
  index.__semanticByOrgDate[key].push({itemId:itemId,tokens:socialSemanticDedupeTokens_(payload.text,payload.organization)});
}

var socialPromoteToHubSemanticBase_=socialPromoteToHub_;
function socialPromoteToHubSemanticAware_(sheet,index,payload,activityType,fingerprint,auto,now){
  const existing=socialSemanticExistingHubItem_(sheet,index,payload,auto);
  if(existing)return {duplicate:true,itemId:existing,semanticDuplicate:true};
  const result=socialPromoteToHubSemanticBase_(sheet,index,payload,activityType,fingerprint,auto,now);
  if(result&&!result.duplicate)socialSemanticRememberHubItem_(index,payload,auto,result.itemId);
  return result;
}

function runSocialSemanticDedupeSelfTest(){
  const failures=[];
  const same=[
    ['If you have an event to suggest. September 26th - Fish Fry','Fish Fry fundraiser at American Legion Post 250 September 26'],
    ['October 5th - Red Cross Blood Drive','Red Cross Blood Drive at American Legion Post 250 October 5'],
    ['November 7th - Music Bingo','Music Bingo at American Legion Post 250 November 7']
  ];
  same.forEach(function(pair){
    const a=socialSemanticDedupeTokens_(pair[0],'American Legion John P. Hand Post 250'),b=socialSemanticDedupeTokens_(pair[1],'American Legion John P. Hand Post 250');
    if(!socialSemanticSameActivity_(a,b))failures.push('same event was not recognized: '+pair[0]);
  });
  const liveA=socialSemanticDedupeTokens_('Live music with Dallas Lybarger','Black Barrel Bar and Grill');
  const liveB=socialSemanticDedupeTokens_('Live music with Jane Doe','Black Barrel Bar and Grill');
  if(socialSemanticSameActivity_(liveA,liveB))failures.push('different live-music performers were incorrectly deduped');
  if(failures.length)throw new Error('Semantic dedupe self-test failed: '+failures.join(' | '));
  Logger.log('Semantic first-party dedupe self-test passed.');
}

// Load after the existing SocialIntake and quality/lookback bridges.
socialPromoteToHub_=socialPromoteToHubSemanticAware_;
