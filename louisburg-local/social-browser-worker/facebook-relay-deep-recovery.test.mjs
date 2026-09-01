import test from 'node:test';
import assert from 'node:assert/strict';
import {deepRelayPostsFromDataSjsBlocks,deepRelayDiagnostics} from './facebook-relay-deep-recovery.mjs';

function weirdTimelineBlock(story){
  const id='adp_ProfileCometTimelineFeedQueryRelayPreloader_deep';
  return JSON.stringify({require:[['RelayPrefetchedStreamCache','next',[],[id,{__bbox:{sequence_number:1,result:{data:{user:{unexpected_public_timeline_wrapper:{payload:{cards:[{content:{story}}]}}}}}}}]]});
}

test('deep Relay fallback finds a story outside timeline_list_feed_units',()=>{
  const now=new Date('2026-09-01T19:30:00.000Z');
  const story={
    post_id:'cowboy_123',
    creation_time:Math.floor((now.getTime()-2*86400000)/1000),
    permalink_url:'https://www.facebook.com/cowboycoffeepost/posts/pfbidDeepCowboy',
    actors:[{name:'Cowboy Coffee Post'}],
    message:{text:'Save the date September 5 for a Louisburg coffee event.'},
    attachments:[{media:{image:{uri:'https://scontent.example.fbcdn.net/cowboy.jpg'}}}],
  };
  const worker={queueId:'SOC-COWBOY-PENDING',organization:'Cowboy Coffee Post',profileUrl:'https://www.facebook.com/cowboycoffeepost/',notes:''};
  const posts=deepRelayPostsFromDataSjsBlocks([weirdTimelineBlock(story)],worker,now,8);
  assert.equal(posts.length,1);
  assert.equal(posts[0].postUrl,'https://www.facebook.com/cowboycoffeepost/posts/pfbidDeepCowboy');
  assert.equal(posts[0].sourceMode,'PUBLIC_RELAY_DEEP_DATA_SJS');
  const diag=deepRelayDiagnostics([weirdTimelineBlock(story)],worker,now);
  assert.equal(diag.timelineDocs,1);
  assert.ok(diag.storyObjects>=1);
  assert.ok(diag.ownedUrls>=1);
});

test('deep Relay fallback accepts verified Cedar Cove vanity alias for numeric worker',()=>{
  const now=new Date('2026-09-01T19:30:00.000Z');
  const story={
    legacy_story_hideable_id:'cedar_123',
    creation_time:Math.floor((now.getTime()-24*3600000)/1000),
    url:'https://www.facebook.com/CedarCoveConservation/posts/pfbidDeepCedar',
    actors:[{name:'Cedar Cove Conservation & Education Center'}],
    comet_sections:{content:{story:{message:{text:'Public tour September 6 in Louisburg. Registration is open.'}}}},
  };
  const worker={queueId:'SOC-CEDARCOVE-FB',organization:'Cedar Cove Conservation & Education Center',profileUrl:'https://www.facebook.com/100064725339064',notes:'FACEBOOK_VANITY_ALIAS=https://www.facebook.com/CedarCoveConservation'};
  const posts=deepRelayPostsFromDataSjsBlocks([weirdTimelineBlock(story)],worker,now,8);
  assert.equal(posts.length,1);
  assert.equal(posts[0].profileUrl,'https://www.facebook.com/CedarCoveConservation');
});

test('deep Relay fallback rejects unrelated Page owner',()=>{
  const now=new Date('2026-09-01T19:30:00.000Z');
  const story={post_id:'bad_123',creation_time:Math.floor(now.getTime()/1000),permalink_url:'https://www.facebook.com/notcowboy/posts/pfbidWrong',actors:[{name:'Not Cowboy'}],message:{text:'Louisburg event September 5'}};
  const worker={queueId:'SOC-COWBOY-PENDING',organization:'Cowboy Coffee Post',profileUrl:'https://www.facebook.com/cowboycoffeepost/',notes:''};
  assert.equal(deepRelayPostsFromDataSjsBlocks([weirdTimelineBlock(story)],worker,now,8).length,0);
});
