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

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSignIn() {
    if (!email.trim() || !password) {
      Alert.alert("Validation", "Please enter your email and password.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    setLoading(false);
    if (error) {
      Alert.alert("Sign In Failed", error.message);
    } else {
      router.replace("/(tabs)/dashboard");
    }
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
            <Text className="text-white text-2xl font-bold mb-6">Sign In</Text>

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

            <Text className="text-white text-sm mb-1 opacity-70">Password</Text>
            <TextInput
              className="bg-primary text-white rounded-xl px-4 py-3 mb-6 border border-muted"
              placeholder="••••••••"
              placeholderTextColor="#4A6080"
              secureTextEntry
              autoComplete="current-password"
              value={password}
              onChangeText={setPassword}
              onSubmitEditing={handleSignIn}
              returnKeyType="go"
            />

            <TouchableOpacity
              className="bg-accent rounded-xl py-4 items-center"
              onPress={handleSignIn}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#0D1B2A" />
              ) : (
                <Text className="text-primary font-bold text-base">
                  Sign In
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <View className="flex-row justify-center mt-6">
            <Text className="text-white opacity-60">
              Don't have an account?{" "}
            </Text>
            <Link href="/(auth)/register" asChild>
              <TouchableOpacity>
                <Text className="text-accent font-semibold">Register</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
