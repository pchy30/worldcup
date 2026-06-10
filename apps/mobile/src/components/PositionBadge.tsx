import { View, Text } from "react-native";
import type { PlayerPosition } from "@wcf/shared";

interface PositionBadgeProps {
  position: PlayerPosition;
  size?: "sm" | "md";
}

const POSITION_STYLES: Record<
  PlayerPosition,
  { bg: string; text: string; label: string }
> = {
  GK: { bg: "#7C3AED", text: "#FFFFFF", label: "GK" },
  DEF: { bg: "#1D4ED8", text: "#FFFFFF", label: "DEF" },
  MID: { bg: "#15803D", text: "#FFFFFF", label: "MID" },
  FWD: { bg: "#B91C1C", text: "#FFFFFF", label: "FWD" },
};

export function PositionBadge({ position, size = "sm" }: PositionBadgeProps) {
  const styles = POSITION_STYLES[position];
  const isSmall = size === "sm";

  return (
    <View
      style={{ backgroundColor: styles.bg }}
      className={`rounded ${isSmall ? "px-1.5 py-0.5" : "px-2.5 py-1"}`}
    >
      <Text
        style={{ color: styles.text }}
        className={`font-bold ${isSmall ? "text-xs" : "text-sm"}`}
      >
        {styles.label}
      </Text>
    </View>
  );
}
