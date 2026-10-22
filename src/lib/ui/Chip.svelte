<script lang="ts">
  import type { Snippet } from 'svelte';
  import Icon, { type IconName } from './Icon.svelte';
  let {
    tone = 'neutral',
    icon,
    dot = false,
    pulse = false,
    title,
    children,
  }: {
    tone?: 'neutral' | 'ok' | 'warn' | 'bad' | 'info' | 'accent';
    icon?: IconName;
    dot?: boolean;
    pulse?: boolean;
    title?: string;
    children?: Snippet;
  } = $props();
</script>

<span class="chip {tone}" class:pulse {title}>
  {#if dot}<i class="dot"></i>{/if}
  {#if icon}<Icon name={icon} size={12} />{/if}
  {@render children?.()}
</span>
