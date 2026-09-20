import { StatusBar } from "expo-status-bar";
import { SessionProvider } from "@/session/SessionContext";
import { RootNavigator } from "@/navigation/RootNavigator";

export default function App() {
  return (
    <SessionProvider>
      <StatusBar style="dark" />
      <RootNavigator />
    </SessionProvider>
  );
}
