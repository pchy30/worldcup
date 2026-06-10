import { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Alert,
  RefreshControl,
  SectionList,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase, useSession } from "@/lib/supabase";
import { PlayerCard } from "@/components/PlayerCard";
import { CountdownTimer } from "@/components/CountdownTimer";
import type { League, Player, DraftPick, PlayerPosition } from "@wcf/shared";
import { validateDraftPick } from "@wcf/shared";

const POSITION_ORDER: PlayerPosition[] = ["GK", "DEF", "MID", "FWD"];

interface ActiveDraftData {
  league: League;
  picks: DraftPick[];
  availablePlayers: Player[];
  mySquad: Player[];
  currentPickerName: string;
  isMyTurn: boolean;
}

export default function DraftScreen() {
  const { user } = useSession();
  const [draftData, setDraftData] = useState<ActiveDraftData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [positionFilter, setPositionFilter] = useState<PlayerPosition | "ALL">("ALL");
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [picking, setPicking] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const fetchDraftData = useCallback(async () => {
    if (!user) return;

    // Find user's active draft league
    const { data: memberships } = await supabase
      .from("league_members")
      .select("league_id, display_name")
      .eq("user_id", user.id);

    if (!memberships?.length) {
      setDraftData(null);
      return;
    }

    const leagueIds = memberships.map((m) => m.league_id);

    const { data: activeLeagues } = await supabase
      .from("leagues")
      .select("*")
      .in("id", leagueIds)
      .eq("draft_status", "active")
      .limit(1)
      .single();

    if (!activeLeagues) {
      setDraftData(null);
      return;
    }

    const league = activeLeagues as League;

    // Fetch all picks for this league
    const { data: picksData } = await supabase
      .from("draft_picks")
      .select("*, player:players(*)")
      .eq("league_id", league.id)
      .order("pick_number", { ascending: true });

    const picks = (picksData ?? []) as DraftPick[];

    // Determine my squad
    const mySquad = picks
      .filter((p) => p.manager_id === user.id && p.player)
      .map((p) => p.player as Player);

    // Determine current picker
    const currentPickerId = league.draft_order[league.current_pick_index] ?? "";
    const isMyTurn = currentPickerId === user.id;

    const { data: pickerProfile } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", currentPickerId)
      .single();

    const currentPickerName =
      pickerProfile?.username ?? memberships.find((m) => m.league_id === league.id)?.display_name ?? "Unknown";

    // Fetch available players (not yet drafted)
    const draftedPlayerIds = picks.map((p) => p.player_id);
    let query = supabase
      .from("players")
      .select("*, team:national_teams(*)")
      .order("total_points", { ascending: false });

    if (draftedPlayerIds.length > 0) {
      query = query.not("id", "in", `(${draftedPlayerIds.join(",")})`);
    }

    const { data: playersData } = await query;
    const availablePlayers = (playersData ?? []) as Player[];

    setDraftData({
      league,
      picks,
      availablePlayers,
      mySquad,
      currentPickerName,
      isMyTurn,
    });
  }, [user]);

  useEffect(() => {
    setLoading(true);
    fetchDraftData().finally(() => setLoading(false));
  }, [fetchDraftData]);

  // Real-time subscription
  useEffect(() => {
    if (!draftData?.league) return;

    const channel = supabase
      .channel(`draft:${draftData.league.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "draft_picks",
          filter: `league_id=eq.${draftData.league.id}`,
        },
        () => fetchDraftData()
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "leagues",
          filter: `id=eq.${draftData.league.id}`,
        },
        () => fetchDraftData()
      )
      .subscribe();

    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
    };
  }, [draftData?.league?.id, fetchDraftData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchDraftData();
    setRefreshing(false);
  }, [fetchDraftData]);

  async function handlePickPlayer() {
    if (!selectedPlayer || !draftData || !user) return;

    const validation = validateDraftPick(
      selectedPlayer.id,
      user.id,
      draftData.picks,
      draftData.mySquad
    );

    if (!validation.valid) {
      Alert.alert("Invalid Pick", validation.reason);
      return;
    }

    setPicking(true);
    const nextPickNumber = draftData.picks.length + 1;

    const { error } = await supabase.from("draft_picks").insert({
      league_id: draftData.league.id,
      manager_id: user.id,
      player_id: selectedPlayer.id,
      pick_number: nextPickNumber,
      picked_at: new Date().toISOString(),
    });

    if (error) {
      Alert.alert("Error", "Failed to submit pick. Please try again.");
      setPicking(false);
      return;
    }

    // Advance current_pick_index on the league
    const nextIndex = draftData.league.current_pick_index + 1;
    await supabase
      .from("leagues")
      .update({
        current_pick_index: nextIndex,
        current_pick_deadline:
          draftData.league.draft_mode === "live"
            ? new Date(
                Date.now() + draftData.league.pick_time_limit_seconds * 1000
              ).toISOString()
            : new Date(
                Date.now() + draftData.league.slow_draft_hours * 3600 * 1000
              ).toISOString(),
      })
      .eq("id", draftData.league.id);

    setPicking(false);
    setConfirmVisible(false);
    setSelectedPlayer(null);
    await fetchDraftData();
  }

  const filteredPlayers = (draftData?.availablePlayers ?? []).filter((p) => {
    const matchesSearch =
      !searchQuery ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.team?.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPosition =
      positionFilter === "ALL" || p.position === positionFilter;
    return matchesSearch && matchesPosition;
  });

  // Group by position for SectionList
  const sections = POSITION_ORDER.map((pos) => ({
    title: pos,
    data: filteredPlayers.filter((p) => p.position === pos),
  })).filter((s) => s.data.length > 0);

  if (loading) {
    return (
      <View className="flex-1 bg-primary items-center justify-center">
        <ActivityIndicator color="#F5B700" size="large" />
      </View>
    );
  }

  if (!draftData) {
    return (
      <View className="flex-1 bg-primary items-center justify-center px-8">
        <Ionicons name="list-outline" size={64} color="#4A6080" />
        <Text className="text-white text-xl font-bold mt-4">
          No Active Draft
        </Text>
        <Text className="text-muted text-center mt-2">
          Join or create a league and start a draft from the lobby.
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-primary">
      {/* Turn banner */}
      <View
        className={`mx-4 mt-4 rounded-xl px-4 py-3 ${
          draftData.isMyTurn ? "bg-accent" : "bg-surface"
        }`}
      >
        {draftData.isMyTurn ? (
          <Text className="text-primary font-bold text-center text-base">
            Your Turn to Pick!
          </Text>
        ) : (
          <Text className="text-white text-center text-base">
            Waiting for{" "}
            <Text className="font-bold text-accent">
              {draftData.currentPickerName}
            </Text>
            ...
          </Text>
        )}
        {draftData.league.current_pick_deadline && (
          <View className="items-center mt-1">
            <CountdownTimer
              deadline={draftData.league.current_pick_deadline}
              onExpired={() => fetchDraftData()}
            />
          </View>
        )}
      </View>

      {/* Squad progress */}
      <View className="mx-4 mt-3 flex-row items-center">
        <Text className="text-muted text-sm">Squad: </Text>
        <Text className="text-white font-bold text-sm">
          {draftData.mySquad.length} / 7
        </Text>
        <View className="flex-1 mx-3 bg-surface rounded-full h-2">
          <View
            className="bg-accent rounded-full h-2"
            style={{ width: `${(draftData.mySquad.length / 7) * 100}%` }}
          />
        </View>
      </View>

      {/* Search */}
      <View className="mx-4 mt-3 bg-surface rounded-xl flex-row items-center px-3">
        <Ionicons name="search" size={18} color="#4A6080" />
        <TextInput
          className="flex-1 text-white py-3 px-2"
          placeholder="Search players..."
          placeholderTextColor="#4A6080"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery("")}>
            <Ionicons name="close-circle" size={18} color="#4A6080" />
          </TouchableOpacity>
        )}
      </View>

      {/* Position filter */}
      <View className="flex-row mx-4 mt-2 gap-2">
        {(["ALL", ...POSITION_ORDER] as const).map((pos) => (
          <TouchableOpacity
            key={pos}
            className={`px-3 py-1.5 rounded-full ${
              positionFilter === pos ? "bg-accent" : "bg-surface"
            }`}
            onPress={() => setPositionFilter(pos as typeof positionFilter)}
          >
            <Text
              className={`text-xs font-semibold ${
                positionFilter === pos ? "text-primary" : "text-muted"
              }`}
            >
              {pos}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Players list */}
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, paddingTop: 8 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#F5B700"
          />
        }
        renderSectionHeader={({ section: { title } }) => (
          <View className="bg-primary py-1">
            <Text className="text-muted text-xs font-bold tracking-wider uppercase">
              {title}
            </Text>
          </View>
        )}
        renderItem={({ item }) => (
          <PlayerCard
            player={item}
            selectable={draftData.isMyTurn}
            onPress={
              draftData.isMyTurn
                ? () => {
                    setSelectedPlayer(item);
                    setConfirmVisible(true);
                  }
                : undefined
            }
          />
        )}
        ItemSeparatorComponent={() => <View className="h-2" />}
        stickySectionHeadersEnabled={false}
      />

      {/* Confirmation modal */}
      <Modal
        visible={confirmVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setConfirmVisible(false)}
      >
        <View className="flex-1 justify-end bg-black/60">
          <View className="bg-surface rounded-t-3xl p-6">
            <Text className="text-white text-xl font-bold mb-1">
              Confirm Pick
            </Text>
            <Text className="text-muted text-sm mb-4">
              Are you sure you want to draft this player?
            </Text>
            {selectedPlayer && (
              <PlayerCard player={selectedPlayer} selected />
            )}
            <View className="flex-row gap-3 mt-4">
              <TouchableOpacity
                className="flex-1 bg-primary rounded-xl py-3 items-center border border-muted"
                onPress={() => setConfirmVisible(false)}
              >
                <Text className="text-white font-semibold">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 bg-accent rounded-xl py-3 items-center"
                onPress={handlePickPlayer}
                disabled={picking}
              >
                {picking ? (
                  <ActivityIndicator color="#0D1B2A" />
                ) : (
                  <Text className="text-primary font-bold">Draft Player</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
