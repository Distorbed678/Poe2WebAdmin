<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    open = $bindable(false),
    title,
    children,
  }: { open?: boolean; title: string; children: Snippet } = $props();

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
  aria-labelledby={titleId}
  onclose={() => (open = false)}
  onclick={(e) => {
    if (e.target === dialog) open = false;
  }}
>
  {#if open}
    <div class="dialog-body">
      <h2 id={titleId}>{title}</h2>
      {@render children()}
    </div>
  {/if}
</dialog>
