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

  accent: "#5B3CFF",
  accentPressed: "#4B2FE0",
  accentTint: "#EDE8FF",

  cheer: "#E2542F",
  cheerTint: "#FDEDE7",
  success: "#3BBF7C",
  danger: "#C43B2E",
  messageBadge: "#0078AA",
  chevronMuted: "rgba(23,20,18,0.32)",
  chipMuted: "rgba(23,20,18,0.06)",
  divider: "rgba(23,20,18,0.08)",
  dashedBorder: "rgba(23,20,18,0.24)",
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
