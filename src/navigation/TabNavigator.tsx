import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { StreamScreen } from "@/screens/StreamScreen";
import { RoamScreen } from "@/screens/RoamScreen";
import { PulseScreen } from "@/screens/PulseScreen";
import { ProfileScreen } from "@/screens/ProfileScreen";
import { AppTabBar } from "./AppTabBar";
import type { TabParamList } from "./types";

const Tab = createBottomTabNavigator<TabParamList>();

// Mirrors TabBar.dc.html: Stream, Roam, Pulse, Me. The center "Drop" action
// is rendered by AppTabBar and opens the NewDrop modal on the root stack
// rather than being a tab route.
export function TabNavigator() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }} tabBar={(props) => <AppTabBar {...props} />}>
      <Tab.Screen name="Stream" component={StreamScreen} />
      <Tab.Screen name="Roam" component={RoamScreen} />
      <Tab.Screen name="Pulse" component={PulseScreen} />
      <Tab.Screen name="Me" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
