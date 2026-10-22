<script lang="ts" module>
  /** What the dialog starts with. */
  export interface BanTarget {
    kind: 'account' | 'ip';
    account?: string;
    ip?: string;
    /** The address the account is playing from now (offers to ban it too). */
    seenIp?: string | null;
  }
</script>

<script lang="ts">
  import { api, unwrap } from '../api/client';
  import { confirms, run } from '../notify.svelte';
  import { MAX_BAN_SECS, MIN_BAN_SECS, banLengthOk, formatDuration, parseDuration } from '../duration';
  import { BAN_QUICK, banLength } from '../players';
  import Icon from './Icon.svelte';
  import Modal from './Modal.svelte';

  let { open = $bindable(false), target, onDone }: { open?: boolean; target: BanTarget; onDone?: () => void } = $props();

  let kind = $state<'account' | 'ip'>('account');
  let account = $state('');
  let ip = $state('');
  let reason = $state('');
  let lengthText = $state('7d');
  let permanent = $state(false);
  let alsoIp = $state(false);
  let busy = $state(false);

  // Each time the dialog opens it starts from its target.
  $effect(() => {
    if (!open) return;
    kind = target.kind;
    account = target.account ?? '';
    ip = target.ip ?? '';
    reason = '';
    lengthText = '7d';
    permanent = false;
    alsoIp = false;
  });

  const secs = $derived(permanent ? null : parseDuration(lengthText));
  const lengthBad = $derived(!permanent && (secs === null || !banLengthOk(secs)));
  const targetOk = $derived(kind === 'account' ? account.trim() !== '' : ip.trim() !== '');
  const what = $derived(kind === 'account' ? `account ${account.trim()}` : `address ${ip.trim()}`);
  const lengthWords = $derived(permanent ? 'permanently' : secs ? `for ${formatDuration(secs)}` : '');

  function pick(s: number | null) {
    permanent = s === null;
    if (s !== null) lengthText = formatDuration(s).replace(/ /g, '');
  }

  async function ban(body: { account?: string; ip?: string }) {
    return unwrap(
      api.POST('/api/v1/admin/bans', {
        body: { ...body, reason: reason.trim() || null, ...banLength(secs) },
      }),
    );
  }

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    if (lengthBad || !targetOk) return;
    if (permanent) {
      const sure = await confirms.ask({
        title: `Ban ${what} permanently?`,
        message: 'There is no end date. You can lift the ban from the Bans list at any time.',
        confirmLabel: 'Ban permanently',
      });
      if (!sure) return;
    }
    busy = true;
    const name = account.trim();
    const address = ip.trim();
    const ok = await run(
      async () => {
        if (kind === 'account') {
          const b = await ban({ account: name });
          // The address second: if it is refused (for example it is yours) the account stays banned.
          if (alsoIp && target.seenIp) {
            try {
              await ban({ ip: target.seenIp });
            } catch (err) {
              throw new Error(`${name} is banned, but the address was not: ${err instanceof Error ? err.message : err}`);
            }
          }
          return b;
        }
        return ban({ ip: address });
      },
      () => `${kind === 'account' ? name : address} banned ${lengthWords}`,
    );
    busy = false;
    if (ok) {
      open = false;
      onDone?.();
    }
  }
</script>

<Modal bind:open title="Ban" icon="ban" danger>
  <form onsubmit={submit}>
    <div class="field">
      <span id="ban-kind">Ban</span>
      <div class="seg" role="radiogroup" aria-labelledby="ban-kind">
        <button type="button" role="radio" aria-checked={kind === 'account'} class:on={kind === 'account'} onclick={() => (kind = 'account')}>An account</button>
        <button type="button" role="radio" aria-checked={kind === 'ip'} class:on={kind === 'ip'} onclick={() => (kind = 'ip')}>An IP address</button>
      </div>
    </div>

    {#if kind === 'account'}
      <label class="field">
        <span>Account name</span>
        <input bind:value={account} required autocomplete="off" spellcheck="false" />
      </label>
    {:else}
      <label class="field">
        <span>IPv4 or IPv6 address</span>
        <input bind:value={ip} required autocomplete="off" spellcheck="false" placeholder="203.0.113.7" />
      </label>
    {/if}

    <label class="field">
      <span>Reason (shown to the player)</span>
      <textarea rows="2" bind:value={reason} maxlength="200" placeholder="e.g. exploiting a bug"></textarea>
      <span class="counter">{reason.length} / 200</span>
    </label>

    <div class="field">
      <label class="lbl" for="ban-length">Length</label>
      <input id="ban-length" bind:value={lengthText} disabled={permanent} aria-invalid={lengthBad} placeholder="7d" autocomplete="off" />
      <div class="quick" role="group" aria-label="Common lengths">
        {#each BAN_QUICK as q (q.label)}
          <button type="button" class:on={q.secs === null ? permanent : !permanent && secs === q.secs} onclick={() => pick(q.secs)}>{q.label}</button>
        {/each}
      </div>
      {#if lengthBad}
        <span class="err" role="alert">Write a length like 30m, 12h, 7d or 2w ({formatDuration(MIN_BAN_SECS)} to {formatDuration(MAX_BAN_SECS)}), or choose Permanent.</span>
      {:else if secs}
        <span class="hint">{formatDuration(secs)}</span>
      {/if}
    </div>

    {#if kind === 'account' && target.seenIp}
      <div class="field">
        <label class="check">
          <input type="checkbox" bind:checked={alsoIp} />
          <span>Also ban its address <code>{target.seenIp}</code> for the same time</span>
        </label>
      </div>
    {/if}

    <div class="dialog-note danger">
      <Icon name="alert" size={16} />
      <span>
        {#if kind === 'account'}
          {account.trim() || 'The account'} is disconnected now, its saved logins stop working, and logging in shows the reason and the end date.
        {:else}
          Nobody can log in to the game or the web admin from this address{lengthWords ? ` ${lengthWords}` : ''}. Behind a shared connection (a household, a proxy) this bans everyone using it.
        {/if}
      </span>
    </div>

    <div class="actions">
      <button type="button" class="btn" onclick={() => (open = false)}>Cancel</button>
      <button type="submit" class="btn danger solid" disabled={busy || lengthBad || !targetOk}>
        <Icon name="ban" size={15} /> Ban {targetOk ? what : ''} {lengthWords}
      </button>
    </div>
  </form>
</Modal>
