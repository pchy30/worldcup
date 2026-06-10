import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase, useSession } from "@/lib/supabase";

export default function JoinLeagueScreen() {
  const router = useRouter();
  const { user } = useSession();
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleJoin() {
    if (!user) return;
    const code = inviteCode.trim().toUpperCase();
    if (code.length < 4) {
      Alert.alert("Validation", "Please enter a valid invite code.");
      return;
    }

    setLoading(true);

    // Look up league by invite code
    const { data: league, error } = await supabase
      .from("leagues")
      .select("*")
      .eq("invite_code", code)
      .single();

    if (error || !league) {
      setLoading(false);
      Alert.alert("Not Found", "No league found with that invite code.");
      return;
    }

    if (league.draft_status === "completed") {
      setLoading(false);
      Alert.alert("Closed", "This league's draft has already completed.");
      return;
    }

    // Check if already a member
    const { data: existing } = await supabase
      .from("league_members")
      .select("id")
      .eq("league_id", league.id)
      .eq("user_id", user.id)
      .single();

    if (existing) {
      setLoading(false);
      // Already a member — just go to lobby
      router.replace(`/league/${league.id}/lobby`);
      return;
    }

    // Check capacity
    const { count } = await supabase
      .from("league_members")
      .select("id", { count: "exact", head: true })
      .eq("league_id", league.id);

    if ((count ?? 0) >= league.max_participants) {
      setLoading(false);
      Alert.alert("Full", "This league is already at max capacity.");
      return;
    }

    // Join the league
    const { error: joinError } = await supabase.from("league_members").insert({
      league_id: league.id,
      user_id: user.id,
      display_name:
        user.user_metadata?.username ?? user.email?.split("@")[0] ?? "Manager",
      total_points: 0,
      goals_scored: 0,
      assists: 0,
      joined_at: new Date().toISOString(),
    });

    setLoading(false);

    if (joinError) {
      Alert.alert("Error", joinError.message);
      return;
    }

    router.replace(`/league/${league.id}/lobby`);
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-primary"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View className="flex-1 px-6 py-12 justify-center">
        {/* Back button */}
        <TouchableOpacity
          className="flex-row items-center mb-8"
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={20} color="#F5B700" />
          <Text className="text-accent ml-2 font-semibold">Back</Text>
        </TouchableOpacity>

        <View className="items-center mb-10">
          <View className="w-16 h-16 rounded-full bg-surface items-center justify-center mb-4">
            <Ionicons name="enter-outline" size={32} color="#F5B700" />
          </View>
          <Text className="text-white text-2xl font-bold">Join a League</Text>
          <Text className="text-muted text-center mt-2">
            Enter the invite code shared by your league commissioner.
          </Text>
        </View>

        <View className="bg-surface rounded-2xl p-6">
          <Text className="text-white text-sm mb-1 opacity-70">
            Invite Code
          </Text>
          <TextInput
            className="bg-primary text-white text-center text-2xl font-bold rounded-xl px-4 py-4 mb-6 border border-muted tracking-widest"
            placeholder="XXXXXX"
            placeholderTextColor="#4A6080"
            autoCapitalize="characters"
            autoComplete="off"
            autoCorrect={false}
            maxLength={8}
            value={inviteCode}
            onChangeText={(t) => setInviteCode(t.toUpperCase())}
            onSubmitEditing={handleJoin}
            returnKeyType="go"
          />

          <TouchableOpacity
            className="bg-accent rounded-xl py-4 items-center"
            onPress={handleJoin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#0D1B2A" />
            ) : (
              <Text className="text-primary font-bold text-base">
                Join League
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
