<script lang="ts">
  import { api, unwrap } from '../lib/api/client';
  import { Resource } from '../lib/resource.svelte';
  import { sideLabel, stateTone, summarize } from '../lib/mods';
  import PageHead from '../lib/ui/PageHead.svelte';
  import Status from '../lib/ui/Status.svelte';
  import Icon from '../lib/ui/Icon.svelte';
  import Chip from '../lib/ui/Chip.svelte';
  import Empty from '../lib/ui/Empty.svelte';
  import Spinner from '../lib/ui/Spinner.svelte';

  const res = new Resource(() => unwrap(api.GET('/api/v1/admin/mods')));
  $effect(() => res.start());
</script>

<PageHead title="Mods" subtitle={res.data ? summarize(res.data.mods) : 'Server mods and the client mods players need'} icon="mods">
  <Status {res} />
  <button type="button" class="btn sm icon ghost" onclick={() => res.load()} disabled={res.loading} aria-label="Refresh" title="Refresh"><Icon name="refresh" size={14} /></button>
</PageHead>

{#if res.data}
  {#if res.data.restart_required}
    <div class="notice warn" role="status">
      <span class="notice-title"><Icon name="alert" size={16} /> Restart required</span>
      The mods folder changed since the server started. Mods are never reloaded: restart the server (Dashboard) to apply the change.
    </div>
  {/if}
  {#if !res.data.active}
    <Empty icon="mods" title="The mod system is off">
      Create the mods folder's <code>state.toml</code> with <code>poe-server mod enable &lt;id&gt;</code>, then restart the server.
    </Empty>
  {:else if res.data.mods.length === 0}
    <Empty icon="mods" title="No mods installed">Install a package with <code>poe-server mod install &lt;zip&gt; --enable</code>.</Empty>
  {:else}
    <div class="table-wrap">
      <table>
        <thead>
          <tr><th>Mod</th><th>Version</th><th>Runs on</th><th>State</th><th>Commands</th><th>Details</th></tr>
        </thead>
        <tbody>
          {#each res.data.mods as m (m.id)}
            <tr>
              <td><span class="name-cell">{m.name}</span> <span class="muted">{m.id}</span></td>
              <td>{m.version || '-'}</td>
              <td>{sideLabel(m.side)}</td>
              <td><Chip tone={stateTone(m.state)} dot={m.state === 'loaded'}>{m.state}</Chip></td>
              <td>{#each m.commands as c}<code>!{c}</code>{' '}{/each}</td>
              <td class="muted">{m.detail}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
  <p class="muted">
    Login check of the client's mods: {res.data.require_client_mods ? 'on' : 'off'}; extra client mods
    {res.data.allow_extra_client_mods ? 'allowed' : 'refused'} (<code>[mods]</code> in the server config).
  </p>
{:else if res.error}
  <div class="notice danger" role="alert"><span class="notice-title"><Icon name="alert" size={16} /> {res.error}</span></div>
{:else}
  <div class="loading"><Spinner size={20} /> Loading...</div>
{/if}
