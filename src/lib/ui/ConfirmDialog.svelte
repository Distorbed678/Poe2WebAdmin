<script lang="ts">
  import { confirms } from '../notify.svelte';

  let dialog: HTMLDialogElement | undefined = $state();
  const titleId = $props.id();
  const req = $derived(confirms.current);

  $effect(() => {
    if (!dialog) return;
    if (req && !dialog.open) dialog.showModal();
    else if (!req && dialog.open) dialog.close();
  });
</script>

<dialog
  bind:this={dialog}
  role="alertdialog"
  aria-labelledby={titleId}
  oncancel={() => confirms.answer(false)}
  onclose={() => confirms.current && confirms.answer(false)}
>
  {#if req}
    <div class="dialog-body">
      <h2 id={titleId}>{req.title}</h2>
      <p>{req.message}</p>
      <div class="actions">
        <!-- svelte-ignore a11y_autofocus -->
        <button type="button" autofocus onclick={() => confirms.answer(false)}>Cancel</button>
        <button type="button" class={req.danger ? 'danger' : 'primary'} onclick={() => confirms.answer(true)}>
          {req.confirmLabel}
        </button>
      </div>
    </div>
  {/if}
</dialog>
