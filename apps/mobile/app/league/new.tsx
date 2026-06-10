import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase, useSession } from "@/lib/supabase";

function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join("");
}

export default function NewLeagueScreen() {
  const router = useRouter();
  const { user } = useSession();
  const [name, setName] = useState("");
  const [maxParticipants, setMaxParticipants] = useState("8");
  const [draftMode, setDraftMode] = useState<"live" | "slow">("live");
  const [pickTimeLimitSeconds, setPickTimeLimitSeconds] = useState("60");
  const [slowDraftHours, setSlowDraftHours] = useState("24");
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    if (!user) return;
    if (!name.trim()) {
      Alert.alert("Validation", "League name is required.");
      return;
    }
    const maxP = parseInt(maxParticipants, 10);
    if (isNaN(maxP) || maxP < 2 || maxP > 20) {
      Alert.alert("Validation", "Max participants must be between 2 and 20.");
      return;
    }

    setLoading(true);

    const inviteCode = generateInviteCode();

    const { data: league, error } = await supabase
      .from("leagues")
      .insert({
        name: name.trim(),
        invite_code: inviteCode,
        commissioner_id: user.id,
        draft_mode: draftMode,
        draft_status: "pending",
        draft_order: [],
        current_pick_index: 0,
        pick_time_limit_seconds: parseInt(pickTimeLimitSeconds, 10) || 60,
        slow_draft_hours: parseInt(slowDraftHours, 10) || 24,
        current_pick_deadline: null,
        max_participants: maxP,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      setLoading(false);
      Alert.alert("Error", error.message);
      return;
    }

    // Auto-join as commissioner
    await supabase.from("league_members").insert({
      league_id: league.id,
      user_id: user.id,
      display_name:
        user.user_metadata?.username ?? user.email?.split("@")[0] ?? "Commissioner",
      total_points: 0,
      goals_scored: 0,
      assists: 0,
      joined_at: new Date().toISOString(),
    });

    setLoading(false);
    router.replace(`/league/${league.id}/lobby`);
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-primary"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={{ padding: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Back button */}
        <TouchableOpacity
          className="flex-row items-center mb-6"
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={20} color="#F5B700" />
          <Text className="text-accent ml-2 font-semibold">Back</Text>
        </TouchableOpacity>

        <Text className="text-white text-2xl font-bold mb-6">
          Create League
        </Text>

        {/* League name */}
        <Text className="text-white text-sm mb-1 opacity-70">League Name</Text>
        <TextInput
          className="bg-surface text-white rounded-xl px-4 py-3 mb-4 border border-muted"
          placeholder="e.g. World Cup Warriors"
          placeholderTextColor="#4A6080"
          value={name}
          onChangeText={setName}
          maxLength={50}
        />

        {/* Max participants */}
        <Text className="text-white text-sm mb-1 opacity-70">
          Max Participants
        </Text>
        <TextInput
          className="bg-surface text-white rounded-xl px-4 py-3 mb-4 border border-muted"
          placeholder="8"
          placeholderTextColor="#4A6080"
          keyboardType="number-pad"
          value={maxParticipants}
          onChangeText={setMaxParticipants}
        />

        {/* Draft mode toggle */}
        <View className="bg-surface rounded-xl px-4 py-4 mb-4">
          <Text className="text-white font-semibold mb-3">Draft Mode</Text>
          <View className="flex-row gap-3">
            {(["live", "slow"] as const).map((mode) => (
              <TouchableOpacity
                key={mode}
                className={`flex-1 py-3 rounded-xl items-center ${
                  draftMode === mode ? "bg-accent" : "bg-primary"
                }`}
                onPress={() => setDraftMode(mode)}
              >
                <Text
                  className={`font-semibold capitalize ${
                    draftMode === mode ? "text-primary" : "text-muted"
                  }`}
                >
                  {mode}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Mode-specific settings */}
        {draftMode === "live" ? (
          <View className="mb-4">
            <Text className="text-white text-sm mb-1 opacity-70">
              Pick Time Limit (seconds)
            </Text>
            <TextInput
              className="bg-surface text-white rounded-xl px-4 py-3 border border-muted"
              placeholder="60"
              placeholderTextColor="#4A6080"
              keyboardType="number-pad"
              value={pickTimeLimitSeconds}
              onChangeText={setPickTimeLimitSeconds}
            />
          </View>
        ) : (
          <View className="mb-4">
            <Text className="text-white text-sm mb-1 opacity-70">
              Hours Per Pick (Slow Draft)
            </Text>
            <TextInput
              className="bg-surface text-white rounded-xl px-4 py-3 border border-muted"
              placeholder="24"
              placeholderTextColor="#4A6080"
              keyboardType="number-pad"
              value={slowDraftHours}
              onChangeText={setSlowDraftHours}
            />
          </View>
        )}

        <TouchableOpacity
          className="bg-accent rounded-xl py-4 items-center mt-4"
          onPress={handleCreate}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#0D1B2A" />
          ) : (
            <Text className="text-primary font-bold text-base">
              Create League
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
