import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

interface TabConfig {
  name: string;
  title: string;
  icon: IoniconsName;
  activeIcon: IoniconsName;
}

const TABS: TabConfig[] = [
  {
    name: "dashboard",
    title: "Dashboard",
    icon: "home-outline",
    activeIcon: "home",
  },
  {
    name: "draft",
    title: "Draft",
    icon: "list-outline",
    activeIcon: "list",
  },
  {
    name: "squad",
    title: "Squad",
    icon: "people-outline",
    activeIcon: "people",
  },
  {
    name: "leaderboard",
    title: "Leaderboard",
    icon: "trophy-outline",
    activeIcon: "trophy",
  },
  {
    name: "profile",
    title: "Profile",
    icon: "person-outline",
    activeIcon: "person",
  },
];

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarStyle: {
          backgroundColor: "#0D1B2A",
          borderTopColor: "#1A2D42",
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
        },
        tabBarActiveTintColor: "#F5B700",
        tabBarInactiveTintColor: "#4A6080",
        headerStyle: {
          backgroundColor: "#0D1B2A",
        },
        headerTintColor: "#FFFFFF",
        headerTitleStyle: {
          fontWeight: "bold",
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "500",
        },
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarIcon: ({ focused, color, size }) => (
              <Ionicons
                name={focused ? tab.activeIcon : tab.icon}
                size={size}
                color={color}
              />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
