<script lang="ts">
  import type { Snippet } from 'svelte';
  import Icon, { type IconName } from './Icon.svelte';

  let {
    open = $bindable(false),
    title,
    icon,
    danger = false,
    children,
  }: { open?: boolean; title: string; icon?: IconName; danger?: boolean; children: Snippet } = $props();

  const titleId = $props.id();
  let dialog: HTMLDialogElement | undefined = $state();

  // The native <dialog> traps focus, closes on Escape and restores focus to the opener.
  $effect(() => {
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  });
</script>

<dialog
  bind:this={dialog}
  class="modal"
  aria-labelledby={titleId}
  onclose={() => (open = false)}
  onclick={(e) => {
    if (e.target === dialog) open = false;
  }}
>
  {#if open}
    <div class="dialog-body">
      <div class="dialog-head">
        {#if icon}<span class="dialog-icon" class:danger><Icon name={icon} size={20} /></span>{/if}
        <h2 id={titleId}>{title}</h2>
      </div>
      {@render children()}
    </div>
  {/if}
</dialog>
