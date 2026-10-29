<script lang="ts">
  import Fold from '../lib/ui/Fold.svelte';
  import { api, unwrap, ApiError, type ConfigFile } from '../lib/api/client';
  import { Resource } from '../lib/resource.svelte';
  import { run, toasts } from '../lib/notify.svelte';
  import { formatUnix } from '../lib/format';
  import {
    type ConfigField,
    type FormValue,
    type FormValues,
    changedValues,
    clone,
    effectiveValues,
    fieldErrors,
    groupFields,
    listFromText,
    listToText,
    problemText,
  } from '../lib/configForm';
  import { MAX_DELAY_SECS, MAX_MESSAGE_CHARS } from '../lib/schedule';
  import PageHead from '../lib/ui/PageHead.svelte';
  import Modal from '../lib/ui/Modal.svelte';
  import Icon from '../lib/ui/Icon.svelte';
  import Chip from '../lib/ui/Chip.svelte';
  import Spinner from '../lib/ui/Spinner.svelte';
  import DiffView from '../lib/ui/DiffView.svelte';

  type Problem = { message: string; line?: number | null; column?: number | null };

  const file = new Resource(() => unwrap(api.GET('/api/v1/admin/config')));
  $effect(() => file.start());

  // What the page edits: the text, and the form's values (the form and the text are kept in step on every switch).
  let tab = $state<'form' | 'raw'>('form');
  /** Which form sections are open (the first one by default). */
  let openGroups = $state<Record<string, boolean>>({});
  let screen = $state<'edit' | 'review'>('edit');
  let loadedRev = $state('');
  let original = $state(''); // the file as loaded (what the diff compares against)
  let draft = $state('');
  let formOriginal = $state<FormValues>({});
  let form = $state<FormValues>({});
  let ready = $state(false);
  let working = $state(false);
  let notice = $state<string | null>(null);

  function adopt(f: ConfigFile) {
    loadedRev = f.revision;
    original = f.content;
    draft = f.content;
    const eff = effectiveValues(f.fields, f.values as Record<string, unknown>);
    formOriginal = eff;
    form = clone(eff);
    screen = 'edit';
    ready = true;
  }

  // The first load fills the page; later loads happen only on request (Reload, after a save).
  $effect(() => {
    if (file.data && !ready) adopt(file.data);
  });

  const f = $derived(file.data);
  const fields = $derived(f?.fields ?? []);
  const groups = $derived(groupFields(fields));
  const formChanges = $derived(changedValues(fields, formOriginal, form));
  const errors = $derived(fieldErrors(fields, form));
  const dirty = $derived(draft !== original || Object.keys(formChanges).length > 0);
  const editable = $derived(f?.editable ?? false);

  const asKey = (v: unknown) => v as FormValue;

  /** Writes the form's changes into the text through the server (comments and layout stay). */
  async function applyForm(): Promise<boolean> {
    if (Object.keys(formChanges).length === 0) return true;
    if (Object.keys(errors).length > 0) {
      notice = Object.values(errors)[0] ?? null;
      return false;
    }
    working = true;
    try {
      const r = await unwrap(api.POST('/api/v1/admin/config/fields', { body: { content: draft, set: formChanges as never } }));
      draft = r.content;
      const eff = effectiveValues(fields, r.values as Record<string, unknown>);
      formOriginal = eff;
      form = clone(eff);
      notice = null;
      return true;
    } catch (e) {
      notice = e instanceof Error ? e.message : String(e);
      return false;
    } finally {
      working = false;
    }
  }

  async function showTab(next: 'form' | 'raw') {
    if (next === tab) return;
    if (next === 'raw') {
      if (!(await applyForm())) return;
      tab = 'raw';
      return;
    }
    // Raw to form: read the values out of the text; a text that does not parse stays in the raw editor.
    working = true;
    try {
      const r = await unwrap(api.POST('/api/v1/admin/config/fields', { body: { content: draft, set: {} } }));
      if (r.parse_error) {
        notice = `The text does not parse yet: ${problemText(r.parse_error)}`;
        return;
      }
      const eff = effectiveValues(fields, r.values as Record<string, unknown>);
      formOriginal = eff;
      form = clone(eff);
      notice = null;
      tab = 'form';
    } catch (e) {
      notice = e instanceof Error ? e.message : String(e);
    } finally {
      working = false;
    }
  }

  // --- the syntax check under the raw editor
  let check = $state<{ valid: boolean; error?: Problem | null; warnings: string[] } | null>(null);
  let checkSeq = 0;
  $effect(() => {
    if (tab !== 'raw' || !ready) return;
    const text = draft;
    const seq = ++checkSeq;
    const timer = setTimeout(async () => {
      try {
        const r = await unwrap(api.POST('/api/v1/admin/config/validate', { body: { content: text } }));
        if (seq === checkSeq) check = r;
      } catch {
        if (seq === checkSeq) check = null;
      }
    }, 450);
    return () => clearTimeout(timer);
  });

  let rawBox: HTMLTextAreaElement | undefined = $state();
  function goToLine(line: number, column?: number | null) {
    if (!rawBox) return;
    const lines = draft.split('\n');
    let start = 0;
    for (let i = 0; i < line - 1 && i < lines.length; i += 1) start += lines[i]!.length + 1;
    const at = start + Math.max(0, (column ?? 1) - 1);
    rawBox.focus();
    rawBox.setSelectionRange(at, start + (lines[line - 1]?.length ?? 0));
  }
  const lineText = (line: number | null | undefined) => (line ? (draft.split('\n')[line - 1] ?? '') : '');

  // --- review, save, save and restart
  let reviewing = $state<{ valid: boolean; error?: Problem | null; warnings: string[] } | null>(null);
  let restartDelay = $state('30');
  let restartMessage = $state('Server configuration changed');
  const delayOk = $derived(/^\d+$/.test(restartDelay.trim()) && Number(restartDelay) <= MAX_DELAY_SECS);

  async function review() {
    if (tab === 'form' && !(await applyForm())) return;
    working = true;
    try {
      reviewing = await unwrap(api.POST('/api/v1/admin/config/validate', { body: { content: draft } }));
      screen = 'review';
      notice = null;
    } catch (e) {
      notice = e instanceof Error ? e.message : String(e);
    } finally {
      working = false;
    }
  }

  async function save(restart: boolean) {
    working = true;
    let conflict = false;
    const ok = await run(
      async () => {
        try {
          const r = await unwrap(
            api.POST('/api/v1/admin/config/save', {
              body: {
                content: draft,
                base_revision: loadedRev,
                restart: restart ? { delay_secs: Number(restartDelay), message: restartMessage.trim() || null } : null,
              },
            }),
          );
          if (r.restart_error) toasts.show('error', `Saved, but no restart: ${r.restart_error}`);
          return r;
        } catch (e) {
          conflict = e instanceof ApiError && e.status === 409;
          throw e;
        }
      },
      (r) => (!r.changed ? 'Nothing to save: the file already has this text' : r.restart ? 'Saved, the server restarts' : `Saved (backup ${r.backup})`),
    );
    working = false;
    if (ok) {
      ready = false; // adopt the new file
      await file.load();
      if (file.data) adopt(file.data);
      reviewing = null;
    } else if (conflict) {
      notice = 'The file changed on disk since you opened it. Reload to see the current version, then make your change again.';
      screen = 'edit';
    }
  }

  async function reload() {
    ready = false;
    notice = null;
    await file.load();
    if (file.data) adopt(file.data);
  }

  function discard() {
    if (file.data) adopt(file.data);
    notice = null;
  }

  // --- backups
  let backupsOpen = $state(false);
  let backups = $state<{ name: string; size: number; modified: number }[] | null>(null);
  let backupsError = $state<string | null>(null);
  async function openBackups() {
    backupsOpen = true;
    backups = null;
    backupsError = null;
    try {
      backups = await unwrap(api.GET('/api/v1/admin/config/backups'));
    } catch (e) {
      backupsError = e instanceof Error ? e.message : String(e);
    }
  }
  async function loadBackup(name: string) {
    const ok = await run(async () => {
      const b = await unwrap(api.GET('/api/v1/admin/config/backups/{name}', { params: { path: { name } } }));
      draft = b.content;
      tab = 'raw';
      screen = 'edit';
      return b;
    }, `Loaded ${name} into the editor: review it and save to restore it`);
    if (ok) backupsOpen = false;
  }

  const setList = (path: string, text: string) => (form[path] = listFromText(text));
  const defaultText = (fld: ConfigField) => {
    const v = asKey(fld.default);
    return Array.isArray(v) ? (v.length === 0 ? 'none' : v.join(', ')) : v === '' ? 'empty' : String(v);
  };
