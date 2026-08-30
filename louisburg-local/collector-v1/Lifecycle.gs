// Louisburg Local feed lifecycle engine.
// Preview-first. Only YES/LIMITED public items are eligible for automated lifecycle movement.
// REVIEW/HOLD rows and editorial lifecycle labels are never overwritten by this engine.

function runLifecycleSelfTest() {
  const now=new Date('2026-08-30T14:00:00-05:00');
  const cases=[
    {name:'today event',item:{eventStart:'2026-08-30 18:00',eventEnd:'2026-08-30 20:00',relevantDate:'2026-08-30',activityType:'Event',discoveryDate:'2026-08-29'},section:'TODAY',state:'TODAY',expired:false},
    {name:'live now',item:{eventStart:'2026-08-30 13:00',eventEnd:'2026-08-30 15:00',relevantDate:'2026-08-30',activityType:'Event',discoveryDate:'2026-08-29'},section:'TODAY',state:'RIGHT NOW',expired:false},
    {name:'coming up',item:{eventStart:'2026-09-02 16:00',eventEnd:'2026-09-02 17:00',relevantDate:'2026-09-02',activityType:'Event',discoveryDate:'2026-08-30'},section:'NEXT',state:'COMING UP',expired:false},
    {name:'whats next',item:{eventStart:'2026-10-10 09:00',eventEnd:'2026-10-10 14:00',relevantDate:'2026-10-10',activityType:'Event',discoveryDate:'2026-08-30'},section:'NOW',state:"WHAT'S NEXT",expired:false},
    {name:'ended event',item:{eventStart:'2026-08-29 09:00',eventEnd:'2026-08-29 11:00',relevantDate:'2026-08-29',activityType:'Event',discoveryDate:'2026-08-29'},section:'ARCHIVE',state:'EXPIRED',expired:true},
    {name:'same day deal',item:{relevantDate:'2026-08-30',activityType:'Deal / Special',discoveryDate:'2026-08-30',currentSection:'TODAY'},section:'TODAY',state:'TODAY',expired:false},
    {name:'old same day deal',item:{relevantDate:'2026-08-29',activityType:'Deal / Special',discoveryDate:'2026-08-29',currentSection:'TODAY'},section:'ARCHIVE',state:'EXPIRED',expired:true},
    {name:'new product five day life',item:{activityType:'New Product / Offering',discoveryDate:'2026-08-28'},section:'NOW',state:'NEW',expired:false},
    {name:'old new product expires',item:{activityType:'New Product / Offering',discoveryDate:'2026-08-20'},section:'ARCHIVE',state:'EXPIRED',expired:true},
    {name:'registration explicit expiry preserved',item:{eventStart:'2026-09-16',eventEnd:'2026-10-28',relevantDate:'2026-09-10',activityType:'Registration',discoveryDate:'2026-08-29',expireAt:'2026-09-11 00:00'},section:'NOW',state:"WHAT'S NEXT",expired:false,expirePrefix:'2026-09-11'},
    {name:'explicit event buffer preserved',item:{eventStart:'2026-09-05 09:00',eventEnd:'2026-09-05 11:00',relevantDate:'2026-09-05',activityType:'Event',discoveryDate:'2026-08-30',expireAt:'2026-09-05 11:30'},section:'NEXT',state:'COMING UP',expired:false,expirePrefix:'2026-09-05 11:30'}
  ];
  const failures=[];
  cases.forEach(function(tc){
    const got=lifecycleDecision_(tc.item,now);
    if(got.section!==tc.section||got.state!==tc.state||got.expired!==tc.expired||(tc.expirePrefix&&String(got.expireAt||'').indexOf(tc.expirePrefix)!==0)){
      failures.push(tc.name+': '+JSON.stringify(got));
    }
  });
  if(failures.length)throw new Error('Lifecycle self-test failed: '+failures.join(' | '));
  Logger.log('Lifecycle self-test passed: '+cases.length+'/'+cases.length);
}

