/** 1.2K / 3.4M style counts (Intl compact notation isn't reliable on Hermes). */
export function compact(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0).replace(/\.0$/, "")}K`;
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
}

/** Public link for a drop (what "Copy link" puts on the clipboard). */
export function dropLink(dropId: string) {
  return `https://rebanter.app/d/${dropId}`;
}

const TAKE_THEMES = [
  { bg: "#7B5CFF", ink: "#FFFFFF" },
  { bg: "#FF5C39", ink: "#0C0C0E" },
  { bg: "#1FB7A6", ink: "#0C0C0E" },
  { bg: "#F2C94C", ink: "#0C0C0E" },
  { bg: "#3E7BFA", ink: "#FFFFFF" },
  { bg: "#FF7AB6", ink: "#0C0C0E" },
];

/** Stable card colour for a hot take, picked from its id. */
export function takeTheme(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return TAKE_THEMES[h % TAKE_THEMES.length];
}
