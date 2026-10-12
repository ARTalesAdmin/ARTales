import test from 'node:test';
import assert from 'node:assert/strict';
import {authorizeAlice114Capture} from '../lib/pilots/alice114CaptureGate';
const base={deployment:'production' as const,request_url:'https://artales.net/api/member/ingest/alice-illustration',origin:'https://artales.net',content_type:'application/json',fetch_site:'same-origin',actor:{user_id:'admin-id',profile_id:'admin-id',role:'admin',is_active:true},json:{ordinal:1}};
test('only signed-in active admin obtains fixed source grant',()=>{const p=authorizeAlice114Capture(base);assert.equal(p.ordinal,1);assert.equal(p.grant.role,'admin');});
test('preview, editor, cross-origin and injected source fail closed',()=>{for(const p of [{deployment:'preview' as const},{origin:'https://elsewhere.invalid'},{actor:{...base.actor,role:'editor'}},{actor:{...base.actor,is_active:false}},{json:{ordinal:1,url:'https://elsewhere.invalid/image.gif'}},{json:{ordinal:43}},{json:{ordinal:0}},{content_type:'text/plain'}])assert.throws(()=>authorizeAlice114Capture({...base,...p}));});
