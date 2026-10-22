<script lang="ts">
  import type { Snippet } from 'svelte';
  let { checked = $bindable(false), children }: { checked?: boolean; children: Snippet } = $props();
</script>

<label class="switch">
  <input type="checkbox" role="switch" bind:checked />
  <span class="track"><span class="thumb"></span></span>
  <span>{@render children()}</span>
</label>