function previewLouisburgLocalLifecycle() {
  return lifecyclePlan_(false);
}

function runLouisburgLocalLifecycle() {
  return lifecyclePlan_(true);
}

function lifecyclePlan_(applyChanges) {
  const ss=SpreadsheetApp.openById(LL_CONFIG.SPREADSHEET_ID);
  const sheet=ss.getSheetByName(LL_CONFIG.SHEETS.FEED);
  if(!sheet||sheet.getLastRow()<2)return {processed:0,planned:0,changed:0,expired:0,skippedReviewHold:0};

  const data=sheet.getDataRange().getDisplayValues();
  const ix=headerMap_(data[0]);
  const now=new Date();
  let processed=0,planned=0,changed=0,expired=0,skippedReviewHold=0;
  const preview=[];

  for(let r=1;r<data.length;r++){
    const row=data[r];
    const eligibility=cell_(row,ix,'Public Eligibility').toUpperCase();
    if(eligibility==='REVIEW'||eligibility==='HOLD'){
      skippedReviewHold++;
      continue;
    }
    if(['YES','LIMITED'].indexOf(eligibility)===-1)continue;

    const item={
      itemId:cell_(row,ix,'Item ID'),
      organization:cell_(row,ix,'Business / Organization'),
      currentSection:cell_(row,ix,'Current Section'),
      lifecycleState:cell_(row,ix,'Lifecycle State'),
      relevantDate:cell_(row,ix,'Relevant / Event Date'),
      eventStart:cell_(row,ix,'Event Start'),
      eventEnd:cell_(row,ix,'Event End'),
      discoveryDate:cell_(row,ix,'Discovery / Post Date'),
      activityType:cell_(row,ix,'Business Activity Type')||cell_(row,ix,'Category'),
      expireAt:cell_(row,ix,'Expire At'),
      importanceBase:Number(cell_(row,ix,'Importance Base')||0),
      sourceConfidence:Number(cell_(row,ix,'Source Confidence Score')||0),
      fairnessPenalty:Number(cell_(row,ix,'Fairness Penalty')||0)
    };
    processed++;
    const d=lifecycleDecision_(item,now);
    const preserveState=shouldPreserveLifecycleState_(item.lifecycleState);
    const stateToWrite=preserveState?item.lifecycleState:d.state;
    const rank=item.importanceBase+d.freshnessBoost+d.proximityBoost+item.sourceConfidence-item.fairnessPenalty;

    const changes=[];
    addLifecyclePreviewChange_(changes,row,ix,'Current Section',d.section);
    if(!preserveState)addLifecyclePreviewChange_(changes,row,ix,'Lifecycle State',stateToWrite);
    if(d.expireAt)addLifecyclePreviewChange_(changes,row,ix,'Expire At',d.expireAt);
    addLifecyclePreviewChange_(changes,row,ix,'Freshness Boost',d.freshnessBoost);
    addLifecyclePreviewChange_(changes,row,ix,'Proximity Boost',d.proximityBoost);
    addLifecyclePreviewChange_(changes,row,ix,'Rank Score',rank);

    if(changes.length){
      planned+=changes.length;
      if(preview.length<30)preview.push({itemId:item.itemId,organization:item.organization,changes:changes});
      if(applyChanges){
        changed+=setLifecycleIfChanged_(sheet,r+1,ix,'Current Section',row,d.section);
        if(!preserveState)changed+=setLifecycleIfChanged_(sheet,r+1,ix,'Lifecycle State',row,stateToWrite);
        if(d.expireAt)changed+=setLifecycleIfChanged_(sheet,r+1,ix,'Expire At',row,d.expireAt);
        changed+=setLifecycleIfChanged_(sheet,r+1,ix,'Freshness Boost',row,d.freshnessBoost);
        changed+=setLifecycleIfChanged_(sheet,r+1,ix,'Proximity Boost',row,d.proximityBoost);
        changed+=setLifecycleIfChanged_(sheet,r+1,ix,'Rank Score',row,rank);
      }
    }
    if(d.expired)expired++;
  }

  if(applyChanges)SpreadsheetApp.flush();
  Logger.log((applyChanges?'Lifecycle APPLY':'Lifecycle PREVIEW')+': processed='+processed+' planned='+planned+' changed='+changed+' expired='+expired+' skipped-review-hold='+skippedReviewHold);
  if(preview.length)Logger.log(JSON.stringify(preview));
  return {processed:processed,planned:planned,changed:changed,expired:expired,skippedReviewHold:skippedReviewHold,preview:preview};
}

