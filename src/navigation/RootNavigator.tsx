import { ActivityIndicator, StyleSheet, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { TabNavigator } from "./TabNavigator";
import { AuthNavigator } from "./AuthNavigator";
import { LoopsPlayerScreen } from "@/screens/LoopsPlayerScreen";
import { BantersScreen } from "@/screens/BantersScreen";
import { BanterThreadScreen } from "@/screens/BanterThreadScreen";
import { NewDropScreen } from "@/screens/NewDropScreen";
import { SettingsScreen } from "@/screens/SettingsScreen";
import { useSession } from "@/session/SessionContext";
import { colors } from "@/theme/colors";
import type { RootStackParamList } from "./types";

const Stack = createNativeStackNavigator<RootStackParamList>();

function AppNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={TabNavigator} />
      <Stack.Screen name="LoopsPlayer" component={LoopsPlayerScreen} />
      <Stack.Screen name="Banters" component={BantersScreen} />
      <Stack.Screen name="BanterThread" component={BanterThreadScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="NewDrop" component={NewDropScreen} options={{ presentation: "modal" }} />
    </Stack.Navigator>
  );
}

export function RootNavigator() {
  const { user, isLoading } = useSession();

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return <NavigationContainer>{user ? <AppNavigator /> : <AuthNavigator />}</NavigationContainer>;
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.canvas },
});
