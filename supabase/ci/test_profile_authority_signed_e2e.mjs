#!/usr/bin/env node
// Synthetic signed Auth security regression, loopback-only.
import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
const status=JSON.parse(execFileSync('supabase',['status','-o','json'],{encoding:'utf8'}));
const url=status.API_URL,anon=status.ANON_KEY,service=status.SERVICE_ROLE_KEY;
if(!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(url)||!anon||!service)throw Error('Refusing nonlocal API');
const request=async(path,token,body,method='POST')=>{
 const response=await fetch(url+path,{method,headers:{apikey:anon,Authorization:'Bearer '+token,'Content-Type':'application/json',Prefer:'return=representation'},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const raw=await response.text();let data;try{data=JSON.parse(raw)}catch{data={raw}};
 return {status:response.status,data};
};
const email='authority-'+randomUUID().slice(0,10)+'@example.invalid';
const password='Fixture-'+randomUUID()+'!x';
const created=await request('/auth/v1/admin/users',service,{email,password,email_confirm:true,user_metadata:{role:'admin',display_name:'QA Reader'}});
if(![200,201].includes(created.status)||!created.data.id)throw Error('Local signup failed '+JSON.stringify(created));
const id=created.data.id;
const signed=await request('/auth/v1/token?grant_type=password',anon,{email,password});
if(signed.status!==200||signed.data.user?.id!==id||!signed.data.access_token)throw Error('Signed login failed');
const token=signed.data.access_token;
const before=await request('/rest/v1/profiles?select=id,role,is_active,display_name&id=eq.'+id,service,undefined,'GET');
if(before.status!==200||before.data.length!==1||before.data[0].role!=='reader')throw Error('Signup metadata elevated role '+JSON.stringify(before));
const attempt=await request('/rest/v1/profiles?id=eq.'+id,token,{role:'admin',is_active:true},'PATCH');
if(attempt.status<400)throw Error('Signed user mutated staff authority: '+JSON.stringify(attempt));
const allowed=await request('/rest/v1/profiles?id=eq.'+id,token,{display_name:'Safe signed profile edit'},'PATCH');
if(allowed.status!==200||!Array.isArray(allowed.data)||allowed.data.length!==1)throw Error('Safe profile update regression '+JSON.stringify(allowed));
const after=await request('/rest/v1/profiles?select=id,role,is_active,display_name&id=eq.'+id,service,undefined,'GET');
if(after.status!==200||after.data[0].role!=='reader'||after.data[0].display_name!=='Safe signed profile edit')throw Error('Role changed or safe profile edit failed '+JSON.stringify(after));
console.log('PASS actual signed GoTrue: user-controlled metadata admin becomes reader; privilege escalation denied; safe profile edit works');


const inviteEmail='invited-'+randomUUID().slice(0,10)+'@example.invalid';
execFileSync('psql',['-X','-v','ON_ERROR_STOP=1','-v','invite_email='+inviteEmail,
 '-f','supabase/ci/test_profile_invite_seed.sql'],{stdio:'pipe'});
const invited=await request('/auth/v1/admin/users',service,{
 email:inviteEmail,password,email_confirm:true,
 user_metadata:{role:'reader',display_name:'QA Invited Editor'}
});
if(![200,201].includes(invited.status)||!invited.data.id)throw Error('Invited signup failed '+JSON.stringify(invited));
const verifiedInvite=await request('/rest/v1/profiles?select=id,role,invite_id&id=eq.'+invited.data.id,service,undefined,'GET');
if(verifiedInvite.status!==200||verifiedInvite.data.length!==1||verifiedInvite.data[0].role!=='editor'||!verifiedInvite.data[0].invite_id)
 throw Error('Verified server email invitation did not grant editor '+JSON.stringify(verifiedInvite));
console.log('PASS verified pending invitation retains editor role, disregards spoofed user metadata');
