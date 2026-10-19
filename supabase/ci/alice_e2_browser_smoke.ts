/**
 * True headless-browser E2E against disposable localhost Supabase + Next.js.
 * Synthetic Alice-like source and test-only GoTrue user: NEVER live credentials,
 * cloud Supabase, production work, production reader, or any release.
 * Chromium/ChromeDriver are preinstalled on the GitHub ubuntu-latest runner.
 */
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {execFileSync,spawn,spawnSync,type ChildProcess} from "node:child_process";

const status=JSON.parse(execFileSync("supabase",["status","-o","json"],{encoding:"utf8"}));
const api=String(status.API_URL??"");
const anon=String(status.ANON_KEY??"");
const service=String(status.SERVICE_ROLE_KEY??"");
if(!/^http:\/\/(localhost|127\.0\.0\.1):54321$/.test(api)||
 !anon||!service||process.env.PGHOST!=="127.0.0.1"||
 process.env.PGPORT!=="54322"||process.env.SUPABASE_ACCESS_TOKEN||
 process.env.SUPABASE_DB_PASSWORD||process.env.VERCEL_ENV)
 throw Error("Browser E2E refuses cloud or production environment");

const slug="alices-adventures-in-wonderland";
const local="http://127.0.0.1:3107";
const wdBase="http://127.0.0.1:9517";
const workId=randomUUID(),authorId=randomUUID(),sourceId=randomUUID(),componentId=randomUUID();
const tag=randomUUID().slice(0,8),email="browser-"+tag+"@example.invalid";
const password="Local-E2-"+randomUUID()+"!Az";
const testText="CHAPTER I. Down the Rabbit-Hole\n\nA short paragraph for one block editing.\n\nCHAPTER II. The Pool of Tears\n\nAnother example paragraph.";
let next:ChildProcess|undefined,driver:ChildProcess|undefined,session:string|undefined;
const logOutput:{next:string;driver:string}={next:"",driver:""};

const sleep=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
async function retry<T>(fn:()=>Promise<T>,accept:(x:T)=>boolean,what:string,limit=90000):Promise<T>{
 const end=Date.now()+limit;let last:unknown;
 while(Date.now()<end){
  try{const value=await fn();if(accept(value))return value;last=value;}
  catch(e){last=e instanceof Error?e.message:String(e);}
  await sleep(900);
 }
 throw Error("Timed out: "+what+"; last="+JSON.stringify(last).slice(0,500)+
  "; app output="+logOutput.next.slice(-1500)+"; webdriver output="+logOutput.driver.slice(-700));
}
async function auth(path:string,token:string,body:unknown){
 const r=await fetch(api+path,{method:"POST",headers:{
  "apikey":anon,"Authorization":"Bearer "+token,"Content-Type":"application/json"
 },body:JSON.stringify(body)});
 const data=await r.json() as Record<string,unknown>;
 if(!r.ok)throw Error("Local GoTrue setup failed "+r.status+" "+JSON.stringify(data).slice(0,450));
 return data;
}
const sqlVars=(vars:Record<string,string>)=>
 Object.entries(vars).flatMap(([k,v])=>["-v",k+"="+v]);
