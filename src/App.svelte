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
  import { slide } from 'svelte/transition';
  import { DUR, ease, ms } from './lib/motion';
  import ThemeToggle from './lib/ui/ThemeToggle.svelte';
  import ShutdownBanner from './lib/ui/ShutdownBanner.svelte';
  import Login from './pages/Login.svelte';
  import Register from './pages/Register.svelte';
  import Setup from './pages/Setup.svelte';
  import Dashboard from './pages/Dashboard.svelte';
  import Logs from './pages/Logs.svelte';
  import Players from './pages/Players.svelte';
  import Instances from './pages/Instances.svelte';
  import Accounts from './pages/Accounts.svelte';
  import Characters from './pages/Characters.svelte';
  import CharacterDetail from './pages/CharacterDetail.svelte';
  import Schedule from './pages/Schedule.svelte';
  import Config from './pages/Config.svelte';
  import Mods from './pages/Mods.svelte';
  import Panel from './pages/Panel.svelte';

  interface NavItem {
    page: string;
    label: string;
    icon: IconName;
  }
  interface NavGroup {
    id: string;
    label: string | null;
    /** Folded by default (the advanced tools): it opens by itself while one of its pages is shown. */
    folds: boolean;
    items: NavItem[];
  }
  // The dashboard, then three groups: people, the world, the server itself.
  const groups: NavGroup[] = [
    { id: 'home', label: null, folds: false, items: [{ page: 'dashboard', label: 'Dashboard', icon: 'dashboard' }] },
    {
      id: 'people',
      label: 'People',
      folds: false,
      items: [
        { page: 'players', label: 'Players', icon: 'players' },
        { page: 'accounts', label: 'Accounts', icon: 'accounts' },
        { page: 'characters', label: 'Characters', icon: 'characters' },
      ],
    },
    {
      id: 'world',
      label: 'World',
      folds: false,
      items: [
        { page: 'instances', label: 'Instances', icon: 'instances' },
        { page: 'schedule', label: 'Schedule', icon: 'calendar' },
      ],
    },
    {
      id: 'server',
      label: 'Server',
      folds: false,
      items: [
        { page: 'config', label: 'Config', icon: 'settings' },
        { page: 'mods', label: 'Mods', icon: 'mods' },
        { page: 'logs', label: 'Live logs', icon: 'logs' },
        ...(features.inventory ? [{ page: 'inventory', label: 'Inventory', icon: 'inventory' as const }] : []),
        ...(features.passives ? [{ page: 'passives', label: 'Passive tree', icon: 'passives' as const }] : []),
      ],
    },
  ];
  const nav = groups.flatMap((g) => g.items);
  const FOLD_KEY = 'poe2admin.advanced-open';
  let advancedOpen = $state(readFold());
  function readFold(): boolean {
    try {
      return localStorage.getItem(FOLD_KEY) === '1';
    } catch {
      return false;
    }
  }
  function toggleFold() {
    advancedOpen = !advancedOpen;
    try {
      localStorage.setItem(FOLD_KEY, advancedOpen ? '1' : '0');
    } catch {
      /* private mode: just for this visit */
    }
  }
  const showGroup = (g: NavGroup) => !g.folds || advancedOpen || g.items.some((n) => n.page === page);

  // A route that is not shown (unknown page, or a stub whose flag is off) falls back to the dashboard.
  // (`#/sessions` was the players page's old address.)
  const routed = $derived(router.page === 'sessions' ? 'players' : router.page);
  const page = $derived(nav.some((n) => n.page === routed) ? routed : 'dashboard');

  // Signed out: a new server without accounts shows the first-run page instead of the login (the
  // server answers `needed` only to a browser on its own computer).
  let setup = $state<{ needed: boolean; name: string } | null>(null);
  $effect(() => {
    if (auth.loggedIn || router.page === 'register') return;
    void api.GET('/api/v1/setup').then(({ data }) => (setup = data ? { needed: data.needed, name: data.name } : { needed: false, name: '' }));
  });

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

{#if router.page === 'register'}
  <Register />
{:else if !auth.loggedIn}
  {#if setup?.needed}<Setup name={setup.name} />{:else}<Login />{/if}
{:else}
  <a class="skip" href="#main">Skip to content</a>
  <div class="window">
    <ShutdownBanner />
    <div class="body">
      <nav class="side" aria-label="Main">
        <a class="brand" href="#/dashboard" aria-label="PoE2 Admin, dashboard">
          <img src="./logo.png" alt="" width="26" height="26" />
          <span class="brand-text">
            <b>Admin</b>
            <small title={server.link.reachable ? 'The server answers' : 'The server does not answer'}>
              <span class="dot-state" class:on={server.link.reachable} class:bad={!server.link.reachable}></span>
              {#if server.info}{server.info.name}{:else if server.link.reachable}online{:else}offline{/if}
            </small>
          </span>
        </a>
        {#each groups as g (g.id)}
          {#if g.label && g.folds}
            <button type="button" class="side-group" aria-expanded={showGroup(g)} aria-controls="nav-{g.id}" onclick={toggleFold}>
              {g.label} <Icon name="chevron" size={12} />
            </button>
          {:else if g.label}
            <div class="side-group">{g.label}</div>
          {/if}
          {#if showGroup(g)}
            <div id="nav-{g.id}" class="side-items" transition:slide={{ duration: ms(DUR.base), easing: ease }}>
              {#each g.items as n (n.page)}
                <a href={'#/' + n.page} aria-current={page === n.page ? 'page' : undefined} title={n.label}>
                  <Icon name={n.icon} size={16} />
                  <span class="label">{n.label}</span>
                </a>
              {/each}
            </div>
          {/if}
        {/each}
        <span class="spacer"></span>
        <div class="side-actions">
          <button type="button" class="btn sm" onclick={() => (announceOpen = true)} title="Announce to all players">
            <Icon name="announce" size={14} /> <span class="label">Announce...</span>
          </button>
        </div>
        <div class="side-foot">
          <span class="who" title="Signed in as {auth.account?.username ?? ''}">
            <Icon name="shield" size={13} />
            <span>{auth.account?.username ?? ''}</span>
          </span>
          <ThemeToggle />
          <button type="button" class="btn icon sm ghost" onclick={() => auth.logout()} title="Sign out" aria-label="Sign out">
            <Icon name="logout" size={15} />
          </button>
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
            {:else if page === 'mods'}
              <Mods />
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
