import { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Share,
  ScrollView,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { supabase, useSession } from "@/lib/supabase";
import { DraftStatusBadge } from "@/components/DraftStatusBadge";
import type { League, LeagueMember } from "@wcf/shared";

export default function LobbyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useSession();
  const [league, setLeague] = useState<League | null>(null);
  const [members, setMembers] = useState<LeagueMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const fetchLobby = useCallback(async () => {
    if (!id) return;

    const [leagueRes, membersRes] = await Promise.all([
      supabase.from("leagues").select("*").eq("id", id).single(),
      supabase
        .from("league_members")
        .select("*")
        .eq("league_id", id)
        .order("joined_at", { ascending: true }),
    ]);

    if (leagueRes.data) setLeague(leagueRes.data as League);
    if (membersRes.data) setMembers(membersRes.data as LeagueMember[]);
  }, [id]);

  useEffect(() => {
    setLoading(true);
    fetchLobby().finally(() => setLoading(false));
  }, [fetchLobby]);

  // Real-time members subscription
  useEffect(() => {
    if (!id) return;

    const channel = supabase
      .channel(`lobby:${id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "league_members",
          filter: `league_id=eq.${id}`,
        },
        () => fetchLobby()
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "leagues",
          filter: `id=eq.${id}`,
        },
        (payload) => {
          const updated = payload.new as League;
          setLeague(updated);
          if (updated.draft_status === "active") {
            router.replace("/(tabs)/draft");
          }
        }
      )
      .subscribe();

    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, fetchLobby]);

  async function copyInviteCode() {
    if (!league) return;
    await Clipboard.setStringAsync(league.invite_code);
    Alert.alert("Copied!", `Invite code ${league.invite_code} copied to clipboard.`);
  }

  async function shareInviteCode() {
    if (!league) return;
    await Share.share({
      message: `Join my World Cup Fantasy league! Use code: ${league.invite_code}`,
      title: `Join ${league.name}`,
    });
  }

  async function handleStartDraft() {
    if (!league || !user) return;
    if (members.length < 2) {
      Alert.alert("Not enough players", "You need at least 2 managers to start the draft.");
      return;
    }

    Alert.alert("Start Draft", "Start the draft now? This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Start",
        style: "destructive",
        onPress: async () => {
          setStarting(true);

          // Shuffle members for draft order
          const shuffledOrder = [...members]
            .sort(() => Math.random() - 0.5)
            .map((m) => m.user_id);

          const deadline =
            league.draft_mode === "live"
              ? new Date(
                  Date.now() + league.pick_time_limit_seconds * 1000
                ).toISOString()
              : new Date(
                  Date.now() + league.slow_draft_hours * 3600 * 1000
                ).toISOString();

          const { error } = await supabase
            .from("leagues")
            .update({
              draft_status: "active",
              draft_order: shuffledOrder,
              current_pick_index: 0,
              current_pick_deadline: deadline,
            })
            .eq("id", league.id);

          setStarting(false);

          if (error) {
            Alert.alert("Error", error.message);
          } else {
            router.replace("/(tabs)/draft");
          }
        },
      },
    ]);
  }

  const isCommissioner = league?.commissioner_id === user?.id;

  if (loading) {
    return (
      <View className="flex-1 bg-primary items-center justify-center">
        <ActivityIndicator color="#F5B700" size="large" />
      </View>
    );
  }

  if (!league) {
    return (
      <View className="flex-1 bg-primary items-center justify-center">
        <Text className="text-muted">League not found.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-primary"
      contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
    >
      {/* Back */}
      <TouchableOpacity
        className="flex-row items-center mb-6"
        onPress={() => router.back()}
      >
        <Ionicons name="arrow-back" size={20} color="#F5B700" />
        <Text className="text-accent ml-2 font-semibold">Back</Text>
      </TouchableOpacity>

      {/* League header */}
      <View className="bg-surface rounded-2xl p-4 mb-4">
        <View className="flex-row items-start justify-between">
          <View className="flex-1 mr-2">
            <Text className="text-white text-xl font-bold" numberOfLines={2}>
              {league.name}
            </Text>
            <Text className="text-muted text-xs mt-1 capitalize">
              {league.draft_mode} draft
            </Text>
          </View>
          <DraftStatusBadge status={league.draft_status} />
        </View>

        {/* Settings summary */}
        <View className="flex-row flex-wrap gap-3 mt-4">
          <View className="flex-row items-center gap-1">
            <Ionicons name="people" size={14} color="#4A6080" />
            <Text className="text-muted text-xs">
              {members.length} / {league.max_participants}
            </Text>
          </View>
          {league.draft_mode === "live" ? (
            <View className="flex-row items-center gap-1">
              <Ionicons name="timer" size={14} color="#4A6080" />
              <Text className="text-muted text-xs">
                {league.pick_time_limit_seconds}s per pick
              </Text>
            </View>
          ) : (
            <View className="flex-row items-center gap-1">
              <Ionicons name="time" size={14} color="#4A6080" />
              <Text className="text-muted text-xs">
                {league.slow_draft_hours}h per pick
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Invite code */}
      {league.draft_status === "pending" && (
        <View className="bg-surface rounded-2xl p-4 mb-4">
          <Text className="text-white font-semibold mb-2">Invite Code</Text>
          <TouchableOpacity
            className="bg-primary rounded-xl px-4 py-3 flex-row items-center justify-between"
            onPress={copyInviteCode}
            activeOpacity={0.8}
          >
            <Text className="text-accent text-2xl font-bold tracking-widest">
              {league.invite_code}
            </Text>
            <Ionicons name="copy-outline" size={20} color="#4A6080" />
          </TouchableOpacity>
          <TouchableOpacity
            className="mt-2 flex-row items-center justify-center gap-2 py-2"
            onPress={shareInviteCode}
          >
            <Ionicons name="share-outline" size={16} color="#F5B700" />
            <Text className="text-accent text-sm font-semibold">
              Share Invite
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Members list */}
      <View className="bg-surface rounded-2xl p-4 mb-4">
        <Text className="text-white font-semibold mb-3">
          Managers ({members.length})
        </Text>
        {members.map((member, index) => (
          <View
            key={member.id}
            className="flex-row items-center py-2.5 border-b border-primary/60 last:border-0"
          >
            <View className="w-8 h-8 rounded-full bg-primary items-center justify-center mr-3">
              <Text className="text-accent text-xs font-bold">
                {member.display_name.slice(0, 2).toUpperCase()}
              </Text>
            </View>
            <Text className="text-white flex-1" numberOfLines={1}>
              {member.display_name}
            </Text>
            {member.user_id === league.commissioner_id && (
              <View className="bg-accent/20 rounded-full px-2 py-0.5 mr-2">
                <Text className="text-accent text-xs font-semibold">
                  Commissioner
                </Text>
              </View>
            )}
            {member.user_id === user?.id && (
              <Text className="text-muted text-xs">You</Text>
            )}
          </View>
        ))}
      </View>

      {/* Start draft button (commissioner only) */}
      {isCommissioner && league.draft_status === "pending" && (
        <TouchableOpacity
          className={`rounded-xl py-4 items-center ${
            members.length >= 2 ? "bg-accent" : "bg-muted/40"
          }`}
          onPress={handleStartDraft}
          disabled={starting || members.length < 2}
          activeOpacity={0.85}
        >
          {starting ? (
            <ActivityIndicator color="#0D1B2A" />
          ) : (
            <Text
              className={`font-bold text-base ${
                members.length >= 2 ? "text-primary" : "text-muted"
              }`}
            >
              {members.length < 2
                ? "Need at least 2 managers"
                : "Start Draft"}
            </Text>
          )}
        </TouchableOpacity>
      )}

      {league.draft_status === "active" && (
        <TouchableOpacity
          className="bg-green-700 rounded-xl py-4 items-center"
          onPress={() => router.replace("/(tabs)/draft")}
          activeOpacity={0.85}
        >
          <Text className="text-white font-bold text-base">
            Go to Draft Room
          </Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}
