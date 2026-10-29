<script lang="ts">
  import { api, unwrap, errorMessage, type RunView, type TaskBody, type TaskView } from '../lib/api/client';
  import { Resource } from '../lib/resource.svelte';
  import { confirms, run } from '../lib/notify.svelte';
  import { formatUnix } from '../lib/format';
  import {
    MAX_DELAY_SECS,
    MAX_MESSAGE_CHARS,
    TASK_KINDS,
    WEEKDAYS,
    emptyRestartForm,
    emptyScheduleForm,
    formFromSchedule,
    formatInZone,
    nameError,
    relativeFuture,
    relativePast,
    restartFormFrom,
    scheduleFromForm,
    statusLabel,
    statusTone,
    taskFromForm,
  } from '../lib/schedule';
  import PageHead from '../lib/ui/PageHead.svelte';
  import Status from '../lib/ui/Status.svelte';
  import Modal from '../lib/ui/Modal.svelte';
  import Icon from '../lib/ui/Icon.svelte';
  import Chip from '../lib/ui/Chip.svelte';
  import Empty from '../lib/ui/Empty.svelte';
  import Spinner from '../lib/ui/Spinner.svelte';

  const res = new Resource(() => unwrap(api.GET('/api/v1/admin/schedule')));
  $effect(() => res.start(10000));

  const d = $derived(res.data);
  const zone = $derived(d?.timezone ?? 'UTC');
  const offset = $derived(d?.utc_offset ?? '+00:00');
  const now = $derived(d?.now ?? Math.floor(Date.now() / 1000));
  const at = (unix: number) => formatInZone(unix, zone, offset);

  // --- create and edit
  let formOpen = $state(false);
  let editing = $state<TaskView | null>(null);
  let name = $state('');
  let enabled = $state(true);
  let kind = $state<string>('restart');
  let restart = $state(emptyRestartForm());
  let sched = $state(emptyScheduleForm());
  let busy = $state(false);

  function openNew() {
    editing = null;
    name = '';
    enabled = true;
    kind = 'restart';
    restart = emptyRestartForm();
    sched = emptyScheduleForm();
    formOpen = true;
  }

  function openEdit(t: TaskView) {
    if (!t.task || !t.schedule) return;
    editing = t;
    name = t.name;
    enabled = t.enabled;
    kind = t.task.kind;
    restart = restartFormFrom(t.task);
    sched = formFromSchedule(t.schedule);
    formOpen = true;
  }

  const nameProblem = $derived(nameError(name));
  const taskParsed = $derived(taskFromForm(restart));
  const schedParsed = $derived(scheduleFromForm(sched));
  const formBad = $derived(nameProblem !== null || !taskParsed.ok || !schedParsed.ok);

  // The server's preview: the next runs and a word-for-word reading of the schedule (cron is only fully checked there).
  let preview = $state<{ description: string; next: number[] } | { error: string } | null>(null);
  let previewSeq = 0;
  $effect(() => {
    if (!formOpen) return;
    const parsed = schedParsed;
    if (!parsed.ok) {
      preview = null;
      return;
    }
    const seq = ++previewSeq;
    const timer = setTimeout(async () => {
      const { data, error, response } = await api.POST('/api/v1/admin/schedule/preview', { body: { schedule: parsed.value } });
      if (seq !== previewSeq) return;
      preview = data ? { description: data.description, next: data.next_runs } : { error: errorMessage(error, response.status) };
    }, 250);
    return () => clearTimeout(timer);
  });
  const previewBad = $derived(preview !== null && 'error' in preview);

  function toggleDay(id: string) {
    sched.days = sched.days.includes(id) ? sched.days.filter((x) => x !== id) : [...sched.days, id];
  }

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    if (!taskParsed.ok || !schedParsed.ok || nameProblem || previewBad) return;
    const body: TaskBody = { name: name.trim(), enabled, task: taskParsed.value, schedule: schedParsed.value };
    busy = true;
    const ok = await run(
      async () => {
        if (editing) await unwrap(api.POST('/api/v1/admin/schedule/tasks/{id}', { params: { path: { id: editing.id } }, body }));
        else await unwrap(api.POST('/api/v1/admin/schedule/tasks', { body }));
      },
      editing ? 'Task saved' : 'Task created',
    );
    busy = false;
    if (ok) {
      formOpen = false;
      void res.load();
    }
  }

  async function toggle(t: TaskView) {
    const next = !t.enabled;
    if (
      await run(
        () => unwrap(api.POST(next ? '/api/v1/admin/schedule/tasks/{id}/enable' : '/api/v1/admin/schedule/tasks/{id}/disable', { params: { path: { id: t.id } } })),
        next ? `${t.name} is on` : `${t.name} is off`,
      )
    ) {
      void res.load();
    } else {
      void res.load(); // puts the switch back
    }
  }

  async function remove(t: TaskView) {
    const ok = await confirms.ask({
      title: `Delete "${t.name}"?`,
      message: 'The task and its history are removed. A restart that is already counting down is not cancelled.',
      confirmLabel: 'Delete',
    });
    if (ok && (await run(() => unwrap(api.POST('/api/v1/admin/schedule/tasks/{id}/delete', { params: { path: { id: t.id } } })), 'Task deleted'))) {
      void res.load();
    }
  }

  // --- history
  let historyOpen = $state(false);
  let historyFor = $state<TaskView | null>(null);
  let runs = $state<RunView[] | null>(null);
  let runsError = $state<string | null>(null);

  async function openHistory(t: TaskView) {
    historyFor = t;
    runs = null;
    runsError = null;
    historyOpen = true;
    try {
      runs = await unwrap(api.GET('/api/v1/admin/schedule/tasks/{id}/runs', { params: { path: { id: t.id } } }));
    } catch (e) {
      runsError = e instanceof Error ? e.message : String(e);
    }
  }
