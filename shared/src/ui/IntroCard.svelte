<script lang="ts">
  import type { EngineFactory, EngineState, Pos } from '../engine';
  import { keyLabel } from '../keys';
  import { computeReplay } from '../replay';
  import EditorView from './EditorView.svelte';

  let {
    title,
    keys,
    body,
    demo = undefined,
    createEngine = undefined,
    onStart,
  }: {
    title: string;
    keys: string[];
    body: string;
    demo?: { lines: string[]; cursor?: Pos; keys: string[] };
    createEngine?: EngineFactory;
    onStart: () => void;
  } = $props();

  const states = $derived<EngineState[]>(demo && createEngine ? computeReplay(createEngine, { lines: demo.lines, cursor: demo.cursor }, demo.keys) : []);
  let step = $state(0);

  // Loop the demo: one key every 650ms, then a pause on the final state.
  $effect(() => {
    const n = states.length;
    if (n === 0) return;
    step = 0;
    const timer = setInterval(() => {
      step = step >= n + 1 ? 0 : step + 1;
    }, 650);
    return () => clearInterval(timer);
  });
  const shown = $derived(states.length ? states[Math.min(step, states.length - 1)]! : null);
</script>

<div class="card" role="dialog" aria-label="New command: {title}">
  <div class="tag">New</div>
  <h3>{title}</h3>
  <div class="keys">
    {#each keys as k, i (i)}
      <kbd>{keyLabel(k)}</kbd>
    {/each}
  </div>
  <p>{body}</p>
  {#if shown}
    <div class="demo" aria-hidden="true">
      <EditorView view={shown} />
    </div>
  {/if}
  <button type="button" onclick={onStart}>Got it <kbd>⏎</kbd></button>
</div>

<style>
  .card {
    position: relative;
    display: grid;
    gap: 0.7rem;
    width: min(30rem, 100%);
    padding: 1.2rem 1.4rem;
    background: var(--panel);
    border: 1px solid var(--normal);
    border-radius: 12px;
    box-shadow: 0 0 22px color-mix(in srgb, var(--normal) 30%, transparent);
  }
  .tag {
    position: absolute;
    top: -0.65rem;
    left: 1rem;
    padding: 0.05rem 0.6rem;
    border-radius: 999px;
    background: var(--normal);
    color: #05080c;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }
  h3 {
    margin: 0.2rem 0 0;
    font-size: 1.1rem;
  }
  .keys {
    display: flex;
    gap: 0.4rem;
  }
  kbd {
    min-width: 2.1rem;
    padding: 0.25rem 0.55rem;
    text-align: center;
    font: inherit;
    border-radius: 6px;
    background: var(--panel-2);
    border: 1px solid var(--line);
    border-bottom-width: 3px;
    color: var(--normal);
  }
  p {
    margin: 0;
    line-height: 1.5;
  }
  .demo :global(.editor) {
    min-height: 0;
    padding: 0.5rem 0.8rem;
    font-size: 0.95rem;
  }
  button {
    justify-self: start;
    display: inline-flex;
    gap: 0.5rem;
    align-items: center;
    padding: 0.4rem 0.9rem;
    cursor: pointer;
    background: var(--panel-2);
    border: 1px solid var(--normal);
    border-radius: 8px;
  }
  button kbd {
    min-width: 0;
    padding: 0 0.3rem;
    font-size: 0.8rem;
  }
</style>
