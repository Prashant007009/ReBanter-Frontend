import { StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { DefaultTheme, NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { TabNavigator } from "./TabNavigator";
import { AuthNavigator } from "./AuthNavigator";
import { LoopsPlayerScreen } from "@/screens/LoopsPlayerScreen";
import { BantersScreen } from "@/screens/BantersScreen";
import { BanterThreadScreen } from "@/screens/BanterThreadScreen";
import { NewDropScreen } from "@/screens/NewDropScreen";
import { NewMomentScreen } from "@/screens/NewMomentScreen";
import { NewTakeScreen } from "@/screens/NewTakeScreen";
import { TagScreen } from "@/screens/TagScreen";
import { DropScreen } from "@/screens/DropScreen";
import { SettingsScreen } from "@/screens/SettingsScreen";
import { EditProfileScreen } from "@/screens/EditProfileScreen";
import { UserProfileScreen } from "@/screens/UserProfileScreen";
import { SplashScreen } from "@/components/SplashScreen";
import { useSession } from "@/session/SessionContext";
import { colors } from "@/theme/colors";
import type { RootStackParamList } from "./types";

const Stack = createNativeStackNavigator<RootStackParamList>();

const navigationTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: "transparent" },
};

function AppNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={TabNavigator} />
      <Stack.Screen name="LoopsPlayer" component={LoopsPlayerScreen} />
      <Stack.Screen name="Banters" component={BantersScreen} />
      <Stack.Screen name="BanterThread" component={BanterThreadScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="UserProfile" component={UserProfileScreen} />
      {/* "modal" presentation relies on react-native-screens' native overlay
          handling, which is unreliable on the web platform (screens can end
          up rendering on top of each other instead of properly stacked) —
          a plain push is what we're testing against here since there's no
          emulator in this environment. Fine to revisit once tested on a
          real device/simulator. */}
      <Stack.Screen name="NewDrop" component={NewDropScreen} />
      <Stack.Screen name="NewMoment" component={NewMomentScreen} />
      <Stack.Screen name="NewTake" component={NewTakeScreen} />
      <Stack.Screen name="Tag" component={TagScreen} />
      <Stack.Screen name="Drop" component={DropScreen} />
    </Stack.Navigator>
  );
}

export function RootNavigator() {
  const { user, isLoading } = useSession();

  if (isLoading) {
    return <SplashScreen />;
  }

  return (
    <LinearGradient colors={colors.canvasGradientColors} style={styles.root}>
      <NavigationContainer theme={navigationTheme}>
        {user ? <AppNavigator /> : <AuthNavigator />}
      </NavigationContainer>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
