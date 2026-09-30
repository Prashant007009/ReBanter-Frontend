/**
 * Border radius scale tokens.
 *
 * Source: Figma node 3:1003, section "5. Border Radius".
 *
 * Note on `full`: the style guide's "full/999" card renders with a
 * `border-radius: 999px` swatch (a pill/fully-rounded corner), but its label
 * text reads "40px" — smaller than `2xl` (28px) despite being the largest
 * named step, and inconsistent with the swatch's own rounded-full rendering.
 * This is almost certainly an authoring mistake in the Figma frame (the label
 * was likely never updated after the swatch was set to a pill radius). This
 * generator trusts the rendered pill shape over the mislabeled text and uses
 * 9999 — the conventional "fully rounded" sentinel — for `full`. Confirm with
 * design before relying on a literal 40px for this token.
 */

export const radius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 22,
  "2xl": 28,
  full: 9999,
} as const;

export type RadiusToken = keyof typeof radius;
export type RadiusValue = (typeof radius)[RadiusToken];
