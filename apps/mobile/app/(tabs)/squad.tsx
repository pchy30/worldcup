import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  SectionList,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase, useSession } from "@/lib/supabase";
import { PlayerCard } from "@/components/PlayerCard";
import type { League, Player, SquadPlayer, TransferWindow } from "@wcf/shared";
import { validateTransfer } from "@wcf/shared";

const POSITION_ORDER = ["GK", "DEF", "MID", "FWD"] as const;

interface LeagueSummary {
  id: string;
  name: string;
}

interface SquadPlayerWithData extends SquadPlayer {
  player: Player;
}

export default function SquadScreen() {
  const { user } = useSession();
  const [myLeagues, setMyLeagues] = useState<LeagueSummary[]>([]);
  const [selectedLeagueId, setSelectedLeagueId] = useState<string | null>(null);
  const [squad, setSquad] = useState<SquadPlayerWithData[]>([]);
  const [transferWindow, setTransferWindow] = useState<TransferWindow | null>(null);
  const [loading, setLoading] = useState(true);

  // Transfer state
  const [transferModalVisible, setTransferModalVisible] = useState(false);
  const [playerOut, setPlayerOut] = useState<Player | null>(null);
  const [availablePlayers, setAvailablePlayers] = useState<Player[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [transferring, setTransferring] = useState(false);

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

  const fetchSquad = useCallback(async () => {
    if (!user || !selectedLeagueId) return;

    const [squadRes, windowRes] = await Promise.all([
      supabase
        .from("squad_players")
        .select("*, player:players(*, team:national_teams(*))")
        .eq("league_id", selectedLeagueId)
        .eq("manager_id", user.id),
      supabase
        .from("transfer_windows")
        .select("*")
        .eq("league_id", selectedLeagueId)
        .eq("status", "open")
        .single(),
    ]);

    setSquad((squadRes.data ?? []) as SquadPlayerWithData[]);
    setTransferWindow(windowRes.data ?? null);
  }, [user, selectedLeagueId]);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchLeagues(), fetchSquad()]).finally(() =>
      setLoading(false)
    );
  }, [fetchLeagues, fetchSquad]);

  useEffect(() => {
    if (selectedLeagueId) {
      setLoading(true);
      fetchSquad().finally(() => setLoading(false));
    }
  }, [selectedLeagueId, fetchSquad]);

  async function openTransferModal(player: Player) {
    setPlayerOut(player);
    setSearchQuery("");

    // Fetch all squads in this league for validation
    const { data: allSquadData } = await supabase
      .from("squad_players")
      .select("manager_id, player:players(*)")
      .eq("league_id", selectedLeagueId!);

    const myPlayerIds = squad.map((sp) => sp.player_id);
    const draftedPlayerIds = (allSquadData ?? []).map((sp) => sp.player_id);

    const { data: available } = await supabase
      .from("players")
      .select("*, team:national_teams(*)")
      .not("id", "in", `(${draftedPlayerIds.join(",")})`)
      .order("total_points", { ascending: false });

    setAvailablePlayers((available ?? []) as Player[]);
    setTransferModalVisible(true);
  }

  async function handleTransfer(playerIn: Player) {
    if (!playerOut || !user || !selectedLeagueId || !transferWindow) return;

    const currentSquad = squad.map((sp) => sp.player);

    // Fetch all squads for validation
    const { data: allSquadData } = await supabase
      .from("squad_players")
      .select("manager_id, player:players(*)")
      .eq("league_id", selectedLeagueId);

    const allSquads = Object.entries(
      (allSquadData ?? []).reduce<Record<string, Player[]>>((acc, sp) => {
        const mid = sp.manager_id as string;
        if (!acc[mid]) acc[mid] = [];
        acc[mid].push(sp.player as unknown as Player);
        return acc;
      }, {})
    ).map(([manager_id, players]) => ({ manager_id, players }));

    const validation = validateTransfer({
      playerIn,
      playerOut,
      currentSquad,
      allSquads,
      managerId: user.id,
    });

    if (!validation.valid) {
      Alert.alert("Invalid Transfer", validation.reason);
      return;
    }

    setTransferring(true);

    const { error } = await supabase.from("transfers").insert({
      league_id: selectedLeagueId,
      manager_id: user.id,
      player_out_id: playerOut.id,
      player_in_id: playerIn.id,
      transfer_window_id: transferWindow.id,
      confirmed_at: new Date().toISOString(),
    });

    if (error) {
      Alert.alert("Error", "Transfer failed. Please try again.");
      setTransferring(false);
      return;
    }

    // Update squad_players table
    await supabase
      .from("squad_players")
      .update({ player_id: playerIn.id })
      .eq("league_id", selectedLeagueId)
      .eq("manager_id", user.id)
      .eq("player_id", playerOut.id);

    setTransferring(false);
    setTransferModalVisible(false);
    setPlayerOut(null);
    await fetchSquad();
  }

  const sections = POSITION_ORDER.map((pos) => ({
    title: pos,
    data: squad.filter((sp) => sp.player?.position === pos),
  })).filter((s) => s.data.length > 0);

  const filteredAvailable = availablePlayers.filter(
    (p) =>
      !searchQuery ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.team?.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <View className="flex-1 bg-primary items-center justify-center">
        <ActivityIndicator color="#F5B700" size="large" />
      </View>
    );
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

      {squad.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="people-outline" size={64} color="#4A6080" />
          <Text className="text-white text-xl font-bold mt-4">
            No Squad Yet
          </Text>
          <Text className="text-muted text-center mt-2">
            Your drafted players will appear here after the draft.
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
          renderSectionHeader={({ section: { title, data } }) => (
            <View className="py-2 flex-row items-center justify-between">
              <Text className="text-muted text-xs font-bold tracking-wider uppercase">
                {title}
              </Text>
              <Text className="text-muted text-xs">{data.length}</Text>
            </View>
          )}
          renderItem={({ item }) => (
            <View className="mb-2">
              <PlayerCard player={item.player} />
              {transferWindow && (
                <TouchableOpacity
                  className="mt-1 bg-surface rounded-lg py-2 items-center flex-row justify-center gap-1"
                  onPress={() => openTransferModal(item.player)}
                >
                  <Ionicons name="swap-horizontal" size={14} color="#4A6080" />
                  <Text className="text-muted text-xs font-semibold">
                    Swap Player
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
          stickySectionHeadersEnabled={false}
          ListHeaderComponent={
            transferWindow ? (
              <View className="bg-green-900/40 rounded-xl px-4 py-3 mb-3">
                <Text className="text-green-400 text-sm font-semibold text-center">
                  Transfer Window Open
                </Text>
                <Text className="text-muted text-xs text-center mt-0.5">
                  Closes{" "}
                  {new Date(transferWindow.closes_at).toLocaleDateString()}
                </Text>
              </View>
            ) : null
          }
        />
      )}

      {/* Transfer player search modal */}
      <Modal
        visible={transferModalVisible}
        animationType="slide"
        onRequestClose={() => setTransferModalVisible(false)}
      >
        <View className="flex-1 bg-primary">
          <View className="px-4 pt-12 pb-4 flex-row items-center bg-surface">
            <TouchableOpacity
              onPress={() => setTransferModalVisible(false)}
              className="mr-3"
            >
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <View>
              <Text className="text-white font-bold text-base">
                Transfer Player
              </Text>
              {playerOut && (
                <Text className="text-muted text-xs">
                  Replacing: {playerOut.name}
                </Text>
              )}
            </View>
          </View>

          <View className="mx-4 mt-3 bg-surface rounded-xl flex-row items-center px-3">
            <Ionicons name="search" size={18} color="#4A6080" />
            <TextInput
              className="flex-1 text-white py-3 px-2"
              placeholder="Search players..."
              placeholderTextColor="#4A6080"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          <FlatList
            data={filteredAvailable}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: 16 }}
            renderItem={({ item }) => (
              <View className="mb-2">
                <PlayerCard
                  player={item}
                  selectable
                  onPress={() => handleTransfer(item)}
                />
              </View>
            )}
            ListEmptyComponent={
              <Text className="text-muted text-center mt-8">
                No available players found
              </Text>
            }
          />

          {transferring && (
            <View className="absolute inset-0 bg-black/60 items-center justify-center">
              <ActivityIndicator color="#F5B700" size="large" />
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}
