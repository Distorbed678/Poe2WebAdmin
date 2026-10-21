<script lang="ts">
  import { api, unwrap } from '../lib/api/client';
  import { Resource } from '../lib/resource.svelte';
  import { formatAge, formatUptime } from '../lib/format';
  import PageHead from '../lib/ui/PageHead.svelte';
  import Status from '../lib/ui/Status.svelte';

  const res = new Resource(async () => {
    const [server, instances, sessions] = await Promise.all([
      unwrap(api.GET('/api/v1/server')),
      unwrap(api.GET('/api/v1/admin/instances')),
      unwrap(api.GET('/api/v1/admin/sessions')),
    ]);
    return { server, instances, sessions };
  });
  $effect(() => res.start(5000));

  const d = $derived(res.data);
  const withPlayers = $derived(d ? d.instances.filter((i) => i.players.length > 0).length : 0);
  const empty = $derived(d ? d.instances.length - withPlayers : 0);
  const persistent = $derived(d ? d.instances.filter((i) => i.persistent).length : 0);
  const busiest = $derived(
    d ? [...d.instances].sort((a, b) => b.players.length - a.players.length).slice(0, 6) : [],
  );
</script>

<PageHead title="Dashboard" subtitle="Refreshes every 5 seconds">
  <Status {res} />
  <button type="button" onclick={() => res.load()} disabled={res.loading}>Refresh</button>
</PageHead>

{#if d}
  <div class="cards">
    <section class="card stat">
      <h2>Players online</h2>
      <p class="big">{d.server.online}</p>
      <p class="muted">{d.sessions.length} session{d.sessions.length === 1 ? '' : 's'} listed</p>
    </section>
    <section class="card stat">
      <h2>Instances</h2>
      <p class="big">{d.instances.length}</p>
      <p class="muted">{withPlayers} with players, {empty} empty, {persistent} persistent</p>
    </section>
    <section class="card stat">
      <h2>Uptime</h2>
      <p class="big">{formatUptime(d.server.uptime_secs)}</p>
      <p class="muted">Version {d.server.version}</p>
    </section>
  </div>

  <div class="two-col">
    <section class="card">
      <h2>Server</h2>
      <dl class="kv">
        <dt>Name</dt><dd>{d.server.name}</dd>
        <dt>Cluster</dt><dd><code>{d.server.cluster_id}</code></dd>
        <dt>Game client connects to</dt><dd><code>{d.server.login_host}:{d.server.login_port}</code></dd>
        <dt>Open registration</dt><dd>{d.server.open_registration ? 'yes' : 'no'}</dd>
      </dl>
    </section>

    <section class="card">
      <h2>Busiest instances</h2>
      {#if busiest.length === 0}
        <p class="muted">No instances.</p>
      {:else}
        <table>
          <thead><tr><th>Id</th><th>Area</th><th class="num">Players</th><th>Age</th></tr></thead>
          <tbody>
            {#each busiest as i (i.id)}
              <tr>
                <td class="num">{i.id}</td>
                <td>{i.area}{#if i.persistent}<span class="badge">persistent</span>{/if}</td>
                <td class="num">{i.players.length}</td>
                <td>{formatAge(i.created_unix_ms)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
        <p><a href="#/instances">All instances</a></p>
      {/if}
    </section>
  </div>
{:else if res.error}
  <p class="err" role="alert">{res.error}</p>
{:else}
  <p class="muted">Loading...</p>
{/if}
