<script lang="ts">
  import { api, errorMessage } from '../lib/api/client';
  import { auth } from '../lib/auth.svelte';
  import Toasts from '../lib/ui/Toasts.svelte';
  import Icon from '../lib/ui/Icon.svelte';
  import Spinner from '../lib/ui/Spinner.svelte';
  import ThemeToggle from '../lib/ui/ThemeToggle.svelte';

  // First run: the server has no accounts, and this browser runs on the server's own computer
  // (the server checks both). The account made here is the admin, signed in at once.
  let { name }: { name: string } = $props();
  let username = $state('');
  let password = $state('');
  let password2 = $state('');
  let busy = $state(false);
  let error = $state<string | null>(null);

  const valid = $derived(/^[A-Za-z0-9_.@+-]{3,64}$/.test(username.trim()) && password.length >= 8 && password === password2);

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    busy = true;
    error = null;
    const { data, error: err, response } = await api.POST('/api/v1/setup', { body: { username: username.trim(), password } });
    if (!data) {
      busy = false;
      error = errorMessage(err, response.status);
      return;
    }
    password = '';
    password2 = '';
    try {
      await auth.acceptSetup(data);
    } catch (e2) {
      error = e2 instanceof Error ? e2.message : String(e2);
    }
    busy = false;
  }
</script>

<div class="login-wrap">
  <span class="theme-corner" style="position: absolute; top: 14px; right: 14px"><ThemeToggle /></span>
  <form class="card login" onsubmit={submit}>
    <div class="login-brand">
      <img src="./logo.png" alt="" width="64" height="64" />
      <h1>Welcome</h1>
      <p class="muted">{name || 'This server'} has no accounts yet. Create the admin account: it manages the server and its players.</p>
    </div>
    {#if error}<div class="notice danger" role="alert"><span class="notice-title"><Icon name="alert" size={16} /> {error}</span></div>{/if}
    <label class="field">
      <span>Admin account name</span>
      <!-- svelte-ignore a11y_autofocus -->
      <input autocomplete="username" autofocus required bind:value={username} />
    </label>
    <label class="field"><span>Password <span class="muted">(at least 8 characters)</span></span><input type="password" autocomplete="new-password" required bind:value={password} /></label>
    <label class="field">
      <span>Repeat the password</span>
      <input type="password" autocomplete="new-password" required bind:value={password2} aria-invalid={password2 !== '' && password !== password2} />
    </label>
    <button type="submit" class="btn primary lg" disabled={busy || !valid}>
      {#if busy}<Spinner size={14} /> Creating...{:else}Create admin and sign in{/if}
    </button>
    <p class="hint center">Only possible on this computer, and only until the first account exists. Log in with the same account in the launcher to play.</p>
  </form>
</div>
<Toasts />

<style>
  .center { text-align: center; margin: 0; }
</style>
