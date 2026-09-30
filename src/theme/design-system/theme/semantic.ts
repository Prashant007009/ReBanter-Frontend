import { colorPrimitives } from "../tokens/colors";

/**
 * Semantic color tokens — the "what it's for" layer that maps onto color
 * primitives, so screens reference intent (`text.primary`) rather than a raw
 * palette step (`neutral900`).
 *
 * Source: Figma node 3:1003, section "2. Semantic Colors". This is the only
 * mode defined in the style guide — no dark-mode column or variant frame was
 * present, so only a light theme is generated. Add a `dark` sibling object
 * here (same shape) once Figma defines dark-mode semantic mappings; do not
 * invent dark values in the meantime.
 */
export const semanticColorsLight = {
  background: {
    primary: colorPrimitives.cream, // background/primary -> cream
    secondary: colorPrimitives.neutral50, // background/secondary -> neutral/50
  },
  text: {
    primary: colorPrimitives.neutral900, // text/primary -> neutral/900
    secondary: colorPrimitives.neutral600, // text/secondary -> neutral/600
  },
  surface: {
    card: colorPrimitives.white, // surface/card -> white
  },
  brand: {
    primary: colorPrimitives.purple500, // brand/primary -> purple/500
    secondary: colorPrimitives.purple100, // brand/secondary -> purple/100
  },
  accent: {
    primary: colorPrimitives.coral500, // accent/primary -> coral/500
    secondary: colorPrimitives.coral100, // accent/secondary -> coral/100
  },
  success: colorPrimitives.green500, // success -> green/500
  border: {
    default: colorPrimitives.neutral200, // border/default -> neutral/200
  },
} as const;

export type SemanticColors = typeof semanticColorsLight;
