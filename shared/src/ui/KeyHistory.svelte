<script lang="ts">
  import type { EngineState } from '../engine';
  import { keyLabel } from '../keys';

  let { view, limit = 14 }: { view: EngineState; limit?: number } = $props();

  const recent = $derived(view.keyLog.slice(-limit).map((e, i, a) => ({ ...e, id: view.keyLog.length - a.length + i })));
</script>

<section class="panel" aria-label="Keystroke history">
  <h3>Keys</h3>
  <div class="strip">
    {#each recent as k (k.id)}
      <kbd class="k {k.mode === 'insert' ? 'insert' : k.mode.startsWith('visual') ? 'visual' : 'normal'}">{keyLabel(k.key)}</kbd>
    {:else}
      <span class="empty">Press a key…</span>
    {/each}
  </div>
</section>

<style>
  .panel {
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 10px;
    padding: 0.7rem 0.9rem 0.9rem;
  }
  h3 {
    margin: 0 0 0.55rem;
    font-size: 0.72rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--dim);
    font-weight: 600;
  }
  .strip {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    min-height: 2rem;
  }
  .k {
    min-width: 1.9rem;
    padding: 0.2rem 0.45rem;
    text-align: center;
    font: inherit;
    font-size: 0.9rem;
    border-radius: 6px;
    background: var(--panel-2);
    border: 1px solid var(--line);
    border-bottom-width: 3px;
    animation: pop 0.2s var(--ease);
  }
  .k.normal {
    color: var(--normal);
    border-color: color-mix(in srgb, var(--normal) 40%, var(--line));
  }
  .k.insert {
    color: var(--insert);
    border-color: color-mix(in srgb, var(--insert) 40%, var(--line));
  }
  .k.visual {
    color: var(--visual);
    border-color: color-mix(in srgb, var(--visual) 40%, var(--line));
  }
  .empty {
    color: var(--dim);
    font-size: 0.85rem;
  }
  @keyframes pop {
    from {
      transform: translateY(-4px) scale(1.15);
      opacity: 0.4;
    }
  }
</style>
