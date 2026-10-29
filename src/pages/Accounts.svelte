<script lang="ts">
  import { api, unwrap, type AccountInfo } from '../lib/api/client';
  import { Resource } from '../lib/resource.svelte';
  import { auth } from '../lib/auth.svelte';
  import { confirms, run } from '../lib/notify.svelte';
  import { formatUnix } from '../lib/format';
  import PageHead from '../lib/ui/PageHead.svelte';
  import Status from '../lib/ui/Status.svelte';
  import Icon from '../lib/ui/Icon.svelte';
  import Chip from '../lib/ui/Chip.svelte';
  import Empty from '../lib/ui/Empty.svelte';
  import Spinner from '../lib/ui/Spinner.svelte';
  import BanDialog, { type BanTarget } from '../lib/ui/BanDialog.svelte';
  import Modal from '../lib/ui/Modal.svelte';
  import Drawer from '../lib/ui/Drawer.svelte';
  import { server } from '../lib/server.svelte';

  const res = new Resource(() => unwrap(api.GET('/api/v1/admin/accounts')));
  $effect(() => res.start());

  // One toolbar (search, a who-filter, New account); a row opens the account's drawer.
  let filter = $state('');
  let show = $state<'all' | 'admins' | 'disabled'>('all');
  const rows = $derived(
    (res.data ?? [])
      .filter((a) => a.username.toLowerCase().includes(filter.trim().toLowerCase()))
      .filter((a) => show === 'all' || (show === 'admins' ? a.role === 'admin' : a.disabled)),
  );
  let selected = $state<string | null>(null);
  const current = $derived((res.data ?? []).find((a) => a.username === selected) ?? null);

  // --- new account ---------------------------------------------------------------------------
  let newOpen = $state(false);
  let newName = $state('');
  let newPassword = $state('');
  let newPassword2 = $state('');
  let newRole = $state<'player' | 'admin'>('player');
  let creating = $state(false);
  const newValid = $derived(/^[A-Za-z0-9_.@+-]{3,64}$/.test(newName.trim()) && newPassword.length >= 8 && newPassword === newPassword2);

  function openNew() {
    newName = '';
    newPassword = '';
    newPassword2 = '';
    newRole = 'player';
    newOpen = true;
  }

  async function createAccount(e: SubmitEvent) {
    e.preventDefault();
    creating = true;
    const r = await run(
      () => unwrap(api.POST('/api/v1/admin/accounts', { body: { username: newName.trim(), password: newPassword, role: newRole } })),
      `Account ${newName.trim()} created`,
    );
    creating = false;
    if (r) {
      newPassword = '';
      newPassword2 = '';
      newOpen = false;
      void res.load();
    }
  }

  async function setRole(a: AccountInfo, role: string) {
    if (role === a.role) return;
    const ok = await confirms.ask({
      title: `Make ${a.username} ${role === 'admin' ? 'an admin' : 'a player'}?`,
      message:
        role === 'admin'
          ? 'Admins can kick, close instances and manage accounts.'
          : 'The account loses access to this site and the admin commands.',
      confirmLabel: 'Change role',
      danger: role !== 'admin',
    });
    if (ok) {
      await run(
        () => unwrap(api.POST('/api/v1/admin/accounts/{name}/role', { params: { path: { name: a.username } }, body: { role } })),
        `${a.username} is now ${role}`,
      );
    }
    void res.load(); // also resets the select when the change was cancelled or failed
  }

  async function disable(a: AccountInfo) {
    const ok = await confirms.ask({
      title: `Disable ${a.username}?`,
      message: 'Its tokens are revoked and its sessions end. It cannot log in until enabled again.',
      confirmLabel: 'Disable',
    });
    if (ok) {
      await run(
        () => unwrap(api.POST('/api/v1/admin/accounts/{name}/disable', { params: { path: { name: a.username } } })),
        `${a.username} disabled`,
      );
      void res.load();
    }
  }

  let banOpen = $state(false);
  let banTarget = $state<BanTarget>({ kind: 'account' });
  function openBan(a: AccountInfo) {
    banTarget = { kind: 'account', account: a.username };
    banOpen = true;
  }

  async function enable(a: AccountInfo) {
    if (
      await run(
        () => unwrap(api.POST('/api/v1/admin/accounts/{name}/enable', { params: { path: { name: a.username } } })),
        `${a.username} enabled`,
      )
    ) {
      void res.load();
    }
  }
</script>

<PageHead title="Accounts" subtitle={res.data ? `${res.data.length} account${res.data.length === 1 ? '' : 's'} · registration ${server.info?.open_registration ? 'open' : 'closed'}` : 'Every account of this cluster'} icon="accounts">
  <Status {res} />
  <button type="button" class="btn sm icon ghost" onclick={() => res.load()} disabled={res.loading} aria-label="Refresh" title="Refresh"><Icon name="refresh" size={14} /></button>
</PageHead>

