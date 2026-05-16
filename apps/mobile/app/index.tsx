import { useEffect } from "react";
import { Redirect } from "expo-router";
import { useSession } from "../lib/session";

export default function Index() {
  const { user, loading } = useSession();
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {}, []);
  if (loading) return null;
  if (!user) return <Redirect href="/(auth)/welcome" />;
  return <Redirect href="/(app)" />;
}
