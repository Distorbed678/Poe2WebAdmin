<script lang="ts">
  import { api, unwrap } from '../lib/api/client';
  import { Resource } from '../lib/resource.svelte';
  import { features } from '../lib/features';
  import PageHead from '../lib/ui/PageHead.svelte';
  import Status from '../lib/ui/Status.svelte';
  import Icon from '../lib/ui/Icon.svelte';
  import Chip from '../lib/ui/Chip.svelte';
  import Empty from '../lib/ui/Empty.svelte';
  import Spinner from '../lib/ui/Spinner.svelte';

  let { id }: { id: string } = $props();

  const res = new Resource(() => unwrap(api.GET('/api/v1/admin/characters/{id}', { params: { path: { id: Number(id) } } })));
  $effect(() => {
    void id;
    return res.start(5000);
  });
  const c = $derived(res.data);
</script>

<PageHead title={c ? c.name : `Character ${id}`} subtitle="Character detail" icon="characters">
  <Status {res} />
  <a class="btn sm" href={c?.account ? '#/characters?account=' + encodeURIComponent(c.account) : '#/characters'}>Back to list</a>
</PageHead>

{#if c}
  <div class="two">
    <section class="card">
      <div class="card-head"><span class="head-icon"><Icon name="characters" size={16} /></span><h2>Character</h2></div>
      <dl class="kv">
        <dt>Id</dt><dd>{c.id}</dd>
        <dt>Name</dt><dd>{c.name}</dd>
        <dt>Account</dt><dd>{c.account ?? '-'} <span class="muted">(#{c.account_id})</span></dd>
        <dt>League</dt><dd>{c.league}</dd>
        <dt>Class id</dt><dd>{c.class_id}</dd>
        <dt>Level</dt><dd>{c.level}</dd>
        <dt>Experience</dt><dd>{c.experience.toLocaleString()}</dd>
        <dt>Status</dt><dd>{#if c.online}<Chip tone="ok" dot pulse>online</Chip>{:else}<Chip>offline</Chip>{/if}</dd>
      </dl>
    </section>
    <section class="card">
      <div class="card-head"><span class="head-icon"><Icon name="instances" size={16} /></span><h2>Location</h2></div>
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
    <div class="section"><Empty icon="inventory" title="Inventory">Waiting for the inventory work.</Empty></div>
  {/if}
  {#if features.passives}
    <div class="section"><Empty icon="passives" title="Passive tree">Waiting for the inventory work.</Empty></div>
  {/if}
{:else if res.error}
  <div class="notice danger" role="alert"><span class="notice-title"><Icon name="alert" size={16} /> {res.error}</span></div>
{:else}
  <div class="loading"><Spinner size={20} /> Loading...</div>
{/if}
