import { useCallback } from "react";
import { View } from "react-native";
import { StatusBar } from "expo-status-bar";
import * as SplashScreenNative from "expo-splash-screen";
import { useFonts, SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold } from "@expo-google-fonts/space-grotesk";
import { DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold, DMSans_700Bold } from "@expo-google-fonts/dm-sans";
import { SessionProvider } from "@/session/SessionContext";
import { RootNavigator } from "@/navigation/RootNavigator";
import { brand } from "@/theme/colors";

// Every Text style in this app is set via `fonts` in theme/colors.ts (Space
// Grotesk + DM Sans, both self-hosted from Google Fonts) — never the
// platform default. Keep the native splash up until those font files are
// actually registered so nothing ever flashes in a system font first.
SplashScreenNative.preventAutoHideAsync().catch(() => {});

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
  });

  const onLayout = useCallback(async () => {
    if (fontsLoaded || fontError) {
      await SplashScreenNative.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <View style={{ flex: 1, backgroundColor: brand.violet }} onLayout={onLayout}>
      <SessionProvider>
        <StatusBar style="dark" />
        <RootNavigator />
      </SessionProvider>
    </View>
  );
}
