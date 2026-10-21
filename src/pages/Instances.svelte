<script lang="ts">
  import { api, unwrap } from '../lib/api/client';
  import { Resource } from '../lib/resource.svelte';
  import { confirms, run } from '../lib/notify.svelte';
  import { formatAge, intOrNull } from '../lib/format';
  import PageHead from '../lib/ui/PageHead.svelte';
  import Status from '../lib/ui/Status.svelte';
  import Modal from '../lib/ui/Modal.svelte';

  const res = new Resource(() => unwrap(api.GET('/api/v1/admin/instances')));
  $effect(() => res.start(5000));

  async function close(id: number, players: number) {
    const ok = await confirms.ask({
      title: `Close instance #${id}?`,
      message:
        players > 0
          ? `${players} player${players === 1 ? ' is' : 's are'} inside and will be disconnected.`
          : 'The instance is removed.',
      confirmLabel: 'Close instance',
    });
    if (ok && (await run(() => unwrap(api.POST('/api/v1/admin/instances/{id}/close', { params: { path: { id } } }))))) {
      void res.load();
    }
  }

  let createOpen = $state(false);
  let area = $state('');
  let seed = $state('');
  let topology = $state('');
  let orientation = $state('');
  const bad = $derived([seed, topology, orientation].some((v) => Number.isNaN(intOrNull(v))));

  function openCreate() {
    area = '';
    seed = '';
    topology = '';
    orientation = '';
    createOpen = true;
  }
  async function create(e: SubmitEvent) {
    e.preventDefault();
    const ok = await run(
      () =>
        unwrap(
          api.POST('/api/v1/admin/instances', {
            body: {
              area: area.trim(),
              seed: intOrNull(seed),
              topology: intOrNull(topology),
              orientation: intOrNull(orientation),
            },
          }),
        ),
      (r) => `Created instance #${r.id}`,
    );
    if (ok) {
      createOpen = false;
      void res.load();
    }
  }
</script>

<PageHead title="Instances" subtitle="Running area instances">
  <Status {res} />
  <button type="button" onclick={() => res.load()} disabled={res.loading}>Refresh</button>
  <button type="button" class="primary" onclick={openCreate}>Create instance</button>
</PageHead>

{#if res.data}
  {#if res.data.length === 0}
    <section class="card empty"><p class="muted">No instances.</p></section>
  {:else}
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th class="num">Id</th><th>Area</th><th class="num">Seed</th><th class="num">Topology</th>
            <th class="num">Orient.</th><th>Players</th><th>Age</th><th class="actions-col">Actions</th>
          </tr>
        </thead>
        <tbody>
          {#each res.data as i (i.id)}
            <tr>
              <td class="num">{i.id}</td>
              <td>{i.area}{#if i.persistent}<span class="badge">persistent</span>{/if}</td>
              <td class="num">{i.seed ?? '-'}</td>
              <td class="num">{i.topology ?? '-'}</td>
              <td class="num">{i.orientation ?? '-'}</td>
              <td>
                {#if i.players.length}{i.players.join(', ')}{:else}
                  <span class="muted">empty{i.empty_for_secs != null ? ` for ${i.empty_for_secs}s` : ''}</span>
                {/if}
              </td>
              <td>{formatAge(i.created_unix_ms)}</td>
              <td class="row-actions">
                <button type="button" class="danger" onclick={() => close(i.id, i.players.length)}>Close</button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
{:else if res.error}
  <p class="err" role="alert">{res.error}</p>
{/if}

<Modal bind:open={createOpen} title="Create instance">
  <form onsubmit={create}>
    <label class="field">
      <span>Area (<code>WorldAreas.Id</code>, e.g. G1_1)</span>
      <input bind:value={area} required />
    </label>
    <div class="grid3">
      <label class="field"><span>Seed</span><input type="number" min="0" bind:value={seed} placeholder="auto" /></label>
      <label class="field"><span>Topology (1-based)</span><input type="number" min="1" bind:value={topology} placeholder="client's" /></label>
      <label class="field"><span>Orientation 0-8</span><input type="number" min="0" max="8" bind:value={orientation} placeholder="client's" /></label>
    </div>
    <div class="actions">
      <button type="button" onclick={() => (createOpen = false)}>Cancel</button>
      <button type="submit" class="primary" disabled={area.trim() === '' || bad}>Create</button>
    </div>
  </form>
</Modal>
