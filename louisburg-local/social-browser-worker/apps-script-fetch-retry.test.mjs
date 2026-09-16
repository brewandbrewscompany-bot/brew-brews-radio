import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyLouisburgActivityType} from './apps-script-fetch-retry.mjs';

test('classifies free same-day coffee invitation as a deal',()=>{
  const text=`WEDNESDAY'S COFFEE IS READY! Today we've got Morning Light and Brazilian Hangover. As always, the brewed coffee is FREE. Come by the roastery, grab a complimentary cup and try something fresh.`;
  assert.equal(classifyLouisburgActivityType(text),'Deal / Special');
});

test('classifies routine current business invitation as an offering',()=>{
  const text=`Today we've got Wildcat and Ironclad brewed fresh and ready. Stop by, grab a cup, pick up a bag, or just say hello.`;
  assert.equal(classifyLouisburgActivityType(text),'New Product / Offering');
});

test('classifies hiring, event and operational updates',()=>{
  assert.equal(classifyLouisburgActivityType('We are now hiring part-time help. Apply today.'),'Hiring');
  assert.equal(classifyLouisburgActivityType('Open house this Saturday from 9 to 10. Join us!'),'Event / Activity');
  assert.equal(classifyLouisburgActivityType('Our phone lines are currently down. Please come in to place to-go orders.'),'Operational Update');
});

test('does not promote generic brand-only copy without current activity',()=>{
  const text='We love serving our community and making great coffee in Louisburg, Kansas.';
  assert.equal(classifyLouisburgActivityType(text),'');
});
