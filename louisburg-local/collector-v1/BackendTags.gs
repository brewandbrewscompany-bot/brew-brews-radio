// Louisburg Local backend tags and designations.
// Category tags are derived in Apps Script, not hardcoded in the frontend.
// Designations are read from Master Registry and only surfaced when verified.

function runBackendTagsSelfTest() {
  const cases=[
    {name:'food',text:'Food / Special featured dish dinner',want:'food'},
    {name:'timber creek chicken special',text:'Deal / Special Monday chicken tender and domestic bottle specials at Timber Creek. $2 off Chicken Tenders with a Side, plus domestic bottles for $3.75.',want:'food'},
    {name:'wednesday catfish deal',text:'Deal / Special Wednesday special fried catfish with curly fries or regular fries and a small side of coleslaw for $13.99!',want:'food'},
    {name:'food deal keeps promotion',text:'Deal / Special Wednesday catfish dinner special for $13.99',want:'promotions'},
    {name:'ciderfest pancake incidental',text:'Event Ciderfest returns for two fall weekends with the Lions Club pancake breakfast, crafts, vendors and family activities. Admission and parking are free.',notWant:'food'},
    {name:'music at restaurant is not food',text:'Event Live music Friday night at Timber Creek Bar & Grill. Band starts at 8 PM.',notWant:'food'},
    {name:'bakery registration is not food',text:'Registration Sign up for our fall business workshop hosted at the bakery.',notWant:'food'},
    {name:'coffee product is food',text:'New Product / Offering New seasonal coffee is available now in 12 oz bags for $14.',want:'food'},
    {name:'restaurant meal offer is food',text:'Deal / Special Burger basket with fries is $9.99 today from 11 AM to 2 PM.',want:'food'},
    {name:'music',text:'Live Music band concert',want:'music'},
    {name:'promotion',text:'Deal / Special discount promotion',want:'promotions'},
    {name:'kids',text:'Kids youth family event',want:'kids'},
    {name:'sports',text:'Sports soccer football',want:'sports'},
    {name:'shopping',text:'Shopping vendor market boutique',want:'shopping'},
    {name:'registration',text:'Registration booking sign-up class',want:'registration'},
    {name:'hiring',text:'Hiring now hiring local job',want:'hiring'},
    {name:'community',text:'Community fundraiser public meeting',want:'community'},
    {name:'roastery designation',text:'Coffee Roastery new coffee release',designations:['LOCAL_ROASTERY'],want:'local-roastery'},
    {name:'no inferred original',text:'Distinctive local attraction',designations:[],notWant:'louisburg-original'},
    {name:'music at market not shopping',text:'Community / Live Music Music at the Market returns September 5',want:'music',notWant:'shopping'},
    {name:'sports hiring not what to do',text:'Sports Hiring LRC is hiring sports officials',want:'hiring',notWant:'what-to-do'},
    {name:'actual games are what to do',text:'Sports Youth soccer and football games are underway today',want:'what-to-do'}
  ];
  const failures=[];
  cases.forEach(function(tc){
    const got=buildBackendTagBundleFromText_(tc.text,tc.designations||[],designationLabelDefaults_());
    const tags=(' '+got.tags+' ');
    if(tc.want&&tags.indexOf(' '+tc.want+' ')===-1)failures.push(tc.name+': missing '+tc.want+' in '+got.tags);
    if(tc.notWant&&tags.indexOf(' '+tc.notWant+' ')!==-1)failures.push(tc.name+': unexpectedly contained '+tc.notWant+'; food='+JSON.stringify(got.foodContext||{}));
  });
  if(failures.length)throw new Error('Backend tags self-test failed: '+failures.join(' | '));
  Logger.log('Backend tags self-test passed: '+cases.length+'/'+cases.length);
}

