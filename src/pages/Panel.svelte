<script lang="ts">
  import PageHead from '../lib/ui/PageHead.svelte';
  import Empty from '../lib/ui/Empty.svelte';
  import type { IconName } from '../lib/ui/Icon.svelte';

  let { title, flag, icon }: { title: string; flag: string; icon: IconName } = $props();
</script>

<PageHead {title} {icon} />
<Empty {icon} title="Waiting for the inventory work">
  This panel is a stub. It is shown because <code>{flag}</code> is set; the server has no endpoint for it yet.
</Empty>
