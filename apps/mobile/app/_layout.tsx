import "../global.css";
import { useEffect } from "react";
import { Slot, useRouter, useSegments } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useSession } from "@/lib/supabase";

function AuthGuard() {
  const { session, loading } = useSession();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === "(auth)";

    if (!session && !inAuthGroup) {
      // Not authenticated — redirect to login
      router.replace("/(auth)/login");
    } else if (session && inAuthGroup) {
      // Authenticated — redirect away from auth screens
      router.replace("/(tabs)/dashboard");
    }
  }, [session, loading, segments]);

  return null;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" backgroundColor="#0D1B2A" />
      <AuthGuard />
      <Slot />
    </SafeAreaProvider>
  );
}
