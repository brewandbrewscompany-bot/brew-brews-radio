import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const source=fs.readFileSync(path.join(here,'..','collector-v1','ZZZZZZZZEventDetailBridge.gs'),'utf8');

function loadBridge(){
  const sandbox={
    Logger:{log:()=>{}},
    socialTimeParts_:()=>({start:'09:00',end:'',window:'09:00'}),
    socialPromotionPlan_:(payload,activityType)=>({itemId:'SOC-TEST',dedupeKey:'activity|test',row:Array(31).fill('').map((v,i)=>i===8?'1 Registry St, Louisburg, KS 66053':v)})
  };
  vm.createContext(sandbox);
  vm.runInContext(source,sandbox,{filename:'ZZZZZZZZEventDetailBridge.gs'});
  return sandbox;
}

test('shared-meridiem and multiple event time ranges parse correctly',()=>{
  const bridge=loadBridge();
  assert.deepEqual(JSON.parse(JSON.stringify(bridge.socialTimeParts_('Panel Pack 4:30-5:30 PM'))),{start:'16:30',end:'17:30',window:'16:30-17:30'});
  assert.deepEqual(JSON.parse(JSON.stringify(bridge.socialTimeParts_('Two sessions: 2:00-3:30 PM and 6:00-7:30 PM'))),{start:'14:00',end:'19:30',window:'14:00-15:30 / 18:00-19:30'});
  assert.equal(bridge.socialTimeParts_('Open 11:00-1:00 PM').window,'11:00-13:00');
});

test('verified explicit Louisburg venue overrides Registry address only for first-party content',()=>{
  const bridge=loadBridge();
  const firstParty=bridge.socialPromotionPlan_({text:'Barn Quilt at Fox Community Hall.'},'Event / Activity','fp',{sourceType:'FIRST_PARTY'},new Date());
  assert.equal(firstParty.row[8],'Fox Community Hall, 201 S Broadway St, Louisburg, KS 66053');
  const social=bridge.socialPromotionPlan_({text:'Barn Quilt at Fox Community Hall.'},'Event / Activity','fp',{sourceType:'SOCIAL'},new Date());
  assert.equal(social.row[8],'1 Registry St, Louisburg, KS 66053');
  const unknown=bridge.socialPromotionPlan_({text:'Event at an unknown venue.'},'Event / Activity','fp',{sourceType:'FIRST_PARTY'},new Date());
  assert.equal(unknown.row[8],'1 Registry St, Louisburg, KS 66053');
});
