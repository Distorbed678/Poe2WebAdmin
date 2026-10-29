<script lang="ts">
  import { api, unwrap } from '../lib/api/client';
  import { Resource } from '../lib/resource.svelte';
  import { router, hrefFor } from '../lib/router.svelte';
  import PageHead from '../lib/ui/PageHead.svelte';
  import Status from '../lib/ui/Status.svelte';
  import Icon from '../lib/ui/Icon.svelte';
  import Chip from '../lib/ui/Chip.svelte';
  import Empty from '../lib/ui/Empty.svelte';
  import Spinner from '../lib/ui/Spinner.svelte';

  // The account filter lives in the URL (#/characters?account=bob) so the other pages can link to it.
  const account = $derived(router.route.query.get('account') ?? '');

  const accounts = new Resource(() => unwrap(api.GET('/api/v1/admin/accounts')));
  $effect(() => accounts.start());

  const res = new Resource(() => {
    const q = router.route.query.get('account')?.trim();
    return unwrap(api.GET('/api/v1/admin/characters', { params: { query: q ? { account: q } : {} } }));
  });
  $effect(() => {
    void router.route.query.get('account'); // reload when the filter changes
    return res.start();
  });

  function choose(v: string) {
    location.hash = hrefFor('characters', { account: v || undefined });
  }
</script>

<PageHead title="Characters" subtitle={account ? `Account ${account}` : 'All accounts'} icon="characters">
  <Status {res} />
  <button type="button" class="btn sm icon ghost" onclick={() => res.load()} disabled={res.loading} aria-label="Refresh" title="Refresh"><Icon name="refresh" size={14} /></button>
</PageHead>

<div class="toolbar">
  <label class="inline">
    <span>Account</span>
    <select value={account} onchange={(e) => choose(e.currentTarget.value)}>
      <option value="">All</option>
      {#each accounts.data ?? [] as a (a.id)}
        <option value={a.username}>{a.username}</option>
      {/each}
      {#if account && !(accounts.data ?? []).some((a) => a.username === account)}
        <option value={account}>{account}</option>
      {/if}
    </select>
  </label>
</div>

{#if res.data}
  {#if res.data.length === 0}
    <Empty icon="characters" title="No characters">{account ? `${account} has no characters yet.` : 'No account has created a character yet.'}</Empty>
  {:else}
    <div class="table-wrap">
      <table>
        <thead>
          <tr><th class="num">Id</th><th>Name</th><th>Account</th><th>League</th><th class="num">Level</th><th>Area</th><th>State</th></tr>
        </thead>
        <tbody>
          {#each res.data as c (c.id)}
            <tr>
              <td class="num">{c.id}</td>
              <td><a href={'#/characters/' + c.id}>{c.name}</a></td>
              <td>{c.account ?? c.account_id}</td>
              <td>{c.league}</td>
              <td class="num">{c.level}</td>
              <td>{c.area}</td>
              <td>{#if c.online}<Chip tone="ok" dot pulse>online</Chip>{:else}<span class="muted">offline</span>{/if}</td>
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
