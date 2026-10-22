<script lang="ts">
  import { type DiffLine, diffLines, diffStats, hunks } from '../diff';

  let { before, after, context = 3 }: { before: string; after: string; context?: number } = $props();

  const lines = $derived(diffLines(before, after));
  const stats = $derived(diffStats(lines));
  const shown = $derived(hunks(lines, context));

  const mark = (l: DiffLine) => (l.kind === 'add' ? '+' : l.kind === 'del' ? '-' : ' ');
</script>

<div class="diff" role="group" aria-label="Changes">
  {#if shown.length === 0}
    <p class="diff-empty muted">No changes.</p>
  {:else}
    <p class="diff-stats">
      <span class="add">+{stats.added}</span> <span class="del">-{stats.removed}</span> lines
    </p>
    <div class="diff-body">
      {#each shown as h, i (i)}
        {#if i > 0}<div class="diff-gap" aria-hidden="true">...</div>{/if}
        {#each h.lines as l (`${l.oldNo ?? ''}-${l.newNo ?? ''}-${l.kind}`)}
          <div class="dl {l.kind}">
            <span class="no">{l.oldNo ?? ''}</span><span class="no">{l.newNo ?? ''}</span>
            <span class="mk" aria-hidden="true">{mark(l)}</span>
            <span class="tx">{l.text || ' '}</span>
            {#if l.kind !== 'same'}<span class="sr-only">{l.kind === 'add' ? 'added' : 'removed'}</span>{/if}
          </div>
        {/each}
      {/each}
    </div>
  {/if}
</div>