function seed(actorId:string){
 const script=[
  "begin;",
  "insert into public.profiles(id,email,display_name,handle,profile_completed_at,role,is_active)",
  "values(:'actor',:'email','QA Architect','qa-"+tag+"',now(),'admin',true)",
  "on conflict(id) do update set role='admin',handle=excluded.handle,display_name=excluded.display_name,profile_completed_at=now(),is_active=true;",
  "insert into public.authors(id,name,slug,created_by,updated_by)",
  "values(:'author','Browser QA Synthetic Author',:'author_slug',:'actor',:'actor');",
  "insert into public.works(id,title,slug,summary,content,canonical_language,origin_type,source_label,status,primary_author_id,created_by,updated_by)",
  "values(:'work','Alice Browser QA Fixture',:'slug',repeat('Synthetic source for browser-only proof. ',5),'Do not publish: browser synthetic source','en','public_domain','gutenberg','draft',:'author',:'actor',:'actor');",
  "insert into artales_evidence.source_snapshots(id,work_id,kind,source_uri,source_bytes)",
  "values(:'snapshot',:'work','external_raw','https://www.gutenberg.org/ebooks/11',decode(:'bytes','hex'));",
  "insert into artales_evidence.source_components(id,snapshot_id,kind,byte_start,byte_end,disposition,explanation)",
  "values(:'component',:'snapshot','WORK_CONTENT',0,octet_length(decode(:'bytes','hex')),'qa_text_only','Synthetic local browser fixture, not a rights determination');",
  "commit;"
 ].join("\n");
 const args=["-h","127.0.0.1","-p","54322","-U","postgres","-d","postgres","-X",
  "-v","ON_ERROR_STOP=1",...sqlVars({
   actor:actorId,email,author:authorId,author_slug:"browser-author-"+tag,
   work:workId,slug,snapshot:sourceId,component:componentId,
   bytes:Buffer.from(testText,"utf8").toString("hex")
  })];
 const p=spawnSync("psql",args,{input:script,encoding:"utf8",
  env:{...process.env,PGPASSWORD:"postgres"},timeout:20000});
 if(p.status!==0)throw Error("Local synthetic browser seed failed "+p.stderr.slice(0,1300));
}
async function wd(method:string,path:string,body?:unknown):Promise<unknown>{
 const res=await fetch(wdBase+path,{
  method,headers:{"Content-Type":"application/json"},
  ...(body===undefined?{}:{body:JSON.stringify(body)})
 });
 const json=await res.json() as {value?:unknown};
 const data=json.value;
 if(!res.ok||(data&&typeof data==="object"&&"error" in data))
  throw Error("WebDriver "+method+" "+path+" -> "+JSON.stringify(data).slice(0,900));
 return data;
}
function sid(){if(!session)throw Error("Missing browser session");return "/session/"+session;}
async function script(js:string,args:unknown[]=[]):Promise<unknown>{
 return wd("POST",sid()+"/execute/sync",{script:js,args});
}
async function nav(url:string){
 await wd("POST",sid()+"/url",{url});
}
async function currentUrl():Promise<string>{return String(await wd("GET",sid()+"/url"));}
async function body():Promise<string>{return String(await script("return document.body ? document.body.innerText : ''"));}
async function ready(needle:string){
 await retry(body,text=>text.includes(needle),"page text "+needle);
}
async function click(label:string){
 const clicked=await script(
  "var el=Array.from(document.querySelectorAll('button')).find(x=>x.textContent && x.textContent.trim()===arguments[0]);"+
  "if(!el||el.disabled)return false;el.scrollIntoView();el.click();return true;",[label]);
 assert.equal(clicked,true,"Cannot click button "+label+"; current URL "+await currentUrl());
}
function attachLog(child:ChildProcess,key:"next"|"driver"){
 child.stdout?.on("data",chunk=>{logOutput[key]=(logOutput[key]+String(chunk)).slice(-3500)});
 child.stderr?.on("data",chunk=>{logOutput[key]=(logOutput[key]+String(chunk)).slice(-3500)});
}
function runSqlValue(query:string):string{
 const r=spawnSync("psql",["-h","127.0.0.1","-p","54322","-U","postgres","-d","postgres","-X","-At","-c",query],
  {encoding:"utf8",env:{...process.env,PGPASSWORD:"postgres"},timeout:15000});
 if(r.status!==0)throw Error("Local postcondition read failed "+r.stderr.slice(0,750));
 return r.stdout.trim();
}
async function main(){
 const created=await auth("/auth/v1/admin/users",service,{email,password,email_confirm:true});
 if(typeof created.id!=="string")throw Error("Missing signed browser QA actor");
 seed(created.id);
 const binary=process.env.CHROMEDRIVER_BIN??"chromedriver";
 driver=spawn(binary,["--port=9517","--allowed-ips=127.0.0.1"],{stdio:["ignore","pipe","pipe"]});
 attachLog(driver,"driver");
 await retry(async()=>{const r=await fetch(wdBase+"/status");return r.ok;},v=>v===true,"ChromeDriver");
 const browser=(await wd("POST","/session",{capabilities:{alwaysMatch:{
  browserName:"chrome","goog:chromeOptions":{
   args:["--headless=new","--no-sandbox","--disable-dev-shm-usage",
    "--disable-gpu","--window-size=1280,900"]
  }}}})) as {sessionId?:string};
 if(!browser.sessionId)throw Error("WebDriver did not return session ID");
 session=browser.sessionId;
 next=spawn(process.execPath,["node_modules/next/dist/bin/next","dev","--hostname","127.0.0.1","--port","3107"],{
  env:{...process.env,NEXT_TELEMETRY_DISABLED:"1",
   NEXT_PUBLIC_SUPABASE_URL:api,NEXT_PUBLIC_SUPABASE_ANON_KEY:anon,
   // The runner seeds Auth through its own isolated local admin call above,
   // but the Next.js app itself never receives privileged credentials.
   SUPABASE_SERVICE_ROLE_KEY:"",ARTALES_TEST_READONLY_LOGIN:"1",
   ARTALES_SEMANTIC_SELF_PILOT_ADMIN_ID:created.id,
   VERCEL_ENV:"",NEXT_PUBLIC_VERCEL_ENV:"",NEXT_PUBLIC_ARTALES_EPHEMERAL_SUPABASE_REF:""},
  stdio:["ignore","pipe","pipe"]
 });
 attachLog(next,"next");
 await retry(async()=>{const r=await fetch(local+"/login");return r.status;},
  v=>v===200,"Next.js localhost login",120000);
 const destination="/member/works/"+slug+"/semantic";
 await nav(local+"/login?next="+encodeURIComponent(destination));
 await ready("Sign in");
 const loginSubmitted=await script(
  "const e=document.querySelector('input[name=email]'),p=document.querySelector('input[name=password]');"+
  "if(!e||!p)return false;e.value=arguments[0];p.value=arguments[1];"+
  "e.dispatchEvent(new Event('input',{bubbles:true}));p.dispatchEvent(new Event('input',{bubbles:true}));"+
  "e.closest('form').requestSubmit();return true;",[email,password]);
 assert.equal(loginSubmitted,true);
 await ready("Soukromý pilot sémantického editoru");
 await ready("Vyber archivovaný zdroj");
 assert.equal(await script("return document.querySelector('select[name=snapshot]')?.options.length"),2);
 const selected=await script(
  "const el=document.querySelector('select[name=snapshot]');"+
  "if(!el)return false;el.value=arguments[0];"+
  "el.dispatchEvent(new Event('change',{bubbles:true}));return el.value===arguments[0];",[sourceId]);
 assert.equal(selected,true);
 await click("Založit soukromý úkol");
 await ready("Čeká na převzetí");
 await click("Převzít jako editor");
 await retry(currentUrl,u=>u.includes("/member/editorial-tasks"),"claimed task redirect");
 await nav(local+destination);
 await ready("Převzatý mnou");
 await click("Sestavit a uložit první revizi ze zdroje");
 await ready("Nezávisle ověřený záznam: revize 1");
 // Verify source/hash display survives an actual fresh browser navigation.
 await nav(local+destination);
 await ready("Nezávisle ověřený záznam: revize 1");
 const chose=await script(
  "const el=document.querySelector('select[name=atom]');"+
  "if(!el||el.options.length<2)return false;el.selectedIndex=1;"+
  "el.dispatchEvent(new Event('change',{bubbles:true}));return !!el.value;");
 assert.equal(chose,true);
 await click("Navrhnout odsazení vybraného bloku");
 await ready("Vráceno k cílené typografické opravě");
 await click("Uložit opravu podle vrácené poznámky");
 await ready("Nezávisle ověřený záznam: revize 2");
 await nav(local+destination);
 await ready("Nezávisle ověřený záznam: revize 2");
 await click("Schválit textové QA — bez publikace");
 await ready("Redakčně schváleno");
 await nav(local+destination);
 await ready("Redakčně schváleno");
 const status=runSqlValue("select status::text from public.works where id='"+workId+"'");
 assert.equal(status,"draft","QA cannot alter the original work status");
 const publicText=runSqlValue("select content from public.works where id='"+workId+"'");
 assert.equal(publicText,"Do not publish: browser synthetic source");
 const finalized=runSqlValue(
  "select t.status::text||'|'||count(a.id)::text from public.editorial_tasks t "+
  "join artales_evidence.semantic_v2_approvals a on a.task_id=t.id "+
  "where t.work_id='"+workId+"' group by t.status");
 assert.equal(finalized,"completed|1");
 const buttonVisible=await script(
  "return Array.from(document.querySelectorAll('button')).some(b=>/Uložit opravu|Schválit textové QA/.test(b.textContent||''));");
 assert.equal(buttonVisible,false,"Finalized pilot must be read-only in browser");
 console.log("PASS real headless Chromium signed login -> private own task -> source -> claim -> draft -> one-block indent -> saved child -> reload -> owner text QA -> immutable audit");
 console.log("PASS public work status and content unchanged; release not authorized");
}
async function run():Promise<void>{
try{await main();}
catch(error){console.error("Browser E2 failed:",error);process.exitCode=1;}
finally{
 if(session)try{await wd("DELETE",sid());}catch{}
 if(next){next.kill("SIGTERM");await sleep(350);if(next.exitCode===null)next.kill("SIGKILL");}
 if(driver){driver.kill("SIGTERM");await sleep(150);if(driver.exitCode===null)driver.kill("SIGKILL");}
}
}


void run();
