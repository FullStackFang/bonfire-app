import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { router } from "expo-router";
import { supabase, supabaseConfigured } from "./supabase";
import type { User } from "@bonfire/shared";
import { light } from "@bonfire/ui-tokens";
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

// Builds the optimistic stub User the app renders before the public.users
// row arrives. Pulls display_name from auth metadata when present (e.g. when
// welcome captured a name); otherwise renders as an unnamed guest.
function stubUser(authUser: { id: string; user_metadata?: Record<string, unknown>; created_at?: string }): User {
  const displayName = (authUser.user_metadata?.display_name as string | undefined) ?? "";
  return {
    id: authUser.id,
    phone_hash: "",
    display_name: displayName,
    letter_pair: (displayName || "G").slice(0, 2).toUpperCase(),
    avatar_color: light.ember,
    created_at: authUser.created_at ?? new Date().toISOString(),
  };
}

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
      if (profile) setUser(profile as User);
    };

    // Returning users (with a cached session) skip the network round-trip;
    // we set an optimistic stub so the splash drops on the next frame, and
    // the profile fetch fills in async. New users get an anonymous sign-in.
    const ensureSession = async () => {
      const { data } = await supabase.auth.getSession();
      const existingUser = data.session?.user;
      if (existingUser) {
        setUser(stubUser(existingUser));
        setLoading(false);
        loadProfile(existingUser.id).catch(() => {});
        return;
      }
      const { data: signIn, error: signErr } = await supabase.auth.signInAnonymously();
      const newUser = signIn?.session?.user;
      if (signErr || !newUser) {
        setLoading(false);
        return;
      }
      setUser(stubUser(newUser));
      setLoading(false);
      loadProfile(newUser.id).catch(() => {});
    };

    ensureSession();

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
