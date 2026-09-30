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
  /** A room's loops, or a single standalone loop by id. */
  LoopsPlayer: { roomId?: string; loopId?: string; startLoopId?: string };
  Banters: undefined;
  BanterThread: { banterId: string; handle: string };
  /** The Drop composer, optionally opened on a mode or as a remix of a take / poll. */
  NewDrop:
    | {
        mode?: "photo" | "loop" | "collage" | "moment" | "take" | "poll";
        remix?: { kind: "take" | "poll"; body: string; options?: string[]; author: string };
      }
    | undefined;
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