</script>

<PageHead title="Config" subtitle={f ? f.path : 'The server configuration file'} icon="settings">
  {#if f}
    <button type="button" class="btn sm" onclick={openBackups}><Icon name="history" size={14} /> Backups</button>
    <button type="button" class="btn sm" onclick={reload} disabled={file.loading || working}><Icon name="refresh" size={14} /> Reload</button>
  {/if}
</PageHead>

{#if f && ready}
  {#each f.notices as n (n)}
    <div class="notice info"><span class="notice-title"><Icon name="info" size={16} /> {n}</span></div>
  {/each}
  {#if f.warnings.length > 0}
    <div class="notice">
      <span class="notice-title"><Icon name="alert" size={16} /> This file has risky settings</span>
      <ul class="plain">{#each f.warnings as w (w)}<li>{w}</li>{/each}</ul>
    </div>
  {/if}
  {#if notice}
    <div class="notice danger" role="alert"><span class="notice-title"><Icon name="alert" size={16} /> {notice}</span></div>
  {/if}

  {#if screen === 'edit'}
    <div class="cfg-bar">
      <div class="seg" role="tablist" aria-label="Editor">
        <button type="button" role="tab" aria-selected={tab === 'form'} class:on={tab === 'form'} onclick={() => showTab('form')} disabled={working}>Form</button>
        <button type="button" role="tab" aria-selected={tab === 'raw'} class:on={tab === 'raw'} onclick={() => showTab('raw')} disabled={working}>Raw TOML</button>
      </div>
    </div>

    {#if tab === 'form'}
      <div class="cfg-groups">
        {#each groups as g (g.section)}
          <Fold title={g.title} open={openGroups[g.section] ?? g === groups[0]} summary={`${g.fields.length} setting${g.fields.length === 1 ? '' : 's'}${g.fields.some((x) => x.path in formChanges) ? ' · changed' : ''}`}>
            <div class="cfg-fields">
              {#each g.fields as fld (fld.path)}
                {@const err = errors[fld.path]}
                {@const changed = fld.path in formChanges}
                <div class="cfg-field" class:changed class:wide={fld.kind === 'list' || fld.multiline}>
                  <div class="cfg-label">
                    <label for={'f-' + fld.path}>{fld.label}</label>
                    {#if !fld.restart}<Chip tone="ok" title="Applies at once">live</Chip>{/if}
                    {#if changed}<Chip tone="accent">changed</Chip>{/if}
                  </div>
                  {#if fld.kind === 'bool'}
                    <label class="switch">
                      <input id={'f-' + fld.path} type="checkbox" role="switch" checked={form[fld.path] === true} disabled={!editable} onchange={(e) => (form[fld.path] = e.currentTarget.checked)} />
                      <span class="track"><span class="thumb"></span></span>
                      <span>{form[fld.path] === true ? 'on' : 'off'}</span>
                    </label>
                  {:else if fld.kind === 'int'}
                    <input id={'f-' + fld.path} type="number" step="1" min={fld.min ?? undefined} max={fld.max ?? undefined} inputmode="numeric" value={form[fld.path] as number} disabled={!editable} aria-invalid={!!err}
                      oninput={(e) => (form[fld.path] = e.currentTarget.value === '' ? (Number.NaN as number) : Number(e.currentTarget.value))} />
                  {:else if fld.kind === 'choice'}
                    <select id={'f-' + fld.path} value={form[fld.path] as string} disabled={!editable} onchange={(e) => (form[fld.path] = e.currentTarget.value)}>
                      {#each fld.options as o (o)}<option value={o}>{o}</option>{/each}
                    </select>
                  {:else if fld.kind === 'list'}
                    <textarea id={'f-' + fld.path} rows="3" spellcheck="false" placeholder="one per line" value={listToText(form[fld.path] as string[])} disabled={!editable} oninput={(e) => setList(fld.path, e.currentTarget.value)}></textarea>
                  {:else if fld.multiline}
                    <textarea id={'f-' + fld.path} rows="3" value={form[fld.path] as string} maxlength={fld.max_len ?? undefined} disabled={!editable} aria-invalid={!!err} oninput={(e) => (form[fld.path] = e.currentTarget.value)}></textarea>
                    <span class="counter">{[...(form[fld.path] as string)].length} / {fld.max_len}</span>
                  {:else}
                    <input id={'f-' + fld.path} value={form[fld.path] as string} maxlength={fld.max_len ?? undefined} disabled={!editable} aria-invalid={!!err} autocomplete="off" spellcheck="false" oninput={(e) => (form[fld.path] = e.currentTarget.value)} />
                  {/if}
                  {#if err}<span class="err small" role="alert">{err}</span>{/if}
                  <span class="hint">{fld.help} <span class="faint">Default: {defaultText(fld)}.{#if fld.restart}{" "}Needs a restart.{/if}</span></span>
                </div>
              {/each}
            </div>
          </Fold>
        {/each}
      </div>
      <p class="hint foot">The form covers the common keys. Everything else is in the Raw TOML tab; comments and layout are kept either way.</p>
    {:else}
      <section class="card raw">
        <textarea
          bind:this={rawBox}
          class="code"
          bind:value={draft}
          spellcheck="false"
          wrap="off"
          readonly={!editable}
          aria-label="Config file text (TOML)"
          aria-invalid={check?.valid === false}
        ></textarea>
        <div class="raw-status" aria-live="polite">
          {#if check === null}
            <span class="muted"><Spinner size={12} /> Checking...</span>
          {:else if check.valid}
            <Chip tone="ok" icon="check">valid</Chip>
            {#each check.warnings as w (w)}<span class="warn-text"><Icon name="alert" size={13} /> {w}</span>{/each}
          {:else if check.error}
            <Chip tone="bad" icon="alert">invalid</Chip>
            <span class="err">{problemText(check.error)}</span>
            {#if check.error.line}
              <button type="button" class="btn sm" onclick={() => goToLine(check?.error?.line ?? 1, check?.error?.column)}>Go to line {check.error.line}</button>
              <code class="line-ex">{lineText(check.error.line)}</code>
            {/if}
          {/if}
        </div>
      </section>
    {/if}
    {#if dirty}
      <div class="cfg-sticky">
        <Chip tone="warn" dot>unsaved changes</Chip>
        <span class="grow"></span>
        <button type="button" class="btn ghost" disabled={working} onclick={discard}><Icon name="undo" size={14} /> Discard</button>
        <button type="button" class="btn primary" disabled={working || !editable || Object.keys(errors).length > 0} onclick={review}>
          {#if working}<Spinner size={13} />{/if} Review and save
        </button>
      </div>
    {/if}
  {:else}
    <section class="card review">
      <div class="card-head"><span class="head-icon"><Icon name="edit" size={16} /></span><h2>Review changes</h2></div>
      {#if reviewing && !reviewing.valid && reviewing.error}
        <div class="notice danger" role="alert">
          <span class="notice-title"><Icon name="alert" size={16} /> The config is not valid, so it cannot be saved</span>
          <p>{problemText(reviewing.error)}</p>
        </div>
      {/if}
      {#if reviewing?.valid && reviewing.warnings.length > 0}
        <div class="notice">
          <span class="notice-title"><Icon name="alert" size={16} /> Risky settings in the new file</span>
          <ul class="plain">{#each reviewing.warnings as w (w)}<li>{w}</li>{/each}</ul>
        </div>
      {/if}
      <DiffView before={original} after={draft} />
      <hr class="sep" />
      <div class="cfg-restart">
        <label class="field narrow">
          <span>Countdown before a restart (seconds)</span>
          <input type="number" min="0" max={MAX_DELAY_SECS} step="1" inputmode="numeric" bind:value={restartDelay} aria-invalid={!delayOk} />
        </label>
        <label class="field grow">
          <span>Message to the players</span>
          <input bind:value={restartMessage} maxlength={MAX_MESSAGE_CHARS} />
        </label>
      </div>
      <div class="actions">
        <button type="button" class="btn" disabled={working} onclick={() => (screen = 'edit')}>Back to editing</button>
        <button type="button" class="btn primary" disabled={working || !reviewing?.valid} onclick={() => save(false)}><Icon name="save" size={15} /> Save</button>
        <button type="button" class="btn danger solid" disabled={working || !reviewing?.valid || !delayOk} onclick={() => save(true)}><Icon name="restart" size={15} /> Save and restart</button>
      </div>
      <p class="hint">The previous file is copied to <code>{f.backup_dir}</code> first. Changes apply at the next start, so Save and restart is what puts them in force.</p>
    </section>
  {/if}
{:else if file.error}
  <div class="notice danger" role="alert"><span class="notice-title"><Icon name="alert" size={16} /> {file.error}</span></div>
{:else}
  <div class="loading"><Spinner size={20} /> Loading...</div>
{/if}

<Modal bind:open={backupsOpen} title="Backups of the config" icon="history">
  {#if backupsError}
    <div class="notice danger" role="alert"><span class="notice-title"><Icon name="alert" size={16} /> {backupsError}</span></div>
  {:else if backups === null}
    <div class="loading"><Spinner size={18} /> Loading...</div>
  {:else if backups.length === 0}
    <p class="muted">No backups yet. One is made each time the file is saved here.</p>
  {:else}
    <div class="table-wrap history">
      <table>
        <thead><tr><th>Saved</th><th class="num">Size</th><th class="actions-col"></th></tr></thead>
        <tbody>
          {#each backups as b (b.name)}
            <tr>
              <td><code>{b.name}</code><div class="muted small">{formatUnix(b.modified)}</div></td>
              <td class="num">{b.size} B</td>
              <td><div class="row-actions"><button type="button" class="btn sm" onclick={() => loadBackup(b.name)}>Load in editor</button></div></td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
  <div class="actions"><button type="button" class="btn" onclick={() => (backupsOpen = false)}>Close</button></div>
</Modal>
