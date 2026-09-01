import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalPostUrl,facebookPostBelongsToProfile,facebookPostBelongsToWorker,facebookSeedPost,facebookWorkerIdentityUrls,findFacebookDateLabel,parseFacebookDateLabel,publicFacebookPageCandidates,workerFacebookPageCandidates} from './worker-v2.mjs';

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


test('post ownership must match the verified Facebook Page',()=>{
  assert.equal(facebookPostBelongsToProfile('https://www.facebook.com/LouisburgKSChamber/posts/pfbid123','https://www.facebook.com/LouisburgKSChamber'),true);
  assert.equal(facebookPostBelongsToProfile('https://www.facebook.com/louisburgsportszone/posts/pfbid123','https://www.facebook.com/LouisburgKSChamber'),false);
  assert.equal(facebookPostBelongsToProfile('https://www.facebook.com/450736031663124/posts/pfbid123','https://www.facebook.com/450736031663124'),true);
});


test('exact Facebook seed post is read from worker notes',()=>{
  const notes='FIRST_PARTY_MODE=AUTO_CURRENT FACEBOOK_SEED_POST=https://www.facebook.com/100063646776157/posts/pfbidExample/';
  assert.equal(facebookSeedPost(notes),'https://www.facebook.com/100063646776157/posts/pfbidExample');
});

// Protect Pages like Brew & Brews that have both stable numeric and vanity public identities.
test('verified numeric Facebook identity also trusts configured vanity alias',()=>{
  const worker={profileUrl:'https://www.facebook.com/100063452718081',notes:'FACEBOOK_VANITY_ALIAS=https://www.facebook.com/BB.Coffee.Tea FACEBOOK_ALT_ID=100063452718081'};
  assert.deepEqual(facebookWorkerIdentityUrls(worker),['https://www.facebook.com/100063452718081','https://www.facebook.com/BB.Coffee.Tea']);
  assert.equal(facebookPostBelongsToWorker('https://www.facebook.com/BB.Coffee.Tea/posts/pfbid123',worker),true);
  assert.equal(facebookPostBelongsToWorker('https://www.facebook.com/100063452718081/posts/pfbid456',worker),true);
  assert.equal(facebookPostBelongsToWorker('https://www.facebook.com/anotherpage/posts/pfbid789',worker),false);
  const candidates=workerFacebookPageCandidates(worker);
  assert.ok(candidates.some(v=>v.includes('/BB.Coffee.Tea')));
  assert.ok(candidates.some(v=>v.includes('id=100063452718081')));
});
