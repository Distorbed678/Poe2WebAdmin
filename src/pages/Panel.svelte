<script lang="ts">
  import PageHead from '../lib/ui/PageHead.svelte';

  let { title, flag }: { title: string; flag: string } = $props();
</script>

<PageHead {title} />
<section class="card empty">
  <p>Waiting for the inventory work.</p>
  <p class="muted">
    This panel is a stub. It is shown because <code>{flag}</code> is set; the server has no endpoint for it yet.
  </p>
</section>
