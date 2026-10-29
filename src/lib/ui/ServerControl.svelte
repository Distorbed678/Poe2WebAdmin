<script lang="ts">
  import { api, unwrap, type ShutdownKind } from '../api/client';
  import { run } from '../notify.svelte';
  import { server } from '../server.svelte';
  import { countdownText } from '../serverLink';
  import { formatUptime } from '../format';
  import { MAX_DELAY_SECS as MAX_DELAY, MAX_MESSAGE_CHARS as MAX_MESSAGE, parseDelay } from '../shutdown';
  import Icon from './Icon.svelte';
  import Chip from './Chip.svelte';
  import Modal from './Modal.svelte';
  import Progress from './Progress.svelte';

  const QUICK = [
    { label: 'Now', secs: 0 },
    { label: '30 s', secs: 30 },
    { label: '1 min', secs: 60 },
    { label: '5 min', secs: 300 },
    { label: '10 min', secs: 600 },
  ];

  /** `compact`: just the Restart and Stop buttons (the dashboard's title row; the countdown shows in the banner). */
  let { online = null, uptime = null, compact = false }: { online?: number | null; uptime?: number | null; compact?: boolean } = $props();

  let kind = $state<ShutdownKind>('restart');
  let open = $state(false);
  let message = $state('');
  // A number input binds a number once the user types; an empty one binds null.
  let delay = $state<string | number | null>('30');
  let busy = $state(false);

  const delayText = $derived(String(delay ?? '').trim());
  const delayValue = $derived(parseDelay(delay));
  const delayBad = $derived(delayValue === null);
  const verb = $derived(kind === 'stop' ? 'Stop' : 'Restart');
  const phase = $derived(server.phase);
  const p = $derived(server.pending);
  const players = $derived(online ?? server.info?.online ?? 0);
  const pct = $derived(p && p.delay_secs > 0 ? (server.remaining / p.delay_secs) * 100 : 0);

  function ask(k: ShutdownKind) {
    kind = k;
    message = '';
    delay = '30';
    open = true;
  }

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    if (delayBad) return;
    busy = true;
    const secs = delayValue ?? 0;
    const text = message.trim();
    const ok = await run(
      () =>
        unwrap(
          kind === 'stop'
            ? api.POST('/api/v1/admin/server/stop', { body: { delay_secs: secs, message: text || null } })
            : api.POST('/api/v1/admin/server/restart', { body: { delay_secs: secs, message: text || null } }),
        ),
      () => (secs === 0 ? `${verb} started` : `${verb} in ${countdownText(secs)}`),
    );
    busy = false;
    if (ok) {
      open = false;
      await server.refresh();
    }
  }

  let cancelling = $state(false);
  async function cancel() {
    cancelling = true;
    await run(() => unwrap(api.POST('/api/v1/admin/server/cancel')), (r) => r.message);
    cancelling = false;
    await server.refresh();
  }

  const tone = $derived(phase === 'up' ? 'ok' : phase === 'counting' || phase === 'draining' || phase === 'restarting' ? 'busy' : 'down');
  const label = $derived(
    {
      up: 'Running',
      counting: p?.action === 'stop' ? 'Stopping soon' : 'Restarting soon',
      draining: p?.action === 'stop' ? 'Stopping' : 'Restarting',
      restarting: 'Restarting',
      stopped: 'Stopped',
      unreachable: 'Unreachable',
    }[phase],
  );
  const chipTone = $derived(tone === 'ok' ? 'ok' : tone === 'busy' ? 'warn' : 'bad');
</script>

