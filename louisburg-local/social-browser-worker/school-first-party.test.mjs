import test from 'node:test';
import assert from 'node:assert/strict';
import {parseSchoolActivityDate,extractSchoolActivities,dedupeSchoolCandidates} from './school-first-party.mjs';

test('school scanner parses short US school dates',()=>{
  const date=parseSchoolActivityDate('Community Pep Rally Thursday night 8/27/26 at 6:30 PM',new Date('2026-08-20T18:00:00Z'));
  assert.equal(date.toISOString().slice(0,10),'2026-08-27');
});

test('school scanner extracts a future PTO night without adjacent post text',()=>{
  const raw=`Let’s kick off the year on a sweet note! We can’t wait to see our Wildcat families on the playground!\n10 DAYS AGO, JANNEIL CRADER\nCome out September 18th for Louisburg Elementary PTO Night at the Stadium! Free admission & Free Shirt to the first 100 students Pre-5th Grade.\n14 DAYS AGO, LOUISBURG USD #416 SCHOOL DISTRICT`;
  const result=extractSchoolActivities(raw,new Date('2026-09-01T12:00:00Z'));
  assert.equal(result.length,1);
  assert.equal(result[0].date,'2026-09-18');
  assert.equal(result[0].activityType,'Event / Activity');
  assert.match(result[0].postText,/PTO Night at the Stadium/i);
  assert.doesNotMatch(result[0].postText,/sweet note/i);
  assert.doesNotMatch(result[0].postText,/14 DAYS AGO/i);
});

test('school scanner rejects stale event dates',()=>{
  const raw=`Community Pep Rally\nAugust 27, 2026\nFree Dinner at 5:30 PM and Pep Rally starts at 6:30 PM.`;
  const result=extractSchoolActivities(raw,new Date('2026-09-01T12:00:00Z'));
  assert.equal(result.length,0);
});

test('relative age prevents an old January closure from becoming next January',()=>{
  const raw=`Louisburg Schools are closed on Monday, January 26th due to inclement weather.\n7 MONTHS AGO, LOUISBURG USD #416 SCHOOL DISTRICT\nAnother older post.`;
  const parsed=parseSchoolActivityDate('Louisburg Schools are closed on Monday, January 26th due to inclement weather.',new Date('2026-09-01T12:00:00Z'),'7 MONTHS AGO, LOUISBURG USD #416 SCHOOL DISTRICT');
  assert.equal(parsed.toISOString().slice(0,10),'2026-01-26');
  const result=extractSchoolActivities(raw,new Date('2026-09-01T12:00:00Z'));
  assert.equal(result.length,0);
});

test('school scanner treats same event reposted by district as one candidate',()=>{
  const activity={date:'2026-09-18',activityType:'Event / Activity',postId:'x',postText:'Louisburg Elementary PTO Night at the Stadium September 18. Admission is free for families.'};
  const district={date:'2026-09-18',activityType:'Event / Activity',postId:'y',postText:'Elementary PTO Night at the Stadium is September 18. Admission is free for Louisburg families.'};
  const result=dedupeSchoolCandidates([
    {source:{organization:'Rockville K-2 Elementary - USD 416'},activity},
    {source:{organization:'Louisburg USD 416'},activity:district}
  ]);
  assert.equal(result.length,1);
  assert.equal(result[0].source.organization,'Rockville K-2 Elementary - USD 416');
});


test('school navigation enrollment labels do not become activity',()=>{
  const raw=`Broadmoor 3-5 Elementary\nSkyward Family Access\nNew Student Enrollment\nReturning Student Enrollment\nSEARCH SITE\nMENU\nTRANSLATE\nBROADMOOR 3-5 ELEMENTARY\nLIVE FEED\nHere's your Weekly Wildcat News for August 30, 2026!\nhttps://app.smore.com/n/31njw`;
  const result=extractSchoolActivities(raw,new Date('2026-09-01T12:00:00Z'));
  assert.equal(result.length,0);
});
