#!/usr/bin/env node
// Disposable local GoTrue + PostgREST E2E. No cloud project, no production credentials.
import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';

const status=JSON.parse(execFileSync('supabase',['status','-o','json'],{encoding:'utf8'}));
const url=status.API_URL, anon=status.ANON_KEY, service=status.SERVICE_ROLE_KEY;
if(!url || !/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(url) || !anon || !service)
  throw Error('Refusing non-loopback Supabase API or missing local keys');
const tag=randomUUID().slice(0,8);
const password='QA-'+randomUUID()+'!x';
const users=[
  {role:'admin',email:'artales-admin-'+tag+'@example.invalid'},
  {role:'editor',email:'artales-editor-'+tag+'@example.invalid'},
  {role:'reader',email:'artales-reader-'+tag+'@example.invalid'}
];
const request=async(path,token,body,method='POST')=>{
  const response=await fetch(url+path,{method,headers:{'apikey':anon,'Authorization':'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body)});
  const raw=await response.text();let data;try{data=JSON.parse(raw)}catch{data={raw}};
  return {status:response.status,data};
};
for(const u of users){
  const created=await request('/auth/v1/admin/users',service,{email:u.email,password,email_confirm:true});
  if(created.status!==200 && created.status!==201) throw Error('Local GoTrue admin create failed '+u.role+' '+JSON.stringify(created.data).slice(0,300));
  u.id=created.data.id;
  const login=await request('/auth/v1/token?grant_type=password',anon,{email:u.email,password});
  if(login.status!==200 || !login.data.access_token || login.data.user?.id!==u.id)throw Error('Signed login failed: '+u.role);
  u.token=login.data.access_token;
}
const [admin,editor,reader]=users;
execFileSync('psql',['-h','127.0.0.1','-p','54322','-U','postgres','-d','postgres','-X','-v','ON_ERROR_STOP=1',
  '-v','admin_id='+admin.id,'-v','editor_id='+editor.id,'-v','reader_id='+reader.id,
  '-v','admin_email='+admin.email,'-v','editor_email='+editor.email,'-v','reader_email='+reader.email,
  '-f','supabase/ci/signed_auth_e2e_seed.sql'],{stdio:'pipe',env:{...process.env,PGPASSWORD:'postgres'}});
const rpc=async(user,fn,args)=>request('/rest/v1/rpc/'+fn,user.token,args);
const c='11111111-1111-4111-8111-111111111111';
const src='44444444-4444-4444-8444-444444444441';
const capture=await rpc(admin,'register_candidate_source_capture',{
 p_candidate_id:c,p_source_id:src,p_text:'Signed auth E2E synthetic source with independently verifiable source bytes.',
 p_inventory:[{component_type:'WORK_CONTENT',included:true},{component_type:'EDITION_CONTENT',included:false}],
 p_provenance_note:'Synthetic E2E fixture only, no actual legal licence or publishing approval.'
});
if(capture.status!==200 || capture.data.result!=='pending_independent_review')throw Error('Capture failed '+JSON.stringify(capture));
const reviewArgs={p_capture_id:capture.data.capture_id,p_expected_sha256:capture.data.sha256,
 p_review_note:'Independent signed editor review of strictly synthetic fixture content.',
 p_origin_type:'public_domain',p_source_label:'manual'};
const self=await rpc(admin,'review_candidate_source_capture',reviewArgs);
if(self.status!==200 || self.data.result!=='blocked' || self.data.reason!=='self_review_forbidden')throw Error('Self-review not denied '+JSON.stringify(self));
const reviewed=await rpc(editor,'review_candidate_source_capture',reviewArgs);
if(reviewed.status!==200 || reviewed.data.result!=='review_recorded')throw Error('Editor review failed '+JSON.stringify(reviewed));
const denied=await rpc(reader,'promote_candidate_to_edit_text',{p_candidate_id:c});
if(denied.status<400 || !JSON.stringify(denied.data).includes('editor_role_required'))throw Error('Reader not denied '+JSON.stringify(denied));
const promotion=await rpc(admin,'promote_candidate_to_edit_text',{p_candidate_id:c});
if(promotion.status!==200 || promotion.data.result!=='promoted' || !promotion.data.work_id || !promotion.data.task_id)throw Error('Promotion failed '+JSON.stringify(promotion));
const repeated=await rpc(editor,'promote_candidate_to_edit_text',{p_candidate_id:c});
if(repeated.status!==200 || repeated.data.result!=='already_promoted' || repeated.data.work_id!==promotion.data.work_id || repeated.data.task_id!==promotion.data.task_id)throw Error('Idempotency failed '+JSON.stringify(repeated));
const tasks=await fetch(url+'/rest/v1/editorial_tasks?select=id,kind,work_id&id=eq.'+promotion.data.task_id,{headers:{apikey:anon,Authorization:'Bearer '+editor.token}});
const rows=await tasks.json();
if(tasks.status!==200 || rows.length!==1 || rows[0].kind!=='edit_text' || rows[0].work_id!==promotion.data.work_id) throw Error('Editor task not readable');
const direct=await request('/rest/v1/candidate_source_captures',admin.token,{candidate_id:c,source_id:src,source_text:'forged'},'POST');
if(direct.status<400)throw Error('Direct capture write must be blocked');
console.log('PASS signed local GoTrue Auth: admin/editor/reader password sessions');
console.log('PASS PostgREST RPC capture, self-review rejection, independent review, reader denial');
console.log('PASS one work-scoped edit_text task, idempotent promotion, direct write rejection');
console.log('NOTE synthetic rights proof only; publication legally NOT authorized');
