// Louisburg Local social activity quality bridge.
//
// Fixes two generic classification errors exposed by the public Facebook Relay
// recovery rollout:
// 1) descriptive praise such as "something special to our studio" must never be
//    interpreted as a Deal / Special;
// 2) explicit "save the date" / "opening day" posts are actionable events when
//    the normal date/freshness/identity safeguards can verify them.
//
// This file changes classification only. Existing source identity, Louisburg,
// freshness, ownership, dedupe and auto-verification safeguards still decide
// whether a classified post can reach Hub Feed.

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

function runSocialActivityQualityBridgeSelfTest(){
  const cases=[
    {
      name:'community praise is not a deal',
      text:'Each and every one of them contribute something special to our studio and I am so grateful that we found each other.',
      want:''
    },
    {
      name:'special people is not a deal',
      text:'We are thankful for the special people who make our community such a wonderful place.',
      want:''
    },
    {
      name:'opening day is an event',
      text:'SAVE THE DATE — OPENING DAY! Mark your calendars for September 11, 2026 and get ready for fall fun.',
      want:'Event / Activity'
    },
    {
      name:'weekday restaurant special remains a deal',
      text:'Wednesday special! Fried catfish with fries and coleslaw for $13.99.',
      want:'Deal / Special'
    },
    {
      name:'percentage discount remains a deal',
      text:'Get 10% off your order today.',
      want:'Deal / Special'
    },
    {
      name:'arrived inventory remains an offering',
      text:'Fresh apples have officially arrived at the Country Store.',
      want:'New Product / Offering'
    }
  ];
  const failures=[];
  cases.forEach(function(tc){
    const got=classifySocialActivityQualityAware_(tc.text);
    if(got!==tc.want)failures.push(tc.name+': expected '+tc.want+', got '+got);
  });
  if(failures.length)throw new Error('Social activity quality bridge self-test failed: '+failures.join(' | '));
  Logger.log('Social activity quality bridge self-test passed: '+cases.length+'/'+cases.length);
}

// Install after SocialIntake.gs. The normal post gate continues to call the
// global classifier, so this narrow override improves both direct social intake
// and Relay-discovered posts without changing the rest of the pipeline.
classifySocialActivity_=classifySocialActivityQualityAware_;
