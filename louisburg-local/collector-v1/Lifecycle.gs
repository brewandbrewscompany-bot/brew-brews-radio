// Louisburg Local feed lifecycle engine.
// Keeps verified Hub Feed items moving through TODAY / NEXT / NOW and expires activity when its useful public life ends.
// It does not verify content and does not promote REVIEW/HOLD items.

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
    {name:'old new product expires',item:{activityType:'New Product / Offering',discoveryDate:'2026-08-20'},section:'ARCHIVE',state:'EXPIRED',expired:true}
  ];
  const failures=[];
  cases.forEach(function(tc){
    const got=lifecycleDecision_(tc.item,now);
    if(got.section!==tc.section||got.state!==tc.state||got.expired!==tc.expired){
      failures.push(tc.name+': '+JSON.stringify(got));
    }
  });
  if(failures.length)throw new Error('Lifecycle self-test failed: '+failures.join(' | '));
  Logger.log('Lifecycle self-test passed: '+cases.length+'/'+cases.length);
}

function runLouisburgLocalLifecycle() {
  const ss=SpreadsheetApp.openById(LL_CONFIG.SPREADSHEET_ID);
  const sheet=ss.getSheetByName(LL_CONFIG.SHEETS.FEED);
  if(!sheet||sheet.getLastRow()<2)return {processed:0,changed:0,expired:0};

  const data=sheet.getDataRange().getDisplayValues();
  const ix=headerMap_(data[0]);
  const now=new Date();
  let processed=0,changed=0,expired=0;

  for(let r=1;r<data.length;r++){
    const row=data[r];
    const eligibility=cell_(row,ix,'Public Eligibility').toUpperCase();
    if(['YES','LIMITED','REVIEW','HOLD'].indexOf(eligibility)===-1)continue;

    const item={
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

    changed+=setLifecycleIfChanged_(sheet,r+1,ix,'Current Section',row,d.section);
    changed+=setLifecycleIfChanged_(sheet,r+1,ix,'Lifecycle State',row,d.state);
    if(d.expireAt)changed+=setLifecycleIfChanged_(sheet,r+1,ix,'Expire At',row,d.expireAt);
    changed+=setLifecycleIfChanged_(sheet,r+1,ix,'Freshness Boost',row,d.freshnessBoost);
    changed+=setLifecycleIfChanged_(sheet,r+1,ix,'Proximity Boost',row,d.proximityBoost);
    const rank=item.importanceBase+d.freshnessBoost+d.proximityBoost+item.sourceConfidence-item.fairnessPenalty;
    changed+=setLifecycleIfChanged_(sheet,r+1,ix,'Rank Score',row,rank);
    if(d.expired)expired++;
  }

  SpreadsheetApp.flush();
  Logger.log('Louisburg Local lifecycle: processed='+processed+' changed='+changed+' expired='+expired);
  return {processed:processed,changed:changed,expired:expired};
}

function lifecycleDecision_(item,now) {
  const tz=(typeof LL_CONFIG!=='undefined'&&LL_CONFIG.TZ)||'America/Chicago';
  const nowMs=now.getTime();
  const today=Utilities.formatDate(now,tz,'yyyy-MM-dd');
  const type=String(item.activityType||'').toLowerCase();
  const eventStart=parseLifecycleDate_(item.eventStart||item.relevantDate,false);
  const eventEnd=parseLifecycleDate_(item.eventEnd||'',true);
  const relevantDate=normalizeLifecycleDate_(item.relevantDate);
  const discovery=parseLifecycleDate_(item.discoveryDate,false);
  const explicitExpire=parseLifecycleDate_(item.expireAt,true);

  let expire=explicitExpire;
  let expired=false;

  if(eventEnd){
    expire=eventEnd;
    expired=nowMs>eventEnd.getTime();
  }else if(eventStart&&eventStart.getTime()<nowMs&&normalizeLifecycleDate_(item.eventStart||item.relevantDate)<today){
    expire=endOfLifecycleDay_(eventStart);
    expired=nowMs>expire.getTime();
  }

  const sameDayDeal=/deal|special|promotion|sale|discount|coupon/.test(type)&&String(item.currentSection||'').toUpperCase().indexOf('TODAY')!==-1;
  if(sameDayDeal&&relevantDate){
    const end=endOfLifecycleDateString_(relevantDate);
    expire=end;
    expired=nowMs>end.getTime();
  }

  if(/new product|new offering|new product \/ offering/.test(type)&&discovery){
    const fiveDays=new Date(discovery.getTime()+5*86400000);
    fiveDays.setHours(23,59,59,999);
    if(!expire||fiveDays.getTime()<expire.getTime())expire=fiveDays;
    if(nowMs>fiveDays.getTime())expired=true;
  }

  if(explicitExpire&&nowMs>explicitExpire.getTime())expired=true;

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
      if(eventStart.getTime()<=nowMs&&(!eventEnd||eventEnd.getTime()>=nowMs))state='RIGHT NOW';
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
  }else{
    section='NOW';state='NOW';
  }

  return {section:section,state:state,expired:false,expireAt:expire?formatLifecycleDateTime_(expire):'',freshnessBoost:freshnessBoost,proximityBoost:proximityBoost};
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