function lifecycleDecision_(item,now) {
  const tz=(typeof LL_CONFIG!=='undefined'&&LL_CONFIG.TZ)||'America/Chicago';
  const nowMs=now.getTime();
  const today=Utilities.formatDate(now,tz,'yyyy-MM-dd');
  const type=String(item.activityType||'').toLowerCase();
  const hasExplicitEventStart=!!String(item.eventStart||'').trim();
  const eventStart=parseLifecycleDate_(item.eventStart||item.relevantDate,false);
  const eventEnd=parseLifecycleDate_(item.eventEnd||'',true);
  const relevantDate=normalizeLifecycleDate_(item.relevantDate);
  const discovery=parseLifecycleDate_(item.discoveryDate,false);
  const explicitExpire=parseLifecycleDate_(item.expireAt,true);

  // An explicit Expire At value is editorial/source truth and is never extended or shortened here.
  let expire=explicitExpire;
  let expired=!!(explicitExpire&&nowMs>explicitExpire.getTime());

  if(!explicitExpire){
    if(eventEnd){
      expire=eventEnd;
      expired=nowMs>eventEnd.getTime();
    }else if(eventStart&&eventStart.getTime()<nowMs&&normalizeLifecycleDate_(item.eventStart||item.relevantDate)<today){
      expire=endOfLifecycleDay_(eventStart);
      expired=nowMs>expire.getTime();
    }
  }

  const sameDayDeal=/deal|special|promotion|sale|discount|coupon/.test(type)&&String(item.currentSection||'').toUpperCase().indexOf('TODAY')!==-1;
  if(!explicitExpire&&sameDayDeal&&relevantDate){
    const end=endOfLifecycleDateString_(relevantDate);
    expire=end;
    expired=nowMs>end.getTime();
  }

  if(/new product|new offering|new product \/ offering/.test(type)&&discovery&&!explicitExpire){
    const fiveDays=new Date(discovery.getTime()+5*86400000);
    fiveDays.setHours(23,59,59,999);
    expire=fiveDays;
    if(nowMs>fiveDays.getTime())expired=true;
  }

  const freshnessBoost=lifecycleFreshnessBoost_(discovery,now);
  const proximityBoost=lifecycleProximityBoost_(eventStart||parseLifecycleDate_(relevantDate,false),now,today);

  if(expired){
    return {section:'ARCHIVE',state:'EXPIRED',expired:true,expireAt:formatLifecycleDateTime_(expire||now),freshnessBoost:0,proximityBoost:0};
  }

  let section='NOW',state='NOW';
  if(eventStart){
    const eventDate=normalizeLifecycleDate_(item.eventStart||item.relevantDate);
    const days=lifecycleDayDiff_(today,eventDate);
    if(eventDate===today){
      section='TODAY';
      if(hasExplicitEventStart&&eventStart.getTime()<=nowMs&&(!eventEnd||eventEnd.getTime()>=nowMs))state='RIGHT NOW';
      else state='TODAY';
    }else if(days>=0&&days<=7){
      section='NEXT';state='COMING UP';
    }else if(days>7){
      section='NOW';state="WHAT'S NEXT";
    }
  }else if(sameDayDeal&&relevantDate===today){
    section='TODAY';state='TODAY';
  }else if(/new product|new offering/.test(type)&&discovery){
    section='NOW';state='NEW';
  }

  return {section:section,state:state,expired:false,expireAt:expire?formatLifecycleDateTime_(expire):'',freshnessBoost:freshnessBoost,proximityBoost:proximityBoost};
}