function previewBackendTagCoverage() {
  const ss=SpreadsheetApp.openById(LL_CONFIG.SPREADSHEET_ID);
  const feed=ss.getSheetByName(LL_CONFIG.SHEETS.FEED);
  if(!feed||feed.getLastRow()<2)return {items:0,designated:0};
  const registry=buildRegistryDesignationIndex_(ss);
  const labels=buildDesignationLabelMap_(ss);
  const data=feed.getDataRange().getDisplayValues();
  const ix=headerMap_(data[0]);
  const preview=[];
  let items=0,designated=0;
  for(let r=1;r<data.length;r++){
    const row=data[r];
    const eligibility=cell_(row,ix,'Public Eligibility').toUpperCase();
    if(['YES','LIMITED'].indexOf(eligibility)===-1)continue;
    const bundle=deriveBackendTagBundle_(row,ix,registry,labels);
    items++;
    if(bundle.designations.length)designated++;
    if(preview.length<30)preview.push({id:cell_(row,ix,'Item ID'),organization:cell_(row,ix,'Business / Organization'),tags:bundle.tags,foodContext:bundle.foodContext,designations:bundle.designations,designationLabels:bundle.designationLabels});
  }
  Logger.log('Backend tag preview: items='+items+' designated='+designated);
  Logger.log(JSON.stringify(preview));
  return {items:items,designated:designated,preview:preview};
}

function deriveBackendTagBundle_(row,ix,registryIndex,labelMap) {
  const org=cell_(row,ix,'Business / Organization');
  const text=[
    cell_(row,ix,'Category'),
    cell_(row,ix,'Business Activity Type'),
    cell_(row,ix,'Headline'),
    cell_(row,ix,'Summary')
  ].join(' ');
  const rec=(registryIndex&&registryIndex[normalizeDesignationOrg_(org)])||{designations:[]};
  return buildBackendTagBundleFromText_(text,rec.designations||[],labelMap||designationLabelDefaults_());
}

function buildBackendTagBundleFromText_(text,designations,labelMap) {
  const s=String(text||'').toLowerCase().replace(/\s+/g,' ').trim();
  const tags=[];
  function add(tag){if(tags.indexOf(tag)===-1)tags.push(tag);}

  // Food is classified from the meaning of the whole post, not from a single trigger word.
  // A food/drink noun is evidence only. The post also needs offering/menu/price/availability
  // context unless the primary activity itself is explicitly food-related.
  const foodContext=classifyFoodContext_(s);
  if(foodContext.classification==='FOOD_OFFERING'){add('food');add('food-drink');}

  if(/coffee|espresso|roast|roastery/.test(s)&&foodContext.classification==='FOOD_OFFERING')add('coffee');
  if(/music|concert|band|dj|karaoke|trivia|live entertainment/.test(s))add('music');
  if(/deal|special|promotion|sale|discount|coupon|giveaway|contest/.test(s))add('promotions');
  if(/family|kid|child|youth|homeschool/.test(s)){add('family');add('kids');}
  if(/sport|soccer|football|athletic|wildcat|kickball|fishing club|golf/.test(s))add('sports');
  if(/shopping|vendor(?:\s+\/\s+|\s+)market|flea market|market street|boutique|retail|open house/.test(s))add('shopping');
  if(/community|fundraiser|public notice|meeting|library|church|city/.test(s))add('community');
  if(/registration|register|booking|sign-up|signup|class|camp|reservation/.test(s))add('registration');
  if(/hiring|now hiring|job opening|employment/.test(s))add('hiring');
  if(/event|festival|ciderfest|vendor(?:\s+\/\s+|\s+)market|flea market|registration|register|music|concert|band|\bgames?\b|match|tournament|meeting|class|open house/.test(s))add('what-to-do');
  if(/hours update|closing early|cancelled|canceled|sold out|weather change|relocation|important update/.test(s))add('right-now');

  const cleanDesignations=[];
  const designationLabels=[];
  (designations||[]).forEach(function(code){
    const c=String(code||'').trim().toUpperCase();
    if(['LOCAL_ROASTERY','LOUISBURG_ORIGINAL','VERIFIED_FIRST_ONLY'].indexOf(c)===-1)return;
    if(cleanDesignations.indexOf(c)!==-1)return;
    cleanDesignations.push(c);
    if(c==='LOCAL_ROASTERY')add('local-roastery');
    if(c==='LOUISBURG_ORIGINAL')add('louisburg-original');
    if(c==='VERIFIED_FIRST_ONLY')add('verified-first-only');
    designationLabels.push((labelMap&&labelMap[c])||designationLabelDefaults_()[c]);
  });

  return {tags:tags.join(' '),foodContext:foodContext,designations:cleanDesignations,designationLabels:designationLabels};
}

