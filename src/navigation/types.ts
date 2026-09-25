import type { NavigatorScreenParams } from "@react-navigation/native";

export type TabParamList = {
  Stream: undefined;
  Roam: undefined;
  Pulse: undefined;
  Me: undefined;
};

export type AuthStackParamList = {
  SignIn: undefined;
  SignUp: undefined;
};

export type RootStackParamList = {
  Tabs: NavigatorScreenParams<TabParamList> | undefined;
  LoopsPlayer: { roomId: string; startLoopId?: string };
  Banters: undefined;
  BanterThread: { banterId: string; handle: string };
  NewDrop: undefined;
  NewMoment: undefined;
  NewTake: { mode: "take" | "poll" };
  Tag: { tag: string };
  Drop: { dropId: string };
  Collection: { type: "save" | "cheer" };
  Settings: undefined;
  EditProfile: undefined;
  UserProfile: { handle: string };
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
