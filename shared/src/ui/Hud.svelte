<script lang="ts">
  import { starsFor, twoStarLimit } from '../scoring';

  let {
    title,
    brief,
    keystrokes,
    par,
    solved,
  }: { title: string; brief: string; keystrokes: number; par: number; solved: boolean } = $props();

  const over = $derived(keystrokes > par);
  const stars = $derived(starsFor(Math.max(keystrokes, 1), par));
  const tone = $derived(keystrokes <= par ? 'good' : keystrokes <= twoStarLimit(par) ? 'ok' : 'bad');
</script>

<header class="hud">
  <div class="mission">
    <h2>{title}</h2>
    <p>{brief}</p>
  </div>
  <div class="score" aria-live="polite">
    <div class="count {tone}" class:over>
      <span class="n">{keystrokes}</span>
      <span class="of">/ par {par}</span>
    </div>
    <div class="stars" aria-label="{stars} stars at this pace">
      {#each [1, 2, 3] as s (s)}
        <span class:on={s <= stars && (keystrokes > 0 || solved)}>★</span>
      {/each}
    </div>
  </div>
</header>

<style>
  .hud {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1.5rem;
    margin-bottom: 0.9rem;
  }
  h2 {
    margin: 0 0 0.25rem;
    font-size: 1.15rem;
    color: var(--accent);
    text-shadow: var(--glow);
  }
  p {
    margin: 0;
    color: var(--fg);
    max-width: 52ch;
  }
  .score {
    text-align: right;
    flex-shrink: 0;
  }
  .count {
    display: flex;
    align-items: baseline;
    gap: 0.4rem;
    justify-content: flex-end;
  }
  .n {
    font-size: 1.9rem;
    font-weight: 700;
    line-height: 1;
    transition: color 0.2s;
  }
  .of {
    color: var(--dim);
    font-size: 0.85rem;
  }
  .good .n {
    color: var(--accent);
  }
  .ok .n {
    color: var(--warn);
  }
  .bad .n {
    color: var(--bad);
  }
  .stars {
    font-size: 1.1rem;
    letter-spacing: 0.15em;
    color: var(--line);
  }
  .stars .on {
    color: var(--star);
    text-shadow: 0 0 8px var(--star);
  }
</style>
