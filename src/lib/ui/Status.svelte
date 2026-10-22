<script lang="ts">
  import type { Resource } from '../resource.svelte';
  import Spinner from './Spinner.svelte';

  let { res }: { res: Resource<unknown> } = $props();
</script>

<span class="status" aria-live="polite">
  {#if res.error}
    <span class="err" role="alert">{res.error}</span>
  {:else if res.updated}
    <span class="muted">Updated {res.updated.toLocaleTimeString()}</span>
  {:else}
    <span class="muted"><Spinner size={12} /> Loading</span>
  {/if}
</span>
