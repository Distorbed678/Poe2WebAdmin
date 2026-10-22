<script lang="ts">
  import { api, unwrap, type InstanceView } from '../lib/api/client';
  import { Resource } from '../lib/resource.svelte';
  import { confirms, run } from '../lib/notify.svelte';
  import { intOrNull } from '../lib/format';
  import PageHead from '../lib/ui/PageHead.svelte';
  import Status from '../lib/ui/Status.svelte';
  import Modal from '../lib/ui/Modal.svelte';
  import Icon from '../lib/ui/Icon.svelte';
  import Empty from '../lib/ui/Empty.svelte';
  import Spinner from '../lib/ui/Spinner.svelte';

  const res = new Resource(async () => {
    const [sessions, instances] = await Promise.all([
      unwrap(api.GET('/api/v1/admin/sessions')),
      unwrap(api.GET('/api/v1/admin/instances')),
    ]);
    return { sessions, instances };
  });
  $effect(() => res.start(5000));

  let filter = $state('');
  const rows = $derived(
    (res.data?.sessions ?? []).filter((s) =>
      `${s.character} ${s.account} ${s.area}`.toLowerCase().includes(filter.trim().toLowerCase()),
    ),
  );

  async function kick(name: string) {
    const ok = await confirms.ask({
      title: `Kick ${name}?`,
      message: `${name} is disconnected from the game and has to log in again.`,
      confirmLabel: 'Kick',
    });
    if (ok && (await run(() => unwrap(api.POST('/api/v1/admin/players/{name}/kick', { params: { path: { name } } }))))) {
      void res.load();
    }
  }

  async function unmute(name: string) {
    await run(() => unwrap(api.POST('/api/v1/admin/players/{name}/unmute', { params: { path: { name } } })));
  }

  // --- mute dialog
  let muteFor = $state<string | null>(null);
  let muteOpen = $state(false);
  let minutes = $state('');
  const minutesValue = $derived(intOrNull(minutes));
  const minutesBad = $derived(Number.isNaN(minutesValue));

  function openMute(name: string) {
    muteFor = name;
    minutes = '';
    muteOpen = true;
  }
  async function submitMute(e: SubmitEvent) {
    e.preventDefault();
    const name = muteFor!;
    const ok = await run(() =>
      unwrap(
        api.POST('/api/v1/admin/players/{name}/mute', {
          params: { path: { name } },
          body: { minutes: minutesValue },
        }),
      ),
    );
    if (ok) muteOpen = false;
  }

  // --- transfer dialog
  let transferFor = $state<string | null>(null);
  let transferOpen = $state(false);
  let mode = $state<'instance' | 'new'>('instance');
  let instanceId = $state('');
  let area = $state('');
  let seed = $state('');
  let topology = $state('');
  let orientation = $state('');

  function openTransfer(name: string) {
    transferFor = name;
    mode = 'instance';
    instanceId = '';
    area = '';
    seed = '';
    topology = '';
    orientation = '';
    transferOpen = true;
  }
  const targets = $derived<InstanceView[]>(
    (res.data?.instances ?? []).filter((i) => !res.data?.sessions.some((s) => s.character === transferFor && s.instance === i.id)),
  );
  const transferInvalid = $derived(
    mode === 'instance'
      ? instanceId === ''
      : area.trim() === '' || [seed, topology, orientation].some((v) => Number.isNaN(intOrNull(v))),
  );
  async function submitTransfer(e: SubmitEvent) {
    e.preventDefault();
    const name = transferFor!;
    const body =
      mode === 'instance'
        ? { instance: Number(instanceId) }
        : {
            area: area.trim(),
            seed: intOrNull(seed),
            topology: intOrNull(topology),
            orientation: intOrNull(orientation),
          };
    const ok = await run(() =>
      unwrap(api.POST('/api/v1/admin/players/{name}/transfer', { params: { path: { name } }, body })),
    );
    if (ok) {
      transferOpen = false;
      void res.load();
    }
  }
</script>

<PageHead title="Players online" subtitle="Characters currently in game" icon="players">
  <label class="inline">
    <span class="sr-only">Filter players</span>
    <input type="search" placeholder="Filter..." bind:value={filter} />
  </label>
  <Status {res} />
  <button type="button" class="btn sm" onclick={() => res.load()} disabled={res.loading}>
    <Icon name="refresh" size={14} /> Refresh
  </button>
