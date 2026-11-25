// Offline ARTales PLAN role admission. No provider connection, role creation,
// grants, credentials or production APPLY. Inputs are operator-attested only.
export const PROJECT_REF="nmhdwmszbwgrgfbmlguu";
export const PLAN_ROLE="artales_migration_plan_reader";
const stop=s=>{throw new Error("artales_plan_role_blocked:"+s);};
const fields=(obj,keys)=>obj&&typeof obj==="object"&&!Array.isArray(obj)&&
 Object.keys(obj).sort().join("|")===keys.slice().sort().join("|");
const nonnegative=x=>Number.isSafeInteger(x)&&x>=0;
export function assessRoleAudit(report,nowISO){
 if(!fields(report,["schema","source","projectRef","database","role","observedAt",
    "roleFlags","catalog","privileges","publicDefiners"]))
  stop("audit_shape");
 if(report.schema!=="artales.plan-role-audit/v0"||
    report.source!=="operator-attested-provider-readback"||
    report.projectRef!==PROJECT_REF||report.database!=="postgres"||
    report.role!==PLAN_ROLE)stop("wrong_scope_or_source");
 const age=Date.parse(nowISO)-Date.parse(report.observedAt);
 if(!Number.isFinite(age)||age>15*60*1000||age< -30000||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(report.observedAt))
   stop("unfresh_evidence");
 const rf=report.roleFlags;
 if(!fields(rf,["login","inherit","superuser","createRole","createDb","replication","bypassRls"])||
    rf.login!==true||rf.inherit!==false||rf.superuser!==false||
    rf.createRole!==false||rf.createDb!==false||
    rf.replication!==false||rf.bypassRls!==false)stop("unsafe_role_flags");
 const c=report.catalog,p=report.privileges;
 if(!fields(c,["tablesScanned","functionsScanned"])||
    !nonnegative(c.tablesScanned)||c.tablesScanned<2||
    !nonnegative(c.functionsScanned))stop("catalog_not_exhaustive");
 if(!fields(p,["ledgerSchemaUsage","ledgerSelect","ledgerWrite","otherTableSelect",
     "otherTableWrite","schemaCreate","databaseCreate"])||
    p.ledgerSchemaUsage!==true||p.ledgerSelect!==true||
    p.ledgerWrite!==false||p.otherTableSelect!==0||p.otherTableWrite!==0||
    p.schemaCreate!==0||p.databaseCreate!==false)stop("unsafe_privilege_set");
 const sd=report.publicDefiners;
 if(!fields(sd,["audited","executable"])||!nonnegative(sd.audited)||
    !Array.isArray(sd.executable)||sd.audited>c.functionsScanned||
    sd.executable.length>sd.audited||
    sd.executable.some(x=>typeof x!=="string"||x.length>180||!x.trim()))
  stop("definer_audit_incomplete");
 if(sd.executable.length!==0)stop("security_definer_public_execute_inherited");
 return {schema:"artales.plan-role-audit-result/v0",role:PLAN_ROLE,
   projectRef:PROJECT_REF,observedAt:report.observedAt,
   evidenceClass:"operator-attested-not-provider-authenticated",
   rolePrivilegeEvidenceAccepted:true,productionApplyAuthorized:false,mayApply:false};
}
