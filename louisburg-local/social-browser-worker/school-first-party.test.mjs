import test from 'node:test';
import assert from 'node:assert/strict';
import {parseSchoolActivityDate,extractSchoolActivities,dedupeSchoolCandidates} from './school-first-party.mjs';

test('school scanner parses short US school dates',()=>{
  const date=parseSchoolActivityDate('Community Pep Rally Thursday night 8/27/26 at 6:30 PM',new Date('2026-08-20T18:00:00Z'));
  assert.equal(date.toISOString().slice(0,10),'2026-08-27');
});

test('school scanner extracts a future PTO night',()=>{
  const raw=`Rockville K-2 Elementary\nGet ready for Louisburg Elementary PTO Night at the Stadium on September 18!\nAdmission is free and the first 100 students in Pre-K through 5th grade receive a free shirt.\n6 days ago, Louisburg USD #416 School District`;
  const result=extractSchoolActivities(raw,new Date('2026-09-01T12:00:00Z'));
  assert.equal(result.length,1);
  assert.equal(result[0].date,'2026-09-18');
  assert.equal(result[0].activityType,'Event / Activity');
});

test('school scanner rejects stale event dates',()=>{
  const raw=`Community Pep Rally\nAugust 27, 2026\nFree Dinner at 5:30 PM and Pep Rally starts at 6:30 PM.`;
  const result=extractSchoolActivities(raw,new Date('2026-09-01T12:00:00Z'));
  assert.equal(result.length,0);
});

test('school scanner treats same event reposted by district as one candidate',()=>{
  const activity={date:'2026-09-18',activityType:'Event / Activity',postId:'x',postText:'Louisburg Elementary PTO Night at the Stadium September 18. Admission is free for families.'};
  const district={date:'2026-09-18',activityType:'Event / Activity',postId:'y',postText:'Elementary PTO Night at the Stadium is September 18. Admission is free for Louisburg families.'};
  const result=dedupeSchoolCandidates([
    {source:{organization:'Rockville K-2 Elementary'},activity},
    {source:{organization:'Louisburg USD 416'},activity:district}
  ]);
  assert.equal(result.length,1);
  assert.equal(result[0].source.organization,'Rockville K-2 Elementary');
});
