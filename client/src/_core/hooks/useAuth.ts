import { trpc } from "@/lib/trpc";
import { supabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";
import { useCallback, useEffect, useState } from "react";

type UseAuthOptions = { redirectOnUnauthenticated?: boolean; redirectPath?: string };

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath } = options ?? {};
  const utils = trpc.useUtils();
  const [session, setSession] = useState<Session | null>(null);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => { setSession(data.session); setSessionReady(true); });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setSessionReady(true);
      void utils.auth.me.invalidate();
    });
    return () => subscription.subscription.unsubscribe();
  }, [utils.auth.me]);

  const meQuery = trpc.auth.me.useQuery(undefined, { enabled: sessionReady && Boolean(session), retry: false, refetchOnWindowFocus: false });
  const logout = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setSession(null);
    utils.auth.me.setData(undefined, null);
    await utils.auth.me.invalidate();
  }, [utils.auth.me]);

  useEffect(() => {
    if (!redirectOnUnauthenticated || !sessionReady || session) return;
    if (redirectPath && window.location.pathname !== redirectPath) window.location.assign(redirectPath);
  }, [redirectOnUnauthenticated, redirectPath, session, sessionReady]);

  return {
    user: meQuery.data ?? null,
    loading: !sessionReady || (Boolean(session) && meQuery.isLoading),
    error: meQuery.error ?? null,
    isAuthenticated: Boolean(session && meQuery.data),
    refresh: () => meQuery.refetch(),
    logout,
  };
}
