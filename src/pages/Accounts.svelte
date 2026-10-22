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

  const res = new Resource(() => unwrap(api.GET('/api/v1/admin/accounts')));
  $effect(() => res.start());

  let filter = $state('');
  const rows = $derived(
    (res.data ?? []).filter((a) => a.username.toLowerCase().includes(filter.trim().toLowerCase())),
  );

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

<PageHead title="Accounts" subtitle="Every account of this cluster" icon="accounts">
  <label class="inline">
    <span class="sr-only">Filter accounts</span>
    <input type="search" placeholder="Filter..." bind:value={filter} />
  </label>
  <Status {res} />
  <button type="button" class="btn sm" onclick={() => res.load()} disabled={res.loading}>
    <Icon name="refresh" size={14} /> Refresh
  </button>
</PageHead>

{#if res.data}
  {#if res.data.length === 0}
    <Empty icon="accounts" title="No accounts">Create one with <code>poe-server account create</code>.</Empty>
  {:else if rows.length === 0}
    <Empty icon="search" title="No account matches">Nothing matches "{filter}".</Empty>
  {:else}
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th class="num">Id</th><th>Username</th><th>Role</th><th>State</th><th>Created</th><th>Last login</th>
            <th class="actions-col">Actions</th>
          </tr>
        </thead>
        <tbody>
          {#each rows as a (a.id)}
            {@const self = a.username === auth.account?.username}
            <tr>
              <td class="num">{a.id}</td>
              <td>
                <span class="name-cell">
                  <a href={'#/characters?account=' + encodeURIComponent(a.username)}>{a.username}</a>
                  {#if self}<Chip tone="accent">you</Chip>{/if}
                  {#if !a.has_password}<Chip title="Dev machine-hash account: no password login">no password</Chip>{/if}
                </span>
              </td>
              <td>
                <select
                  aria-label={`Role of ${a.username}`}
                  value={a.role}
                  disabled={self}
                  title={self ? 'You cannot change your own role' : undefined}
                  onchange={(e) => setRole(a, e.currentTarget.value)}
                >
                  <option value="player">player</option>
                  <option value="admin">admin</option>
                </select>
              </td>
              <td>{#if a.disabled}<Chip tone="bad">disabled</Chip>{:else}<Chip tone="ok" dot>active</Chip>{/if}</td>
              <td>{formatUnix(a.created_at)}</td>
              <td>{formatUnix(a.last_login)}</td>
              <td>
                <div class="row-actions">
                  {#if a.disabled}
                    <button type="button" class="btn sm" onclick={() => enable(a)}>Enable</button>
                  {:else}
                    <button type="button" class="btn sm danger" disabled={self} onclick={() => disable(a)}>Disable</button>
                  {/if}
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
