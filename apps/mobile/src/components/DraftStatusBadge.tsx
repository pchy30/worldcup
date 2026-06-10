import { View, Text } from "react-native";
import type { DraftStatus } from "@wcf/shared";

interface DraftStatusBadgeProps {
  status: DraftStatus;
}

const STATUS_CONFIG: Record<
  DraftStatus,
  { label: string; bg: string; text: string }
> = {
  pending: {
    label: "Pending",
    bg: "rgba(100, 116, 139, 0.25)",
    text: "#94A3B8",
  },
  active: {
    label: "Live Draft",
    bg: "rgba(22, 163, 74, 0.25)",
    text: "#4ADE80",
  },
  completed: {
    label: "Completed",
    bg: "rgba(37, 99, 235, 0.25)",
    text: "#60A5FA",
  },
};

export function DraftStatusBadge({ status }: DraftStatusBadgeProps) {
  const config = STATUS_CONFIG[status];

  return (
    <View
      style={{ backgroundColor: config.bg }}
      className="rounded-full px-3 py-1"
    >
      <Text style={{ color: config.text }} className="text-xs font-semibold">
        {config.label}
      </Text>
    </View>
  );
}
