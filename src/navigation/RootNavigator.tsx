import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { TabNavigator } from "./TabNavigator";
import { LoopsPlayerScreen } from "@/screens/LoopsPlayerScreen";
import { BantersScreen } from "@/screens/BantersScreen";
import { BanterThreadScreen } from "@/screens/BanterThreadScreen";
import { NewDropScreen } from "@/screens/NewDropScreen";
import { SettingsScreen } from "@/screens/SettingsScreen";
import type { RootStackParamList } from "./types";

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Tabs" component={TabNavigator} />
        <Stack.Screen name="LoopsPlayer" component={LoopsPlayerScreen} />
        <Stack.Screen name="Banters" component={BantersScreen} />
        <Stack.Screen name="BanterThread" component={BanterThreadScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="NewDrop" component={NewDropScreen} options={{ presentation: "modal" }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
