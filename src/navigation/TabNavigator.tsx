import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { colors } from "@/theme/colors";
import { StreamScreen } from "@/screens/StreamScreen";
import { RoamScreen } from "@/screens/RoamScreen";
import { PulseScreen } from "@/screens/PulseScreen";
import { ProfileScreen } from "@/screens/ProfileScreen";
import type { TabParamList } from "./types";

const Tab = createBottomTabNavigator<TabParamList>();

// Mirrors TabBar.dc.html: Stream, Roam, Pulse, Me. The center "Drop" action
// opens the NewDrop modal from the root stack rather than being a tab route.
export function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.inkSubtle,
        tabBarStyle: { backgroundColor: colors.surfaceRaised, borderTopColor: colors.hairlineSoft },
      }}
    >
      <Tab.Screen name="Stream" component={StreamScreen} />
      <Tab.Screen name="Roam" component={RoamScreen} />
      <Tab.Screen name="Pulse" component={PulseScreen} />
      <Tab.Screen name="Me" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