function classifyFoodContext_(text){
  const s=String(text||'').toLowerCase().replace(/\s+/g,' ').trim();
  if(!s)return {classification:'NON_FOOD',score:0,reason:'empty'};

  // Evidence families. These are deliberately used together instead of as standalone tags.
  const foodNoun=/\b(food|meal|dish|entree|breakfast|brunch|lunch|dinner|burger|hamburger|chicken|tenders?|catfish|fish|steak|ribeye|filet|pizza|tacos?|sandwich|wings|fries|coleslaw|barbecue|bbq|ice cream|coffee|espresso|latte|cappuccino|cider|beer|wine|cocktail|mimosa|bloody mary|bottle|drink|beverage)\b/g;
  const directOffer=/\b(special|deal|menu|served|serving|order|available|offering|featured|comes with|with a side|choice of|your choice|plate|basket|combo|freshly roasted|fresh inventory|in stock)\b/g;
  const commerce=/\$\s?\d|\b\d+(?:\.\d{2})?\s*(?:dollars?|off)\b|\bbuy one\b|\bbogo\b|\bpercent off\b|\bdiscount\b/g;
  const immediacy=/\b(today|tonight|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|daily|this week|available now|now available|until \d|from \d|starts? at \d)\b/g;
  const eventFrame=/\b(event|festival|ciderfest|concert|music|band|crafts?|vendors?|family activities|parade|fair|meeting|fundraiser|registration|register|workshop|class|open house|tournament|games?)\b/g;
  const nonFoodPurpose=/\b(hiring|job opening|apply now|registration|register|workshop|class|meeting|concert|live music|band|parade|crafts?|vendors?|family activities)\b/g;

  const foodHits=countRegexHits_(s,foodNoun);
  const offerHits=countRegexHits_(s,directOffer);
  const commerceHits=countRegexHits_(s,commerce);
  const timeHits=countRegexHits_(s,immediacy);
  const eventHits=countRegexHits_(s,eventFrame);
  const nonFoodHits=countRegexHits_(s,nonFoodPurpose);

  // Strong structural clues that the actual thing being promoted is food/drink.
  const explicitFoodPrimary=/\b(food\s*\/|food special|drink special|meal special|dinner special|lunch special|breakfast special|menu special|new coffee|new drink|new menu|coffee release|freshly roasted)\b/.test(s);
  const pricedFood=foodHits>0&&commerceHits>0;
  const offeredFood=foodHits>0&&offerHits>0;
  const timedFood=foodHits>0&&timeHits>0&&(offerHits>0||commerceHits>0);

  let score=0;
  score+=Math.min(foodHits,4)*2;
  score+=Math.min(offerHits,3)*2;
  score+=Math.min(commerceHits,2)*3;
  score+=Math.min(timeHits,2);
  if(explicitFoodPrimary)score+=5;
  if(pricedFood)score+=4;
  if(offeredFood)score+=3;
  if(timedFood)score+=2;

  // Incidental-food protection: events/classes/etc. can mention pancakes, drinks, a venue,
  // or a restaurant without making the post a Food destination.
  if(eventHits>=2&&foodHits===1&&commerceHits===0&&offerHits===0)score-=8;
  if(nonFoodHits>=1&&foodHits===1&&commerceHits===0&&offerHits===0)score-=6;
  if(/\b(hosted at|located at|at the)\s+(?:restaurant|bar|cafe|coffee shop|bakery)\b/.test(s)&&commerceHits===0&&offerHits===0)score-=5;
  if(/\bwith (?:a|the) (?:pancake breakfast|meal|refreshments?|snacks?)\b/.test(s)&&eventHits>=1&&commerceHits===0)score-=4;

  let classification='NON_FOOD';
  if(score>=8&&(foodHits>=1)&&(explicitFoodPrimary||pricedFood||offeredFood||timedFood))classification='FOOD_OFFERING';
  else if(foodHits>0)classification='FOOD_INCIDENTAL';

  return {
    classification:classification,
    score:score,
    reason:'food='+foodHits+', offer='+offerHits+', price='+commerceHits+', time='+timeHits+', event='+eventHits+', nonFoodPurpose='+nonFoodHits
  };
}