{#if compact}
  <button type="button" class="btn sm" disabled={phase !== 'up'} onclick={() => ask('restart')}><Icon name="restart" size={14} /> Restart</button>
  <button type="button" class="btn sm danger" disabled={phase !== 'up'} onclick={() => ask('stop')}><Icon name="stop" size={14} /> Stop</button>
{:else}
<section class="card control" aria-label="Server control">
  <div class="control-info">
    <span class="power {tone}"><Icon name="power" size={22} /></span>
    <div>
      <h3>
        Server
        <Chip tone={chipTone} dot pulse={tone !== 'down'}>{label}</Chip>
      </h3>
      <p class="muted">
        {#if phase === 'up' || phase === 'counting'}
          {players} player{players === 1 ? '' : 's'} online{#if uptime !== null}, up for {formatUptime(uptime)}{/if}
        {:else if phase === 'stopped'}
          The process has exited. It stays off until it is started again.
        {:else if phase === 'draining'}
          Disconnecting the players.
        {:else}
          {phase === 'unreachable' ? 'Not answering.' : 'Waiting for it to come back.'}
        {/if}
      </p>
    </div>
  </div>
  <div class="control-actions">
    <button type="button" class="btn lg" disabled={phase !== 'up'} onclick={() => ask('restart')}>
      <Icon name="restart" size={16} /> Restart
    </button>
    <button type="button" class="btn lg danger" disabled={phase !== 'up'} onclick={() => ask('stop')}>
      <Icon name="stop" size={16} /> Stop
    </button>
  </div>

  {#if p && phase === 'counting'}
    <div class="countdown">
      <div class="count">
        <b>{countdownText(server.remaining)}</b>
        <span class="muted">until the {p.action === 'stop' ? 'stop' : 'restart'}, asked by {p.requested_by}{#if p.message}: "{p.message}"{/if}</span>
        <span class="grow"></span>
        <button type="button" class="btn sm" disabled={cancelling} onclick={cancel}>Cancel {p.action}</button>
      </div>
      <Progress value={pct} danger label="Time left" />
    </div>
  {/if}
</section>
{/if}

<Modal bind:open title={kind === 'stop' ? 'Stop the server?' : 'Restart the server?'} icon={kind === 'stop' ? 'stop' : 'restart'} danger={kind === 'stop'}>
  <form onsubmit={submit}>
    <div class="dialog-note" class:danger={kind === 'stop'}>
      <Icon name="alert" size={16} />
      <span>
        {#if kind === 'stop'}
          {players} player{players === 1 ? ' is' : 's are'} in game. They are warned, then disconnected, and the server process exits. It stays off until someone starts it again.
        {:else}
          {players} player{players === 1 ? ' is' : 's are'} in game. They are warned, then disconnected, and can log in again once the server is back (a few seconds).
        {/if}
      </span>
    </div>

    <label class="field">
      <span>Message to the players (optional, added to every announcement)</span>
      <textarea rows="2" bind:value={message} maxlength={MAX_MESSAGE} placeholder="e.g. updating to a new build"></textarea>
      <span class="counter">{message.length} / {MAX_MESSAGE}</span>
    </label>

    <div class="field">
      <label class="lbl" for="delay">Countdown in seconds (announced in game)</label>
      <input id="delay" type="number" min="0" max={MAX_DELAY} step="1" inputmode="numeric" bind:value={delay} aria-invalid={delayBad} />
      <div class="quick" role="group" aria-label="Common countdowns">
        {#each QUICK as q (q.secs)}
          <button type="button" class:on={delayText === String(q.secs)} onclick={() => (delay = String(q.secs))}>{q.label}</button>
        {/each}
      </div>
      {#if delayBad}<span class="err" role="alert">A whole number of seconds from 0 to {MAX_DELAY}.</span>{/if}
    </div>

    <div class="actions">
      <button type="button" class="btn" onclick={() => (open = false)}>Cancel</button>
      <button type="submit" class="btn {kind === 'stop' ? 'danger solid' : 'primary'}" disabled={busy || delayBad}>
        <Icon name={kind === 'stop' ? 'stop' : 'restart'} size={16} />
        {verb}{delayValue ? ` in ${countdownText(delayValue)}` : ' now'}
      </button>
    </div>
  </form>
</Modal>
