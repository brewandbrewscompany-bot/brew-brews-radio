import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {canonicalPostUrl,cleanPostText,findFacebookDateLabel,isPostFresh,parseFacebookDateLabel,publicFacebookPageCandidates,shouldScanWorker} from './worker.mjs';

test('canonicalPostUrl keeps the public permalink and removes tracking',()=>{
  assert.equal(canonicalPostUrl('https://www.facebook.com/louisburgcidermill/posts/pfbid123?__cft__=tracking'),'https://www.facebook.com/louisburgcidermill/posts/pfbid123');
  assert.equal(canonicalPostUrl('https://example.com/posts/nope'),'');
});

test('relative Facebook age becomes a fresh ISO-capable date',()=>{
  const now=new Date('2026-08-30T18:00:00-05:00');
  const date=parseFacebookDateLabel('1d',now);
  assert.equal(now.getTime()-date.getTime(),86400000);
  assert.equal(isPostFresh(date,now),true);
});

test('human Facebook relative labels parse too',()=>{
  const now=new Date('2026-08-31T08:00:00-05:00');
  assert.equal(now.getTime()-parseFacebookDateLabel('2 hrs',now).getTime(),7200000);
  assert.equal(parseFacebookDateLabel('Just now',now).getTime(),now.getTime());
});

test('visible post text can reveal a timestamp without a permalink',()=>{
  const now=new Date('2026-08-31T08:00:00-05:00');
  const raw='Timber Creek Bar & Grill\n2 hrs\nMonday special: Chicken Tenders with a Side $2 off\nLike\nComment';
  assert.equal(findFacebookDateLabel(raw,now),'2 hrs');
});

test('dated public label is parsed in the current year',()=>{
  const now=new Date(2026,7,30,18,0,0);
  const date=parseFacebookDateLabel('August 18 at 12:03 PM',now);
  assert.equal(date.getFullYear(),2026);
  assert.equal(date.getMonth(),7);
  assert.equal(date.getDate(),18);
});

test('post copy is separated from Facebook controls',()=>{
  const raw=`Louisburg Cider Mill\n1d\n·\nApples are here at the Country Store!\nFresh apples have officially arrived.\n#LouisburgCiderMill\nAll reactions:\n15\nLike\nComment`;
  assert.equal(cleanPostText(raw,'Louisburg Cider Mill','1d'),'Apples are here at the Country Store!\nFresh apples have officially arrived.\n#LouisburgCiderMill');
});

test('worker cadence respects hourly and daily queue settings',()=>{
  const now=new Date('2026-08-30T18:00:00-05:00');
  assert.equal(shouldScanWorker({scanMode:'META_API_PUBLIC_PAGE',lastScanAtIso:'2026-08-30T22:50:00.000Z',scanFrequency:'HOURLY'},now),true);
  assert.equal(shouldScanWorker({scanMode:'BROWSER_PUBLIC_PREVIEW',lastScanAtIso:'2026-08-30T22:30:00.000Z',scanFrequency:'HOURLY'},now),false);
  assert.equal(shouldScanWorker({scanMode:'BROWSER_PUBLIC_PREVIEW',lastScanAtIso:'2026-08-29T23:00:00.000Z',scanFrequency:'DAILY'},now),true);
});

test('numeric Facebook Pages get normal logged-out fallback surfaces',()=>{
  const candidates=publicFacebookPageCandidates('https://www.facebook.com/450736031663124');
  assert.ok(candidates.includes('https://www.facebook.com/450736031663124/posts'));
  assert.ok(candidates.includes('https://m.facebook.com/450736031663124'));
  assert.ok(candidates.includes('https://www.facebook.com/profile.php?id=450736031663124&sk=posts'));
});

function loadCollectorBridge(relativePath,globals={}){
  const source=fs.readFileSync(new URL(relativePath,import.meta.url),'utf8');
  const context=vm.createContext({console,Logger:{log:()=>{}},...globals});
  vm.runInContext(source,context,{filename:relativePath});
  return context;
}

test('current activity-quality bridge passes its embedded regression suite',()=>{
  const ctx=loadCollectorBridge('../collector-v1/ZZZSocialActivityQualityBridge.gs',{
    classifySocialActivity_:()=>'',
    socialPostGate_:()=>({ok:true})
  });
  assert.doesNotThrow(()=>ctx.runSocialActivityQualityBridgeSelfTest());
});

test('current semantic-dedupe bridge passes its embedded regression suite',()=>{
  const ctx=loadCollectorBridge('../collector-v1/ZZZZZSocialSemanticDedupeBridge.gs',{
    socialPromoteToHub_:()=>({promoted:false,reason:'BASE_TEST_STUB'})
  });
  assert.doesNotThrow(()=>ctx.runSocialSemanticDedupeSelfTest());
});
