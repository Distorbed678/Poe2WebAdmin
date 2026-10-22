<script lang="ts">
  import { api, unwrap } from '../api/client';
  import { toasts, run } from '../notify.svelte';
  import { MOTD_MAX, motdProblem } from '../motd';
  import Icon from './Icon.svelte';

  /** The message now in effect (from `GET /server`); `undefined` until the first answer. */
  let { current }: { current: string | undefined } = $props();

  let draft = $state('');
  let loaded = $state(false);
  let saving = $state(false);

  // The first answer fills the box; later refreshes do not overwrite what is being typed.
  $effect(() => {
    if (current !== undefined && !loaded) {
      draft = current;
      loaded = true;
    }
  });

  const dirty = $derived(loaded && draft.trim() !== (current ?? '').trim());
  const problem = $derived(motdProblem(draft));

  async function save(e: SubmitEvent) {
    e.preventDefault();
    if (problem) return;
    saving = true;
    const ok = await run(
      async () => {
        const r = await unwrap(api.POST('/api/v1/admin/motd', { body: { motd: draft } }));
        if (!r.persisted) toasts.show('error', `Applied, but not written to the config file: ${r.note ?? 'unknown reason'}`);
        draft = r.motd;
        return r;
      },
      (r) => (r.motd === '' ? 'Message of the day cleared' : r.persisted ? 'Message of the day saved' : 'Message of the day applied'),
    );
    saving = false;
    void ok;
  }
</script>

<section class="card">
  <div class="card-head"><span class="head-icon"><Icon name="announce" size={16} /></span><h2>Message of the day</h2></div>
  <form onsubmit={save}>
    <label class="field">
      <span class="sr-only">Message of the day</span>
      <textarea rows="3" bind:value={draft} maxlength={MOTD_MAX} placeholder="Shown on the launcher's Home page, e.g. Maintenance on Friday 18:00." aria-invalid={problem !== null}></textarea>
      <span class="counter">{[...draft].length} / {MOTD_MAX}</span>
    </label>
    {#if problem}<p class="err" role="alert">{problem}</p>{/if}
    <div class="actions">
      <span class="hint grow">Plain text. Applies at once and is written into the config file.</span>
      <button type="button" class="btn sm" disabled={!dirty || saving} onclick={() => (draft = current ?? '')}>Reset</button>
      <button type="submit" class="btn primary sm" disabled={!dirty || saving || problem !== null}><Icon name="save" size={14} /> Save</button>
    </div>
  </form>
</section>
