<script lang="ts" module>
  export interface Series {
    id: string;
    label: string;
    /** A CSS colour, normally one of the theme tokens: `var(--accent)`. */
    color: string;
    /** One value per time, `null` where there is none (draws a gap). */
    values: (number | null)[];
    dashed?: boolean;
    /** Fill under the line. */
    area?: boolean;
  }
</script>

<script lang="ts">
  import { areaPath, formatClock, linePath, linear, nearestIndex, timeTicks, yTicks } from '../chart';

  let {
    times,
    series,
    format,
    from,
    to,
    label,
    height = 170,
  }: {
    times: number[];
    series: Series[];
    /** Writes a value for the axis and the tooltip. */
    format: (v: number) => string;
    /** The time window drawn (ms). Default: the first to the last time. */
    from?: number;
    to?: number;
    /** What the chart shows, for screen readers. */
    label: string;
    height?: number;
  } = $props();

  const PAD = { l: 52, r: 12, t: 10, b: 24 };
  let width = $state(640);
  let hover = $state<number | null>(null);

  const x0 = $derived(from ?? times[0] ?? 0);
  const x1 = $derived(to ?? times[times.length - 1] ?? 1);
  const innerW = $derived(Math.max(10, width - PAD.l - PAD.r));
  const innerH = $derived(height - PAD.t - PAD.b);
  const maxValue = $derived(Math.max(0, ...series.flatMap((s) => s.values.filter((v): v is number => v !== null && Number.isFinite(v)))));
  const y = $derived(yTicks(maxValue));
  const sx = $derived(linear([x0, x1 > x0 ? x1 : x0 + 1], [PAD.l, PAD.l + innerW]));
  const sy = $derived(linear([0, y.top], [PAD.t + innerH, PAD.t]));
  const offset = $derived(-new Date(x0).getTimezoneOffset() * 60_000);
  const xTicks = $derived(timeTicks(x0, x1, Math.max(2, Math.floor(innerW / 90)), offset));
  const showSeconds = $derived(x1 - x0 <= 20 * 60_000);
  const drawn = $derived(
    series.map((s) => {
      const pts = times.map((t, i) => ({ t, v: s.values[i] ?? null }));
      return { s, line: linePath(pts, sx, sy), area: s.area ? areaPath(pts, sx, sy, PAD.t + innerH) : '' };
    }),
  );
  const empty = $derived(times.length === 0);

  function at(e: PointerEvent) {
    const svg = e.currentTarget as SVGElement;
    const r = svg.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * width;
    const t = x0 + ((px - PAD.l) / innerW) * (x1 - x0);
    const i = nearestIndex(times, t);
    hover = i >= 0 && px >= PAD.l - 4 && px <= PAD.l + innerW + 4 ? i : null;
  }

  function key(e: KeyboardEvent) {
    if (empty) return;
    if (e.key === 'ArrowLeft') hover = Math.max(0, (hover ?? times.length) - 1);
    else if (e.key === 'ArrowRight') hover = Math.min(times.length - 1, (hover ?? -1) + 1);
    else if (e.key === 'Escape') hover = null;
    else return;
    e.preventDefault();
  }

  const tip = $derived(hover === null ? null : { i: hover, left: sx(times[hover]!) });
  const summary = $derived(
    empty
      ? `${label}: no data yet`
      : `${label}: ${series
          .map((s) => {
            const last = [...s.values].reverse().find((v) => v !== null);
            return `${s.label} ${last === undefined || last === null ? 'no value' : format(last)} now`;
          })
          .join(', ')}`,
  );
</script>

