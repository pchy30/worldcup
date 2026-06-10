import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { supabase, useSession } from "@/lib/supabase";

interface ProfileStats {
  totalLeagues: number;
  totalPoints: number;
  username: string;
  email: string;
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user } = useSession();
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  const fetchProfile = useCallback(async () => {
    if (!user) return;

    const [profileRes, membershipsRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("username, email")
        .eq("id", user.id)
        .single(),
      supabase
        .from("league_members")
        .select("total_points")
        .eq("user_id", user.id),
    ]);

    const username =
      profileRes.data?.username ??
      user.user_metadata?.username ??
      "Manager";
    const email = profileRes.data?.email ?? user.email ?? "";
    const totalLeagues = membershipsRes.data?.length ?? 0;
    const totalPoints = (membershipsRes.data ?? []).reduce(
      (sum, m) => sum + (m.total_points ?? 0),
      0
    );

    setStats({ username, email, totalLeagues, totalPoints });
  }, [user]);

  useEffect(() => {
    setLoading(true);
    fetchProfile().finally(() => setLoading(false));
  }, [fetchProfile]);

  async function handleSignOut() {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          setSigningOut(true);
          await supabase.auth.signOut();
          setSigningOut(false);
          router.replace("/(auth)/login");
        },
      },
    ]);
  }

  if (loading) {
    return (
      <View className="flex-1 bg-primary items-center justify-center">
        <ActivityIndicator color="#F5B700" size="large" />
      </View>
    );
  }

  const initials = (stats?.username ?? "M")
    .slice(0, 2)
    .toUpperCase();

  return (
    <ScrollView className="flex-1 bg-primary" contentContainerStyle={{ padding: 24 }}>
      {/* Avatar */}
      <View className="items-center mt-6 mb-8">
        <View className="w-24 h-24 rounded-full bg-surface border-4 border-accent items-center justify-center mb-4">
          <Text className="text-accent text-3xl font-bold">{initials}</Text>
        </View>
        <Text className="text-white text-2xl font-bold">
          {stats?.username ?? "Manager"}
        </Text>
        <Text className="text-muted text-sm mt-1">{stats?.email}</Text>
      </View>

      {/* Stats cards */}
      <View className="flex-row gap-4 mb-8">
        <View className="flex-1 bg-surface rounded-2xl p-4 items-center">
          <Ionicons name="trophy" size={28} color="#F5B700" />
          <Text className="text-white text-2xl font-bold mt-2">
            {stats?.totalLeagues ?? 0}
          </Text>
          <Text className="text-muted text-xs mt-1">Leagues</Text>
        </View>
        <View className="flex-1 bg-surface rounded-2xl p-4 items-center">
          <Ionicons name="star" size={28} color="#F5B700" />
          <Text className="text-white text-2xl font-bold mt-2">
            {stats?.totalPoints ?? 0}
          </Text>
          <Text className="text-muted text-xs mt-1">Total Points</Text>
        </View>
      </View>

      {/* Actions */}
      <View className="gap-3">
        <TouchableOpacity
          className="bg-surface rounded-xl px-4 py-4 flex-row items-center"
          onPress={() => {/* Future: edit profile */}}
          activeOpacity={0.8}
        >
          <Ionicons name="create-outline" size={20} color="#4A6080" />
          <Text className="text-white ml-3 flex-1">Edit Profile</Text>
          <Ionicons name="chevron-forward" size={16} color="#4A6080" />
        </TouchableOpacity>

        <TouchableOpacity
          className="bg-surface rounded-xl px-4 py-4 flex-row items-center"
          onPress={() => {/* Future: notifications */}}
          activeOpacity={0.8}
        >
          <Ionicons name="notifications-outline" size={20} color="#4A6080" />
          <Text className="text-white ml-3 flex-1">Notifications</Text>
          <Ionicons name="chevron-forward" size={16} color="#4A6080" />
        </TouchableOpacity>

        <TouchableOpacity
          className="bg-red-900/40 rounded-xl px-4 py-4 flex-row items-center mt-4"
          onPress={handleSignOut}
          disabled={signingOut}
          activeOpacity={0.8}
        >
          {signingOut ? (
            <ActivityIndicator color="#EF4444" size="small" />
          ) : (
            <Ionicons name="log-out-outline" size={20} color="#EF4444" />
          )}
          <Text className="text-red-400 ml-3 font-semibold">Sign Out</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
