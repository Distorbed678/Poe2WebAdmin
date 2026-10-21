<script lang="ts">
  import { auth } from '../lib/auth.svelte';
  import Toasts from '../lib/ui/Toasts.svelte';

  let username = $state('');
  let password = $state('');
  let busy = $state(false);
  let error = $state<string | null>(null);

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    busy = true;
    error = null;
    try {
      await auth.login(username.trim(), password);
      password = '';
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    } finally {
      busy = false;
    }
  }
</script>

<div class="login-wrap">
  <form class="card login" onsubmit={submit}>
    <h1>PoE2 server admin</h1>
    <p class="muted">Sign in with an admin account.</p>
    {#if auth.notice}<p class="notice" role="status">{auth.notice}</p>{/if}
    {#if error}<p class="err" role="alert">{error}</p>{/if}
    <label class="field">
      <span>Username</span>
      <!-- svelte-ignore a11y_autofocus -->
      <input name="username" autocomplete="username" autofocus required bind:value={username} />
    </label>
    <label class="field">
      <span>Password</span>
      <input name="password" type="password" autocomplete="current-password" required bind:value={password} />
    </label>
    <button type="submit" class="primary" disabled={busy || !username || !password}>
      {busy ? 'Signing in...' : 'Sign in'}
    </button>
  </form>
</div>
<Toasts />
