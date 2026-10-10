import { createClient } from "@supabase/supabase-js"
import { getBrowserSupabaseConnection } from "@/lib/supabase/connectionIsolation"
const target = getBrowserSupabaseConnection()
export const supabase = createClient(target.url, target.anonKey)