function shouldPreserveLifecycleState_(state){
  const s=String(state||'').toUpperCase();
  if(!s)return false;
  if(s.indexOf('/')!==-1)return true;
  return /FEATURED|REVIEW|ROUTINE|SPLIT|SUPPRESS|VERIFY|HOLD/.test(s);
}

function addLifecyclePreviewChange_(changes,row,ix,header,value){
  const c=ix[header];
  if(c==null)return;
  const old=String(row[c]==null?'':row[c]).trim();
  const next=String(value==null?'':value).trim();
  if(old!==next)changes.push({field:header,from:old,to:next});
}

function lifecycleFreshnessBoost_(discovery,now){
  if(!discovery)return 0;
  const days=Math.floor((now.getTime()-discovery.getTime())/86400000);
  if(days<=2)return 20;
  if(days<=5)return 12;
  if(days<=14)return 5;
  return 0;
}

function lifecycleProximityBoost_(eventDate,now,today){
  if(!eventDate)return 0;
  const d=normalizeLifecycleDate_(eventDate);
  const days=lifecycleDayDiff_(today,d);
  if(days<0)return 0;
  if(days===0)return 30;
  if(days<=2)return 20;
  if(days<=7)return 15;
  if(days<=30)return 5;
  return 0;
}

function lifecycleDayDiff_(fromYmd,toYmd){
  if(!fromYmd||!toYmd)return 9999;
  const a=fromYmd.split('-').map(Number),b=toYmd.split('-').map(Number);
  return Math.round((Date.UTC(b[0],b[1]-1,b[2])-Date.UTC(a[0],a[1]-1,a[2]))/86400000);
}

function normalizeLifecycleDate_(v){
  if(v instanceof Date&&!isNaN(v.getTime()))return Utilities.formatDate(v,(typeof LL_CONFIG!=='undefined'&&LL_CONFIG.TZ)||'America/Chicago','yyyy-MM-dd');
  const s=String(v||'').trim();
  if(!s)return '';
  let m=s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if(m)return m[1]+'-'+m[2]+'-'+m[3];
  m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if(m)return m[3]+'-'+('0'+m[1]).slice(-2)+'-'+('0'+m[2]).slice(-2);
  return '';
}

function parseLifecycleDate_(v,endOfDay){
  if(v instanceof Date&&!isNaN(v.getTime()))return new Date(v.getTime());
  const s=String(v||'').trim();
  if(!s)return null;
  let m=s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if(m){
    const hasTime=m[4]!=null;
    const d=new Date(Number(m[1]),Number(m[2])-1,Number(m[3]),hasTime?Number(m[4]):(endOfDay?23:0),hasTime?Number(m[5]):(endOfDay?59:0),hasTime?Number(m[6]||0):(endOfDay?59:0),endOfDay&&!hasTime?999:0);
    return isNaN(d.getTime())?null:d;
  }
  const d=new Date(s);
  return isNaN(d.getTime())?null:d;
}

function endOfLifecycleDay_(d){const x=new Date(d.getTime());x.setHours(23,59,59,999);return x;}
function endOfLifecycleDateString_(ymd){const p=ymd.split('-').map(Number);return new Date(p[0],p[1]-1,p[2],23,59,59,999);}
function formatLifecycleDateTime_(d){return Utilities.formatDate(d,(typeof LL_CONFIG!=='undefined'&&LL_CONFIG.TZ)||'America/Chicago','yyyy-MM-dd HH:mm:ss');}

function setLifecycleIfChanged_(sheet,row,ix,header,sourceRow,value){
  const c=ix[header];
  if(c==null)return 0;
  const old=String(sourceRow[c]==null?'':sourceRow[c]).trim();
  const next=String(value==null?'':value).trim();
  if(old===next)return 0;
  sheet.getRange(row,c+1).setValue(value);
  return 1;
}
