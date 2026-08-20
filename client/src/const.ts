import { supabase } from "@/lib/supabase";

import { EMAIL_RATE_LIMIT_COOLDOWN_MS, MAGIC_LINK_COOLDOWN_MS, formatRemainingMinutes, remainingMagicLinkCooldown } from "@/lib/magicLinkRateLimit";

/** Opens the minimal Supabase Auth email magic-link flow from an explicit user action. */
export const startLogin = async () => {
  const lastRequestedAt = Number(window.sessionStorage.getItem("glaucoma-care:magic-link-requested-at") ?? 0);
  const remaining = remainingMagicLinkCooldown(lastRequestedAt);
  if (remaining > 0) {
    window.alert(`이미 로그인 링크를 요청했습니다. 약 ${formatRemainingMinutes(remaining)}분 뒤 다시 요청해 주세요.`);
    return;
  }
  const email = window.prompt("Supabase Auth 로그인 이메일을 입력해 주세요.");
  if (!email) return;
  const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } });
  if (error) {
    if (/rate limit/i.test(error.message)) {
      window.sessionStorage.setItem("glaucoma-care:magic-link-requested-at", String(Date.now() - MAGIC_LINK_COOLDOWN_MS + EMAIL_RATE_LIMIT_COOLDOWN_MS));
      window.alert("Supabase 기본 이메일 발송 한도에 도달했습니다. 약 60분 뒤 다시 요청하거나, 운영 전용 SMTP를 연결해 주세요.");
      return;
    }
    window.alert(`로그인 링크를 보내지 못했습니다: ${error.message}`);
    return;
  }
  window.sessionStorage.setItem("glaucoma-care:magic-link-requested-at", String(Date.now()));
  window.alert("로그인 링크를 이메일로 보냈습니다. 메일의 링크를 열어 로그인해 주세요.");
};
