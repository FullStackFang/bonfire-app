import { Redirect } from "expo-router";
import { Platform } from "react-native";
import { useSession } from "../lib/session";

export default function Index() {
  const { user, loading } = useSession();
  // The v1 app is not web-ready (MapStage hosts MapLibre in a WebView, which
  // has no web implementation). Until the v2 shell exists, web lands on the
  // push spike.
  if (Platform.OS === "web") return <Redirect href="/push-spike" />;
  // While SessionProvider resolves (loading from storage + auto-creating a
  // guest user if needed), render nothing. The splash screen is still up.
  if (loading) return null;
  // If auto-anonymous-sign-in failed (e.g., disabled in the Supabase project),
  // fall back to the explicit welcome screen.
  if (!user) return <Redirect href="/(auth)/welcome" />;
  return <Redirect href="/(app)" />;
}
