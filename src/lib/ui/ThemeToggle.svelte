<script lang="ts">
  import { theme } from '../theme.svelte';
  import Icon from './Icon.svelte';
</script>

<button
  type="button"
  class="btn icon ghost"
  title={theme.current === 'dark' ? 'Switch to the light theme' : 'Switch to the dark theme'}
  aria-label={theme.current === 'dark' ? 'Switch to the light theme' : 'Switch to the dark theme'}
  onclick={() => theme.toggle()}
>
  <Icon name={theme.current === 'dark' ? 'sun' : 'moon'} size={18} />
</button>
