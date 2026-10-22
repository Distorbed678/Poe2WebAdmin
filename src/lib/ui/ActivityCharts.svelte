<script lang="ts">
  import { api, unwrap } from '../api/client';
  import { Resource } from '../resource.svelte';
  import { MAX_POINTS, RANGES, formatBytes, formatMicros, formatPercent, pollMs } from '../chart';
  import { formatUptime } from '../format';
  import Icon from './Icon.svelte';
  import LineChart, { type Series } from './LineChart.svelte';
  import Spinner from './Spinner.svelte';

  const STORE = 'poe2-admin.chart-range';
  function saved(): string {
    try {
      const v = localStorage.getItem(STORE);
      return RANGES.some((r) => r.id === v) ? (v as string) : '1h';
    } catch {
      return '1h';
    }
  }

  let rangeId = $state(saved());
  const range = $derived(RANGES.find((r) => r.id === rangeId) ?? RANGES[1]!);

  function choose(id: string) {
    rangeId = id;
    try {
      localStorage.setItem(STORE, id);
    } catch {
      /* storage can be blocked: the choice just is not remembered */
    }
  }

  const res = new Resource(() =>
    unwrap(api.GET('/api/v1/admin/metrics', { params: { query: { range_secs: range.secs, max_points: MAX_POINTS } } })),
  );
  // Restarts when the range changes (the effect reads `range`), reloads as often as the data changes.
  $effect(() => res.start(pollMs(range.secs)));

  const d = $derived(res.data);
  const samples = $derived(d?.samples ?? []);
  const times = $derived(samples.map((s) => s.t));
  // The window ends at the server's clock (the last sample is up to one interval old).
  const to = $derived(d?.now ?? times[times.length - 1]);
  const from = $derived(to !== undefined ? to - range.secs * 1000 : undefined);

  const MB = 1024 * 1024;
  const players: Series[] = $derived([
    { id: 'players', label: 'Players', color: 'var(--ok)', values: samples.map((s) => s.players), area: true },
    { id: 'occupied', label: 'Busy instances', color: 'var(--info)', values: samples.map((s) => s.occupied), dashed: true },
    { id: 'instances', label: 'Instances', color: 'var(--violet)', values: samples.map((s) => s.instances), dashed: true },
  ]);
  // A sample without frames (nobody in game) has no frame time: a gap, not a zero.
  const tick: Series[] = $derived([
    { id: 'avg', label: 'Mean', color: 'var(--accent)', values: samples.map((s) => (s.tick_count > 0 ? s.tick_avg_us : null)), area: true },
    { id: 'max', label: 'Longest', color: 'var(--danger)', values: samples.map((s) => (s.tick_count > 0 ? s.tick_max_us : null)), dashed: true },
  ]);
  const memory: Series[] = $derived([
    { id: 'rss', label: 'Resident memory', color: 'var(--violet)', values: samples.map((s) => (s.rss_bytes > 0 ? s.rss_bytes / MB : null)), area: true },
  ]);
  const cpu: Series[] = $derived([
    { id: 'cpu', label: 'CPU', color: 'var(--info)', values: samples.map((s) => s.cpu_pct ?? null), area: true },
  ]);

  const last = $derived(samples[samples.length - 1]);
  const peak = $derived(samples.reduce((m, s) => Math.max(m, s.players), 0));
  const fmtCount = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));
  const fmtTick = (us: number) => formatMicros(us);
  const fmtMem = (mb: number) => formatBytes(mb * MB);
</script>

<section class="card activity" aria-label="Activity over time">
  <div class="card-head">
    <span class="head-icon"><Icon name="activity" size={16} /></span>
    <h2>Activity</h2>
    <span class="grow"></span>
    {#if res.loading && !d}<Spinner size={13} />{/if}
    <div class="seg" role="radiogroup" aria-label="Time range">
      {#each RANGES as r (r.id)}
        <button type="button" role="radio" aria-checked={rangeId === r.id} class:on={rangeId === r.id} onclick={() => choose(r.id)}>{r.label}</button>
      {/each}
    </div>
  </div>

  {#if d && !d.enabled}
    <div class="notice info"><span class="notice-title"><Icon name="info" size={16} /> Metrics are off</span><p class="muted">Set <code>[metrics] enabled = true</code> in the config and restart to see charts here.</p></div>
  {:else if res.error && !d}
    <div class="notice danger" role="alert"><span class="notice-title"><Icon name="alert" size={16} /> {res.error}</span></div>
  {:else}
    <div class="charts">
      <figure class="chart-box">
        <figcaption>
          <h3>Players and instances</h3>
          <span class="muted">{last ? `${last.players} now, peak ${peak}` : ''}</span>
        </figcaption>
        <LineChart label="Players and instances" times={times} series={players} format={fmtCount} {from} {to} />
      </figure>
      <figure class="chart-box">
        <figcaption>
          <h3>Simulation frame time</h3>
          <span class="muted">{last && last.tick_count > 0 ? `mean ${formatMicros(last.tick_avg_us)}, longest ${formatMicros(last.tick_max_us)}` : 'no frames while nobody is in game'}</span>
        </figcaption>
        <LineChart label="Simulation frame time" times={times} series={tick} format={fmtTick} {from} {to} />
      </figure>
      <figure class="chart-box">
        <figcaption>
          <h3>Memory</h3>
          <span class="muted">{last && last.rss_bytes > 0 ? formatBytes(last.rss_bytes) : 'not measured on this system'}</span>
        </figcaption>
        <LineChart label="Resident memory of the server" times={times} series={memory} format={fmtMem} {from} {to} />
      </figure>
      <figure class="chart-box">
        <figcaption>
          <h3>CPU</h3>
          <span class="muted">{last?.cpu_pct != null ? `${formatPercent(last.cpu_pct)} of one core` : 'not measured on this system'}</span>
        </figcaption>
        <LineChart label="CPU use of the server" times={times} series={cpu} format={formatPercent} {from} {to} />
      </figure>
    </div>
    <p class="hint foot">
      One sample every {d?.interval_secs ?? 5} s, kept {d ? formatUptime(d.retention_secs) : '-'} in memory (lost on a restart).
      {#if range.secs > 3000}Long ranges are merged: players, memory and the longest frame show the peak of each step.{/if}
    </p>
  {/if}
</section>
