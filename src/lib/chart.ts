/** Scaling and formatting for the dashboard charts (hand-rolled SVG, no charting library). */

/** A time range of the picker. */
export interface RangeOption {
  id: string;
  label: string;
  secs: number;
}

export const RANGES: readonly RangeOption[] = [
  { id: '15m', label: '15 min', secs: 15 * 60 },
  { id: '1h', label: '1 h', secs: 3600 },
  { id: '6h', label: '6 h', secs: 6 * 3600 },
  { id: '24h', label: '24 h', secs: 24 * 3600 },
];

/** Points asked from the server (it merges longer ranges into buckets). */
export const MAX_POINTS = 600;

/** How often a range is reloaded: every sample interval for short ranges, slower for long ones. */
export function pollMs(rangeSecs: number, sampleSecs = 5): number {
  return Math.min(60_000, Math.max(sampleSecs * 1000, Math.round((rangeSecs * 1000) / MAX_POINTS)));
}

/** A linear map from a domain to a range. Values outside are extrapolated. */
export function linear(domain: [number, number], range: [number, number]): (x: number) => number {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const span = d1 - d0;
  if (span === 0) return () => (r0 + r1) / 2;
  return (x) => r0 + ((x - d0) / span) * (r1 - r0);
}

/** The smallest "nice" number (1, 2, 2.5, 5 times a power of ten) at or above `v`; 1 for v <= 0. */
export function niceCeil(v: number): number {
  if (!(v > 0) || !Number.isFinite(v)) return 1;
  const exp = Math.floor(Math.log10(v));
  const base = 10 ** exp;
  for (const m of [1, 2, 2.5, 5, 10]) {
    if (m * base >= v - base * 1e-9) return m * base;
  }
  return 10 * base;
}

/** Ticks from 0 up to a nice maximum above `max`: `{ticks, top}` (the axis is 0..top). */
export function yTicks(max: number, count = 4): { ticks: number[]; top: number } {
  const top = niceCeil(max / count) * count;
  const step = top / count;
  return { ticks: Array.from({ length: count + 1 }, (_, i) => +(i * step).toFixed(10)), top };
}

/** Clock-aligned time steps that keep about `count` ticks in a range, in ms. */
const TIME_STEPS_MS = [
  10_000, 30_000, 60_000, 5 * 60_000, 10 * 60_000, 15 * 60_000, 30 * 60_000, 3_600_000, 2 * 3_600_000,
  3 * 3_600_000, 6 * 3_600_000, 12 * 3_600_000, 86_400_000,
];

/** Tick times (ms) inside `[from, to]`, aligned to the local clock; `offsetMs` is the zone's offset. */
export function timeTicks(from: number, to: number, count = 5, offsetMs = 0): number[] {
  const span = to - from;
  if (!(span > 0)) return [];
  const want = span / count;
  const step = TIME_STEPS_MS.find((s) => s >= want) ?? TIME_STEPS_MS[TIME_STEPS_MS.length - 1]!;
  const first = Math.ceil((from + offsetMs) / step) * step - offsetMs;
  const out: number[] = [];
  for (let t = first; t <= to; t += step) out.push(t);
  return out;
}

/** `HH:MM` (with seconds for short spans), in local time. */
export function formatClock(t: number, withSeconds = false): string {
  const d = new Date(t);
  const p = (n: number) => String(n).padStart(2, '0');
  return withSeconds ? `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}` : `${p(d.getHours())}:${p(d.getMinutes())}`;
}

export interface XY {
  t: number;
  v: number | null;
}

/** An SVG path through the points; a `null` value breaks the line. */
export function linePath(points: readonly XY[], x: (t: number) => number, y: (v: number) => number): string {
  let d = '';
  let pen = false;
  for (const p of points) {
    if (p.v === null || !Number.isFinite(p.v)) {
      pen = false;
      continue;
    }
    d += `${pen ? 'L' : 'M'}${x(p.t).toFixed(1)} ${y(p.v).toFixed(1)}`;
    pen = true;
  }
  return d;
}

/** The area under the line down to `baseline` (a pixel y); gaps close their own shapes. */
export function areaPath(points: readonly XY[], x: (t: number) => number, y: (v: number) => number, baseline: number): string {
  let d = '';
  let run: XY[] = [];
  const flush = () => {
    if (run.length > 0) {
      const first = run[0]!;
      const last = run[run.length - 1]!;
      d += `M${x(first.t).toFixed(1)} ${baseline.toFixed(1)}`;
      for (const p of run) d += `L${x(p.t).toFixed(1)} ${y(p.v as number).toFixed(1)}`;
      d += `L${x(last.t).toFixed(1)} ${baseline.toFixed(1)}Z`;
    }
    run = [];
  };
  for (const p of points) {
    if (p.v === null || !Number.isFinite(p.v)) flush();
    else run.push(p);
  }
  flush();
  return d;
}

/** The index of the point nearest in time to `t` (points sorted by time); -1 when empty. */
export function nearestIndex(times: readonly number[], t: number): number {
  if (times.length === 0) return -1;
  let lo = 0;
  let hi = times.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (times[mid]! < t) lo = mid + 1;
    else hi = mid;
  }
  if (lo > 0 && Math.abs(times[lo - 1]! - t) <= Math.abs(times[lo]! - t)) return lo - 1;
  return lo;
}

export function formatBytes(n: number): string {
  if (!(n > 0)) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v >= 100 || i === 0 ? v.toFixed(0) : v.toFixed(1)} ${units[i]}`;
}

/** Microseconds as `850 us` or `1.4 ms`. */
export function formatMicros(us: number): string {
  if (us < 1000) return `${Math.round(us)} µs`;
  const ms = us / 1000;
  return `${ms >= 100 ? ms.toFixed(0) : ms.toFixed(1)} ms`;
}

export function formatPercent(v: number): string {
  return `${v >= 100 ? v.toFixed(0) : v.toFixed(1)}%`;
}

export function formatCount(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}
