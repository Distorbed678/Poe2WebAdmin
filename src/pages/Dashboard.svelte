<script lang="ts">
  import { api, unwrap } from '../lib/api/client';
  import { Resource } from '../lib/resource.svelte';
  import { server } from '../lib/server.svelte';
  import { formatAge, formatUptime } from '../lib/format';
  import PageHead from '../lib/ui/PageHead.svelte';
  import Status from '../lib/ui/Status.svelte';
  import Icon from '../lib/ui/Icon.svelte';
  import Chip from '../lib/ui/Chip.svelte';
  import Empty from '../lib/ui/Empty.svelte';
  import Spinner from '../lib/ui/Spinner.svelte';
  import ServerControl from '../lib/ui/ServerControl.svelte';

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
  const empty = $derived(d ? d.instances.length - withPlayers : 0);
  const persistent = $derived(d ? d.instances.filter((i) => i.persistent).length : 0);
  const busiest = $derived(d ? [...d.instances].sort((a, b) => b.players.length - a.players.length).slice(0, 6) : []);
</script>

<PageHead title="Dashboard" subtitle="Refreshes every 5 seconds" icon="dashboard">
  <Status {res} />
  <button type="button" class="btn sm" onclick={() => res.load()} disabled={res.loading}>
    <Icon name="refresh" size={14} /> Refresh
  </button>
</PageHead>

<ServerControl online={d?.server.online ?? null} uptime={d?.server.uptime_secs ?? null} />

{#if d}
  <div class="cards">
    <section class="card stat-card ok">
      <div class="stat-top"><Icon name="players" size={16} /><h2>Players online</h2></div>
      <p class="big">{d.server.online}</p>
      <p class="sub">{d.sessions.length} session{d.sessions.length === 1 ? '' : 's'} listed</p>
    </section>
    <section class="card stat-card">
      <div class="stat-top"><Icon name="instances" size={16} /><h2>Instances</h2></div>
      <p class="big">{d.instances.length}</p>
      <p class="sub">{withPlayers} with players, {empty} empty, {persistent} persistent</p>
    </section>
    <section class="card stat-card violet">
      <div class="stat-top"><Icon name="clock" size={16} /><h2>Uptime</h2></div>
      <p class="big sm">{formatUptime(d.server.uptime_secs)}</p>
      <p class="sub">Client version {d.server.version}</p>
    </section>
  </div>

  <div class="two section">
    <section class="card">
      <div class="card-head"><span class="head-icon"><Icon name="server" size={16} /></span><h2>Server</h2></div>
      <dl class="kv">
        <dt>Name</dt><dd>{d.server.name}</dd>
        <dt>Cluster</dt><dd><code>{d.server.cluster_id}</code></dd>
        <dt>Game client connects to</dt><dd><code>{d.server.login_host}:{d.server.login_port}</code></dd>
        <dt>Open registration</dt>
        <dd>{#if d.server.open_registration}<Chip tone="warn">open</Chip>{:else}<Chip>closed</Chip>{/if}</dd>
      </dl>
    </section>

    <section class="card">
      <div class="card-head">
        <span class="head-icon"><Icon name="instances" size={16} /></span><h2>Busiest instances</h2>
        <a class="end" href="#/instances">All instances</a>
      </div>
      {#if busiest.length === 0}
        <Empty icon="instances" title="No instances">Instances appear when a player enters an area.</Empty>
      {:else}
        <div class="table-wrap">
          <table>
            <thead><tr><th class="num">Id</th><th>Area</th><th class="num">Players</th><th>Age</th></tr></thead>
            <tbody>
              {#each busiest as i (i.id)}
                <tr>
                  <td class="num">{i.id}</td>
                  <td><span class="name-cell">{i.area}{#if i.persistent}<Chip>persistent</Chip>{/if}</span></td>
                  <td class="num">{i.players.length}</td>
                  <td>{formatAge(i.created_unix_ms)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </section>
  </div>
{:else if res.error}
  <div class="notice danger" role="alert"><span class="notice-title"><Icon name="alert" size={16} /> {res.error}</span></div>
{:else}
  <div class="loading"><Spinner size={20} /> Loading...</div>
{/if}
