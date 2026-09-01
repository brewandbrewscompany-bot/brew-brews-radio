import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const source=fs.readFileSync(path.join(here,'..','collector-v1','ZZZZZZZVerificationAuditIdentityBridge.gs'),'utf8');

function loadBridge(){
  const sandbox={
    Logger:{log:()=>{}},
    socialEnsureManualVerification_:()=>{},
    socialUpsertVerificationAudit_:()=>{}
  };
  vm.createContext(sandbox);
  vm.runInContext(source,sandbox,{filename:'ZZZZZZZVerificationAuditIdentityBridge.gs'});
  return sandbox;
}

test('shared calendar URL does not merge different verification fingerprints',()=>{
  const bridge=loadBridge();
  const payload={postUrl:'https://example.com/events'};
  const row=['','','','','https://example.com/events','','','','','Social fingerprint aaaaaaaaaaaaaaaa;'];
  assert.equal(bridge.socialVerificationActivityMatches_(row,payload,'bbbbbbbbbbbbbbbb'),false);
});

test('verification audit identity matches the fingerprint and retains URL fallback only without one',()=>{
  const bridge=loadBridge();
  const payload={postUrl:'https://example.com/events'};
  const row=['','','','','https://example.com/events','','','','','Automatic checks: ok; fingerprint=bbbbbbbbbbbbbbbb; platform=WEBSITE;'];
  assert.equal(bridge.socialVerificationActivityMatches_(row,payload,'bbbbbbbbbbbbbbbb'),true);
  assert.equal(bridge.socialVerificationActivityMatches_(row,payload,''),true);
});
