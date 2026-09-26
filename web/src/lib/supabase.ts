import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "../config/env";

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!env.supabaseUrl || !env.supabaseAnonKey) return null;
  if (!client) client = createClient(env.supabaseUrl, env.supabaseAnonKey);
  return client;
}
