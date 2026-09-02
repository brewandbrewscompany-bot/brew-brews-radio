import test from 'node:test';
import assert from 'node:assert/strict';
import {extractWildcatEvents} from './wildcats-schedule.mjs';

test('extracts athletic contests and ignores practices/non-sports',()=>{
  const body=`Louisburg\nFriday, September 4, 2026\nTime\tEvent\tDetails\n7:20am\tFCA Meeting\tLHS Room 108 location\n7:00pm\tFootball: Varsity Game\tvs. Tonganoxie USD 464 @ Louisburg High School Wildcat Stadium Complex location\nSaturday, September 5, 2026\n8:00am\tCross Country: Varsity Invitational\tvs. Multiple Schools.. @ Ottawa High School location\n9:00am\tVolleyball Team Practice\tLHS Main Gym location\n`;
  const rows=extractWildcatEvents(body,{today:'2026-09-01',futureDays:14});
  assert.equal(rows.length,2);
  assert.equal(rows[0].date,'2026-09-04');
  assert.match(rows[0].title,/Football: Varsity Game/);
  assert.equal(rows[0].opponent,'Tonganoxie USD 464');
  assert.match(rows[0].location,/Louisburg High School/);
  assert.equal(rows[1].sport,'Cross Country');
});

test('supports line-separated table cells and skips expired dates',()=>{
  const body=`Monday, August 31, 2026\n4:30pm\nFootball: JV Game Bus Info\nvs. Paola @ Paola High School location\nTuesday, September 1, 2026\n4:30pm\nSoccer: Boys JV Game\nvs. Bonner Springs @ Wildcat Stadium Complex location\n6:00pm\nSoccer: Boys Varsity Game\nvs. Bonner Springs @ Wildcat Stadium Complex location\n`;
  const rows=extractWildcatEvents(body,{today:'2026-09-01',futureDays:7});
  assert.equal(rows.length,2);
  assert(rows.every(x=>x.date==='2026-09-01'));
  assert(rows.every(x=>x.opponent==='Bonner Springs'));
});

test('keeps cancelled contests as operationally meaningful schedule entries',()=>{
  const body=`Thursday, September 3, 2026\n4:30pm\tSoccer: Boys JV Game (Cancelled)\tvs. Paola @ Wildcat Stadium Complex location\n`;
  const rows=extractWildcatEvents(body,{today:'2026-09-01',futureDays:7});
  assert.equal(rows.length,1);
  assert.equal(rows[0].cancelled,true);
});
