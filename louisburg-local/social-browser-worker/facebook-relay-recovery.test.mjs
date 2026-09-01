import test from 'node:test';
import assert from 'node:assert/strict';
import {dataSjsBlocksFromHtml,relayDocumentsFromDataSjsBlocks,relayPostsFromDataSjsBlocks} from './facebook-relay-recovery.mjs';

function relayBlock(story,message='Fresh roasted coffee is ready in Louisburg today!'){
  const id='adp_ProfileCometTimelineFeedQueryRelayPreloader_test123';
  return JSON.stringify({
    require:[
      ['RelayPrefetchedStreamCache','next',[],[id,{__bbox:{sequence_number:1,result:{data:{user:{timeline_list_feed_units:{edges:[{node:story}]}}}}}}]],
      ['RelayPrefetchedStreamCache@abc123','next',[],[id,{__bbox:{sequence_number:2,result:{label:'deferred-message',path:['user','timeline_list_feed_units','edges',0,'node'],data:{message:{text:message}}}}}]],
    ],
  });
}

test('signed-out data-sjs Relay timeline yields a verified current Brew & Brews post',()=>{
  const now=new Date('2026-09-01T17:30:00.000Z');
  const story={
    post_id:'100063452718081_999999999',
    creation_time:Math.floor((now.getTime()-10*60*1000)/1000),
    permalink_url:'https://www.facebook.com/BB.Coffee.Tea/posts/pfbidToday',
    // Facebook's public Page display name currently differs from the registry name.
    actors:[{id:'100063452718081',name:'Brew and Brews Company'}],
    attachments:[{style_list:['photo'],media:{image:{uri:'https://scontent.example.fbcdn.net/current-post.jpg'}}}],
  };
  const block=relayBlock(story);
  const worker={
    queueId:'SOC-BREW-PENDING',
    organization:'Brew & Brews Coffee Co.',
    profileUrl:'https://www.facebook.com/100063452718081',
    notes:'FACEBOOK_VANITY_ALIAS=https://www.facebook.com/BB.Coffee.Tea',
  };
  const docs=relayDocumentsFromDataSjsBlocks([block]);
  assert.ok(docs.has('ProfileCometTimelineFeedQuery'));
  const posts=relayPostsFromDataSjsBlocks([block],worker,now,8);
  assert.equal(posts.length,1);
  assert.equal(posts[0].postUrl,'https://www.facebook.com/BB.Coffee.Tea/posts/pfbidToday');
  assert.equal(posts[0].postText,'Fresh roasted coffee is ready in Louisburg today!');
  assert.equal(posts[0].mediaType,'IMAGE');
  assert.equal(posts[0].sourceMode,'PUBLIC_RELAY_DATA_SJS');
});

test('Relay recovery rejects a post owned by an unrelated Facebook Page',()=>{
  const now=new Date('2026-09-01T17:30:00.000Z');
  const story={
    post_id:'999_123',
    creation_time:Math.floor((now.getTime()-5*60*1000)/1000),
    permalink_url:'https://www.facebook.com/notbrew/posts/pfbidWrong',
    actors:[{name:'Not Brew'}],
  };
  const worker={queueId:'SOC-BREW-PENDING',organization:'Brew & Brews Coffee Co.',profileUrl:'https://www.facebook.com/100063452718081',notes:'FACEBOOK_VANITY_ALIAS=https://www.facebook.com/BB.Coffee.Tea'};
  assert.equal(relayPostsFromDataSjsBlocks([relayBlock(story)],worker,now,8).length,0);
});

test('data-sjs extraction reads only public application/json script blocks',()=>{
  const body=relayBlock({post_id:'1',creation_time:1,permalink_url:'https://www.facebook.com/x/posts/y'});
  const html=`<html><script type="text/javascript" data-sjs>${body}</script><script type="application/json" data-sjs>${body}</script></html>`;
  const blocks=dataSjsBlocksFromHtml(html);
  assert.equal(blocks.length,1);
  assert.equal(blocks[0],body);
});
