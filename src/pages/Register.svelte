<script lang="ts">
  import { onMount } from 'svelte';
  import { api, errorMessage } from '../lib/api/client';
  import Toasts from '../lib/ui/Toasts.svelte';
  import Icon from '../lib/ui/Icon.svelte';
  import Spinner from '../lib/ui/Spinner.svelte';
  import ThemeToggle from '../lib/ui/ThemeToggle.svelte';

  // The server's public page for new player accounts (`#/register`; the launcher and the game's
  // "Create account" button open it). No sign-in needed; honours `[accounts] open_registration`.
  let name = $state('');
  let open = $state<boolean | null>(null);
  let username = $state('');
  let password = $state('');
  let password2 = $state('');
  let busy = $state(false);
  let error = $state<string | null>(null);
  let created = $state<string | null>(null);

  const valid = $derived(/^[A-Za-z0-9_.@+-]{3,64}$/.test(username.trim()) && password.length >= 8 && password === password2);

  onMount(async () => {
    const { data } = await api.GET('/api/v1/server');
    name = data?.name ?? '';
    open = data?.open_registration ?? false;
  });

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    busy = true;
    error = null;
    const { data, error: err, response } = await api.POST('/api/v1/register', { body: { username: username.trim(), password } });
    busy = false;
    if (!data) {
      error = errorMessage(err, response.status);
      return;
    }
    created = data.username;
    password = '';
    password2 = '';
  }
</script>

<div class="login-wrap">
  <span class="theme-corner" style="position: absolute; top: 14px; right: 14px"><ThemeToggle /></span>
  <form class="card login" onsubmit={submit}>
    <div class="login-brand">
      <img src="./logo.png" alt="" width="64" height="64" />
      <h1>{name || 'PoE2 server'}</h1>
      <p class="muted">{created ? 'Your account is ready.' : 'Create an account to play on this server.'}</p>
    </div>
    {#if open === null}
      <div class="loading"><Spinner size={16} /> Loading...</div>
    {:else if created}
      <div class="notice info" role="status">
        <span class="notice-title"><Icon name="check" size={16} /> Account {created} created</span>
        <p>Log in with it from the launcher (Servers, Log in) or in the game.</p>
      </div>
    {:else if !open}
      <div class="notice" role="status">
        <span class="notice-title"><Icon name="info" size={16} /> Registration is closed</span>
        <p>On this server an admin creates the accounts. Ask the person who runs it.</p>
      </div>
    {:else}
      {#if error}<div class="notice danger" role="alert"><span class="notice-title"><Icon name="alert" size={16} /> {error}</span></div>{/if}
      <label class="field">
        <span>Account name <span class="muted">(3-64 characters: letters, digits, _ . @ + -)</span></span>
        <!-- svelte-ignore a11y_autofocus -->
        <input autocomplete="username" autofocus required bind:value={username} />
      </label>
      <label class="field"><span>Password <span class="muted">(at least 8 characters)</span></span><input type="password" autocomplete="new-password" required bind:value={password} /></label>
      <label class="field">
        <span>Repeat the password</span>
        <input type="password" autocomplete="new-password" required bind:value={password2} aria-invalid={password2 !== '' && password !== password2} />
      </label>
      <button type="submit" class="btn primary lg" disabled={busy || !valid}>
        {#if busy}<Spinner size={14} /> Creating...{:else}Create account{/if}
      </button>
      <p class="hint center">{location.protocol === 'https:' ? 'The password travels encrypted (https).' : 'Plain http: only use a password you use nowhere else.'}</p>
    {/if}
  </form>
</div>
<Toasts />

<style>
  .center { text-align: center; margin: 0; }
</style>
