import { createClient } from "@supabase/supabase-js";

function readSupabaseConfig() {
  const url = process.env.VITE_SUPABASE_URL;
  const publishableKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) throw new Error("Supabase URL 또는 Publishable key가 설정되지 않았습니다.");
  return { url, publishableKey };
}

export function getSupabaseAuthClient() {
  const { url, publishableKey } = readSupabaseConfig();
  return createClient(url, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function getSupabaseAdminClient() {
  const { url } = readSupabaseConfig();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) throw new Error("Supabase service role key가 설정되지 않았습니다.");
  return createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
}
