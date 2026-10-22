<script lang="ts">
  import { api, unwrap, type BanView, type InstanceView } from '../lib/api/client';
  import { Resource } from '../lib/resource.svelte';
  import { auth } from '../lib/auth.svelte';
  import { router, hrefFor } from '../lib/router.svelte';
  import { confirms, run } from '../lib/notify.svelte';
  import { formatUnix, intOrNull } from '../lib/format';
  import { type PlayerSort, banEnds, banTarget, banTone, classLevel, connectedFor, filterPlayers, sortPlayers } from '../lib/players';
  import PageHead from '../lib/ui/PageHead.svelte';
  import Status from '../lib/ui/Status.svelte';
  import Modal from '../lib/ui/Modal.svelte';
  import Icon from '../lib/ui/Icon.svelte';
  import Chip from '../lib/ui/Chip.svelte';
  import Empty from '../lib/ui/Empty.svelte';
  import Spinner from '../lib/ui/Spinner.svelte';
  import BanDialog, { type BanTarget } from '../lib/ui/BanDialog.svelte';

  // The tab lives in the address (#/players?tab=bans) so other pages can link to it.
  const tab = $derived<'online' | 'bans'>(router.route.query.get('tab') === 'bans' ? 'bans' : 'online');

  const res = new Resource(async () => {
    const [sessions, instances] = await Promise.all([
      unwrap(api.GET('/api/v1/admin/sessions')),
      unwrap(api.GET('/api/v1/admin/instances')),
    ]);
    return { sessions, instances };
  });
  $effect(() => res.start(5000));

  let showAllBans = $state(false);
  const bans = new Resource(() => unwrap(api.GET('/api/v1/admin/bans', { params: { query: showAllBans ? {} : { active: true } } })));
  $effect(() => {
    void showAllBans; // reload when the filter changes
    return bans.start(15000);
  });

  const nowSecs = $derived(Math.floor((res.updated ?? bans.updated ?? new Date()).getTime() / 1000));

  let filter = $state('');
  let sortBy = $state<PlayerSort>('character');
  const rows = $derived(sortPlayers(filterPlayers(res.data?.sessions ?? [], filter), sortBy));
  const activeBans = $derived((bans.data ?? []).filter((b) => b.status === 'active').length);

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
    const ok = await confirms.ask({
      title: `Unmute ${name}?`,
      message: `${name} can chat again.`,
      confirmLabel: 'Unmute',
      danger: false,
    });
    if (ok && (await run(() => unwrap(api.POST('/api/v1/admin/players/{name}/unmute', { params: { path: { name } } }))))) {
      void res.load();
    }
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
    if (ok) {
      muteOpen = false;
      void res.load();
    }
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

  // --- ban dialog and the ban list
  let banOpen = $state(false);
  let banTargetState = $state<BanTarget>({ kind: 'account' });
  function openBan(target: BanTarget) {
    banTargetState = target;
    banOpen = true;
  }
  function banDone() {
    void bans.load();
    void res.load();
  }

  async function lift(b: BanView) {
    const ok = await confirms.ask({
      title: `Lift the ban on ${banTarget(b)}?`,
      message: b.kind === 'ip' ? 'Connections from this address are accepted again.' : 'The account can log in again.',
      confirmLabel: 'Lift ban',
      danger: false,
    });
    if (ok && (await run(() => unwrap(api.POST('/api/v1/admin/bans/{id}/lift', { params: { path: { id: b.id } } })), `Ban on ${banTarget(b)} lifted`))) {
      void bans.load();
    }
  }
</script>

