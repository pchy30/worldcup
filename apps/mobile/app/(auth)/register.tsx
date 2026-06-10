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
  ScrollView,
} from "react-native";
import { Link, useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";

export default function RegisterScreen() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    if (!username.trim() || !email.trim() || !password) {
      Alert.alert("Validation", "Please fill in all fields.");
      return;
    }
    if (username.trim().length < 3) {
      Alert.alert("Validation", "Username must be at least 3 characters.");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Validation", "Password must be at least 6 characters.");
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        data: { username: username.trim() },
      },
    });

    if (error) {
      setLoading(false);
      Alert.alert("Registration Failed", error.message);
      return;
    }

    if (data.user) {
      // Upsert a profiles row so other parts of the app can look up display names
      const { error: profileError } = await supabase.from("profiles").upsert(
        {
          id: data.user.id,
          username: username.trim(),
          email: email.trim().toLowerCase(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );

      if (profileError) {
        console.warn("Profile upsert failed:", profileError.message);
      }
    }

    setLoading(false);
    router.replace("/(tabs)/dashboard");
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-primary"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="flex-1 justify-center px-6 py-12">
          {/* Header */}
          <View className="items-center mb-10">
            <Text className="text-accent text-5xl font-bold tracking-widest">
              WCF
            </Text>
            <Text className="text-white text-lg mt-2 opacity-80">
              World Cup Fantasy Draft
            </Text>
          </View>

          {/* Form card */}
          <View className="bg-surface rounded-2xl p-6 shadow-lg">
            <Text className="text-white text-2xl font-bold mb-6">
              Create Account
            </Text>

            <Text className="text-white text-sm mb-1 opacity-70">
              Username
            </Text>
            <TextInput
              className="bg-primary text-white rounded-xl px-4 py-3 mb-4 border border-muted"
              placeholder="manager_name"
              placeholderTextColor="#4A6080"
              autoCapitalize="none"
              autoComplete="username-new"
              value={username}
              onChangeText={setUsername}
            />

            <Text className="text-white text-sm mb-1 opacity-70">Email</Text>
            <TextInput
              className="bg-primary text-white rounded-xl px-4 py-3 mb-4 border border-muted"
              placeholder="you@example.com"
              placeholderTextColor="#4A6080"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              value={email}
              onChangeText={setEmail}
            />

            <Text className="text-white text-sm mb-1 opacity-70">
              Password
            </Text>
            <TextInput
              className="bg-primary text-white rounded-xl px-4 py-3 mb-6 border border-muted"
              placeholder="••••••••"
              placeholderTextColor="#4A6080"
              secureTextEntry
              autoComplete="new-password"
              value={password}
              onChangeText={setPassword}
              onSubmitEditing={handleRegister}
              returnKeyType="go"
            />

            <TouchableOpacity
              className="bg-accent rounded-xl py-4 items-center"
              onPress={handleRegister}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#0D1B2A" />
              ) : (
                <Text className="text-primary font-bold text-base">
                  Create Account
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <View className="flex-row justify-center mt-6">
            <Text className="text-white opacity-60">
              Already have an account?{" "}
            </Text>
            <Link href="/(auth)/login" asChild>
              <TouchableOpacity>
                <Text className="text-accent font-semibold">Sign In</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
