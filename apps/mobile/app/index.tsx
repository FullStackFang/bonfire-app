import { Redirect } from "expo-router";
import { useSession } from "../lib/session";

export default function Index() {
  const { user, loading } = useSession();
  // While SessionProvider resolves (loading from storage + auto-creating a
  // guest user if needed), render nothing. The splash screen is still up.
  if (loading) return null;
  // If auto-anonymous-sign-in failed (e.g., disabled in the Supabase project),
  // fall back to the explicit welcome screen.
  if (!user) return <Redirect href="/(auth)/welcome" />;
  return <Redirect href="/(app)" />;
}
