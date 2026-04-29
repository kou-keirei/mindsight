import { createClient } from "@supabase/supabase-js";

function getViteEnvValue(name) {
  return import.meta.env?.[name] || "";
}

const supabaseUrl = getViteEnvValue("VITE_SUPABASE_URL");
const supabaseAnonKey = getViteEnvValue("VITE_SUPABASE_ANON_KEY");

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export function getSupabaseClient() {
  return supabase;
}
