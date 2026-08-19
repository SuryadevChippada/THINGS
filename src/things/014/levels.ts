/**
 * A corridor is a path, not a row of boxes.
 *
 * Each level is a polyline with a width at every point, so the safe area
 * is "within half a width of the centreline". That gives smooth bends and
 * corridors that taper to a squeeze, and it makes collision exact: one
 * point-to-segment distance rather than a pile of rectangle tests.
 *
 * Coordinates are 0–1 of the viewport. Widths are a fraction of the
 * smaller viewport dimension, so a level plays the same on any screen.
 */
export interface Node {
  x: number;
  y: number;
  w: number;
}

export interface Level {
  name: string;
  nodes: Node[];
}

/** An inward spiral, which is unpleasant in a way straight lines are not. */
function spiral(turns: number, from: number, to: number, w0: number, w1: number): Node[] {
  const nodes: Node[] = [];
  const steps = Math.round(turns * 26);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const angle = t * turns * Math.PI * 2;
    const r = from + (to - from) * t;
    nodes.push({
      x: 0.5 + Math.cos(angle) * r,
      y: 0.5 + Math.sin(angle) * r * 1.05,
      w: w0 + (w1 - w0) * t,
    });
  }
  return nodes;
}

/** A long shallow wave. Easy to see, hard to hold. */
function wave(cycles: number, amp: number, w: number): Node[] {
  const nodes: Node[] = [];
  const steps = 48;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    nodes.push({
      x: 0.08 + t * 0.84,
      y: 0.5 + Math.sin(t * cycles * Math.PI * 2) * amp,
      // a touch wider at the two ends, so starting and finishing is fair
      w: w * (1 + 2.6 * Math.max(0, 0.12 - Math.min(t, 1 - t)) * 8),
    });
  }
  return nodes;
}

