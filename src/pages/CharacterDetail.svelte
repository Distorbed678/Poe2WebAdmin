<script lang="ts">
  import { api, unwrap } from '../lib/api/client';
  import { Resource } from '../lib/resource.svelte';
  import { features } from '../lib/features';
  import PageHead from '../lib/ui/PageHead.svelte';
  import Status from '../lib/ui/Status.svelte';

  let { id }: { id: string } = $props();

  const res = new Resource(() => unwrap(api.GET('/api/v1/admin/characters/{id}', { params: { path: { id: Number(id) } } })));
  $effect(() => {
    void id;
    return res.start(5000);
  });
  const c = $derived(res.data);
</script>

<PageHead title={c ? c.name : `Character ${id}`} subtitle="Character detail">
  <Status {res} />
  <a class="btn" href={c?.account ? '#/characters?account=' + encodeURIComponent(c.account) : '#/characters'}>Back to list</a>
</PageHead>

{#if c}
  <div class="two-col">
    <section class="card">
      <h2>Character</h2>
      <dl class="kv">
        <dt>Id</dt><dd>{c.id}</dd>
        <dt>Name</dt><dd>{c.name}</dd>
        <dt>Account</dt><dd>{c.account ?? '-'} <span class="muted">(#{c.account_id})</span></dd>
        <dt>League</dt><dd>{c.league}</dd>
        <dt>Class id</dt><dd>{c.class_id}</dd>
        <dt>Level</dt><dd>{c.level}</dd>
        <dt>Experience</dt><dd>{c.experience.toLocaleString()}</dd>
        <dt>Status</dt><dd>{#if c.online}<span class="badge ok">online</span>{:else}offline{/if}</dd>
      </dl>
    </section>
    <section class="card">
      <h2>Location</h2>
      <dl class="kv">
        <dt>Area</dt><dd>{c.area}</dd>
        <dt>Start state</dt><dd>{c.start_state}</dd>
        <dt>Intro done</dt><dd>{c.intro_done ? 'yes' : 'no'}</dd>
        {#if c.location}
          <dt>Saved seed</dt><dd>{c.location.seed}</dd>
          <dt>Saved position</dt><dd>{c.location.x}, {c.location.y}</dd>
        {:else}
          <dt>Saved position</dt><dd class="muted">none</dd>
        {/if}
      </dl>
    </section>
  </div>
  {#if features.inventory}
    <section class="card empty"><h2>Inventory</h2><p class="muted">Waiting for the inventory work.</p></section>
  {/if}
  {#if features.passives}
    <section class="card empty"><h2>Passive tree</h2><p class="muted">Waiting for the inventory work.</p></section>
  {/if}
{:else if res.error}
  <p class="err" role="alert">{res.error}</p>
{:else}
  <p class="muted">Loading...</p>
{/if}
