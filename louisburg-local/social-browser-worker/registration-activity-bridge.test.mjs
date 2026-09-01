import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const source=fs.readFileSync(path.join(here,'..','collector-v1','ZZZZZZRegistrationActivityBridge.gs'),'utf8');

function loadBridge(){
  const calls={auto:[],firstParty:[],promotion:[]};
  const sandbox={
    Logger:{log:()=>{}},
    socialAutoVerificationDecision_:(payload,activityType,...rest)=>{calls.auto.push(activityType);return {ok:true,activityType,rest};},
    socialFirstPartyVerificationDecision_:(payload,activityType,...rest)=>{calls.firstParty.push(activityType);return {ok:true,activityType,rest};},
    socialPromotionPlan_:(payload,activityType)=>{calls.promotion.push(activityType);return {itemId:'SOC-TEST',dedupeKey:'activity|test',row:Array(31).fill('')};}
  };
  vm.createContext(sandbox);
  vm.runInContext(source,sandbox,{filename:'ZZZZZZRegistrationActivityBridge.gs'});
  return {sandbox,calls};
}

test('registration activity aliases to event safeguards without changing other types',()=>{
  const {sandbox}=loadBridge();
  assert.equal(sandbox.socialRegistrationActivityAlias_('Registration / Event'),'Event / Activity');
  assert.equal(sandbox.socialRegistrationActivityAlias_('Deal / Special'),'Deal / Special');
});

test('registration activity is verified with event safeguards and keeps registration Hub classification',()=>{
  const {sandbox,calls}=loadBridge();
  sandbox.socialAutoVerificationDecision_({},'Registration / Event',new Date(),{}, {}, {});
  sandbox.socialFirstPartyVerificationDecision_({},'Registration / Event',new Date(),{},{});
  const plan=sandbox.socialPromotionPlan_({},'Registration / Event','fingerprint',{sourceType:'FIRST_PARTY'},new Date());
  assert.deepEqual(calls.auto,['Event / Activity']);
  assert.deepEqual(calls.firstParty,['Event / Activity']);
  assert.deepEqual(calls.promotion,['Event / Activity']);
  assert.equal(plan.row[2],'Registration');
  assert.equal(plan.row[30],'Registration / Event');
});
