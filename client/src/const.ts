import { supabase } from "@/lib/supabase";

/** Opens the minimal Supabase Auth email magic-link flow from an explicit user action. */
export const startLogin = async () => {
  const email = window.prompt("Supabase Auth 로그인 이메일을 입력해 주세요.");
  if (!email) return;
  const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } });
  if (error) {
    window.alert(`로그인 링크를 보내지 못했습니다: ${error.message}`);
    return;
  }
  window.alert("로그인 링크를 이메일로 보냈습니다. 메일의 링크를 열어 로그인해 주세요.");
};
