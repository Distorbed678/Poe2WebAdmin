<script lang="ts">
  import { onDestroy, tick } from 'svelte';
  import { api, type LogEvent, type LogLevel } from '../lib/api/client';
  import { auth } from '../lib/auth.svelte';
  import { LEVELS, LogStore, logsWsUrl, matchesFilter, type LogFilter } from '../lib/logs/ring';
  import { LogSocket, type SocketState } from '../lib/logs/socket';
  import PageHead from '../lib/ui/PageHead.svelte';

  const CAP = 3000;
  const store = new LogStore(CAP);

  let level = $state<LogLevel>('info');
  let target = $state('');
  let text = $state('');
  const filter = (): LogFilter => ({ min_level: level, target, text, history: 200 });

  let view = $state.raw<LogEvent[]>([]);
  let paused = $state(false);
  let autoscroll = $state(true);
  let pending = $state(0); // lines that arrived while paused
  let conn = $state<SocketState>('connecting');
  let retryInfo = $state('');
  let notice = $state<string | null>(null);
  let scroller: HTMLDivElement | undefined = $state();

  let flushTimer: ReturnType<typeof setTimeout> | null = null;
  function scheduleFlush() {
    if (flushTimer) return;
    flushTimer = setTimeout(() => {
      flushTimer = null;
      if (paused) return;
      view = store.snapshot();
    }, 100);
  }

  const socket = new LogSocket({
    url: () => (auth.token ? logsWsUrl(location, auth.token) : null),
    filter,
    onState(s, info) {
      conn = s;
      retryInfo = s === 'reconnecting' && info?.delayMs ? `retry ${info.attempt} in ${(info.delayMs / 1000).toFixed(1)}s` : '';
    },
    onMessage(m) {
      switch (m.type) {
        case 'hello':
          // Every (re)connect replays the history: start from an empty view.
          store.clear();
          pending = 0;
          notice = null;
          view = paused ? view : [];
          break;
        case 'event':
          if (!matchesFilter(filter(), m.event)) break;
          store.push([m.event]);
          if (paused) pending += 1;
          scheduleFlush();
          break;
        case 'reset':
          store.clear();
          pending = 0;
          if (!paused) view = [];
          break;
        case 'lagged':
          notice = `The server skipped ${m.missed} events because this page read too slowly.`;
          break;
        case 'error':
          notice = `Server: ${m.message}`;
          break;
      }
    },
    // A socket that never opens may mean the token is dead: any admin call answers with 401 then,
    // and the client sends us back to the login.
    onConnectFailed: () => void api.GET('/api/v1/admin/sessions').catch(() => {}),
  });
  socket.start();
  onDestroy(() => {
    socket.stop();
    if (flushTimer) clearTimeout(flushTimer);
  });

  // Filter changes go to the server after a short pause in typing.
  let sendTimer: ReturnType<typeof setTimeout> | undefined;
  let first = true;
  $effect(() => {
    void [level, target, text];
    if (first) {
      first = false;
      return;
    }
    clearTimeout(sendTimer);
    sendTimer = setTimeout(() => socket.sendFilter(), 300);
    return () => clearTimeout(sendTimer);
  });

  function togglePause() {
    paused = !paused;
    if (!paused) {
      pending = 0;
      view = store.snapshot();
    }
  }
  function clearView() {
    store.clear();
    pending = 0;
    view = [];
  }

  $effect(() => {
    void view;
    if (!autoscroll || paused) return;
    void tick().then(() => {
      if (scroller) scroller.scrollTop = scroller.scrollHeight;
    });
  });

  function onScroll() {
    if (!scroller) return;
    autoscroll = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 24;
  }

  const clock = (ms: number) => {
    const d = new Date(ms);
    const p = (n: number, w = 2) => String(n).padStart(w, '0');
    return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}`;
  };
  const fields = (e: LogEvent) =>
    Object.entries(e.fields)
      .map(([k, v]) => `${k}=${v}`)
      .join(' ');
</script>

<PageHead title="Live logs" subtitle="Server log events, newest at the bottom">
  <span class="conn {conn}" role="status">
    {conn}{retryInfo ? ` (${retryInfo})` : ''}
  </span>
</PageHead>

<form class="toolbar filters" onsubmit={(e) => e.preventDefault()} aria-label="Log filters">
  <label class="inline">
    <span>Level</span>
    <select bind:value={level}>
      {#each LEVELS as l (l)}<option value={l}>{l}{l === 'error' ? '' : ' and worse'}</option>{/each}
    </select>
  </label>
  <label class="inline">
    <span>Target</span>
    <input placeholder="prefix, e.g. instance_server" bind:value={target} spellcheck="false" />
  </label>
  <label class="inline grow">
    <span>Search</span>
    <input type="search" placeholder="message or field text" bind:value={text} />
  </label>
  <button type="button" onclick={togglePause} aria-pressed={paused}>
    {paused ? `Resume${pending ? ` (${pending} new)` : ''}` : 'Pause'}
  </button>
  <label class="check"><input type="checkbox" bind:checked={autoscroll} /> Autoscroll</label>
  <button type="button" onclick={clearView}>Clear</button>
</form>

{#if notice}<p class="notice" role="status">{notice}</p>{/if}

<!-- A scrollable region must be reachable by keyboard to scroll it. -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div class="log" role="log" aria-label="Server log" tabindex="0" bind:this={scroller} onscroll={onScroll}>
  {#each view as e (e.seq)}
    <div class="line lvl-{e.level}">
      <time>{clock(e.ts_ms)}</time>
      <span class="lvl">{e.level}</span>
      <span class="tgt">{e.target}</span>
      <span class="msg">{e.message}{#if fields(e)} <span class="flds">{fields(e)}</span>{/if}</span>
    </div>
  {:else}
    <p class="muted empty-log">{conn === 'open' ? 'No events match the filters yet.' : 'Waiting for the connection...'}</p>
  {/each}
</div>
<p class="muted log-foot">
  {view.length} lines shown (at most {CAP} kept){store.dropped ? `, ${store.dropped} older dropped` : ''}{paused ? ', paused' : ''}
</p>
