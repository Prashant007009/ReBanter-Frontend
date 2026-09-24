// Design tokens — cream/white brand theme (source: Figma "reb-stream", node 4:9).
// Roles: canvas = the app's flat-white base (every screen's bg); surface/
// surfaceRaised/surfaceWarm/surfaceSecondary are the off-white cards and bars
// that sit on top of it. `ink` is the near-black text/icon color used
// everywhere on that light base. `onDark*` tokens are kept for text/icons
// placed on a genuinely dark surface (image overlays, filled buttons) — with
// a white canvas they're pointed at the same values as their `ink*`
// counterparts so every screen stays legible.
export const colors = {
  canvas: "#FFFFFF",
  surface: "#F7F4EF",
  surfaceRaised: "#FFFDFA",
  surfaceWarm: "#F7F3E9",
  surfaceSecondary: "#F2F2F7",
  canvasGradientColors: ["#FFFFFF", "#FFFFFF"],

  ink: "#171412",
  inkMuted: "#7C7670",
  inkFaint: "rgba(23,20,18,0.45)",
  inkSubtle: "rgba(23,20,18,0.58)",

  onDark: "#171412",
  onDarkMuted: "#7C7670",
  onDarkFaint: "rgba(23,20,18,0.45)",
  onDarkHairline: "#E1DAD0",

  hairline: "#E1DAD0",
  hairlineStrong: "rgba(23,20,18,0.18)",
  hairlineSoft: "rgba(23,20,18,0.08)",

  accent: "#4F378A",
  accentPressed: "#3D2A6E",
  accentTint: "#EDE7F7",

  cheer: "#E2542F",
  cheerTint: "#FDEDE7",
  success: "#3BBF7C",
  danger: "#C43B2E",
  chevronMuted: "rgba(23,20,18,0.32)",
  chipMuted: "rgba(23,20,18,0.06)",
  divider: "rgba(23,20,18,0.08)",
  dashedBorder: "rgba(23,20,18,0.24)",
} as const;

// Direct-message thread palette — the chat screen is dark with lime "mine"
// bubbles (source: claude.ai design "Rebanter Chat"), independent of the
// light app theme above.
export const chat = {
  bg: "#0C0C0E",
  ink: "#F5F3EF",
  inkMuted: "#9A98A2",
  inkSoft: "#B9B7C0",
  hairline: "#1C1C21",
  bubbleTheirs: "#222228",
  bubbleMine: "#C8F169",
  onMine: "#0C0C0E",
  onMineMuted: "#44511A",
  readTick: "#1F4FE0",
  field: "#18181C",
  fieldBorder: "#26262C",
  tray: "#131316",
  trayBorder: "#222228",
  chip: "#222228",
  chipActive: "#2A2A31",
  popBorder: "#34343B",
  popMore: "#2E2E35",
  dot: "#C9C7CF",
  peer: "#FF8A5B",
  danger: "#FF6B6B",
} as const;

// Fixed mark colors for the app icon and launch splash — the ReBanter
// logomark predates the in-app navy retheme and keeps its original
// violet/ember/bone palette regardless of `colors` above.
export const brand = {
  violet: "#5B3CFF",
  bone: "#F7F4EF",
} as const;

export const fonts = {
  display: "SpaceGrotesk_700Bold",
  displaySemibold: "SpaceGrotesk_600SemiBold",
  body: "DMSans_400Regular",
  bodyMedium: "DMSans_500Medium",
  bodySemibold: "DMSans_600SemiBold",
  bodyBold: "DMSans_700Bold",
} as const;
