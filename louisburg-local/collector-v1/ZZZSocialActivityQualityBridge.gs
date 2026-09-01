// Louisburg Local social activity quality bridge.
//
// Fixes generic classification errors exposed by the public-source rollout:
// 1) descriptive praise such as "something special to our studio" must never be
//    interpreted as a Deal / Special;
// 2) explicit "save the date" / "opening day" posts are actionable events when
//    the normal date/freshness/identity safeguards can verify them;
// 3) generic website contact/booking calls-to-action and bare calendar labels
//    must not become Hub events just because they contain "event" or "today".
//
// Existing source identity, Louisburg, freshness, ownership, dedupe and
// auto-verification safeguards still decide whether accepted activity reaches
// Hub Feed.

function classifySocialActivityQualityAware_(text){
  const t=String(text||'').toLowerCase().replace(/\s+/g,' ').trim();
  if(!t)return '';

  if(/closed today|closing early|closure|cancelled|canceled|postponed|rescheduled|delayed|sold out|hours? changed|change(?:d)? (?:our )?hours/.test(t))return 'Operational Update';
  if(/now hiring|\bhiring\b|apply today|job opening|applications? (?:close|closing|due)/.test(t))return 'Hiring';

  // Commercial special language only. Do not use a bare "special" token because
  // ordinary praise ("something special", "special people", "special place")
  // is common in community posts and is not a promotion.
  const explicitDeal=/daily special|special today|today'?s special|tonight'?s special|today only|\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+special|\bdeal\b|discount|coupon|promo(?:tion)? code|\b\d{1,3}\s*%\s*off\b|\bsave\s+\d{1,3}\s*%\b|\bpromotion\b|on sale|sale ends|buy one|get one|\bbogo\b/.test(t);
  const pricedSpecial=/(?:\bspecial\b.{0,90}(?:\$\s*\d|\b(?:off|only|price|meal|lunch|dinner|breakfast|drink|coffee|menu)\b)|(?:\$\s*\d|\b(?:off|price|meal|lunch|dinner|breakfast|drink|coffee|menu)\b).{0,90}\bspecial\b)/.test(t);
  if(explicitDeal||pricedSpecial)return 'Deal / Special';

  if(/new product|new coffee|new drink|new menu|\blaunch\b|\brelease\b|available now|now available|freshly roasted|fresh inventory|\bare here\b|\b(?:has|have) (?:officially )?arrived\b|\bjust arrived\b|\bnow in stock\b/.test(t))return 'New Product / Offering';

  // Calendar-intent language is an event signal. The downstream auto-verifier
  // still requires an exact enough relevant date for Event / Activity.
  if(/live music|concert|festival|workshop|fundraiser|open house|\bevent\b|tickets|register now|registration open|open enrollment|sign up|signup|\bclass(?:es)?\b|save the date|mark your calendars?|\bopening day\b|season opens?/.test(t))return 'Event / Activity';

  if(/now open|grand opening|online ordering|new hours|extended hours/.test(t))return 'Business Update';
  return '';
}

function socialFirstPartyActivityQualityRejectReason_(payload){
  const platform=String(payload&&payload.platform||'').toUpperCase();
  if(['WEBSITE','FIRST_PARTY','DIRECT'].indexOf(platform)===-1)return '';
  const text=String(payload&&payload.text||payload&&payload.postText||'').replace(/\s+/g,' ').trim();
  const lower=text.toLowerCase();
  if(!text)return '';

  // Website footer/contact copy is not an event. The word "today" in
  // "contact us today" must never manufacture a same-day activity.
  const genericBooking=/\b(?:contact|con\s*tact) us!?\b.{0,180}\b(?:booking|book) (?:your )?(?:next )?event\b|\binterested in booking (?:your )?(?:next )?event\b.{0,180}\bcontact us today\b/i;
  if(genericBooking.test(text)&&!/(?:\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b\s+\d{1,2}|\b20\d{2}-\d{1,2}-\d{1,2}\b|\b\d{1,2}\/\d{1,2}\/20\d{2}\b)/i.test(text))return 'GENERIC CONTACT / EVENT-BOOKING CTA';

  // Calendar widgets sometimes expose a date label without the event name.
  // Keep those as scan evidence, not public cards.
  if(/^multiple dates\b/i.test(text)&&text.length<90)return 'UNDERSPECIFIED CALENDAR LABEL';
  if(/^(?:mon|tue|wed|thu|fri|sat|sun)(?:day)?[,]?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2}$/i.test(text))return 'UNDERSPECIFIED CALENDAR LABEL';

  // A form shell with fields but no actual dated/public activity is navigation.
  if(/\bname:\s*email:\s*phone:\s*message:/i.test(lower)&&!/\b(?:register|registration|tickets?|special|deal|sale|concert|festival|fundraiser|blood drive|fish fry)\b/i.test(lower))return 'CONTACT FORM / NAVIGATION';
  return '';
}

var socialPostGateQualityBase_=socialPostGate_;
function socialPostGateQualityAware_(payload,now){
  const reject=socialFirstPartyActivityQualityRejectReason_(payload);
  if(reject)return {ok:false,reason:reject};
  return socialPostGateQualityBase_(payload,now);
}

function runSocialActivityQualityBridgeSelfTest(){
  const cases=[
    {name:'community praise is not a deal',text:'Each and every one of them contribute something special to our studio and I am so grateful that we found each other.',want:''},
    {name:'special people is not a deal',text:'We are thankful for the special people who make our community such a wonderful place.',want:''},
    {name:'opening day is an event',text:'SAVE THE DATE — OPENING DAY! Mark your calendars for September 11, 2026 and get ready for fall fun.',want:'Event / Activity'},
    {name:'weekday restaurant special remains a deal',text:'Wednesday special! Fried catfish with fries and coleslaw for $13.99.',want:'Deal / Special'},
    {name:'percentage discount remains a deal',text:'Get 10% off your order today.',want:'Deal / Special'},
    {name:'arrived inventory remains an offering',text:'Fresh apples have officially arrived at the Country Store.',want:'New Product / Offering'}
  ];
  const failures=[];
  cases.forEach(function(tc){const got=classifySocialActivityQualityAware_(tc.text);if(got!==tc.want)failures.push(tc.name+': expected '+tc.want+', got '+got);});

  const booking=socialFirstPartyActivityQualityRejectReason_({platform:'WEBSITE',text:'Con tact Us! Looking for more information or interested in booking your next event? Contact us today and someone from our team will be in touch!'});
  if(booking!=='GENERIC CONTACT / EVENT-BOOKING CTA')failures.push('generic booking CTA was not rejected');
  const label=socialFirstPartyActivityQualityRejectReason_({platform:'WEBSITE',text:'Multiple Dates Sat, Sep 26'});
  if(label!=='UNDERSPECIFIED CALENDAR LABEL')failures.push('bare calendar label was not rejected');
  const real=socialFirstPartyActivityQualityRejectReason_({platform:'WEBSITE',text:'Save the date September 26 for the Fish Fry fundraiser.'});
  if(real)failures.push('real dated first-party event was incorrectly rejected: '+real);

  if(failures.length)throw new Error('Social activity quality bridge self-test failed: '+failures.join(' | '));
  Logger.log('Social activity quality bridge self-test passed: '+(cases.length+3)+'/'+(cases.length+3));
}

// Install after SocialIntake.gs. The normal processor continues to use the
// public function names, so these narrow overrides improve direct, first-party,
// DOM and Relay-discovered intake without changing identity or publish policy.
classifySocialActivity_=classifySocialActivityQualityAware_;
socialPostGate_=socialPostGateQualityAware_;
