import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ActionSheetIOS,
  Platform,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase, useSession } from "@/lib/supabase";
import { LeagueCard } from "@/components/LeagueCard";
import type { League } from "@wcf/shared";

interface LeagueWithMemberCount extends League {
  member_count: number;
  my_points: number;
}

export default function DashboardScreen() {
  const router = useRouter();
  const { user } = useSession();
  const [leagues, setLeagues] = useState<LeagueWithMemberCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchLeagues = useCallback(async () => {
    if (!user) return;

    const { data: memberships, error } = await supabase
      .from("league_members")
      .select(
        `
        league_id,
        total_points,
        leagues (
          id,
          name,
          invite_code,
          commissioner_id,
          draft_mode,
          draft_status,
          draft_order,
          current_pick_index,
          pick_time_limit_seconds,
          slow_draft_hours,
          current_pick_deadline,
          max_participants,
          created_at
        )
      `
      )
      .eq("user_id", user.id);

    if (error) {
      console.error("Failed to fetch leagues:", error.message);
      return;
    }

    if (!memberships) return;

    // Fetch member counts for each league
    const leagueIds = memberships.map((m) => m.league_id);
    const { data: memberCounts } = await supabase
      .from("league_members")
      .select("league_id")
      .in("league_id", leagueIds);

    const countMap: Record<string, number> = {};
    memberCounts?.forEach((row) => {
      countMap[row.league_id] = (countMap[row.league_id] ?? 0) + 1;
    });

    const result: LeagueWithMemberCount[] = memberships
      .filter((m) => m.leagues)
      .map((m) => ({
        ...(m.leagues as unknown as League),
        member_count: countMap[m.league_id] ?? 0,
        my_points: m.total_points ?? 0,
      }));

    setLeagues(result);
  }, [user]);

  useEffect(() => {
    setLoading(true);
    fetchLeagues().finally(() => setLoading(false));
  }, [fetchLeagues]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchLeagues();
    setRefreshing(false);
  }, [fetchLeagues]);

  function showActionSheet() {
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ["Cancel", "Create League", "Join League"],
          cancelButtonIndex: 0,
          tintColor: "#F5B700",
        },
        (index) => {
          if (index === 1) router.push("/league/new");
          if (index === 2) router.push("/league/join");
        }
      );
    } else {
      Alert.alert("Leagues", "What would you like to do?", [
        { text: "Cancel", style: "cancel" },
        { text: "Create League", onPress: () => router.push("/league/new") },
        { text: "Join League", onPress: () => router.push("/league/join") },
      ]);
    }
  }

  return (
    <View className="flex-1 bg-primary">
      {/* Section header */}
      <View className="px-4 pt-4 pb-2 flex-row items-center justify-between">
        <Text className="text-white text-xl font-bold">My Leagues</Text>
        <Text className="text-muted text-sm">{leagues.length} league(s)</Text>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#F5B700" size="large" />
        </View>
      ) : leagues.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="trophy-outline" size={64} color="#4A6080" />
          <Text className="text-white text-xl font-bold mt-4">
            No leagues yet
          </Text>
          <Text className="text-muted text-center mt-2">
            Create a new league or join one with an invite code.
          </Text>
        </View>
      ) : (
        <FlatList
          data={leagues}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#F5B700"
            />
          }
          renderItem={({ item }) => (
            <LeagueCard
              league={item}
              memberCount={item.member_count}
              myPoints={item.my_points}
              onPress={() =>
                router.push(`/league/${item.id}/lobby`)
              }
            />
          )}
          ItemSeparatorComponent={() => <View className="h-3" />}
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        className="absolute bottom-6 right-6 bg-accent rounded-full w-14 h-14 items-center justify-center shadow-lg"
        onPress={showActionSheet}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={30} color="#0D1B2A" />
      </TouchableOpacity>
    </View>
  );
}
