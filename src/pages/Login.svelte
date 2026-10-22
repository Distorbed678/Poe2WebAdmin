<script lang="ts">
  import { auth } from '../lib/auth.svelte';
  import Toasts from '../lib/ui/Toasts.svelte';
  import Icon from '../lib/ui/Icon.svelte';
  import Spinner from '../lib/ui/Spinner.svelte';
  import ThemeToggle from '../lib/ui/ThemeToggle.svelte';

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
  <span class="theme-corner" style="position: absolute; top: 14px; right: 14px"><ThemeToggle /></span>
  <form class="card login" onsubmit={submit}>
    <div class="login-brand">
      <img src="./logo.png" alt="" width="72" height="72" />
      <h1>PoE2 <b>Admin</b></h1>
      <p class="muted">Sign in with an admin account.</p>
    </div>
    {#if auth.pending}
      <div class="notice info" role="status"><span class="notice-title"><Spinner size={14} /> Signing you in...</span></div>
    {/if}
    {#if auth.notice}
      <div class="notice" role="status"><span class="notice-title"><Icon name="info" size={16} /> {auth.notice}</span></div>
    {/if}
    {#if error}
      <div class="notice danger" role="alert"><span class="notice-title"><Icon name="alert" size={16} /> {error}</span></div>
    {/if}
    <label class="field">
      <span>Username</span>
      <!-- svelte-ignore a11y_autofocus -->
      <input name="username" autocomplete="username" autofocus required bind:value={username} />
    </label>
    <label class="field">
      <span>Password</span>
      <input name="password" type="password" autocomplete="current-password" required bind:value={password} />
    </label>
    <button type="submit" class="btn primary lg" disabled={busy || !username || !password}>
      {#if busy}<Spinner size={14} /> Signing in...{:else}Sign in{/if}
    </button>
  </form>
</div>
<Toasts />
