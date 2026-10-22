<script lang="ts">
  import { auth } from './lib/auth.svelte';
  import { router } from './lib/router.svelte';
  import { features } from './lib/features';
  import { api, errorMessage } from './lib/api/client';
  import { run } from './lib/notify.svelte';
  import { server } from './lib/server.svelte';
  import ConfirmDialog from './lib/ui/ConfirmDialog.svelte';
  import Toasts from './lib/ui/Toasts.svelte';
  import Modal from './lib/ui/Modal.svelte';
  import Icon, { type IconName } from './lib/ui/Icon.svelte';
  import Chip from './lib/ui/Chip.svelte';
  import Spinner from './lib/ui/Spinner.svelte';
  import ThemeToggle from './lib/ui/ThemeToggle.svelte';
  import ShutdownBanner from './lib/ui/ShutdownBanner.svelte';
  import Login from './pages/Login.svelte';
  import Dashboard from './pages/Dashboard.svelte';
  import Logs from './pages/Logs.svelte';
  import Players from './pages/Players.svelte';
  import Instances from './pages/Instances.svelte';
  import Accounts from './pages/Accounts.svelte';
  import Characters from './pages/Characters.svelte';
  import CharacterDetail from './pages/CharacterDetail.svelte';
  import Schedule from './pages/Schedule.svelte';
  import Config from './pages/Config.svelte';
  import Panel from './pages/Panel.svelte';

  interface NavItem {
    page: string;
    label: string;
    icon: IconName;
  }
  const nav: NavItem[] = [
    { page: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
    { page: 'logs', label: 'Live logs', icon: 'logs' },
    { page: 'players', label: 'Players', icon: 'players' },
    { page: 'instances', label: 'Instances', icon: 'instances' },
    { page: 'accounts', label: 'Accounts', icon: 'accounts' },
    { page: 'characters', label: 'Characters', icon: 'characters' },
    { page: 'schedule', label: 'Schedule', icon: 'calendar' },
    { page: 'config', label: 'Config', icon: 'settings' },
    ...(features.inventory ? [{ page: 'inventory', label: 'Inventory', icon: 'inventory' as const }] : []),
    ...(features.passives ? [{ page: 'passives', label: 'Passive tree', icon: 'passives' as const }] : []),
  ];

  // A route that is not shown (unknown page, or a stub whose flag is off) falls back to the dashboard.
  // (`#/sessions` was the players page's old address.)
  const routed = $derived(router.page === 'sessions' ? 'players' : router.page);
  const page = $derived(nav.some((n) => n.page === routed) ? routed : 'dashboard');

  // The server link is only polled while an admin is signed in.
  $effect(() => {
    if (!auth.loggedIn) return;
    return server.start();
  });

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

  // A page change returns to the top of the new page.
  let main: HTMLElement | undefined = $state();
  $effect(() => {
    void page;
    main?.scrollTo({ top: 0 });
  });
</script>

{#if !auth.loggedIn}
  <Login />
{:else}
  <a class="skip" href="#main">Skip to content</a>
  <div class="window">
    <header class="topbar">
      <a class="brand" href="#/dashboard" aria-label="PoE2 Admin, dashboard">
        <img src="./logo.png" alt="" width="28" height="28" />
        <span>PoE2 <b>Admin</b></span>
      </a>
      <div class="top-end">
        {#if server.link.reachable}
          <Chip tone="ok" dot pulse title="The server answers">{server.info ? `${server.info.online} online` : 'online'}</Chip>
        {:else}
          <Chip tone="bad" dot title="The server does not answer">offline</Chip>
        {/if}
        <button type="button" class="btn sm with-label" onclick={() => (announceOpen = true)} title="Announce to all players">
          <Icon name="announce" size={15} /> <span class="label">Announce</span>
        </button>
        <ThemeToggle />
        <span class="who" title="Signed in as {auth.account?.username ?? ''}">
          <span class="avatar"><Icon name="shield" size={15} /></span>
          <span>{auth.account?.username ?? ''}</span>
        </span>
        <button type="button" class="btn sm with-label" onclick={() => auth.logout()} title="Sign out">
          <Icon name="logout" size={15} /> <span class="label">Sign out</span>
        </button>
      </div>
    </header>
    <ShutdownBanner />
    <div class="body">
      <nav class="side" aria-label="Main">
        {#each nav as n (n.page)}
          <a href={'#/' + n.page} aria-current={page === n.page ? 'page' : undefined} title={n.label}>
            <Icon name={n.icon} size={18} />
            <span class="label">{n.label}</span>
          </a>
        {/each}
        <span class="spacer"></span>
        <div class="side-card">
          <strong><Icon name="server" size={14} /> {server.info?.name ?? 'Server'}</strong>
          <span class="muted">{#if server.info}client {server.info.version}{:else}<Spinner size={11} /> connecting{/if}</span>
        </div>
      </nav>
      <main id="main" tabindex="-1" bind:this={main}>
        {#key page}
          <div class="page">
            {#if page === 'dashboard'}
              <Dashboard />
            {:else if page === 'logs'}
              <Logs />
            {:else if page === 'players'}
              <Players />
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
            {:else if page === 'schedule'}
              <Schedule />
            {:else if page === 'config'}
              <Config />
            {:else if page === 'inventory'}
              <Panel title="Inventory" icon="inventory" flag="VITE_FEATURE_INVENTORY" />
            {:else if page === 'passives'}
              <Panel title="Passive tree" icon="passives" flag="VITE_FEATURE_PASSIVES" />
            {/if}
          </div>
        {/key}
      </main>
    </div>
  </div>

  <Modal bind:open={announceOpen} title="Announce to all players" icon="announce">
    <form onsubmit={announce}>
      <label class="field">
        <span>Message (shown as a &lt;Server&gt; chat line)</span>
        <textarea rows="3" bind:value={message} required maxlength="500"></textarea>
      </label>
      <div class="actions">
        <button type="button" class="btn" onclick={() => (announceOpen = false)}>Cancel</button>
        <button type="submit" class="btn primary" disabled={sending || message.trim() === ''}>Send</button>
      </div>
    </form>
  </Modal>
{/if}

<ConfirmDialog />
<Toasts />
