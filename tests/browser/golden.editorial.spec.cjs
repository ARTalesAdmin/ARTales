const {test,expect}=require("@playwright/test");
const {createClient}=require("@supabase/supabase-js");

const LOCAL="http://127.0.0.1:54321";
test.describe.configure({mode:"serial"});
test("real ARTales browser → local Supabase Auth → candidate → legal → Snapshot → editorial card",async({page})=>{
 test.setTimeout(240000);
 const api=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!api||!key||api!==LOCAL)throw Error("GOLDEN E2E REFUSED: only isolated local Supabase at "+LOCAL+" is permitted");
 if(process.env.GOLDEN_E2E_ISOLATED!=="yes")throw Error("GOLDEN E2E REFUSED: explicit isolated guard missing");
 const admin=createClient(api,key,{auth:{autoRefreshToken:false,persistSession:false}});
 const email="artales-golden-"+Date.now()+"@example.invalid";
 const password="Golden-local-only-"+Date.now()+"!";
 const {data:created,error:createError}=await admin.auth.admin.createUser({email,password,email_confirm:true});
 expect(createError).toBeNull();
 const uid=created.user?.id;
 expect(uid).toBeTruthy();
 const {error:profileError}=await admin.from("profiles").upsert({
  id:uid,email,role:"admin",is_active:true,display_name:"Golden Test Editor",
  handle:"golden-"+uid.slice(0,8),profile_completed_at:new Date().toISOString()
 },{onConflict:"id"});
 expect(profileError).toBeNull();
 const failures=[];
 page.on("pageerror",e=>failures.push("browser:"+e.message));
 page.on("response",r=>{if(r.status()>=500&&new URL(r.url()).origin==="http://127.0.0.1:3000")failures.push("http:"+r.status()+" "+r.url())});
 await page.goto("/login");
 await page.getByLabel("E-mail").fill(email);
 await page.getByLabel("Password").fill(password);
 await page.getByRole("button",{name:"Sign in"}).click();
 await expect(page).toHaveURL(/\/member(?:\?|$)/,{timeout:30000});
 await page.goto("/member/candidates/new");
 await expect(page.getByRole("heading",{name:"Nový kandidát"})).toBeVisible();
 await page.locator("#candidate-title").fill("The Adventures of Tom Sawyer");
 await page.locator("#candidate-author").fill("Mark Twain");
 await page.getByRole("button",{name:"Uložit kandidáta"}).click();
 await expect(page).toHaveURL(/\/member\/candidates\/[0-9a-f-]{36}$/,{timeout:20000});
 const candidateId=new URL(page.url()).pathname.split("/").at(-1);
 const {data:candidate,error:lookupError}=await admin.from("work_candidates")
  .select("id,proposed_title,proposed_author_name").eq("id",candidateId).single();
 expect(lookupError).toBeNull();
 expect(candidate).toMatchObject({id:candidateId,proposed_title:"The Adventures of Tom Sawyer",proposed_author_name:"Mark Twain"});
 await page.goto("/member/candidates/"+candidateId+"/legal");
 await expect(page.getByRole("heading",{name:"Automatický právní screen"})).toBeVisible();
 await page.getByRole("button",{name:"Ověřit dílo a pokračovat"}).click();
 await expect.poll(async()=>{
  const loc=new URL(page.url()).pathname;
  if(loc.startsWith("/member/snapshot/"))return "snapshot";
  if(await page.getByRole("button",{name:"Přijmout nejistotu a pokračovat"}).isVisible().catch(()=>false))return "risk";
  if(await page.getByRole("alert").isVisible().catch(()=>false))return "error";
  return "pending";
 },{timeout:100000,intervals:[1000,3000]}).not.toBe("pending");
 if(new URL(page.url()).pathname.includes("/legal")){
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.getByRole("button",{name:"Přijmout nejistotu a pokračovat"}).click();
  await expect(page).toHaveURL(new RegExp("/member/snapshot/"+candidateId),{timeout:30000});
 }
 const {data:lock,error:lockError}=await admin.from("candidate_legal_locks")
  .select("candidate_id").eq("candidate_id",candidateId).single();
 expect(lockError).toBeNull();
 expect(lock?.candidate_id).toBe(candidateId);
 await expect(page.getByRole("button",{name:"Pokračovat v přípravě"})).toBeVisible();
 await page.getByRole("button",{name:"Pokračovat v přípravě"}).click();
 await expect(page.getByText("Zdroj připraven",{exact:false})).toBeVisible({timeout:120000});
 const {data:receipt,error:receiptError}=await admin.from("candidate_snapshots")
  .select("candidate_id,sha256,readback_status").eq("candidate_id",candidateId).single();
 expect(receiptError).toBeNull();
 expect(receipt?.readback_status).toBe("sha256_verified");
 await page.getByRole("button",{name:"Pokračovat do redakce"}).click();
 await expect(page).toHaveURL(new RegExp("/member/editorial-detail/"+candidateId),{timeout:120000});
 const {data:revision,error:revError}=await admin.from("candidate_semantic_revisions")
  .select("revision_sha256").eq("candidate_id",candidateId).limit(1);
 expect(revError).toBeNull();
 expect(revision?.length).toBeGreaterThan(0);
 const {data:tasks,error:taskError}=await admin.from("artales_editorial_tasks")
  .select("kind,status").eq("candidate_id",candidateId);
 expect(taskError).toBeNull();
 expect(tasks?.length).toBeGreaterThan(0);
 expect(failures).toEqual([]);
 console.log("GOLDEN_BROWSER_PASS",JSON.stringify({candidateId,legal:true,archive:true,revision:true,tasks:tasks.length}));
});
