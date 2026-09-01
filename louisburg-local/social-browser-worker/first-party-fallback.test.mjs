import test from 'node:test';
import assert from 'node:assert/strict';
import {parseFallbackMetadata,fallbackUrlCandidates,extractWeekdaySpecial,extractFallbackActivity,extractFallbackActivities,extractJsonLdActivities} from './first-party-fallback.mjs';

test('fallback metadata is read from queue notes',()=>{
  const meta=parseFallbackMetadata('Keep social primary. FIRST_PARTY_FALLBACK=https://example.com/specials FIRST_PARTY_MODE=WEEKDAY_SPECIALS');
  assert.equal(meta.url,'https://example.com/specials');
  assert.deepEqual(meta.urls,['https://example.com/specials']);
  assert.equal(meta.mode,'WEEKDAY_SPECIALS');
});

test('multiple fallback URLs are parsed in numbered order and de-duplicated',()=>{
  const meta=parseFallbackMetadata('FIRST_PARTY_FALLBACK=https://example.com/classes FIRST_PARTY_FALLBACK_2=https://example.com/events FIRST_PARTY_FALLBACK_3=https://example.com/classes FIRST_PARTY_MODE=AUTO_CURRENT');
  assert.equal(meta.url,'https://example.com/classes');
  assert.deepEqual(meta.urls,['https://example.com/classes','https://example.com/events']);
  assert.equal(meta.mode,'AUTO_CURRENT');
});

test('fallback URL recovery tries the verified host and its www/apex twin only',()=>{
  assert.deepEqual(fallbackUrlCandidates('https://www.example.com/events/'),['https://www.example.com/events/','https://example.com/events/']);
  assert.deepEqual(fallbackUrlCandidates('https://example.com/events/'),['https://example.com/events/','https://www.example.com/events/']);
});

test('current weekday special is extracted without neighboring days',()=>{
  const raw=`Specials\nSunday\nAny Chicken Fried Specialty $2.00 off | Bloody Mary’s & Mimosas $1.00 off\n11:00 AM - 09:00 PM\nMonday\nDaily Specials! Chicken Tenders with a Side $2.00 off | Domestic Bottles $3.75\n11:00 AM - 09:00 PM\nTuesday\nPork Tenderloin Sandwich with a Side $2.00 off | Wells $3.75\n11:00 AM - 09:00 PM`;
  const result=extractWeekdaySpecial(raw,new Date('2026-08-31T12:00:00Z'));
  assert.equal(result.postId,'MONDAY-SPECIAL-2026-08-31');
  assert.equal(result.activityType,'Deal / Special');
  assert.equal(result.postText,'Monday daily special: Chicken Tenders with a Side $2.00 off | Domestic Bottles $3.75. 11:00 AM - 9:00 PM.');
});

test('dated current activity is extracted from verified first-party text',()=>{
  const raw=`Upcoming Events\nFall Open House\nSeptember 5, 2026\nJoin us for a special event from 5 PM to 8 PM.\nContact`;
  const result=extractFallbackActivities(raw,'AUTO_CURRENT',new Date('2026-08-31T18:00:00Z'));
  assert.ok(result.length>=1);
  assert.equal(result[0].activityType,'Deal / Special');
  assert.match(result[0].postText,/September 5, 2026/i);
});

test('timed dated first-party title is treated as an event without requiring an event keyword',()=>{
  const raw=`MCDM SEMI-ANNUAL HOLIDAY PRODUCTION\nWILDCAT ACTIVITY CENTER\n“A Christmas Carol”, Saturday, December 5th, 2026 – 2:30 PM\nPerformers include all MCDM Ballet levels`;
  const result=extractFallbackActivities(raw,'AUTO_CURRENT',new Date('2026-09-01T18:00:00Z'));
  assert.equal(result.length,1);
  assert.equal(result[0].date,'2026-12-05');
  assert.equal(result[0].activityType,'Event / Activity');
  assert.match(result[0].postText,/Christmas Carol/i);
});

test('event calendar lines become separate dated activities instead of one multi-event blob',()=>{
  const raw=`American Legion Community Events\nIf you have an event to suggest please email us at info@example.com.\nSeptember 26th - Fish Fry\nOctober 5th - Red Cross Blood Drive\nOctober 8th - Sons of American Legion BBQ Contest\nNovember 7th - Music Bingo`;
  const result=extractFallbackActivities(raw,'AUTO_CURRENT',new Date('2026-09-01T18:00:00Z'));
  assert.equal(result.length,4);
  assert.deepEqual(result.map(x=>x.date),['2026-09-26','2026-10-05','2026-10-08','2026-11-07']);
  assert.ok(result.some(x=>/Fish Fry/i.test(x.postText)));
  assert.ok(result.some(x=>/Blood Drive/i.test(x.postText)));
  assert.ok(result.every(x=>!( /Fish Fry/i.test(x.postText)&&/Blood Drive/i.test(x.postText) )));
});

test('stale dated activity is rejected',()=>{
  const raw=`Events\nSummer Sale\nJune 1, 2025\nSave 20% off all weekend.`;
  const result=extractFallbackActivities(raw,'AUTO_CURRENT',new Date('2026-08-31T18:00:00Z'));
  assert.equal(result.length,0);
});

test('future JSON-LD Event is extracted and stale Event is ignored',()=>{
  const fresh=JSON.stringify({'@context':'https://schema.org','@type':'Event',name:'Cider Run',startDate:'2026-09-26T15:00:00-05:00',description:'Community event in Louisburg'});
  const stale=JSON.stringify({'@context':'https://schema.org','@type':'Event',name:'Old Event',startDate:'2025-09-26T15:00:00-05:00'});
  const result=extractJsonLdActivities([fresh,stale],new Date('2026-08-31T18:00:00Z'));
  assert.equal(result.length,1);
  assert.match(result[0].postText,/Cider Run/);
});

test('unsupported fallback mode does not invent content',()=>{
  assert.equal(extractFallbackActivity('anything','UNKNOWN',new Date()),null);
});
