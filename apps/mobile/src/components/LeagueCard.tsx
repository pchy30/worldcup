import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { League } from "@wcf/shared";
import { DraftStatusBadge } from "./DraftStatusBadge";

interface LeagueCardProps {
  league: League;
  memberCount: number;
  myPoints: number;
  onPress?: () => void;
}

export function LeagueCard({
  league,
  memberCount,
  myPoints,
  onPress,
}: LeagueCardProps) {
  return (
    <TouchableOpacity
      className="bg-surface rounded-2xl p-4 active:opacity-80"
      onPress={onPress}
      activeOpacity={0.75}
    >
      {/* Top row: name + status badge */}
      <View className="flex-row items-start justify-between mb-3">
        <Text
          className="text-white font-bold text-base flex-1 mr-3"
          numberOfLines={2}
        >
          {league.name}
        </Text>
        <DraftStatusBadge status={league.draft_status} />
      </View>

      {/* Stats row */}
      <View className="flex-row items-center gap-4">
        {/* Points */}
        <View className="flex-row items-center gap-1.5">
          <Ionicons name="star" size={14} color="#F5B700" />
          <Text className="text-white text-sm font-semibold">{myPoints}</Text>
          <Text className="text-muted text-xs">pts</Text>
        </View>

        {/* Members */}
        <View className="flex-row items-center gap-1.5">
          <Ionicons name="people" size={14} color="#4A6080" />
          <Text className="text-muted text-xs">
            {memberCount} / {league.max_participants}
          </Text>
        </View>

        {/* Draft mode */}
        <View className="flex-row items-center gap-1.5">
          <Ionicons
            name={league.draft_mode === "live" ? "flash" : "time"}
            size={14}
            color="#4A6080"
          />
          <Text className="text-muted text-xs capitalize">
            {league.draft_mode}
          </Text>
        </View>
      </View>

      {/* Chevron */}
      <View className="absolute right-4 top-1/2 -translate-y-3">
        <Ionicons name="chevron-forward" size={16} color="#4A6080" />
      </View>
    </TouchableOpacity>
  );
}