</PageHead>

{#if res.data}
  {#if rows.length === 0}
    {#if filter}
      <Empty icon="search" title="No player matches">Nothing matches "{filter}".</Empty>
    {:else}
      <Empty icon="players" title="Nobody is in game">Players show up here as soon as they enter an area.</Empty>
    {/if}
  {:else}
    <div class="table-wrap">
      <table>
        <thead>
          <tr><th>Character</th><th>Account</th><th>Area</th><th class="num">Instance</th><th class="actions-col">Actions</th></tr>
        </thead>
        <tbody>
          {#each rows as s (s.character)}
            <tr>
              <td><b>{s.character}</b></td>
              <td><a href={'#/characters?account=' + encodeURIComponent(s.account)}>{s.account}</a></td>
              <td>{s.area}</td>
              <td class="num">{s.instance ?? '-'}</td>
              <td>
                <div class="row-actions">
                  <button type="button" class="btn sm" onclick={() => openMute(s.character)}><Icon name="mute" size={13} /> Mute</button>
                  <button type="button" class="btn sm" onclick={() => unmute(s.character)}>Unmute</button>
                  <button type="button" class="btn sm" onclick={() => openTransfer(s.character)}><Icon name="transfer" size={13} /> Transfer</button>
                  <button type="button" class="btn sm danger" onclick={() => kick(s.character)}><Icon name="kick" size={13} /> Kick</button>
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
{:else if res.error}
  <div class="notice danger" role="alert"><span class="notice-title"><Icon name="alert" size={16} /> {res.error}</span></div>
{:else}
  <div class="loading"><Spinner size={20} /> Loading...</div>
{/if}

<Modal bind:open={muteOpen} title={`Mute ${muteFor ?? ''}`} icon="mute">
  <form onsubmit={submitMute}>
    <label class="field">
      <span>Minutes (leave empty to mute until unmuted)</span>
      <input type="number" min="1" step="1" inputmode="numeric" bind:value={minutes} aria-invalid={minutesBad} />
    </label>
    <div class="actions">
      <button type="button" class="btn" onclick={() => (muteOpen = false)}>Cancel</button>
      <button type="submit" class="btn primary" disabled={minutesBad}>Mute</button>
    </div>
  </form>
</Modal>

<Modal bind:open={transferOpen} title={`Transfer ${transferFor ?? ''}`} icon="transfer">
  <form onsubmit={submitTransfer}>
    <div class="field">
      <span id="dest">Destination</span>
      <div class="seg" role="radiogroup" aria-labelledby="dest">
        <button type="button" role="radio" aria-checked={mode === 'instance'} class:on={mode === 'instance'} onclick={() => (mode = 'instance')}>Existing instance</button>
        <button type="button" role="radio" aria-checked={mode === 'new'} class:on={mode === 'new'} onclick={() => (mode = 'new')}>New instance</button>
      </div>
    </div>
    {#if mode === 'instance'}
      <label class="field">
        <span>Instance</span>
        <select bind:value={instanceId} required>
          <option value="" disabled>Choose...</option>
          {#each targets as i (i.id)}
            <option value={String(i.id)}>#{i.id} {i.area} ({i.players.length} players)</option>
          {/each}
        </select>
      </label>
    {:else}
      <label class="field">
        <span>Area (<code>WorldAreas.Id</code>, e.g. G1_1)</span>
        <input bind:value={area} required />
      </label>
      <div class="grid3">
        <label class="field"><span>Seed</span><input type="number" min="0" bind:value={seed} placeholder="auto" /></label>
        <label class="field"><span>Topology</span><input type="number" min="1" bind:value={topology} placeholder="client's" /></label>
        <label class="field"><span>Orientation 0-8</span><input type="number" min="0" max="8" bind:value={orientation} placeholder="client's" /></label>
      </div>
    {/if}
    <div class="actions">
      <button type="button" class="btn" onclick={() => (transferOpen = false)}>Cancel</button>
      <button type="submit" class="btn primary" disabled={transferInvalid}>Transfer</button>
    </div>
  </form>
</Modal>
