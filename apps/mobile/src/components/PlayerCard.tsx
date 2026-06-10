import { View, Text, TouchableOpacity } from "react-native";
import type { Player } from "@wcf/shared";
import { PositionBadge } from "./PositionBadge";

// ISO 3166-1 alpha-3 to flag emoji helper
function flagEmoji(code?: string): string {
  if (!code || code.length !== 3) return "🌐";
  // Map common 3-letter codes to 2-letter ISO 3166-1 alpha-2 for flag rendering
  const map: Record<string, string> = {
    ARG: "AR", BRA: "BR", FRA: "FR", DEU: "DE", ENG: "GB-ENG", ESP: "ES",
    POR: "PT", NLD: "NL", BEL: "BE", ITA: "IT", URY: "UY", COL: "CO",
    MEX: "MX", USA: "US", JPN: "JP", KOR: "KR", MAR: "MA", SEN: "SN",
    NGA: "NG", GHA: "GH", CMR: "CM", EGY: "EG", TUN: "TN", AUS: "AU",
    CAN: "CA", CHE: "CH", HRV: "HR", SRB: "RS", DNK: "DK", POL: "PL",
    CRO: "HR", SWE: "SE", WAL: "GB-WLS", SCO: "GB-SCT",
  };
  const alpha2 = map[code.toUpperCase()];
  if (!alpha2 || alpha2.includes("-")) return "🌐";
  const codePoints = alpha2
    .toUpperCase()
    .split("")
    .map((c) => 0x1f1e6 + c.charCodeAt(0) - 65);
  return String.fromCodePoint(...codePoints);
}

interface PlayerCardProps {
  player: Player;
  selectable?: boolean;
  selected?: boolean;
  onPress?: () => void;
}

export function PlayerCard({
  player,
  selectable = false,
  selected = false,
  onPress,
}: PlayerCardProps) {
  const flag = flagEmoji(player.team?.code);

  const content = (
    <View
      className={`bg-surface rounded-xl px-4 py-3 flex-row items-center ${
        selected ? "border-2 border-accent" : ""
      } ${selectable && !selected ? "border border-transparent" : ""}`}
    >
      {/* Flag */}
      <Text className="text-2xl mr-3">{flag}</Text>

      {/* Name + team */}
      <View className="flex-1 mr-2">
        <Text className="text-white font-semibold text-sm" numberOfLines={1}>
          {player.name}
        </Text>
        <Text className="text-muted text-xs mt-0.5" numberOfLines={1}>
          {player.team?.name ?? "Unknown"}
        </Text>
      </View>

      {/* Position badge */}
      <PositionBadge position={player.position} />

      {/* Stats */}
      <View className="flex-row items-center gap-3 ml-3">
        <View className="items-center">
          <Text className="text-white text-xs font-bold">{player.goals}</Text>
          <Text className="text-muted text-xs">G</Text>
        </View>
        <View className="items-center">
          <Text className="text-white text-xs font-bold">{player.assists}</Text>
          <Text className="text-muted text-xs">A</Text>
        </View>
        {(player.position === "GK" || player.position === "DEF") && (
          <View className="items-center">
            <Text className="text-white text-xs font-bold">
              {player.clean_sheets}
            </Text>
            <Text className="text-muted text-xs">CS</Text>
          </View>
        )}
      </View>

      {/* Points badge */}
      <View className="ml-3 bg-accent/20 rounded-lg px-2 py-1 items-center min-w-[40px]">
        <Text className="text-accent font-bold text-sm">
          {player.total_points}
        </Text>
        <Text className="text-accent/70 text-xs">pts</Text>
      </View>
    </View>
  );

  if (selectable && onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.75}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}
