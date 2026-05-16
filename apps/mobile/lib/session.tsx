import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { router } from "expo-router";
import { supabase, supabaseConfigured } from "./supabase";
import type { User } from "@bonfire/shared";
import { mockSession } from "./mockSeeds";

type SessionState = {
  user: User | null;
  loading: boolean;
  /** True if no Supabase project is configured — we run on mock data. */
  isMock: boolean;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionState>({
  user: null,
  loading: true,
  isMock: false,
  signOut: async () => {},
});

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const isMock = !supabaseConfigured;

  useEffect(() => {
    if (isMock) {
      setUser(mockSession.user);
      setLoading(false);
      return;
    }

    const loadProfile = async (authUserId: string) => {
      const { data: profile } = await supabase
        .from("users")
        .select("*")
        .eq("id", authUserId)
        .maybeSingle();
      setUser((profile as User | null) ?? null);
    };

    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session?.user) await loadProfile(data.session.user.id);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        await loadProfile(session.user.id);
      } else {
        setUser(null);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [isMock]);

  const value = useMemo<SessionState>(
    () => ({
      user,
      loading,
      isMock,
      signOut: async () => {
        if (!isMock) await supabase.auth.signOut();
        setUser(null);
        router.replace("/(auth)/welcome");
      },
    }),
    [user, loading, isMock],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  return useContext(SessionContext);
}