export const LEVELS: Level[] = [
  {
    name: "warm up",
    nodes: [
      { x: 0.12, y: 0.5, w: 0.115 },
      { x: 0.5, y: 0.5, w: 0.105 },
      { x: 0.88, y: 0.5, w: 0.115 },
    ],
  },
  {
    name: "the bend",
    nodes: [
      { x: 0.12, y: 0.78, w: 0.1 },
      { x: 0.34, y: 0.78, w: 0.082 },
      { x: 0.44, y: 0.74, w: 0.075 },
      { x: 0.48, y: 0.62, w: 0.072 },
      { x: 0.48, y: 0.36, w: 0.072 },
      { x: 0.53, y: 0.25, w: 0.075 },
      { x: 0.64, y: 0.21, w: 0.082 },
      { x: 0.88, y: 0.21, w: 0.1 },
    ],
  },
  {
    name: "the zigzag",
    nodes: [
      { x: 0.1, y: 0.3, w: 0.085 },
      { x: 0.26, y: 0.3, w: 0.068 },
      { x: 0.38, y: 0.68, w: 0.062 },
      { x: 0.5, y: 0.3, w: 0.062 },
      { x: 0.62, y: 0.68, w: 0.062 },
      { x: 0.74, y: 0.3, w: 0.068 },
      { x: 0.9, y: 0.3, w: 0.085 },
    ],
  },
  {
    name: "the pinch",
    nodes: [
      { x: 0.1, y: 0.5, w: 0.1 },
      { x: 0.3, y: 0.5, w: 0.078 },
      { x: 0.4, y: 0.5, w: 0.03 },
      { x: 0.5, y: 0.5, w: 0.03 },
      { x: 0.6, y: 0.5, w: 0.075 },
      { x: 0.72, y: 0.5, w: 0.026 },
      { x: 0.8, y: 0.5, w: 0.026 },
      { x: 0.9, y: 0.5, w: 0.1 },
    ],
  },
  {
    name: "the switchback",
    nodes: [
      { x: 0.1, y: 0.16, w: 0.075 },
      { x: 0.78, y: 0.16, w: 0.05 },
      { x: 0.88, y: 0.22, w: 0.045 },
      { x: 0.88, y: 0.34, w: 0.045 },
      { x: 0.78, y: 0.4, w: 0.05 },
      { x: 0.22, y: 0.4, w: 0.042 },
      { x: 0.12, y: 0.47, w: 0.038 },
      { x: 0.12, y: 0.58, w: 0.038 },
      { x: 0.22, y: 0.64, w: 0.042 },
      { x: 0.8, y: 0.64, w: 0.04 },
      { x: 0.88, y: 0.72, w: 0.05 },
      { x: 0.88, y: 0.84, w: 0.075 },
    ],
  },
  {
    name: "the comb",
    nodes: [
      { x: 0.08, y: 0.5, w: 0.07 },
      { x: 0.16, y: 0.16, w: 0.04 },
      { x: 0.24, y: 0.84, w: 0.038 },
      { x: 0.34, y: 0.16, w: 0.036 },
      { x: 0.44, y: 0.84, w: 0.034 },
      { x: 0.54, y: 0.16, w: 0.034 },
      { x: 0.64, y: 0.84, w: 0.034 },
      { x: 0.74, y: 0.16, w: 0.036 },
      { x: 0.84, y: 0.5, w: 0.042 },
      { x: 0.92, y: 0.5, w: 0.07 },
    ],
  },
  {
    name: "the drain",
    nodes: spiral(2, 0.33, 0.07, 0.05, 0.03),
  },
  {
    name: "the stutter",
    nodes: [
      { x: 0.08, y: 0.5, w: 0.08 },
      { x: 0.18, y: 0.5, w: 0.022 },
      { x: 0.26, y: 0.5, w: 0.07 },
      { x: 0.34, y: 0.5, w: 0.02 },
      { x: 0.42, y: 0.5, w: 0.065 },
      { x: 0.5, y: 0.5, w: 0.018 },
      { x: 0.58, y: 0.5, w: 0.06 },
      { x: 0.66, y: 0.5, w: 0.018 },
      { x: 0.74, y: 0.5, w: 0.055 },
      { x: 0.82, y: 0.5, w: 0.016 },
      { x: 0.92, y: 0.5, w: 0.08 },
    ],
  },
  {
    name: "the needle",
    nodes: wave(3.5, 0.2, 0.021),
  },
  {
    name: "the last one",
    nodes: [
      { x: 0.07, y: 0.5, w: 0.06 },
      { x: 0.16, y: 0.5, w: 0.018 },
      { x: 0.24, y: 0.22, w: 0.016 },
      { x: 0.34, y: 0.78, w: 0.015 },
      { x: 0.44, y: 0.22, w: 0.015 },
      { x: 0.5, y: 0.5, w: 0.014 },
      { x: 0.56, y: 0.78, w: 0.015 },
      { x: 0.66, y: 0.22, w: 0.015 },
      { x: 0.76, y: 0.78, w: 0.016 },
      { x: 0.86, y: 0.5, w: 0.02 },
      { x: 0.94, y: 0.5, w: 0.06 },
    ],
  },
];

/**
 * How close to the wall you are, at a point.
 * Returns 0 at the centreline and 1 exactly on the wall — over 1 is a
 * touch. Also reports the local half-width, for drawing.
 */
export function proximity(
  px: number,
  py: number,
  nodes: Node[],
  w: number,
  h: number,
  unit: number,
): { ratio: number; half: number } {
  let best = Infinity;
  let bestHalf = 1;

  for (let i = 0; i < nodes.length - 1; i++) {
    const a = nodes[i];
    const b = nodes[i + 1];
    const ax = a.x * w;
    const ay = a.y * h;
    const bx = b.x * w;
    const by = b.y * h;

    const dx = bx - ax;
    const dy = by - ay;
    const lenSq = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));

    const cx = ax + dx * t;
    const cy = ay + dy * t;
    const dist = Math.hypot(px - cx, py - cy);
    // width tapers along the segment, so the squeeze is gradual
    const half = ((a.w + (b.w - a.w) * t) * unit) / 2;
    const ratio = dist / half;

    if (ratio < best) {
      best = ratio;
      bestHalf = half;
    }
  }

  return { ratio: best, half: bestHalf };
}
