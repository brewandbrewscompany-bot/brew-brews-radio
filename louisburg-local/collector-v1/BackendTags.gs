// Louisburg Local backend tags and designations.
// Category tags are derived in Apps Script, not hardcoded in the frontend.
// Designations are read from Master Registry and only surfaced when verified.

function runBackendTagsSelfTest() {
  const cases=[
    {name:'food',text:'Food / Special featured dish dinner',want:'food'},
    {name:'timber creek chicken special',text:'Monday chicken tender and domestic bottle specials at Timber Creek',want:'food'},
    {name:'wednesday catfish deal',text:'Wednesday catfish dinner special with fries and a side',want:'food'},
    {name:'food deal keeps promotion',text:'Wednesday catfish deal special',want:'promotions'},
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
    if(tc.notWant&&tags.indexOf(' '+tc.notWant+' ')!==-1)failures.push(tc.name+': unexpectedly contained '+tc.notWant);
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
    if(preview.length<30)preview.push({id:cell_(row,ix,'Item ID'),organization:cell_(row,ix,'Business / Organization'),tags:bundle.tags,designations:bundle.designations,designationLabels:bundle.designationLabels});
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
  const s=String(text||'').toLowerCase();
  const tags=[];
  function add(tag){if(tags.indexOf(tag)===-1)tags.push(tag);}

  // Food is a secondary/navigation category, independent of the primary activity type.
  // Keep this vocabulary broad enough that specials such as chicken tenders or catfish
  // remain Food even when their primary type is Deal / Special.
  if(/food|drink|coffee|restaurant|cafe|steak|menu|dining|barbecue|ice cream|cider|burger|chicken|tender|catfish|\bfish\b|pizza|taco|sandwich|breakfast|brunch|lunch|dinner|meal|entree|wings|fries|bottle special|beer|wine/.test(s)){add('food');add('food-drink');}
  if(/coffee|espresso|roast|roastery/.test(s))add('coffee');
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

  return {tags:tags.join(' '),designations:cleanDesignations,designationLabels:designationLabels};
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
