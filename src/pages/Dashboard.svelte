<script lang="ts">
  import { api, unwrap } from '../lib/api/client';
  import { Resource } from '../lib/resource.svelte';
  import { server } from '../lib/server.svelte';
  import { formatUptime } from '../lib/format';
  import PageHead from '../lib/ui/PageHead.svelte';
  import Status from '../lib/ui/Status.svelte';
  import Icon from '../lib/ui/Icon.svelte';
  import Chip from '../lib/ui/Chip.svelte';
  import ServerControl from '../lib/ui/ServerControl.svelte';
  import { formatBytes, formatMicros } from '../lib/chart';
  import ActivityCharts from '../lib/ui/ActivityCharts.svelte';
  import MotdCard from '../lib/ui/MotdCard.svelte';

  // A calm overview: four numbers, the activity, who is on, the message of the day. Restart and
  // Stop sit next to the title.
  const res = new Resource(async () => {
    const [info, instances, sessions, metrics] = await Promise.all([
      unwrap(api.GET('/api/v1/server')),
      unwrap(api.GET('/api/v1/admin/instances')),
      unwrap(api.GET('/api/v1/admin/sessions')),
      unwrap(api.GET('/api/v1/admin/metrics', { params: { query: { range_secs: 120, max_points: 10 } } })).catch(() => null),
    ]);
    return { server: info, instances, sessions, last: metrics?.samples.at(-1) ?? null };
  });
  $effect(() => res.start(5000));
  // The server came back after a restart: load at once instead of waiting for the next tick.
  $effect(() => {
    if (server.returns > 0) void res.load();
  });

  const d = $derived(res.data);
  const withPlayers = $derived(d ? d.instances.filter((i) => i.players.length > 0).length : 0);
  const persistent = $derived(d ? d.instances.filter((i) => i.persistent).length : 0);
  const online = $derived(d ? [...d.sessions].sort((a, b) => a.character.localeCompare(b.character)).slice(0, 8) : []);
  const subtitle = $derived(
    !d ? 'Loading...' : server.link.reachable ? `Server running · up ${formatUptime(d.server.uptime_secs)}` : 'The server does not answer',
  );
</script>

<PageHead title="Dashboard" {subtitle}>
  <Status {res} />
  {#if d}<ServerControl compact online={d.server.online} uptime={d.server.uptime_secs} />{/if}
</PageHead>

{#if d}
  <div class="tiles">
    <section class="card stat-card">
      <h2>Players</h2>
      <p class="big">{d.server.online}</p>
      <p class="sub">{d.sessions.length} session{d.sessions.length === 1 ? '' : 's'}</p>
    </section>
    <section class="card stat-card">
      <h2>Instances</h2>
      <p class="big">{d.instances.length}</p>
      <p class="sub">{withPlayers} with players · {persistent} persistent</p>
    </section>
    <section class="card stat-card">
      <h2>Tick time</h2>
      <p class="big">{d.last && d.last.tick_count > 0 ? formatMicros(d.last.tick_avg_us) : '-'}</p>
      <p class="sub">{d.last && d.last.tick_count > 0 ? `longest ${formatMicros(d.last.tick_max_us)}` : 'no frames while nobody plays'}</p>
    </section>
    <section class="card stat-card">
      <h2>Memory</h2>
      <p class="big">{d.last && d.last.rss_bytes > 0 ? formatBytes(d.last.rss_bytes) : '-'}</p>
      <p class="sub">{d.last?.cpu_pct != null ? `CPU ${d.last.cpu_pct.toFixed(0)} %` : 'CPU not measured'}{d.last ? ` · net ${formatBytes(d.last.net_in_bps + d.last.net_out_bps)}/s` : ''}</p>
    </section>
  </div>

  <div class="section"><ActivityCharts /></div>

  <div class="overview">
    <section class="card">
      <div class="card-head"><h2>Online now</h2><a class="end" href="#/players">All players</a></div>
      {#if online.length === 0}
        <p class="muted calm">Nobody is in game right now.</p>
      {:else}
        <ul class="people">
          {#each online as s (s.character)}
            <li>
              <span class="dot-state on"></span>
              <b>{s.character}</b>
              <span class="muted">{s.account}</span>
              {#if s.muted}<Chip tone="warn" icon="mute">muted</Chip>{/if}
              <span class="area">{s.area}</span>
            </li>
          {/each}
        </ul>
        {#if d.sessions.length > online.length}<p class="hint more">and {d.sessions.length - online.length} more</p>{/if}
      {/if}
    </section>
    <MotdCard current={d.server.motd ?? ''} />
  </div>
{:else if res.error}
  <div class="notice danger" role="alert"><span class="notice-title"><Icon name="alert" size={16} /> {res.error}</span></div>
{:else}
  <div class="tiles" aria-busy="true">
    {#each [0, 1, 2, 3] as k (k)}<section class="card"><div class="skeleton" style="width: 50%"></div><div class="skeleton big"></div><div class="skeleton" style="width: 70%"></div></section>{/each}
  </div>
{/if}

<style>
  .tiles { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--sp-3); margin-bottom: var(--sp-4); }
  .tiles h2 { margin: 0 0 4px; font: 500 var(--fs-xs)/1.4 var(--font); letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); }
  .tiles .big { font: 600 26px / 1.1 var(--font); color: var(--text); }
  .section { margin-bottom: var(--sp-4); }
  .overview { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: var(--sp-4); align-items: start; }
  .overview > :global(.card) { margin: 0; }
  .card-head .end { font-size: var(--fs-sm); }
  .calm { margin: 0; }
  .people { list-style: none; margin: 0; padding: 0; }
  .people li { display: flex; align-items: center; gap: var(--sp-2); padding: 8px 0; border-top: 1px solid var(--line-soft); font-size: 13px; }
  .people li:first-child { border-top: 0; }
  .people .area { margin-left: auto; color: var(--muted); font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .more { margin: 6px 0 0; }
  @media (max-width: 1100px) { .tiles { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  @media (max-width: 900px) { .overview { grid-template-columns: 1fr; } }
</style>
