import test from "node:test"
import assert from "node:assert/strict"
import {resolveSupabaseConnection,PRODUCTION_SUPABASE_REF} from "../lib/supabase/connectionIsolation"
const productionUrl="https://"+PRODUCTION_SUPABASE_REF+".supabase.co"
const ephemeralUrl="https://testephemeralref.supabase.co"
test("production remains connected to the existing backend",()=>{const r=resolveSupabaseConnection({deployment:"production",url:productionUrl,anonKey:"test",ephemeralRef:undefined});assert.equal(r.enabled,true);assert.equal(r.url,productionUrl)})
test("preview fails closed even with configured production credentials",()=>{const r=resolveSupabaseConnection({deployment:"preview",url:productionUrl,anonKey:"test",ephemeralRef:PRODUCTION_SUPABASE_REF});assert.equal(r.enabled,false);assert.notEqual(r.url,productionUrl)})
test("preview without ephemeral configuration is disabled",()=>assert.equal(resolveSupabaseConnection({deployment:"preview",url:ephemeralUrl,anonKey:"test",ephemeralRef:undefined}).enabled,false))
test("preview accepts exact independently configured ephemeral ref",()=>assert.equal(resolveSupabaseConnection({deployment:"preview",url:ephemeralUrl,anonKey:"test",ephemeralRef:"testephemeralref"}).enabled,true))
test("other remote project without matching ref is denied",()=>assert.equal(resolveSupabaseConnection({deployment:"preview",url:"https://untrusted.supabase.co",anonKey:"test",ephemeralRef:"testephemeralref"}).enabled,false))
test("unknown Vercel environment is disabled for remote DB",()=>assert.equal(resolveSupabaseConnection({deployment:undefined,url:productionUrl,anonKey:"test",ephemeralRef:undefined}).enabled,false))
test("local loopback stays available for local development",()=>assert.equal(resolveSupabaseConnection({deployment:undefined,url:"http://127.0.0.1:54321",anonKey:"test",ephemeralRef:undefined}).enabled,true))
