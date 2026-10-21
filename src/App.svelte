<script lang="ts">
  import { auth } from './lib/auth.svelte';
  import { router } from './lib/router.svelte';
  import { features } from './lib/features';
  import { api, errorMessage } from './lib/api/client';
  import { run } from './lib/notify.svelte';
  import ConfirmDialog from './lib/ui/ConfirmDialog.svelte';
  import Toasts from './lib/ui/Toasts.svelte';
  import Modal from './lib/ui/Modal.svelte';
  import Login from './pages/Login.svelte';
  import Dashboard from './pages/Dashboard.svelte';
  import Logs from './pages/Logs.svelte';
  import Sessions from './pages/Sessions.svelte';
  import Instances from './pages/Instances.svelte';
  import Accounts from './pages/Accounts.svelte';
  import Characters from './pages/Characters.svelte';
  import CharacterDetail from './pages/CharacterDetail.svelte';
  import Panel from './pages/Panel.svelte';

  interface NavItem {
    page: string;
    label: string;
  }
  const nav: NavItem[] = [
    { page: 'dashboard', label: 'Dashboard' },
    { page: 'logs', label: 'Live logs' },
    { page: 'sessions', label: 'Players online' },
    { page: 'instances', label: 'Instances' },
    { page: 'accounts', label: 'Accounts' },
    { page: 'characters', label: 'Characters' },
    ...(features.inventory ? [{ page: 'inventory', label: 'Inventory' }] : []),
    ...(features.passives ? [{ page: 'passives', label: 'Passive tree' }] : []),
  ];

  // A route that is not shown (unknown page, or a stub whose flag is off) falls back to the dashboard.
  const page = $derived(nav.some((n) => n.page === router.page) ? router.page : 'dashboard');

  let announceOpen = $state(false);
  let message = $state('');
  let sending = $state(false);

  async function announce(e: SubmitEvent) {
    e.preventDefault();
    sending = true;
    const ok = await run(async () => {
      const { data, error, response } = await api.POST('/api/v1/admin/announce', { body: { message: message.trim() } });
      if (!data) throw new Error(errorMessage(error, response.status));
      return data;
    }, 'Announcement sent');
    sending = false;
    if (ok) {
      announceOpen = false;
      message = '';
    }
  }
</script>

{#if !auth.loggedIn}
  <Login />
{:else}
  <a class="skip" href="#main">Skip to content</a>
  <div class="shell">
    <header class="topbar">
      <span class="brand">PoE2 <b>Admin</b></span>
      <span class="grow"></span>
      <button type="button" onclick={() => (announceOpen = true)}>Announce</button>
      <span class="who muted">{auth.account?.username ?? ''}</span>
      <button type="button" onclick={() => auth.logout()}>Sign out</button>
    </header>
    <nav class="side" aria-label="Main">
      {#each nav as n (n.page)}
        <a href={'#/' + n.page} aria-current={page === n.page ? 'page' : undefined}>{n.label}</a>
      {/each}
    </nav>
    <main id="main" tabindex="-1">
      {#if page === 'dashboard'}
        <Dashboard />
      {:else if page === 'logs'}
        <Logs />
      {:else if page === 'sessions'}
        <Sessions />
      {:else if page === 'instances'}
        <Instances />
      {:else if page === 'accounts'}
        <Accounts />
      {:else if page === 'characters'}
        {#if router.route.segments[1]}
          <CharacterDetail id={router.route.segments[1]} />
        {:else}
          <Characters />
        {/if}
      {:else if page === 'inventory'}
        <Panel title="Inventory" flag="VITE_FEATURE_INVENTORY" />
      {:else if page === 'passives'}
        <Panel title="Passive tree" flag="VITE_FEATURE_PASSIVES" />
      {/if}
    </main>
  </div>

  <Modal bind:open={announceOpen} title="Announce to all players">
    <form onsubmit={announce}>
      <label class="field">
        <span>Message (shown as a &lt;Server&gt; chat line)</span>
        <textarea rows="3" bind:value={message} required maxlength="500"></textarea>
      </label>
      <div class="actions">
        <button type="button" onclick={() => (announceOpen = false)}>Cancel</button>
        <button type="submit" class="primary" disabled={sending || message.trim() === ''}>Send</button>
      </div>
    </form>
  </Modal>
{/if}

<ConfirmDialog />
<Toasts />
