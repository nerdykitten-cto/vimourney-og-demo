<script lang="ts">
  import type { Snippet } from 'svelte';
  import { normalizeKey } from '../keys';

  let {
    onKey,
    onRestart,
    children,
  }: {
    onKey: (key: string) => void;
    onRestart: () => void;
    children: Snippet;
  } = $props();

  let root: HTMLDivElement | undefined = $state();
  let focused = $state(false);
  const canFullscreen = typeof document !== 'undefined' && document.fullscreenEnabled === true;

  $effect(() => {
    root?.focus();
  });

  function keydown(e: KeyboardEvent): void {
    if (e.altKey && !e.ctrlKey && !e.metaKey && e.key.toLowerCase() === 'r') {
      e.preventDefault();
      onRestart();
      return;
    }
    const key = normalizeKey(e);
    if (key === null) return;
    // Everything we understand is ours: stop Tab moving focus, Ctrl-chords opening browser features, etc.
    e.preventDefault();
    e.stopPropagation();
    onKey(key);
  }

  function fullscreen(e: MouseEvent): void {
    e.stopPropagation();
    void document.documentElement.requestFullscreen?.().finally(() => root?.focus());
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
<div
  class="gate"
  bind:this={root}
  tabindex="0"
  role="application"
  aria-label="Game area. Click to focus, then type."
  onkeydown={keydown}
  onfocus={() => (focused = true)}
  onblur={() => (focused = false)}
  onclick={() => root?.focus()}
>
  {@render children()}
  {#if !focused}
    <div class="veil">
      <div class="card">
        <strong>Click here, then type</strong>
        <span>Keys only count while this area has focus.</span>
        {#if canFullscreen}
          <button type="button" onclick={fullscreen}>Fullscreen</button>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .gate {
    position: relative;
    outline: none;
  }
  .veil {
    position: absolute;
    inset: -0.5rem;
    z-index: 10;
    display: grid;
    place-items: center;
    background: color-mix(in srgb, var(--bg) 78%, transparent);
    backdrop-filter: blur(3px);
    border-radius: 14px;
    cursor: pointer;
  }
  .card {
    display: grid;
    gap: 0.5rem;
    justify-items: center;
    padding: 1.2rem 1.8rem;
    background: var(--panel);
    border: 1px solid var(--accent);
    border-radius: 12px;
    box-shadow: var(--glow);
    text-align: center;
  }
  .card strong {
    color: var(--accent);
    font-size: 1.1rem;
  }
  .card span {
    color: var(--dim);
    font-size: 0.85rem;
  }
  .card button {
    margin-top: 0.3rem;
    padding: 0.3rem 0.9rem;
    background: transparent;
    border: 1px solid var(--line);
    border-radius: 6px;
    cursor: pointer;
  }
  .card button:hover {
    border-color: var(--accent);
  }
</style>
