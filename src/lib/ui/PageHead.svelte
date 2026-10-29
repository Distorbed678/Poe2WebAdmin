<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { IconName } from './Icon.svelte';

  // `icon` is accepted for the callers but not drawn: the serif headings stand on their own.
  let { title, subtitle, children }: { title: string; subtitle?: string; icon?: IconName; children?: Snippet } = $props();
</script>

<header class="page-head">
  <div class="page-title">
    <h1>{title}</h1>
    {#if subtitle}<p class="muted">{subtitle}</p>{/if}
  </div>
  {#if children}<div class="toolbar">{@render children()}</div>{/if}
</header>