</script>

<PageHead title="Schedule" subtitle="Tasks that run by themselves, in the server's time zone" icon="calendar">
  <Status {res} />
  <button type="button" class="btn sm icon ghost" onclick={() => res.load()} disabled={res.loading} aria-label="Refresh" title="Refresh"><Icon name="refresh" size={14} /></button>
</PageHead>

<div class="toolbar">
  <span class="grow"></span>
  <button type="button" class="btn primary" onclick={openNew}><Icon name="plus" size={14} /> New task</button>
</div>

{#if d}
  <p class="zone-line">
    <Icon name="clock" size={15} />
    Server time zone: <b>{zone}</b> (UTC{offset}), now <b>{at(now)}</b>
  </p>
  {#if !d.enabled}
    <div class="notice"><span class="notice-title"><Icon name="alert" size={16} /> The scheduler is off</span><p class="muted">Tasks are listed but never run. Set <code>[scheduler] enabled = true</code> and restart.</p></div>
  {/if}
  {#if d.tasks.length === 0}
    <Empty icon="calendar" title="No scheduled tasks">
      Create a task to restart the server every night, for example. A restart warns the players first.
      {#snippet action()}<button type="button" class="btn primary" onclick={openNew}><Icon name="plus" size={15} /> New task</button>{/snippet}
    </Empty>
  {:else}
    <div class="table-wrap">
      <table>
        <thead>
          <tr><th>Task</th><th>Schedule</th><th>Next run</th><th>Last run</th><th>On</th><th class="actions-col">Actions</th></tr>
        </thead>
        <tbody>
          {#each d.tasks as t (t.id)}
            <tr class:dim={!t.enabled}>
              <td>
                <b>{t.name}</b>
                <div class="muted small">{t.problem ? t.problem : t.task_text}</div>
              </td>
              <td>{t.schedule_text ?? '-'}</td>
              <td>
                {#if t.next_run_at}
                  <span title={at(t.next_run_at)}>{relativeFuture(t.next_run_at, now)}</span>
                  <div class="muted small">{at(t.next_run_at)}</div>
                {:else}
                  <span class="muted">{t.enabled ? '-' : 'off'}</span>
                {/if}
              </td>
              <td>
                {#if t.last_run_at}
                  <Chip tone={statusTone(t.last_status)}>{statusLabel(t.last_status)}</Chip>
                  <div class="muted small" title={formatUnix(t.last_run_at)}>{relativePast(t.last_run_at, now)}</div>
                {:else}
                  <span class="muted">never ran</span>
                {/if}
              </td>
              <td>
                <label class="switch" title={t.enabled ? 'Turn off' : 'Turn on'}>
                  <input type="checkbox" role="switch" checked={t.enabled} disabled={!!t.problem && !t.enabled} onchange={() => toggle(t)} aria-label={`${t.name} enabled`} />
                  <span class="track"><span class="thumb"></span></span>
                </label>
              </td>
              <td>
                <div class="row-actions">
                  <button type="button" class="btn sm" onclick={() => openHistory(t)}><Icon name="history" size={13} /> History</button>
                  <button type="button" class="btn sm" disabled={!!t.problem} onclick={() => openEdit(t)}><Icon name="edit" size={13} /> Edit</button>
                  <button type="button" class="btn sm danger" onclick={() => remove(t)}><Icon name="trash" size={13} /> Delete</button>
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    <p class="hint foot">A run that is more than a couple of minutes late (the server was down or asleep) is skipped and shown as <em>missed</em>; it is never made up afterwards.</p>
  {/if}
{:else if res.error}
  <div class="notice danger" role="alert"><span class="notice-title"><Icon name="alert" size={16} /> {res.error}</span></div>
{:else}
  <div class="loading"><Spinner size={20} /> Loading...</div>
{/if}

<Modal bind:open={formOpen} title={editing ? 'Edit task' : 'New task'} icon="calendar">
  <form onsubmit={submit}>
    <label class="field">
      <span>Name</span>
      <input bind:value={name} maxlength="80" placeholder="Nightly restart" required aria-invalid={name !== '' && nameProblem !== null} />
    </label>

    <label class="field">
      <span>Action</span>
      <select bind:value={kind}>
        {#each TASK_KINDS as k (k.id)}<option value={k.id}>{k.label}</option>{/each}
      </select>
    </label>

    {#if kind === 'restart'}
      <div class="grid2">
        <label class="field">
          <span>Countdown (seconds, 0 to {MAX_DELAY_SECS})</span>
          <input type="number" min="0" max={MAX_DELAY_SECS} step="1" inputmode="numeric" bind:value={restart.delay} aria-invalid={!taskParsed.ok} />
        </label>
        <label class="field">
          <span>Message to the players (optional)</span>
          <input bind:value={restart.message} maxlength={MAX_MESSAGE_CHARS} placeholder="Nightly maintenance" />
        </label>
      </div>
      <p class="hint">The players are warned in chat during the countdown, then disconnected, and the server starts again.</p>
    {/if}

    <div class="field">
      <span id="sched-type">When</span>
      <div class="seg" role="radiogroup" aria-labelledby="sched-type">
        {#each [['daily', 'Every day'], ['weekly', 'Days of the week'], ['interval', 'Every N hours'], ['cron', 'Cron']] as [id, label] (id)}
          <button type="button" role="radio" aria-checked={sched.type === id} class:on={sched.type === id} onclick={() => (sched.type = id as typeof sched.type)}>{label}</button>
        {/each}
      </div>
    </div>

    {#if sched.type === 'daily' || sched.type === 'weekly'}
      <label class="field narrow">
        <span>At ({zone} time)</span>
        <input type="time" bind:value={sched.time} required />
      </label>
    {/if}
    {#if sched.type === 'weekly'}
      <div class="field">
        <span id="days">Days</span>
        <div class="quick" role="group" aria-labelledby="days">
          {#each WEEKDAYS as w (w.id)}
            <button type="button" class:on={sched.days.includes(w.id)} aria-pressed={sched.days.includes(w.id)} onclick={() => toggleDay(w.id)}>{w.label}</button>
          {/each}
        </div>
      </div>
    {/if}
    {#if sched.type === 'interval'}
      <label class="field narrow">
        <span>Every (like 6h, 90m, 1d; 1 minute to 30 days)</span>
        <input bind:value={sched.every} placeholder="6h" autocomplete="off" aria-invalid={!schedParsed.ok} />
      </label>
      <p class="hint">Counted from the last run, or from the server start. A server that restarts more often than this never reaches it.</p>
    {/if}
    {#if sched.type === 'cron'}
      <label class="field">
        <span>Cron expression: minute hour day-of-month month day-of-week</span>
        <input class="mono" bind:value={sched.cron} placeholder="0 4 * * mon-fri" autocomplete="off" spellcheck="false" aria-invalid={!schedParsed.ok || previewBad} />
      </label>
      <p class="hint">
        Each field takes <code>*</code>, a number, a range <code>1-5</code>, a list <code>1,3</code>, a step <code>*/15</code>;
        months and weekdays also take names (<code>jan</code>, <code>mon-fri</code>). If both day fields are set, either may match.
      </p>
    {/if}

    {#if !schedParsed.ok}
      <p class="err" role="alert">{schedParsed.error}</p>
    {:else if preview && 'error' in preview}
      <p class="err" role="alert">{preview.error}</p>
    {:else if preview}
      <div class="preview" aria-live="polite">
        <b>{preview.description}</b>
        {#if preview.next.length === 0}
          <span class="muted">never matches a date</span>
        {:else}
          <ul>
            {#each preview.next as n (n)}<li>{at(n)} <span class="muted">{relativeFuture(n, now)}</span></li>{/each}
          </ul>
        {/if}
      </div>
    {/if}

    <div class="field"><label class="check"><input type="checkbox" bind:checked={enabled} /> <span>Turned on</span></label></div>

    <div class="actions">
      <button type="button" class="btn" onclick={() => (formOpen = false)}>Cancel</button>
      <button type="submit" class="btn primary" disabled={busy || formBad || previewBad}><Icon name="save" size={15} /> {editing ? 'Save task' : 'Create task'}</button>
    </div>
  </form>
</Modal>

<Modal bind:open={historyOpen} title={`History of ${historyFor?.name ?? ''}`} icon="history">
  {#if runsError}
    <div class="notice danger" role="alert"><span class="notice-title"><Icon name="alert" size={16} /> {runsError}</span></div>
  {:else if runs === null}
    <div class="loading"><Spinner size={18} /> Loading...</div>
  {:else if runs.length === 0}
    <p class="muted">This task has not run yet.</p>
  {:else}
    <div class="table-wrap history">
      <table>
        <thead><tr><th>Due</th><th>Result</th><th>What happened</th></tr></thead>
        <tbody>
          {#each runs as r (r.id)}
            <tr>
              <td>{at(r.due_at)}</td>
              <td><Chip tone={statusTone(r.status)}>{statusLabel(r.status)}</Chip></td>
              <td>{r.message || '-'}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
  <div class="actions"><button type="button" class="btn" onclick={() => (historyOpen = false)}>Close</button></div>
</Modal>
