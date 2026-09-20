export type TabParamList = {
  Stream: undefined;
  Roam: undefined;
  Pulse: undefined;
  Me: undefined;
};

export type RootStackParamList = {
  Tabs: undefined;
  LoopsPlayer: { loopId: string };
  Banters: undefined;
  BanterThread: { banterId: string; handle: string };
  NewDrop: undefined;
  Settings: undefined;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
