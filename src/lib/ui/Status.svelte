<script lang="ts">
  import type { Resource } from '../resource.svelte';

  let { res }: { res: Resource<unknown> } = $props();
</script>

<span class="status" aria-live="polite">
  {#if res.error}
    <span class="err" role="alert">Error: {res.error}</span>
  {:else if res.updated}
    <span class="muted">Updated {res.updated.toLocaleTimeString()}</span>
  {:else}
    <span class="muted">Loading...</span>
  {/if}
</span>
