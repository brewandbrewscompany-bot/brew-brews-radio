import test from 'node:test';
import assert from 'node:assert/strict';
import {relayDocumentsFromDataSjsBlocks} from './facebook-relay-recovery.mjs';
import {deepRelayPostsFromDataSjsBlocks} from './facebook-relay-lookback.mjs';

function alternateRelayBlock(story){
  const id='adp_ProfileCometTimelineFeedQueryRelayPreloader_altshape';
  return JSON.stringify({require:[['RelayPrefetchedStreamCache','next',[],[id,{__bbox:{sequence_number:1,result:{data:{user:{timeline_feed:{units:[{payload:{story}}]}}}}}}]]});
}

const worker={queueId:'SOC-COWBOY-PENDING',organization:'Cowboy Coffee Post',profileUrl:'https://www.facebook.com/cowboycoffeepost/',notes:'Require Louisburg-specific text/location before publishing location-specific activity.'};

test('deep Relay parser finds alternate TimelineFeed shapes within the 10-day lookback',()=>{
  const now=new Date('2026-09-01T17:30:00.000Z');
  const story={post_id:'cowboy_1',creation_time:Math.floor((now.getTime()-9*86400000)/1000),permalink_url:'https://www.facebook.com/cowboycoffeepost/posts/pfbidFuture',actors:[{name:'Cowboy Coffee Post'}],message:{text:'Louisburg: save the date for our September 8 fall tasting event.'}};
  const block=alternateRelayBlock(story);
  assert.ok(relayDocumentsFromDataSjsBlocks([block]).has('ProfileCometTimelineFeedQuery'));
  const posts=deepRelayPostsFromDataSjsBlocks([block],worker,now,8);
  assert.equal(posts.length,1);
  assert.equal(posts[0].postUrl,'https://www.facebook.com/cowboycoffeepost/posts/pfbidFuture');
  assert.equal(posts[0].sourceMode,'PUBLIC_RELAY_DEEP_10_DAY_LOOKBACK');
});

test('deep Relay lookback excludes posts older than ten days',()=>{
  const now=new Date('2026-09-01T17:30:00.000Z');
  const story={post_id:'cowboy_2',creation_time:Math.floor((now.getTime()-11*86400000)/1000),permalink_url:'https://www.facebook.com/cowboycoffeepost/posts/pfbidTooOld',actors:[{name:'Cowboy Coffee Post'}],message:{text:'Louisburg event on September 8.'}};
  assert.equal(deepRelayPostsFromDataSjsBlocks([alternateRelayBlock(story)],worker,now,8).length,0);
});

test('multi-location workers require Louisburg-specific copy when configured',()=>{
  const now=new Date('2026-09-01T17:30:00.000Z');
  const story={post_id:'cowboy_3',creation_time:Math.floor((now.getTime()-2*86400000)/1000),permalink_url:'https://www.facebook.com/cowboycoffeepost/posts/pfbidOtherTown',actors:[{name:'Cowboy Coffee Post'}],message:{text:'Save the date for our September 8 tasting event in Paola.'}};
  assert.equal(deepRelayPostsFromDataSjsBlocks([alternateRelayBlock(story)],worker,now,8).length,0);
});

test('deep Relay still rejects unrelated Page ownership',()=>{
  const now=new Date('2026-09-01T17:30:00.000Z');
  const story={post_id:'wrong_1',creation_time:Math.floor((now.getTime()-2*86400000)/1000),permalink_url:'https://www.facebook.com/unrelated.page/posts/pfbidWrong',actors:[{name:'Cowboy Coffee Post'}],message:{text:'Louisburg event September 8.'}};
  assert.equal(deepRelayPostsFromDataSjsBlocks([alternateRelayBlock(story)],worker,now,8).length,0);
});
