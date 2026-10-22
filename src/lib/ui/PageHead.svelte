<script lang="ts">
  import type { Snippet } from 'svelte';
  import Icon, { type IconName } from './Icon.svelte';

  let { title, subtitle, icon, children }: { title: string; subtitle?: string; icon?: IconName; children?: Snippet } = $props();
</script>

<header class="page-head">
  <div class="page-title">
    {#if icon}<span class="page-icon"><Icon name={icon} size={20} /></span>{/if}
    <div>
      <h1>{title}</h1>
      {#if subtitle}<p class="muted">{subtitle}</p>{/if}
    </div>
  </div>
  {#if children}<div class="toolbar">{@render children()}</div>{/if}
</header>