<PageHead title="Players" subtitle={tab === 'online' ? 'Characters currently in game' : 'Bans on accounts and addresses'} icon="players">
  {#if tab === 'online'}
    <label class="inline">
      <span class="sr-only">Filter players</span>
      <input type="search" placeholder="Filter..." bind:value={filter} />
    </label>
    <label class="inline">
      <span>Sort</span>
      <select bind:value={sortBy}>
        <option value="character">Character</option>
        <option value="account">Account</option>
        <option value="level">Level</option>
        <option value="connected">Longest connected</option>
      </select>
    </label>
    <Status {res} />
    <button type="button" class="btn sm" onclick={() => res.load()} disabled={res.loading}>
      <Icon name="refresh" size={14} /> Refresh
    </button>
  {:else}
    <Status res={bans} />
    <button type="button" class="btn sm" onclick={() => bans.load()} disabled={bans.loading}>
      <Icon name="refresh" size={14} /> Refresh
    </button>
    <button type="button" class="btn sm danger" onclick={() => openBan({ kind: 'ip' })}><Icon name="ban" size={14} /> New ban</button>
  {/if}
</PageHead>

<div class="tabs" role="tablist" aria-label="Players">
  <a role="tab" aria-selected={tab === 'online'} class:on={tab === 'online'} href={hrefFor('players')}>
    <Icon name="players" size={15} /> Online {#if res.data}<span class="count">{res.data.sessions.length}</span>{/if}
  </a>
  <a role="tab" aria-selected={tab === 'bans'} class:on={tab === 'bans'} href={hrefFor('players', { tab: 'bans' })}>
    <Icon name="ban" size={15} /> Bans {#if bans.data && !showAllBans}<span class="count">{activeBans}</span>{/if}
  </a>
</div>

{#if tab === 'online'}
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
            <tr>
              <th>Character</th><th>Account</th><th>Area</th><th class="num">Instance</th><th>Connected</th>
              <th title="Shown to admins only">IP address</th><th class="actions-col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {#each rows as s (s.character)}
              {@const self = s.account === auth.account?.username}
              <tr>
                <td>
                  <span class="name-cell"><b>{s.character}</b>{#if s.muted}<Chip tone="warn" icon="mute">muted</Chip>{/if}</span>
                  <div class="muted small">{classLevel(s)}</div>
                </td>
                <td><a href={'#/characters?account=' + encodeURIComponent(s.account)}>{s.account}</a>{#if self} <Chip tone="accent">you</Chip>{/if}</td>
                <td>{s.area}</td>
                <td class="num">{s.instance ?? '-'}</td>
                <td title={formatUnix(s.connected_at)}>{connectedFor(s.connected_at, nowSecs)}</td>
                <td>{#if s.ip}<code>{s.ip}</code>{:else}<span class="muted">-</span>{/if}</td>
                <td>
                  <div class="row-actions">
                    {#if s.muted}
                      <button type="button" class="btn sm" onclick={() => unmute(s.character)}>Unmute</button>
                    {:else}
                      <button type="button" class="btn sm" onclick={() => openMute(s.character)}><Icon name="mute" size={13} /> Mute</button>
                    {/if}
                    <button type="button" class="btn sm" onclick={() => openTransfer(s.character)}><Icon name="transfer" size={13} /> Transfer</button>
                    <button type="button" class="btn sm danger" onclick={() => kick(s.character)}><Icon name="kick" size={13} /> Kick</button>
                    <button
                      type="button"
                      class="btn sm danger"
                      disabled={self}
                      title={self ? 'You cannot ban yourself' : `Ban the account ${s.account}`}
                      onclick={() => openBan({ kind: 'account', account: s.account, seenIp: s.ip ?? null })}
                    >
                      <Icon name="ban" size={13} /> Ban
                    </button>
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
{:else}
  <div class="toolbar tab-tools">
    <label class="check"><input type="checkbox" bind:checked={showAllBans} /> Show ended and lifted bans too</label>
  </div>
  {#if bans.data}
    {#if bans.data.length === 0}
      <Empty icon="ban" title={showAllBans ? 'No bans yet' : 'No active bans'}>
        Ban an account from the Online tab or the Accounts page, or an address with New ban.
      </Empty>
    {:else}
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>Target</th><th>Reason</th><th>By</th><th>Created</th><th>Ends</th><th class="actions-col">Actions</th></tr>
          </thead>
          <tbody>
            {#each bans.data as b (b.id)}
              <tr>
                <td>
                  <span class="name-cell">
                    <Chip tone={banTone(b)} icon={b.kind === 'ip' ? 'wifi' : 'accounts'}>{b.kind === 'ip' ? 'address' : 'account'}</Chip>
                    <b>{banTarget(b)}</b>
                  </span>
                </td>
                <td>{b.reason || '-'}</td>
                <td>{b.created_by}</td>
                <td title={formatUnix(b.created_at)}>{formatUnix(b.created_at)}</td>
                <td title={b.expires_at ? formatUnix(b.expires_at) : 'never'}>
                  <span class="name-cell"><Chip tone={banTone(b)} dot={b.status === 'active'}>{b.status}</Chip> <span class="muted">{banEnds(b, nowSecs)}</span></span>
                </td>
                <td>
                  <div class="row-actions">
                    {#if b.status === 'active'}
                      <button type="button" class="btn sm" onclick={() => lift(b)}><Icon name="undo" size={13} /> Lift</button>
                    {/if}
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  {:else if bans.error}
    <div class="notice danger" role="alert"><span class="notice-title"><Icon name="alert" size={16} /> {bans.error}</span></div>
  {:else}
    <div class="loading"><Spinner size={20} /> Loading...</div>
  {/if}
{/if}

<BanDialog bind:open={banOpen} target={banTargetState} onDone={banDone} />

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