function countRegexHits_(text,re){
  const flags=re.flags.indexOf('g')===-1?re.flags+'g':re.flags;
  const copy=new RegExp(re.source,flags);
  const m=String(text||'').match(copy);
  return m?m.length:0;
}

function buildRegistryDesignationIndex_(ss) {
  const sheet=ss.getSheetByName('Master Registry');
  const out={};
  if(!sheet||sheet.getLastRow()<2)return out;
  const data=sheet.getDataRange().getDisplayValues();
  const ix=headerMap_(data[0]);
  for(let r=1;r<data.length;r++){
    const row=data[r];
    const org=cell_(row,ix,'Business / Organization');
    if(!org)continue;
    const key=normalizeDesignationOrg_(org);
    if(!out[key])out[key]={designations:[],evidence:[]};

    const louisburgVerified=/^(yes|verified)$/i.test(cell_(row,ix,'Louisburg Verified'));
    const designationVerified=/^(yes|verified)$/i.test(cell_(row,ix,'Designation Verified'));
    const explicit=String(cell_(row,ix,'Public Designations')||'').split(/[;,|]/).map(function(v){return v.trim().toUpperCase();}).filter(String);

    if(designationVerified){
      explicit.forEach(function(code){
        if(['LOCAL_ROASTERY','LOUISBURG_ORIGINAL','VERIFIED_FIRST_ONLY'].indexOf(code)!==-1&&out[key].designations.indexOf(code)===-1)out[key].designations.push(code);
      });
    }

    // LOCAL_ROASTERY can also be safely inferred from a verified Louisburg registry category.
    // The more subjective ORIGINAL and FIRST/ONLY designations are never inferred.
    if(louisburgVerified&&/coffee\s+roastery/i.test(cell_(row,ix,'Category'))&&out[key].designations.indexOf('LOCAL_ROASTERY')===-1){
      out[key].designations.push('LOCAL_ROASTERY');
    }

    const evidence=cell_(row,ix,'Designation Evidence');
    if(evidence&&out[key].evidence.indexOf(evidence)===-1)out[key].evidence.push(evidence);
  }
  return out;
}

function buildDesignationLabelMap_(ss) {
  const labels=designationLabelDefaults_();
  const sheet=ss.getSheetByName('Category Rules');
  if(!sheet||sheet.getLastRow()<2)return labels;
  const data=sheet.getDataRange().getDisplayValues();
  const ix=headerMap_(data[0]);
  for(let r=1;r<data.length;r++){
    const code=cell_(data[r],ix,'Business Activity Type').toUpperCase();
    if(labels[code]!=null){
      const label=cell_(data[r],ix,'Public Label');
      if(label)labels[code]=label;
    }
  }
  return labels;
}

function designationLabelDefaults_(){
  return {LOCAL_ROASTERY:'Local Roastery',LOUISBURG_ORIGINAL:'Louisburg Original',VERIFIED_FIRST_ONLY:'Verified First / Only'};
}

function normalizeDesignationOrg_(value){
  return String(value||'').toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
}
