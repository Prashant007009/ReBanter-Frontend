import type { ReactNode } from "react";
import { View } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";
import { stream } from "@/theme/colors";

/**
 * Rounded-square ring around a Moment avatar: one lime segment per unseen
 * frame (split by small gaps), a single grey ring once everything's seen,
 * nothing when there are no moments.
 */
export function MomentRing({
  size,
  radius,
  frames,
  seen,
  thickness = 3,
  children,
}: {
  size: number;
  radius: number;
  frames: number;
  seen: boolean;
  thickness?: number;
  children: ReactNode;
}) {
  if (frames === 0) return <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>{children}</View>;
  const color = seen ? stream.ringSeen : stream.lime;
  const inset = thickness / 2;
  const w = size - thickness;
  const r = Math.max(radius - inset, 0);

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ position: "absolute" }}>
        {seen || frames < 2 ? (
          <Rect x={inset} y={inset} width={w} height={w} rx={r} fill="none" stroke={color} strokeWidth={thickness} />
        ) : (
          segments(inset, w, r, frames).map((d, i) => <Path key={i} d={d} fill="none" stroke={color} strokeWidth={thickness} strokeLinecap="round" />)
        )}
      </Svg>
      {children}
    </View>
  );
}

// Split the rounded-rect perimeter into `n` arcs with gaps, starting top-centre.
function segments(o: number, w: number, r: number, n: number): string[] {
  const straight = w - 2 * r;
  const corner = (Math.PI / 2) * r;
  const perimeter = 4 * straight + 4 * corner;
  const gap = Math.min(6, perimeter / n / 3);
  const seg = perimeter / n;
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const from = i * seg + gap / 2;
    const to = (i + 1) * seg - gap / 2;
    const pts: string[] = [];
    const steps = Math.max(8, Math.ceil((to - from) / 2));
    for (let s = 0; s <= steps; s++) {
      const [x, y] = pointAt(o, w, r, straight, corner, from + ((to - from) * s) / steps);
      pts.push(`${s === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`);
    }
    out.push(pts.join(" "));
  }
  return out;
}

// Walk clockwise from the top-centre of the rounded rect.
function pointAt(o: number, w: number, r: number, straight: number, corner: number, dist: number): [number, number] {
  const half = straight / 2;
  const legs: { len: number; at: (t: number) => [number, number] }[] = [
    { len: half, at: (t) => [o + w / 2 + t, o] },
    { len: corner, at: (t) => arc(o + w - r, o + r, r, -Math.PI / 2 + t / r) },
    { len: straight, at: (t) => [o + w, o + r + t] },
    { len: corner, at: (t) => arc(o + w - r, o + w - r, r, t / r) },
    { len: straight, at: (t) => [o + w - r - t, o + w] },
    { len: corner, at: (t) => arc(o + r, o + w - r, r, Math.PI / 2 + t / r) },
    { len: straight, at: (t) => [o, o + w - r - t] },
    { len: corner, at: (t) => arc(o + r, o + r, r, Math.PI + t / r) },
    { len: half, at: (t) => [o + r + t, o] },
  ];
  let left = dist;
  for (const leg of legs) {
    if (left <= leg.len) return leg.at(left);
    left -= leg.len;
  }
  return legs[legs.length - 1].at(legs[legs.length - 1].len);
}

function arc(cx: number, cy: number, r: number, angle: number): [number, number] {
  return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
}
