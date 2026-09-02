import test from 'node:test';
import assert from 'node:assert/strict';
import {parseArbiterAnchorText,parseArbiterEventsResponse} from './wildcats-schedule.mjs';

function summary(start,gameId,teamId,label,time='07:00 PM'){
  return {
    start,
    title:`<a data-content='&lt;div&gt;&lt;a href=&#39;/Teams/Game/${gameId}/13250/${teamId}/93&#39;&gt;&lt;span class=&#39;fc-event-time&#39;&gt;${time}&lt;/span&gt;&lt;br/&gt;${label} Game&lt;/a&gt;&lt;/div&gt;'>Games</a>`
  };
}

test('parses Arbiter visible game text',()=>{
  const event=parseArbiterAnchorText('7:00p - 9:00p Varsity Boys Football vs. Tonganoxie High School');
  assert.equal(event.time,'7:00 PM');
  assert.equal(event.endTime,'9:00 PM');
  assert.equal(event.teamLabel,'Varsity Boys Football');
  assert.equal(event.sport,'Football');
  assert.equal(event.homeAway,'HOME');
  assert.equal(event.opponent,'Tonganoxie High School');
});

test('joins structured Arbiter date/game id with visible opponent text',()=>{
  const outer={EventsFilteredSummaryString:JSON.stringify([summary('9/4/2026 12:00 AM','96570833','7646646','Varsity Boys Football')])};
  const anchors=[{href:'/Teams/Game/96570833/13250/7646646/93',text:'7:00p - 9:00p Varsity Boys Football vs. Tonganoxie High School'}];
  const rows=parseArbiterEventsResponse(outer,anchors,{today:'2026-09-01',futureDays:14});
  assert.equal(rows.length,1);
  assert.equal(rows[0].date,'2026-09-04');
  assert.equal(rows[0].postId,'WILDCATS-96570833');
  assert.equal(rows[0].opponent,'Tonganoxie High School');
  assert.equal(rows[0].postUrl,'https://www.arbiterlive.com/Teams/Game/96570833/13250/7646646/93');
});

test('dedupes duplicate logical games and prefers active over canceled record',()=>{
  const outer={EventsFilteredSummaryString:JSON.stringify([
    summary('9/8/2026 12:00 AM','101331383','7713492','Varsity Boys Soccer','06:00 PM'),
    summary('9/8/2026 12:00 AM','101063757','7713492','Varsity Boys Soccer','06:00 PM')
  ])};
  const anchors=[
    {href:'/Teams/Game/101331383/13250/7713492/93',text:'6:00p Varsity Boys Soccer vs. Pittsburg High School Canceled'},
    {href:'/Teams/Game/101063757/13250/7713492/93',text:'6:00p Varsity Boys Soccer vs. Pittsburg High School'}
  ];
  const rows=parseArbiterEventsResponse(outer,anchors,{today:'2026-09-01',futureDays:14});
  assert.equal(rows.length,1);
  assert.equal(rows[0].cancelled,false);
  assert.equal(rows[0].gameId,'101063757');
});

test('keeps a canceled game when there is no active duplicate',()=>{
  const outer={EventsFilteredSummaryString:JSON.stringify([summary('9/3/2026 12:00 AM','100999554','7713493','Junior Varsity Boys Soccer','04:30 PM')])};
  const anchors=[{href:'/Teams/Game/100999554/13250/7713493/93',text:'4:30p - 6:00p Junior Varsity Boys Soccer at Basehor-linwood HS Canceled'}];
  const rows=parseArbiterEventsResponse(outer,anchors,{today:'2026-09-01',futureDays:7});
  assert.equal(rows.length,1);
  assert.equal(rows[0].cancelled,true);
  assert.equal(rows[0].homeAway,'AWAY');
});
