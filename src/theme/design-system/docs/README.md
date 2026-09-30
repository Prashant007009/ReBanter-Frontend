# Design System — generated from Figma

Generated non-interactively by the Design Keeper from the Figma style guide
frame at:

- File key: `U06e4NQVyjFgJhDN8dAlKO`
- Node: `3:1003` ("design-tokens")
- URL: https://www.figma.com/design/U06e4NQVyjFgJhDN8dAlKO/Untitled?node-id=3-1003

## What was extracted

The frame is a single style-guide page with five sections and no bound Figma
Variables (`get_variable_defs` returned an empty set) — every value below was
read directly from the layer fills/text in `get_design_context`.

| Category | Count | Source section |
|---|---|---|
| Color primitives | 12 | 1. Color Primitives |
| Semantic color tokens | 11 | 2. Semantic Colors |
| Font families | 2 | 3. Typography Scale |
| Type scale steps | 8 | 3. Typography Scale |
| Spacing steps | 9 | 4. Spacing Scale |
| Radius steps | 6 | 5. Border Radius |

No effects/shadow section and no dark-mode variant frame were present in the
style guide, so no elevation tokens or dark theme were generated. Add them
once Figma defines them — do not fabricate values here.

## Framework detection

This is an Expo / React Native project (`expo ~51`, `react-native 0.74.5`),
not a web app. `package.json` was checked for CSS/styling approaches:

- No `nativewind`, `tailwindcss`, `styled-components`, `tamagui`, or
  `react-native-paper` — no CSS-in-JS or utility-class framework is installed.
- The project already styles with plain React Native `StyleSheet` (see
  `src/screens/*.tsx`, `src/components/*.tsx`).
- Fonts are loaded via `@expo-google-fonts/space-grotesk` and
  `@expo-google-fonts/dm-sans` — which happen to be exactly the two families
  in the Figma style guide's "Font Families" row (Space Grotesk / DM Sans),
  confirming this style guide corresponds to this app.

Given that, this generator produced **plain TypeScript token objects**
(`tokens/*.ts`, `theme/*.ts`) meant to be imported directly into
`StyleSheet.create()` calls or inline `style` props — there is no CSS output,
Tailwind config, or ThemeProvider, since none of those apply to this stack.

## Files written

```
src/theme/design-system/
  tokens/
    colors.ts        primitive color tokens (colorPrimitives)
    spacing.ts        spacing scale (spacing)
    radius.ts          border radius scale (radius)
    typography.ts     font families, weight->key map, type scale
    index.ts            re-exports the above
  theme/
    semantic.ts        semantic color mapping onto primitives (light only)
    theme.ts             combined `theme` object (colors+semantics+spacing+radius+typography)
    index.ts
  fontLoader.ts        reference `useFonts` map for the two Google Font families
  index.ts               barrel export for the whole design system
  docs/README.md      this file
```

## Relationship to the existing `src/theme/colors.ts`

The project already has a hand-authored `src/theme/colors.ts` (comment: "pulled
from ReBanter Screens.dc.html — visual pass two — warm bone canvas") that is
actively imported by existing screens/components. It overlaps with, but does
not exactly match, the Figma style guide's canonical values:

| Token intent | Existing `colors.ts` | Figma style guide (this generation) |
|---|---|---|
| Brand/accent purple | `accent: #5B3CFF` | `purple500: #5B3CFF` — matches |
| Cheer/coral accent | `cheer: #E2542F` | `coral500: #E2542F` — matches |
| Primary text | `ink: #171412` | `neutral900: #171412` — matches |
| Raised surface | `surfaceRaised: #FFFDFA` | `cream: #FFFDFA` — matches |
| Canvas/background | `canvas: #E9E4DC` | no equivalent primitive in the style guide (closest is `neutral50: #FBF9F5`, a different warmth) |
| Success | `success: #3BBF7C` | `green500: #10B981` — **differs** |
| Muted text | `inkMuted: #7B756C` | `neutral600: #7D7571` — close but not identical |

This generation was scoped to `src/theme/design-system/` only, per the
target directory supplied for this run, so `src/theme/colors.ts` was left
untouched. Before wiring screens to the new tokens, decide with design
whether `colors.ts` should be superseded by `design-system/theme/theme.ts`
or whether the style guide needs a follow-up pass to reconcile `canvas` and
`success`, since those two do not currently map onto anything in the Figma
style guide.

## Known data-quality note

The `full` radius token ("full/999") in the style guide renders as a fully
pill-shaped swatch (Tailwind class `rounded-[999px]` in the extracted code)
but its label text reads "40px" — smaller than the preceding `2xl` step
(28px is smaller, but 40px is an implausible literal for a token whose whole
purpose is "no visible corner radius at any size"). Treated as a mislabeled
frame rather than a real value; `radius.full` is set to the conventional
`9999` sentinel instead of the literal label. Flag with design if that
assumption is wrong.

## Non-interactive run

This generation ran under `--non-interactive`: target directory, framework
detection, Figma access, and artifact writing were all pre-authorized by the
delegation prompt, so no clarifying questions were asked and all artifacts
were written directly.
