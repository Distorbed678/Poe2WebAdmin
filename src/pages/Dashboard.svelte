<script lang="ts">
  import { api, unwrap } from '../lib/api/client';
  import { Resource } from '../lib/resource.svelte';
  import { server } from '../lib/server.svelte';
  import { formatUptime } from '../lib/format';
  import PageHead from '../lib/ui/PageHead.svelte';
  import Status from '../lib/ui/Status.svelte';
  import Icon from '../lib/ui/Icon.svelte';
  import Chip from '../lib/ui/Chip.svelte';
  import Empty from '../lib/ui/Empty.svelte';
  import ServerControl from '../lib/ui/ServerControl.svelte';
  import ActivityCharts from '../lib/ui/ActivityCharts.svelte';
  import MotdCard from '../lib/ui/MotdCard.svelte';

  // A calm overview: who is on, where they are, the server's state. The rest is one click away.
  const res = new Resource(async () => {
    const [info, instances, sessions] = await Promise.all([
      unwrap(api.GET('/api/v1/server')),
      unwrap(api.GET('/api/v1/admin/instances')),
      unwrap(api.GET('/api/v1/admin/sessions')),
    ]);
    return { server: info, instances, sessions };
  });
  $effect(() => res.start(5000));
  // The server came back after a restart: load at once instead of waiting for the next tick.
  $effect(() => {
    if (server.returns > 0) void res.load();
  });

  const d = $derived(res.data);
  const withPlayers = $derived(d ? d.instances.filter((i) => i.players.length > 0).length : 0);
  const persistent = $derived(d ? d.instances.filter((i) => i.persistent).length : 0);
  const busiest = $derived(d ? [...d.instances].sort((a, b) => b.players.length - a.players.length).slice(0, 5) : []);
  const most = $derived(Math.max(1, ...busiest.map((i) => i.players.length)));
  const online = $derived(d ? [...d.sessions].sort((a, b) => a.character.localeCompare(b.character)).slice(0, 8) : []);
  const subtitle = $derived(
    !d ? 'Loading...' : server.link.reachable ? `Server running · up ${formatUptime(d.server.uptime_secs)}` : 'The server does not answer',
  );
</script>

<PageHead title="Dashboard" {subtitle}>
  <Status {res} />
  <button type="button" class="btn sm icon ghost" onclick={() => res.load()} disabled={res.loading} title="Refresh now (it refreshes every 5 seconds)" aria-label="Refresh">
    <Icon name="refresh" size={14} />
  </button>
</PageHead>

{#if d}
  <div class="tiles">
    <section class="card stat-card">
      <h2>Players online</h2>
      <p class="big">{d.server.online}</p>
      <p class="sub">{d.sessions.length} session{d.sessions.length === 1 ? '' : 's'}</p>
    </section>
    <section class="card stat-card">
      <h2>Instances</h2>
      <p class="big">{d.instances.length}</p>
      <p class="sub">{withPlayers} with players · {persistent} persistent</p>
    </section>
    <section class="card stat-card">
      <h2>Client version</h2>
      <p class="big ver">{d.server.version}</p>
      <p class="sub">{d.server.name}</p>
    </section>
  </div>

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

    <section class="card">
      <div class="card-head"><h2>Busiest instances</h2><a class="end" href="#/instances">All instances</a></div>
      {#if busiest.length === 0}
        <Empty icon="instances" title="No instances">Instances appear when a player enters an area.</Empty>
      {:else}
        <ul class="bars">
          {#each busiest as i (i.id)}
            <li>
              <span class="bar-name" title="Instance {i.id}">{i.area}</span>
              <span class="bar"><i style:width="{(i.players.length / most) * 100}%"></i></span>
              <span class="num">{i.players.length}</span>
            </li>
          {/each}
        </ul>
      {/if}
    </section>
  </div>

  <ServerControl online={d.server.online} uptime={d.server.uptime_secs} />

  <div class="two section">
    <MotdCard current={d.server.motd ?? ''} />
    <section class="card">
      <div class="card-head"><h2>Server</h2></div>
      <dl class="kv">
        <dt>Name</dt><dd>{d.server.name}</dd>
        <dt>Cluster</dt><dd><code>{d.server.cluster_id}</code></dd>
        <dt>Game client connects to</dt><dd><code>{d.server.login_host}:{d.server.login_port}</code></dd>
        <dt>Open registration</dt>
        <dd>{#if d.server.open_registration}<Chip tone="warn">open</Chip>{:else}<Chip>closed</Chip>{/if}</dd>
      </dl>
    </section>
  </div>

  <div class="section"><ActivityCharts /></div>
{:else if res.error}
  <div class="notice danger" role="alert"><span class="notice-title"><Icon name="alert" size={16} /> {res.error}</span></div>
{:else}
  <div class="tiles" aria-busy="true">
    {#each [0, 1, 2] as k (k)}<section class="card"><div class="skeleton" style="width: 50%"></div><div class="skeleton big"></div><div class="skeleton" style="width: 70%"></div></section>{/each}
  </div>
  <div class="overview" aria-hidden="true">
    {#each [0, 1] as k (k)}<section class="card"><div class="skeleton" style="width: 30%"></div><div class="skeleton"></div><div class="skeleton" style="width: 85%"></div><div class="skeleton" style="width: 60%"></div></section>{/each}
  </div>
{/if}

<style>
  .tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--sp-3); }
  .tiles h2 { margin: 0 0 4px; font: 500 var(--fs-xs)/1.4 var(--font); letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); }
  .big.ver { font-size: 20px; margin-top: 8px; }
  .overview { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr); gap: var(--sp-3); margin: var(--sp-3) 0 18px; }
  .card-head .end { font-size: var(--fs-sm); }
  .calm { margin: 0; }
  .people { list-style: none; margin: 0; padding: 0; }
  .people li { display: flex; align-items: center; gap: var(--sp-2); padding: 7px 0; border-top: 1px solid var(--line-soft); font-size: 13px; }
  .people li:first-child { border-top: 0; }
  .people .area { margin-left: auto; color: var(--muted); font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .more { margin: 6px 0 0; }
  .bars { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
  .bars li { display: grid; grid-template-columns: minmax(0, 120px) 1fr 28px; align-items: center; gap: 10px; font-size: 12.5px; }
  .bar-name { color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .bar { height: 6px; background: var(--surface-3); border-radius: var(--radius-pill); overflow: hidden; }
  .bar i { display: block; height: 100%; background: var(--gold); transition: width var(--dur-slow) var(--ease); }
  @media (max-width: 900px) { .overview { grid-template-columns: 1fr; } }
</style>
