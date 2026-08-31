import test from 'node:test';
import assert from 'node:assert/strict';
import {parseFallbackMetadata,extractWeekdaySpecial,extractFallbackActivity,extractFallbackActivities,extractJsonLdActivities} from './first-party-fallback.mjs';

test('fallback metadata is read from queue notes',()=>{
  const meta=parseFallbackMetadata('Keep social primary. FIRST_PARTY_FALLBACK=https://example.com/specials FIRST_PARTY_MODE=WEEKDAY_SPECIALS');
  assert.equal(meta.url,'https://example.com/specials');
  assert.equal(meta.mode,'WEEKDAY_SPECIALS');
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
