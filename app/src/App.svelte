<script lang="ts">
  import { findLevel } from '@kbm/shared';
  import { pkg } from './game';
  import Play from './screens/Play.svelte';
  import Title from './screens/Title.svelte';
  import WorldMap from './screens/WorldMap.svelte';

  type Screen = { name: 'title' } | { name: 'map' } | { name: 'play'; levelId: string } | { name: 'sandbox' };
  let screen = $state<Screen>({ name: 'title' });

  const current = $derived(screen.name === 'play' ? findLevel(pkg.worlds, screen.levelId) : null);
</script>

{#if screen.name === 'title'}
  <Title onPlay={() => (screen = { name: 'map' })} />
{:else if screen.name === 'map'}
  <WorldMap
    onLevel={(id) => (screen = { name: 'play', levelId: id })}
    onSandbox={() => (screen = { name: 'sandbox' })}
    onBack={() => (screen = { name: 'title' })}
  />
{:else if screen.name === 'sandbox'}
  {#key 'sandbox'}
    <Play level={null} onMap={() => (screen = { name: 'map' })} onLevel={() => {}} />
  {/key}
{:else if current}
  {#key current.level.id}
    <Play level={current.level} onMap={() => (screen = { name: 'map' })} onLevel={(id) => (screen = { name: 'play', levelId: id })} />
  {/key}
{/if}
