import test from 'node:test';
import assert from 'node:assert/strict';
import {parseExactRecoveryHints} from './exact-post-recovery.mjs';

test('exact recovery hints keep numeric Page identity and canonical post URL',()=>{
  const hints=parseExactRecoveryHints('FACEBOOK_ALT_ID=100063452718081 EXACT_POST_URL=https://www.facebook.com/100063452718081/posts/pfbid123/?tracking=1 FIRST_PARTY_MODE=PROMO_CURRENT');
  assert.equal(hints.altId,'100063452718081');
  assert.equal(hints.exactPostUrl,'https://www.facebook.com/100063452718081/posts/pfbid123');
});

test('no exact recovery hint does not invent one',()=>{
  const hints=parseExactRecoveryHints('FIRST_PARTY_MODE=AUTO_CURRENT');
  assert.equal(hints.altId,'');
  assert.equal(hints.exactPostUrl,'');
});