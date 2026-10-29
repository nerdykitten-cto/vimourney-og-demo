<script lang="ts">
  import { isWorldUnlocked, levelStars, sandboxUnlocked, worldCleared, worldStars } from '@kbm/shared';
  import { pkg, save } from '../game';

  let { onLevel, onSandbox, onBack }: { onLevel: (id: string) => void; onSandbox: () => void; onBack: () => void } = $props();

  const worlds = pkg.worlds;
  const sandboxOpen = sandboxUnlocked(worlds, save);
</script>

<main class="map">
  <nav>
    <button type="button" class="ghost" onclick={onBack}>← Back</button>
    <span class="grow"></span>
    <span class="total">★ {save.totalStars()}</span>
  </nav>
  <h1>{pkg.name}</h1>

  {#each worlds as world, wi (world.id)}
    {@const open = isWorldUnlocked(worlds, wi, save)}
    {@const stars = worldStars(world, save)}
    <section class="world" class:locked={!open}>
      <header>
        <div>
          <h2><span class="n">{wi + 1}</span>{world.title}{#if worldCleared(world, save)}<span class="done">cleared</span>{/if}</h2>
          <p>{world.flavor}</p>
        </div>
        <span class="wstars">★ {stars.got}/{stars.max}</span>
      </header>
      {#if open}
        <div class="levels">
          {#each world.levels as level, li (level.id)}
            {@const got = levelStars(save, level)}
            <button type="button" class="tile" class:solved={got > 0} onclick={() => onLevel(level.id)}>
              <span class="idx">{li + 1}</span>
              <span class="name">{level.title}</span>
              <span class="st">{#each [1, 2, 3] as s (s)}<span class:on={s <= got}>★</span>{/each}</span>
            </button>
          {/each}
        </div>
      {:else}
        <p class="lock">🔒 Clear “{worlds[wi - 1]!.title}” to unlock.</p>
      {/if}
    </section>
  {/each}

  <section class="world sandbox" class:locked={!sandboxOpen}>
    <header>
      <div>
        <h2>Sandbox</h2>
        <p>Free play with every key, plus the key, register and range displays.</p>
      </div>
    </header>
    {#if sandboxOpen}
      <button type="button" class="tile" onclick={onSandbox}><span class="name">Open the sandbox</span></button>
    {:else}
      <p class="lock">🔒 Clear “{worlds[0]!.title}” to unlock.</p>
    {/if}
  </section>
</main>

<style>
  .map {
    max-width: 880px;
    margin: 0 auto;
    padding: 1rem 16px 3rem;
  }
  nav {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .grow {
    flex: 1;
  }
  .total {
    color: var(--star);
  }
  h1 {
    margin: 0.5rem 0 1.2rem;
    color: var(--accent);
    text-shadow: var(--glow);
  }
  .ghost {
    padding: 0.3rem 0.8rem;
    cursor: pointer;
    background: transparent;
    border: 1px solid var(--line);
    border-radius: 6px;
    color: var(--dim);
  }
  .ghost:hover {
    color: var(--fg);
    border-color: var(--accent);
  }
  .world {
    margin-bottom: 1rem;
    padding: 1rem 1.1rem 1.1rem;
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 12px;
  }
  .world.locked {
    opacity: 0.55;
  }
  header {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 0.8rem;
  }
  h2 {
    margin: 0 0 0.25rem;
    font-size: 1.1rem;
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }
  .n {
    display: inline-grid;
    place-items: center;
    width: 1.6rem;
    height: 1.6rem;
    border-radius: 50%;
    background: var(--panel-2);
    border: 1px solid var(--line);
    font-size: 0.85rem;
    color: var(--accent);
  }
  .done {
    font-size: 0.7rem;
    color: var(--accent);
    border: 1px solid var(--accent);
    border-radius: 999px;
    padding: 0 0.5rem;
    font-weight: 400;
  }
  header p {
    margin: 0;
    color: var(--dim);
    max-width: 58ch;
  }
  .wstars {
    color: var(--star);
    white-space: nowrap;
  }
  .levels {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr));
    gap: 0.6rem;
  }
  .tile {
    display: grid;
    grid-template-columns: auto 1fr;
    grid-template-areas: 'idx name' '. st';
    gap: 0.1rem 0.6rem;
    align-items: center;
    padding: 0.6rem 0.8rem;
    text-align: left;
    cursor: pointer;
    background: var(--panel-2);
    border: 1px solid var(--line);
    border-radius: 8px;
    transition: border-color 0.15s, transform 0.15s var(--ease);
  }
  .tile:hover {
    border-color: var(--accent);
    transform: translateY(-1px);
  }
  .tile.solved {
    border-color: color-mix(in srgb, var(--star) 35%, var(--line));
  }
  .idx {
    grid-area: idx;
    color: var(--dim);
  }
  .name {
    grid-area: name;
  }
  .st {
    grid-area: st;
    letter-spacing: 0.15em;
    color: var(--line);
    font-size: 0.85rem;
  }
  .st .on {
    color: var(--star);
  }
  .lock {
    margin: 0;
    color: var(--dim);
  }
  .sandbox .tile {
    grid-template-areas: 'name';
    grid-template-columns: 1fr;
    max-width: 16rem;
  }
</style>
