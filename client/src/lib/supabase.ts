import { createClient, type Session } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !publishableKey) throw new Error("Supabase URL 또는 Publishable key가 설정되지 않았습니다.");

export const supabase = createClient(url, publishableKey);

let accessToken: string | null = null;
void supabase.auth.getSession().then(({ data }) => { accessToken = data.session?.access_token ?? null; });
supabase.auth.onAuthStateChange((_event, session: Session | null) => { accessToken = session?.access_token ?? null; });

export function getSupabaseAccessToken() {
  return accessToken;
}