<div class="chart" bind:clientWidth={width}>
  <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
  <svg
    {width}
    {height}
    viewBox="0 0 {width} {height}"
    role="img"
    aria-label={summary}
    tabindex="0"
    onpointermove={at}
    onpointerleave={() => (hover = null)}
    onkeydown={key}
    onblur={() => (hover = null)}
  >
    {#each y.ticks as t (t)}
      <line class="grid" x1={PAD.l} x2={PAD.l + innerW} y1={sy(t)} y2={sy(t)} />
      <text class="tick" x={PAD.l - 8} y={sy(t)} text-anchor="end" dominant-baseline="middle">{format(t)}</text>
    {/each}
    {#each xTicks as t (t)}
      <text class="tick" x={sx(t)} y={height - 6} text-anchor="middle">{formatClock(t, showSeconds)}</text>
    {/each}
    {#if empty}
      <text class="none" x={PAD.l + innerW / 2} y={PAD.t + innerH / 2} text-anchor="middle">No data yet</text>
    {/if}
    {#each drawn as d (d.s.id)}
      {#if d.area}<path class="area" d={d.area} style:fill={d.s.color} />{/if}
      <path class="line" class:dashed={d.s.dashed} d={d.line} style:stroke={d.s.color} />
    {/each}
    {#if tip}
      <line class="cursor" x1={tip.left} x2={tip.left} y1={PAD.t} y2={PAD.t + innerH} />
      {#each series as s (s.id)}
        {@const v = s.values[tip.i]}
        {#if v !== null && v !== undefined}<circle cx={tip.left} cy={sy(v)} r="3.5" style:fill={s.color} />{/if}
      {/each}
    {/if}
  </svg>
  {#if series.length > 1}
    <ul class="legend" aria-hidden="true">
      {#each series as s (s.id)}
        <li><i class:dash={s.dashed} style:background={s.dashed ? 'none' : s.color} style:color={s.color}></i>{s.label}</li>
      {/each}
    </ul>
  {/if}
  {#if tip}
    <div class="chart-tip" class:flip={tip.left > width * 0.6} style:left="{tip.left}px" role="status">
      <b>{formatClock(times[tip.i]!, true)}</b>
      {#each series as s (s.id)}
        {@const v = s.values[tip.i]}
        <span><i style:background={s.color}></i>{s.label} <b>{v === null || v === undefined ? '-' : format(v)}</b></span>
      {/each}
    </div>
  {/if}
</div>

<style>
  .chart { position: relative; width: 100%; }
  svg { display: block; width: 100%; overflow: visible; touch-action: pan-y; border-radius: 6px; }
  svg:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
  .grid { stroke: var(--line-soft); stroke-width: 1; }
  .tick { fill: var(--faint); font-size: 10.5px; font-variant-numeric: tabular-nums; }
  .none { fill: var(--faint); font-size: 12.5px; }
  .line { fill: none; stroke-width: 1.8; stroke-linejoin: round; stroke-linecap: round; }
  .line.dashed { stroke-dasharray: 5 4; stroke-width: 1.5; }
  .area { opacity: 0.14; }
  .cursor { stroke: var(--faint); stroke-width: 1; stroke-dasharray: 3 3; }
  .legend { display: flex; flex-wrap: wrap; gap: 4px 14px; list-style: none; margin: 4px 0 2px; padding: 0 0 0 52px; font-size: 11.5px; color: var(--muted); }
  .legend li { display: inline-flex; align-items: center; gap: 6px; }
  .legend i { display: inline-block; width: 14px; height: 3px; border-radius: 2px; }
  .legend i.dash { height: 0; border-top: 2px dashed currentColor; border-radius: 0; }
  .chart-tip {
    position: absolute; top: 6px; transform: translateX(12px); z-index: 2; pointer-events: none;
    display: flex; flex-direction: column; gap: 2px; padding: 7px 10px; border-radius: 9px; font-size: 12px; white-space: nowrap;
    background: var(--surface-2); border: 1px solid var(--line); box-shadow: var(--shadow-sm);
  }
  .chart-tip.flip { transform: translateX(calc(-100% - 12px)); }
  .chart-tip span { display: flex; align-items: center; gap: 6px; color: var(--muted); }
  .chart-tip i { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
  .chart-tip b { color: var(--text); font-variant-numeric: tabular-nums; }
</style>