<div class="toolbar">
  <label class="search">
    <Icon name="search" size={14} />
    <span class="sr-only">Search accounts</span>
    <input type="search" placeholder="Search accounts" bind:value={filter} />
  </label>
  <div class="pills" role="radiogroup" aria-label="Show">
    {#each [['all', 'All'], ['admins', 'Admins'], ['disabled', 'Disabled']] as [id, label] (id)}
      <button type="button" role="radio" aria-checked={show === id} class:on={show === id} onclick={() => (show = id as typeof show)}>{label}</button>
    {/each}
  </div>
  <span class="grow"></span>
  <button type="button" class="btn primary" onclick={openNew}><Icon name="plus" size={14} /> New account</button>
</div>

{#if res.data}
  {#if res.data.length === 0}
    <Empty icon="accounts" title="No accounts">Create one with New account.</Empty>
  {:else if rows.length === 0}
    <Empty icon="search" title="No account matches">Nothing matches this search.</Empty>
  {:else}
    <div class="table-wrap">
      <table class="clickable">
        <thead>
          <tr><th>Account</th><th>Role</th><th>State</th><th>Last login</th><th class="actions-col"><span class="sr-only">Details</span></th></tr>
        </thead>
        <tbody>
          {#each rows as a (a.id)}
            {@const self = a.username === auth.account?.username}
            <tr onclick={() => (selected = a.username)} class:on={selected === a.username}>
              <td>
                <span class="name-cell">
                  <b>{a.username}</b>
                  {#if self}<Chip tone="accent">you</Chip>{/if}
                  {#if !a.has_password}<Chip title="Dev machine-hash account: no password login">no password</Chip>{/if}
                </span>
              </td>
              <td>{a.role}</td>
              <td>{#if a.disabled}<Chip tone="bad">disabled</Chip>{:else}<Chip tone="ok" dot>active</Chip>{/if}</td>
              <td class="muted">{formatUnix(a.last_login)}</td>
              <td class="num"><button type="button" class="btn sm icon ghost" aria-label={`Details of ${a.username}`} onclick={(e) => { e.stopPropagation(); selected = a.username; }}><Icon name="chevron" size={14} /></button></td>
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

{#if current}
  {@const a = current}
  {@const self = a.username === auth.account?.username}
  <Drawer title={a.username} width={460} onclose={() => (selected = null)}>
    <dl class="kv">
      <dt>Role</dt>
      <dd>
        <select aria-label={`Role of ${a.username}`} value={a.role} disabled={self} title={self ? 'You cannot change your own role' : undefined} onchange={(e) => setRole(a, e.currentTarget.value)}>
          <option value="player">player</option>
          <option value="admin">admin</option>
        </select>
      </dd>
      <dt>State</dt><dd>{#if a.disabled}<Chip tone="bad">disabled</Chip>{:else}<Chip tone="ok" dot>active</Chip>{/if}</dd>
      <dt>Id</dt><dd>{a.id}</dd>
      <dt>Created</dt><dd>{formatUnix(a.created_at)}</dd>
      <dt>Last login</dt><dd>{formatUnix(a.last_login)}</dd>
      <dt>Characters</dt><dd><a href={'#/characters?account=' + encodeURIComponent(a.username)}>Show the characters</a></dd>
    </dl>
    <div class="drawer-actions">
      {#if a.disabled}
        <button type="button" class="btn" onclick={() => enable(a)}>Enable</button>
      {:else}
        <button type="button" class="btn danger" disabled={self} onclick={() => disable(a)}>Disable</button>
      {/if}
      <button type="button" class="btn danger" disabled={self || a.role === 'admin'}
        title={self ? 'You cannot ban yourself' : a.role === 'admin' ? 'Take the admin role away first' : 'Ban for a time or for good, with a reason'}
        onclick={() => openBan(a)}><Icon name="ban" size={13} /> Ban...</button>
    </div>
  </Drawer>
{/if}

<Modal bind:open={newOpen} title="New account" icon="plus">
  <form onsubmit={createAccount}>
    <label class="field"><span>Account name <span class="muted">(3-64 characters: letters, digits, _ . @ + -)</span></span><input bind:value={newName} autocomplete="off" /></label>
    <label class="field"><span>Password <span class="muted">(at least 8 characters)</span></span><input type="password" bind:value={newPassword} autocomplete="new-password" /></label>
    <label class="field"><span>Repeat the password</span><input type="password" bind:value={newPassword2} autocomplete="new-password" aria-invalid={newPassword2 !== '' && newPassword !== newPassword2} /></label>
    <label class="field"><span>Role</span>
      <select bind:value={newRole}><option value="player">player</option><option value="admin">admin</option></select>
    </label>
    <p class="hint">Give the password to its owner in person or over a private channel; they can change it in the launcher.</p>
    <div class="actions">
      <button type="button" class="btn" onclick={() => (newOpen = false)}>Cancel</button>
      <button type="submit" class="btn primary" disabled={creating || !newValid}>{#if creating}<Spinner size={14} />{/if} Create account</button>
    </div>
  </form>
</Modal>

<BanDialog bind:open={banOpen} target={banTarget} onDone={() => res.load()} />

<style>
  .drawer-actions { display: flex; gap: var(--sp-2); margin-top: var(--sp-5); }
  .kv select { max-width: 160px; }
</style>
