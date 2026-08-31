import test from 'node:test';
import assert from 'node:assert/strict';
import {parseFallbackMetadata,extractWeekdaySpecial,extractFallbackActivity} from './first-party-fallback.mjs';

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

test('unsupported fallback mode does not invent content',()=>{
  assert.equal(extractFallbackActivity('anything','UNKNOWN',new Date()),null);
});
