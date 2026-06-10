import { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase, useSession } from "@/lib/supabase";
import type { ManagerStanding } from "@wcf/shared";
import { rankManagers } from "@wcf/shared";

interface LeagueSummary {
  id: string;
  name: string;
}

interface StandingRow extends ManagerStanding {
  rank: number;
}

export default function LeaderboardScreen() {
  const { user } = useSession();
  const [myLeagues, setMyLeagues] = useState<LeagueSummary[]>([]);
  const [selectedLeagueId, setSelectedLeagueId] = useState<string | null>(null);
  const [standings, setStandings] = useState<StandingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const fetchLeagues = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("league_members")
      .select("league_id, leagues(id, name)")
      .eq("user_id", user.id);

    const leagues: LeagueSummary[] = (data ?? [])
      .filter((m) => m.leagues)
      .map((m) => m.leagues as unknown as LeagueSummary);

    setMyLeagues(leagues);
    if (!selectedLeagueId && leagues.length > 0) {
      setSelectedLeagueId(leagues[0].id);
    }
  }, [user, selectedLeagueId]);

  const fetchStandings = useCallback(async () => {
    if (!selectedLeagueId) return;

    const { data: membersData } = await supabase
      .from("league_members")
      .select("user_id, display_name, total_points, goals_scored, assists")
      .eq("league_id", selectedLeagueId);

    if (!membersData) return;

    // Calculate highest individual player points per manager
    const { data: squadsData } = await supabase
      .from("squad_players")
      .select("manager_id, player:players(total_points)")
      .eq("league_id", selectedLeagueId);

    const highestMap: Record<string, number> = {};
    (squadsData ?? []).forEach((sp) => {
      const pts = (sp.player as unknown as { total_points: number })?.total_points ?? 0;
      const existing = highestMap[sp.manager_id] ?? 0;
      if (pts > existing) highestMap[sp.manager_id] = pts;
    });

    const raw: ManagerStanding[] = membersData.map((m) => ({
      manager_id: m.user_id,
      display_name: m.display_name,
      total_points: m.total_points ?? 0,
      goals_scored: m.goals_scored ?? 0,
      assists: m.assists ?? 0,
      highest_individual_player_points: highestMap[m.user_id] ?? 0,
    }));

    const ranked = rankManagers(raw).map((s, index) => ({
      ...s,
      rank: index + 1,
    }));

    setStandings(ranked);
  }, [selectedLeagueId]);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchLeagues(), fetchStandings()]).finally(() =>
      setLoading(false)
    );
  }, []);

  useEffect(() => {
    if (selectedLeagueId) {
      setLoading(true);
      fetchStandings().finally(() => setLoading(false));
    }
  }, [selectedLeagueId, fetchStandings]);

  // Real-time subscription
  useEffect(() => {
    if (!selectedLeagueId) return;

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase
      .channel(`leaderboard:${selectedLeagueId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "league_members",
          filter: `league_id=eq.${selectedLeagueId}`,
        },
        () => fetchStandings()
      )
      .subscribe();

    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedLeagueId, fetchStandings]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchStandings();
    setRefreshing(false);
  }, [fetchStandings]);

  function getMedalIcon(rank: number): string {
    if (rank === 1) return "🥇";
    if (rank === 2) return "🥈";
    if (rank === 3) return "🥉";
    return `${rank}.`;
  }

  return (
    <View className="flex-1 bg-primary">
      {/* League selector */}
      {myLeagues.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10, gap: 8 }}
        >
          {myLeagues.map((league) => (
            <TouchableOpacity
              key={league.id}
              className={`px-4 py-2 rounded-full ${
                selectedLeagueId === league.id ? "bg-accent" : "bg-surface"
              }`}
              onPress={() => setSelectedLeagueId(league.id)}
            >
              <Text
                className={`text-sm font-semibold ${
                  selectedLeagueId === league.id ? "text-primary" : "text-white"
                }`}
              >
                {league.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#F5B700" size="large" />
        </View>
      ) : standings.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="trophy-outline" size={64} color="#4A6080" />
          <Text className="text-white text-xl font-bold mt-4">
            No Standings Yet
          </Text>
          <Text className="text-muted text-center mt-2">
            Standings appear once the draft is complete.
          </Text>
        </View>
      ) : (
        <FlatList
          data={standings}
          keyExtractor={(item) => item.manager_id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, paddingTop: 8 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#F5B700"
            />
          }
          renderItem={({ item }) => {
            const isMe = item.manager_id === user?.id;
            return (
              <View
                className={`rounded-xl px-4 py-3 mb-2 flex-row items-center ${
                  isMe
                    ? "bg-surface border-2 border-accent"
                    : "bg-surface"
                }`}
              >
                {/* Rank */}
                <Text
                  className="w-8 text-center font-bold text-base"
                  style={{ color: item.rank <= 3 ? "#F5B700" : "#4A6080" }}
                >
                  {getMedalIcon(item.rank)}
                </Text>

                {/* Avatar */}
                <View className="w-9 h-9 rounded-full bg-primary items-center justify-center mx-3">
                  <Text className="text-accent font-bold text-sm">
                    {item.display_name.slice(0, 2).toUpperCase()}
                  </Text>
                </View>

                {/* Name */}
                <View className="flex-1">
                  <Text className="text-white font-semibold text-sm" numberOfLines={1}>
                    {item.display_name}
                    {isMe && (
                      <Text className="text-accent text-xs"> (You)</Text>
                    )}
                  </Text>
                  <Text className="text-muted text-xs">
                    {item.goals_scored}G · {item.assists}A
                  </Text>
                </View>

                {/* Points */}
                <View className="items-end">
                  <Text className="text-accent font-bold text-lg">
                    {item.total_points}
                  </Text>
                  <Text className="text-muted text-xs">pts</Text>
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}
