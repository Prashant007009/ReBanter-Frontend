/**
 * Reference font-loading map for `expo-font`'s `useFonts` hook.
 *
 * The style guide's two families (Space Grotesk for headings, DM Sans for
 * body/system text) already have matching packages in this project's
 * dependencies: `@expo-google-fonts/space-grotesk` and
 * `@expo-google-fonts/dm-sans`. This module only re-exports the specific
 * weight imports the type scale in `tokens/typography.ts` actually uses —
 * it does not call `useFonts` itself, since that is an app-bootstrap
 * concern (e.g. `App.tsx`), not something a design-system module should
 * do as a side effect.
 *
 * Integration note: at generation time, `App.tsx` does not call `useFonts`
 * anywhere in this project, even though the font packages are already a
 * dependency. Text styled with the `fontFamily` keys in
 * `tokens/typography.ts` (e.g. `SpaceGrotesk_700Bold`) will silently fall
 * back to the OS default font on native until those fonts are loaded. Wire
 * this map into `useFonts` at the app root when ready:
 *
 * ```tsx
 * import { useFonts } from "expo-font";
 * import { fontsToLoad } from "@/theme/design-system/fontLoader";
 *
 * const [fontsLoaded] = useFonts(fontsToLoad);
 * ```
 */
import { SpaceGrotesk_700Bold } from "@expo-google-fonts/space-grotesk";
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
} from "@expo-google-fonts/dm-sans";

export const fontsToLoad = {
  SpaceGrotesk_700Bold,
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
} as const;
