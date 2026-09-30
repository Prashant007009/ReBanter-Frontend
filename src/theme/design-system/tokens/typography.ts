/**
 * Typography tokens.
 *
 * Source: Figma node 3:1003, section "3. Typography Scale".
 *
 * Font families in the style guide are named generically ("Space Grotesk",
 * "DM Sans"). This project already depends on `@expo-google-fonts/space-grotesk`
 * and `@expo-google-fonts/dm-sans` (see package.json) — those packages expose
 * font keys of the form `{Family}_{weight}{Style}` (e.g. `SpaceGrotesk_700Bold`),
 * which is the naming convention `fontFamily` below follows so tokens can be
 * passed straight into a React Native `TextStyle` once the fonts are loaded
 * with `expo-font`'s `useFonts`.
 *
 * The style guide sets every sample to CSS `line-height: normal` (i.e. no
 * explicit line-height override) — no numeric line-height is defined in the
 * source, so none is fabricated here. Add `lineHeight` per-scale-step only
 * once design specifies one.
 */

export const fontFamilies = {
  heading: "Space Grotesk",
  body: "DM Sans",
} as const;

/**
 * Concrete font keys as loaded by @expo-google-fonts/space-grotesk and
 * @expo-google-fonts/dm-sans, limited to the weights actually used in the
 * style guide (headings: Bold only; body: Regular, Medium, SemiBold).
 */
export const fontWeights = {
  headingBold: "SpaceGrotesk_700Bold",
  bodyRegular: "DMSans_400Regular",
  bodyMedium: "DMSans_500Medium",
  bodySemiBold: "DMSans_600SemiBold",
} as const;

export const typeScale = {
  displayLarge: { fontSize: 40, fontFamily: fontWeights.headingBold },
  headingH1: { fontSize: 28, fontFamily: fontWeights.headingBold },
  headingH2: { fontSize: 22, fontFamily: fontWeights.headingBold },
  bodyLarge: { fontSize: 18, fontFamily: fontWeights.bodyMedium },
  bodyMedium: { fontSize: 16, fontFamily: fontWeights.bodyRegular },
  bodySmall: { fontSize: 14, fontFamily: fontWeights.bodyMedium },
  captionBold: { fontSize: 12, fontFamily: fontWeights.bodySemiBold },
  captionTiny: { fontSize: 10, fontFamily: fontWeights.bodyMedium },
} as const;

export type TypeScaleToken = keyof typeof typeScale;
export type FontWeightToken = keyof typeof fontWeights;
