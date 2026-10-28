import test from "node:test";
import assert from "node:assert/strict";
import {assessRoleAudit,PLAN_ROLE,PROJECT_REF}
 from "../scripts/artales-migration-role-audit.mjs";
const NOW="2026-10-28T16:30:00.000Z";
function good(){
 return {schema:"artales.plan-role-audit/v0",
   source:"operator-attested-provider-readback",projectRef:PROJECT_REF,
   database:"postgres",role:PLAN_ROLE,observedAt:"2026-10-28T16:29:00.000Z",
   roleFlags:{login:true,inherit:false,superuser:false,createRole:false,
      createDb:false,replication:false,bypassRls:false},
   catalog:{tablesScanned:80,functionsScanned:190},
   privileges:{ledgerSchemaUsage:true,ledgerSelect:true,ledgerWrite:false,
     otherTableSelect:0,otherTableWrite:0,schemaCreate:0,databaseCreate:false},
   publicDefiners:{audited:11,executable:[]}};
}
function blocked(r){assert.throws(()=>assessRoleAudit(r,NOW),/artales_plan_role_blocked/);}
test("only an exhaustive narrow role proposal may produce a non-executable attestation",()=>{
 const r=assessRoleAudit(good(),NOW);
 assert.equal(r.rolePrivilegeEvidenceAccepted,true);
 assert.equal(r.mayApply,false);
 assert.equal(r.productionApplyAuthorized,false);
});
test("current ARTales PUBLIC EXECUTE on 10 definers must fail closed",()=>{
 const r=good();
 r.publicDefiners.executable=[
   "public.activate_reader_membership_with_credits(uuid,text,integer,integer,integer,boolean)",
   "public.artales_complete_onboarding_v082(text,text)",
   "public.artales_ensure_profile_after_login_v082()",
   "public.artales_find_pending_invite_for_email(text)",
   "public.artales_sync_profile_from_auth_user_v081()",
   "public.handle_new_user()","public.is_handle_available(text)",
   "public.rls_auto_enable()","public.use_at_credit_online_unlock(uuid,uuid)",
   "public.use_member_online_unlock(uuid,uuid)"];
 blocked(r);
});
test("NOINHERIT cannot override PUBLIC function execute",()=>{
 const r=good();r.roleFlags.inherit=false;
 r.publicDefiners.executable=["public.example()"];blocked(r);
});
test("broader table privilege, schema CREATE and bypassRLS are rejected",()=>{
 const variants=[
  x=>x.roleFlags.bypassRls=true,
  x=>x.roleFlags.inherit=true,
  x=>x.roleFlags.createRole=true,
  x=>x.privileges.otherTableSelect=1,
  x=>x.privileges.otherTableWrite=1,
  x=>x.privileges.ledgerWrite=true,
  x=>x.privileges.ledgerSelect=false,
  x=>x.privileges.schemaCreate=1,
  x=>x.privileges.databaseCreate=true
 ];
 for(const mutate of variants){const r=good();mutate(r);blocked(r);}
});
test("stale and untrusted, malformed or partial audit fails",()=>{
 const a=good();a.observedAt="2026-10-28T16:00:00.000Z";blocked(a);
 const b=good();b.source="local-synthetic";blocked(b);
 const c=good();delete c.publicDefiners;blocked(c);
 const d=good();d.publicDefiners.audited=195;blocked(d);
 const e=good();e.role="postgres";blocked(e);
 const f=good();f.catalog.tablesScanned=0;blocked(f);
});
