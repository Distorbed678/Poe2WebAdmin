<script lang="ts">
  import { api, unwrap } from '../api/client';
  import { run } from '../notify.svelte';
  import { server } from '../server.svelte';
  import { countdownText } from '../serverLink';
  import Icon from './Icon.svelte';
  import Progress from './Progress.svelte';
  import Spinner from './Spinner.svelte';

  const p = $derived(server.pending);
  const verb = $derived(p?.action === 'stop' ? 'Stop' : 'Restart');
  const pct = $derived(p && p.delay_secs > 0 ? (server.remaining / p.delay_secs) * 100 : 0);
  let cancelling = $state(false);

  async function cancel() {
    cancelling = true;
    await run(() => unwrap(api.POST('/api/v1/admin/server/cancel')), (r) => r.message);
    cancelling = false;
    await server.refresh();
  }
</script>

{#if server.phase === 'counting' && p}
  <div class="banner warn" role="status">
    <Icon name="clock" size={18} />
    <span><strong>{verb} in {countdownText(server.remaining)}</strong>{#if p.message}: {p.message}{/if}
      <span class="muted">(asked by {p.requested_by})</span></span>
    <Progress value={pct} danger label="Time left" />
    <span class="banner-end">
      <button type="button" class="btn sm" disabled={cancelling} onclick={cancel}>Cancel {p.action}</button>
    </span>
  </div>
{:else if server.phase === 'draining'}
  <div class="banner warn" role="status">
    <Spinner size={16} />
    <span><strong>{verb === 'Stop' ? 'Stopping' : 'Restarting'} now.</strong> Players are being disconnected.</span>
  </div>
{:else if server.phase === 'restarting'}
  <div class="banner warn" role="status">
    <Spinner size={16} />
    <span><strong>The server is restarting.</strong> This page reconnects by itself.</span>
  </div>
{:else if server.phase === 'stopped'}
  <div class="banner danger" role="status">
    <Icon name="power" size={18} />
    <span><strong>The server has stopped.</strong> This page reconnects by itself if it is started again.</span>
  </div>
{:else if server.phase === 'unreachable'}
  <div class="banner danger" role="status">
    <Icon name="wifi" size={18} />
    <span><strong>Cannot reach the server.</strong> Retrying...</span>
  </div>
{/if}
