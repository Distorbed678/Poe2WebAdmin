<script lang="ts">
  import { confirms } from '../notify.svelte';
  import Icon from './Icon.svelte';

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
  class="modal"
  role="alertdialog"
  aria-labelledby={titleId}
  oncancel={() => confirms.answer(false)}
  onclose={() => confirms.current && confirms.answer(false)}
>
  {#if req}
    <div class="dialog-body">
      <div class="dialog-head">
        <span class="dialog-icon" class:danger={req.danger}><Icon name={req.danger ? 'alert' : 'info'} size={20} /></span>
        <h2 id={titleId}>{req.title}</h2>
      </div>
      <div class="dialog-msg"><p>{req.message}</p></div>
      <div class="actions">
        <!-- svelte-ignore a11y_autofocus -->
        <button type="button" class="btn" autofocus onclick={() => confirms.answer(false)}>Cancel</button>
        <button type="button" class="btn {req.danger ? 'danger solid' : 'primary'}" onclick={() => confirms.answer(true)}>
          {req.confirmLabel}
        </button>
      </div>
    </div>
  {/if}
</dialog>
