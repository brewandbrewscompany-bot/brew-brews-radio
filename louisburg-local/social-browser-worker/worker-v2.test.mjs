import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalPostUrl,findFacebookDateLabel,parseFacebookDateLabel,publicFacebookPageCandidates} from './worker-v2.mjs';

test('modern Facebook content URLs canonicalize',()=>{
  assert.equal(canonicalPostUrl('https://m.facebook.com/test/posts/pfbid123?__cft__=x'),'https://www.facebook.com/test/posts/pfbid123');
  assert.equal(canonicalPostUrl('https://www.facebook.com/permalink.php?story_fbid=123&id=456&tracking=1'),'https://www.facebook.com/permalink.php?story_fbid=123&id=456');
  assert.equal(canonicalPostUrl('https://www.facebook.com/test/reel/123/?foo=1'),'https://www.facebook.com/test/reel/123');
});

test('mobile-first page candidates include m, www, and mbasic',()=>{
  const c=publicFacebookPageCandidates('https://www.facebook.com/examplepage');
  assert.equal(c[0],'https://m.facebook.com/examplepage?sk=posts');
  assert.ok(c.includes('https://www.facebook.com/examplepage?sk=posts'));
  assert.ok(c.includes('https://mbasic.facebook.com/examplepage?sk=posts'));
});

test('recent relative labels remain discoverable',()=>{
  const now=new Date('2026-08-31T10:00:00-05:00');
  assert.equal(findFacebookDateLabel('Brew and Brews Company\n2 hrs\nNew coffee blend - try it today!',now),'2 hrs');
  assert.equal(now-parseFacebookDateLabel('2 hrs',now),7200000);
});
